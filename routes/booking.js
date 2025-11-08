const express = require('express');
const Booking = require('../models/Booking');
const Technician = require('../models/Technician');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { haversineKm } = require('../utils/geo');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secretjwt';

function auth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr) return res.status(401).json({ message: 'Missing auth' });
  const token = hdr.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) { return res.status(401).json({ message: 'Invalid token' }); }
}

/**
 * Create booking and match nearest available technician (simple)
 * body: { serviceType, lat, lng, address }
 */
router.post('/request', auth, async (req, res) => {
  try {
    if (req.user.role !== 'user') return res.status(403).json({ message: 'Only customers can request' });
    const { serviceType, lat, lng, address } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const booking = new Booking({
      user: user._id,
      serviceType,
      location: { address, lat, lng },
      status: 'requested'
    });
    await booking.save();

    // Find nearest available technician with skill
    // First, fetch candidates (available technicians)
    const candidates = await Technician.find({ isAvailable: true, skills: serviceType }).populate('user');
    // If none with skill, widen to any available
    let chosen = null;
    if (candidates.length === 0) {
      const allAvail = await Technician.find({ isAvailable: true }).populate('user');
      for (const t of allAvail) {
        if (!t.location || !t.location.coordinates) continue;
        const [lngT, latT] = t.location.coordinates;
        const d = haversineKm(lat, lng, latT, lngT);
        t._distance = d;
      }
      allAvail.sort((a,b) => (a._distance || 1e9) - (b._distance || 1e9));
      chosen = allAvail[0] || null;
    } else {
      for (const t of candidates) {
        if (!t.location || !t.location.coordinates) continue;
        const [lngT, latT] = t.location.coordinates;
        const d = haversineKm(lat, lng, latT, lngT);
        t._distance = d;
      }
      candidates.sort((a,b) => a._distance - b._distance);
      chosen = candidates[0];
    }

    if (chosen) {
      booking.technician = chosen._id;
      booking.status = 'matched';
      // estimate ETA roughly: assume 40 km/h => minutes = distance(km)/40*60
      const eta = Math.round((chosen._distance || 0) / 40 * 60);
      booking.etaMinutes = eta;
      await booking.save();

      // Mark tech as not available (reserved) in simple flow
      chosen.isAvailable = false;
      await chosen.save();

      // Emit socket events to notify all parties
      const io = req.app.get('io');
      io.to(`tech_${chosen._id}`).emit('booking:assigned', { bookingId: booking._id, user: { name: user.name, lat, lng, address } });
      io.to(`user_${user._id}`).emit('booking:updated', { bookingId: booking._id, status: 'matched' });
      io.emit('booking:updated', { bookingId: booking._id, status: 'matched' });

      return res.json({ booking, technician: chosen });
    } else {
      // No tech found
      booking.status = 'requested';
      await booking.save();
      
      // Notify user that booking is created but no tech available yet
      const io = req.app.get('io');
      io.to(`user_${user._id}`).emit('booking:updated', { bookingId: booking._id, status: 'requested' });
      
      return res.status(200).json({ message: 'No technicians available nearby', booking });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept booking (technician)
router.post('/:id/accept', auth, async (req, res) => {
  try {
    if (req.user.role !== 'technician') return res.status(403).json({ message: 'Only technicians' });
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('technician').populate('user');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const tech = await Technician.findOne({ user: req.user.userId });
    if (!tech) return res.status(404).json({ message: 'Tech not found' });

    if (booking.technician && booking.technician._id.toString() !== tech._id.toString()) return res.status(403).json({ message: 'Not assigned to you' });

    booking.status = 'accepted';
    await booking.save();

    // Notify user via socket
    const io = req.app.get('io');
    io.emit('booking:accepted', { bookingId: booking._id, techId: tech._id, status: 'accepted' });
    io.emit('booking:updated', { bookingId: booking._id, status: 'accepted' });
    // Notify specific user
    if (booking.user && booking.user._id) {
      io.to(`user_${booking.user._id}`).emit('booking:status', { bookingId: booking._id, status: 'accepted' });
    }

    res.json({ ok: true, booking });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all bookings for the current user
// IMPORTANT: This must come BEFORE /:id route to avoid "user" being treated as an ID
router.get('/user', auth, async (req, res) => {
  try {
    // Only allow users to access their own bookings
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Access denied. Users only.' });
    }

    const { status } = req.query;
    const query = { user: req.user.userId };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate({
        path: 'technician',
        populate: { path: 'user', select: 'name phone email' }
      })
      .populate('user', 'name phone email')
      .sort({ requestedAt: -1 }); // Most recent first

    // Return full booking data with proper field mapping
    const formattedBookings = bookings.map(booking => ({
      _id: booking._id,
      id: booking._id,
      user: booking.user,
      technician: booking.technician,
      serviceType: booking.serviceType,
      status: booking.status,
      location: booking.location,
      createdAt: booking.requestedAt,
      requestedAt: booking.requestedAt,
      updatedAt: booking.updatedAt,
      etaMinutes: booking.etaMinutes,
      priceEstimate: booking.priceEstimate,
      totalCost: booking.priceEstimate
    }));

    res.json(formattedBookings);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ 
      message: 'Failed to fetch bookings',
      error: error.message 
    });
  }
});

// Get booking by id
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('technician').populate('user');
    if (!booking) return res.status(404).json({ message: 'Not found' });
    res.json(booking);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create booking with specific technician
router.post('/create', auth, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Only customers can create bookings' });
    }

    const { serviceType, lat, lng, address, technicianId } = req.body;
    
    if (!serviceType || !lat || !lng || !address || !technicianId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const technician = await Technician.findById(technicianId).populate('user');
    if (!technician) {
      return res.status(404).json({ message: 'Technician not found' });
    }

    // Calculate ETA
    let eta = 30; // default
    if (technician.location && technician.location.coordinates) {
      const [lngT, latT] = technician.location.coordinates;
      const distance = haversineKm(lat, lng, latT, lngT);
      eta = Math.round((distance / 40) * 60); // assume 40 km/h
    }

    const booking = new Booking({
      user: user._id,
      technician: technician._id,
      serviceType,
      location: { address, lat, lng },
      status: 'matched',
      etaMinutes: eta
    });

    await booking.save();

    // Mark technician as unavailable
    technician.isAvailable = false;
    await technician.save();

    // Notify all parties via socket
    const io = req.app.get('io');
    io.to(`tech_${technician._id}`).emit('booking:assigned', {
      bookingId: booking._id,
      user: { name: user.name, lat, lng, address }
    });
    io.to(`user_${user._id}`).emit('booking:updated', { bookingId: booking._id, status: 'matched' });
    io.emit('booking:updated', { bookingId: booking._id, status: 'matched' });

    res.json({
      message: 'Booking created successfully',
      booking: {
        id: booking._id,
        serviceType: booking.serviceType,
        status: booking.status,
        etaMinutes: booking.etaMinutes,
        location: booking.location
      },
      technician: {
        id: technician._id,
        name: technician.user.name,
        phone: technician.user.phone,
        rating: technician.rating
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      message: 'Failed to create booking',
      error: error.message
    });
  }
});

// Get technician jobs (for technician role)
router.get('/technician/jobs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'technician') {
      return res.status(403).json({ message: 'Access denied. Technicians only.' });
    }

    const technician = await Technician.findOne({ user: req.user.userId });
    if (!technician) {
      return res.status(404).json({ message: 'Technician profile not found' });
    }

    const { status } = req.query;
    const query = { technician: technician._id };
    
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name phone email')
      .sort({ requestedAt: -1 });

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching technician jobs:', error);
    res.status(500).json({
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
});

// Update booking status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id).populate('user').populate('technician');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify authorization
    if (req.user.role === 'technician') {
      const tech = await Technician.findOne({ user: req.user.userId });
      if (!tech || booking.technician._id.toString() !== tech._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    } else if (req.user.role === 'user') {
      if (booking.user._id.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    const oldStatus = booking.status;
    booking.status = status;
    await booking.save();

    // If completed, make technician available again
    if (status === 'completed' || status === 'cancelled') {
      const tech = await Technician.findById(booking.technician._id);
      if (tech) {
        tech.isAvailable = true;
        await tech.save();
      }
    }

    // Emit socket events to notify all parties
    const io = req.app.get('io');
    io.emit('booking:updated', { bookingId: booking._id, status, oldStatus });
    io.emit('booking:status', { bookingId: booking._id, status });
    
    // Notify specific user
    if (booking.user && booking.user._id) {
      io.to(`user_${booking.user._id}`).emit('booking:status', { bookingId: booking._id, status });
    }
    
    // Notify specific technician
    if (booking.technician && booking.technician._id) {
      io.to(`tech_${booking.technician._id}`).emit('booking:status', { bookingId: booking._id, status });
    }

    // Emit specific event for completion
    if (status === 'completed') {
      io.emit('booking:completed', { bookingId: booking._id });
    }

    res.json({ message: 'Status updated', booking });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Rate a completed booking
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { score, review } = req.body;
    const booking = await Booking.findById(req.params.id).populate('technician');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only the user who made the booking can rate
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Can only rate completed bookings
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed bookings' });
    }

    // Validate score
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ message: 'Score must be between 1 and 5' });
    }

    booking.rating = {
      score,
      review: review || '',
      ratedAt: new Date()
    };
    await booking.save();

    // Update technician's average rating
    if (booking.technician) {
      const tech = await Technician.findById(booking.technician._id);
      if (tech) {
        const allRatedBookings = await Booking.find({
          technician: tech._id,
          'rating.score': { $exists: true }
        });
        
        if (allRatedBookings.length > 0) {
          const avgRating = allRatedBookings.reduce((sum, b) => sum + b.rating.score, 0) / allRatedBookings.length;
          tech.rating = Math.round(avgRating * 10) / 10; // Round to 1 decimal
        }
        await tech.save();
      }
    }

    res.json({ message: 'Rating submitted successfully', booking });
  } catch (error) {
    console.error('Error rating booking:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
