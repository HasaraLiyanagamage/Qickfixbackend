const express = require('express');
const Technician = require('../models/Technician');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secretjwt';
const mongoose = require('mongoose');

// Simple middleware
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

// Debug endpoint to list all technicians
router.get('/debug/all', async (req, res) => {
  try {
    const techs = await Technician.find().populate('user', 'name email phone');
    const summary = techs.map(t => ({
      id: t._id,
      name: t.user?.name,
      email: t.user?.email,
      skills: t.skills,
      isAvailable: t.isAvailable,
      location: t.location,
      rating: t.rating
    }));
    
    res.json({
      total: techs.length,
      technicians: summary
    });
  } catch (e) {
    console.error('Debug endpoint error:', e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Ensure geospatial index exists
router.get('/debug/ensure-index', async (req, res) => {
  try {
    await Technician.collection.createIndex({ location: '2dsphere' });
    const indexes = await Technician.collection.indexes();
    res.json({
      message: 'Index ensured',
      indexes: indexes
    });
  } catch (e) {
    console.error('Index creation error:', e);
    res.status(500).json({ message: 'Error creating index', error: e.message });
  }
});

// Update technician location and availability
router.post('/update-location', auth, async (req, res) => {
  try {
    if (req.user.role !== 'technician') return res.status(403).json({ message: 'Not a technician' });
    const { lat, lng, isAvailable } = req.body;
    const user = await User.findById(req.user.userId);
    const tech = await Technician.findOne({ user: user._id });
    if (!tech) return res.status(404).json({ message: 'Technician profile not found' });

    tech.location = { type: 'Point', coordinates: [lng, lat] };
    if (typeof isAvailable === 'boolean') tech.isAvailable = isAvailable;
    tech.updatedAt = new Date();
    await tech.save();

    res.json({ ok: true, tech });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// List available technicians (optionally filter by service)
router.get('/available', async (req, res) => {
  try {
    const { lat, lng, radiusKm = 50, skill } = req.query;
    
    console.log('=== AVAILABLE TECHNICIANS REQUEST ===');
    console.log('Request params:', { lat, lng, radiusKm, skill });
    
    // First, let's check total technicians in DB
    const totalTechs = await Technician.countDocuments();
    const availableTechs = await Technician.countDocuments({ isAvailable: true });
    console.log(`Total technicians in DB: ${totalTechs}`);
    console.log(`Available technicians: ${availableTechs}`);
    
    // Build base query
    const baseQuery = { isAvailable: true };
    
    // Add skill filter if provided - use case-insensitive regex
    if (skill) {
      baseQuery.skills = { 
        $regex: new RegExp(skill, 'i')
      };
      
      // Check how many have this skill
      const withSkill = await Technician.countDocuments(baseQuery);
      console.log(`Technicians with skill "${skill}": ${withSkill}`);
      
      // If no technicians with this skill, return empty array early
      if (withSkill === 0) {
        console.log('No technicians found with the requested skill');
        return res.json([]);
      }
    }
    
    console.log('Base query:', JSON.stringify(baseQuery));
    
    // Get all matching technicians first
    let technicians = await Technician.find(baseQuery)
      .limit(100)
      .populate('user', 'name phone')
      .lean();
    
    console.log(`Found ${technicians.length} technicians matching base criteria`);
    
    // If we have lat/lng, calculate distances and filter by radius
    if (lat && lng && technicians.length > 0) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxRadius = parseFloat(radiusKm);
      
      console.log(`Calculating distances from (${userLat}, ${userLng})`);
      
      // Calculate distance for each technician
      technicians = technicians.map(tech => {
        if (tech.location && tech.location.coordinates && tech.location.coordinates.length === 2) {
          const [techLng, techLat] = tech.location.coordinates;
          
          // Haversine formula for distance calculation
          const R = 6371; // Earth's radius in km
          const dLat = (techLat - userLat) * Math.PI / 180;
          const dLng = (techLng - userLng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(userLat * Math.PI / 180) * Math.cos(techLat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          tech.distance = R * c;
          
          console.log(`Technician ${tech.user?.name}: ${tech.distance.toFixed(2)}km away at (${techLat}, ${techLng})`);
        } else {
          tech.distance = 999999; // No valid location
          console.log(`Technician ${tech.user?.name}: No valid location`);
        }
        return tech;
      });
      
      // Sort by distance (closest first)
      technicians.sort((a, b) => a.distance - b.distance);
      
      // Filter by radius
      const beforeFilter = technicians.length;
      technicians = technicians.filter(t => t.distance <= maxRadius);
      console.log(`After radius filter (${maxRadius}km): ${technicians.length}/${beforeFilter} technicians`);
    }
    
    console.log(`Returning ${technicians.length} technicians`);
    res.json(technicians);
  } catch (e) {
    console.error('Error in /available endpoint:', e);
    console.error('Stack trace:', e.stack);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Get technician profile
router.get('/profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'technician') {
      return res.status(403).json({ message: 'Access denied. Technicians only.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find or create technician profile
    let technician = await Technician.findOne({ user: user._id })
      .populate('user', 'name email phone');

    if (!technician) {
      // Create a default technician profile if not exists
      technician = new Technician({
        user: user._id,
        skills: [],
        rating: 5,
        isAvailable: true,
        location: {
          type: 'Point',
          coordinates: [0, 0]
        }
      });
      await technician.save();
      technician = await technician.populate('user', 'name email phone');
    }

    // Calculate total jobs (this is a simplified example)
    const totalJobs = await mongoose.model('Booking').countDocuments({
      technician: technician._id,
      status: 'completed'
    });

    res.json({
      user: {
        _id: technician.user._id,
        name: technician.user.name,
        email: technician.user.email,
        phone: technician.user.phone
      },
      skills: technician.skills,
      rating: technician.rating,
      isAvailable: technician.isAvailable,
      totalJobs,
      location: technician.location
    });
  } catch (error) {
    console.error('Error fetching technician profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update technician profile
router.put('/update-profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'technician') {
      return res.status(403).json({ message: 'Access denied. Technicians only.' });
    }

    const { name, phone, skills, isAvailable, lat, lng } = req.body;
    const updates = {};
    
    // Update user info if provided
    if (name || phone) {
      const userUpdate = {};
      if (name) userUpdate.name = name;
      if (phone) userUpdate.phone = phone;
      await User.findByIdAndUpdate(req.user.userId, userUpdate);
    }

    // Find technician profile
    let technician = await Technician.findOne({ user: req.user.userId });
    
    if (!technician) {
      // Create new technician profile if not exists
      technician = new Technician({
        user: req.user.userId,
        skills: Array.isArray(skills) ? skills : [],
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        location: {
          type: 'Point',
          coordinates: [lng || 0, lat || 0]
        }
      });
    } else {
      // Update existing profile
      if (skills !== undefined) {
        technician.skills = Array.isArray(skills) 
          ? skills 
          : (typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : []);
      }
      if (isAvailable !== undefined) technician.isAvailable = isAvailable;
      if (lat !== undefined && lng !== undefined) {
        technician.location = {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        };
      }
    }

    technician.updatedAt = new Date();
    await technician.save();

    // Populate user data for response
    const updatedTech = await Technician.findById(technician._id)
      .populate('user', 'name email phone');

    res.json({
      message: 'Profile updated successfully',
      profile: {
        user: {
          name: updatedTech.user.name,
          email: updatedTech.user.email,
          phone: updatedTech.user.phone
        },
        skills: updatedTech.skills,
        isAvailable: updatedTech.isAvailable,
        location: updatedTech.location,
        rating: updatedTech.rating
      }
    });
  } catch (error) {
    console.error('Error updating technician profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get technician feedbacks/ratings
router.get('/feedbacks', auth, async (req, res) => {
  try {
    if (req.user.role !== 'technician') {
      return res.status(403).json({ message: 'Access denied. Technicians only.' });
    }

    // Find technician profile
    const technician = await Technician.findOne({ user: req.user.userId });
    if (!technician) {
      return res.json({ feedbacks: [] });
    }

    // Get all completed bookings with ratings for this technician
    const Booking = mongoose.model('Booking');
    const bookings = await Booking.find({
      technician: technician._id,
      rating: { $exists: true, $ne: null }
    })
    .populate('user', 'name')
    .sort({ updatedAt: -1 })
    .limit(50);

    // Format feedbacks
    const feedbacks = bookings.map(booking => ({
      _id: booking._id,
      rating: booking.rating || 0,
      comment: booking.comment || '',
      userName: booking.user?.name || 'Anonymous',
      serviceType: booking.serviceType || 'Service',
      createdAt: booking.updatedAt || booking.createdAt,
      bookingId: booking._id
    }));

    res.json({ feedbacks });
  } catch (error) {
    console.error('Error fetching technician feedbacks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
