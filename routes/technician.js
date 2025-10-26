const express = require('express');
const Technician = require('../models/Technician');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secretjwt';

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
    const { lat, lng, radiusKm = 10, skill } = req.query;
    const query = { isAvailable: true };
    if (skill) query.skills = skill;
    // If lat/lng provided, use geoNear (requires 2dsphere index)
    if (lat && lng) {
      // simple bounding using $near
      const nearby = await Technician.find({
        ...query,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: parseFloat(radiusKm) * 1000
          }
        }
      }).limit(50).populate('user', 'name phone');
      return res.json(nearby);
    }
    const list = await Technician.find(query).limit(100).populate('user','name phone');
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
