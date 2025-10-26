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

      // Emit socket to technician room to notify
      const io = req.app.get('io');
      io.to(`tech_${chosen._id}`).emit('booking:assigned', { bookingId: booking._id, user: { name: user.name, lat, lng, address } });

      return res.json({ booking, technician: chosen });
    } else {
      // No tech found
      booking.status = 'requested';
      await booking.save();
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
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const tech = await Technician.findOne({ user: req.user.userId });
    if (!tech) return res.status(404).json({ message: 'Tech not found' });

    if (booking.technician && booking.technician.toString() !== tech._id.toString()) return res.status(403).json({ message: 'Not assigned to you' });

    booking.status = 'accepted';
    await booking.save();

    // Notify user via socket (room user_<userId>)
    const io = req.app.get('io');
    io.emit('booking:accepted', { bookingId: booking._id, techId: tech._id });

    res.json({ ok: true, booking });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
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

module.exports = router;
