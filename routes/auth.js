const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Technician = require('../models/Technician');

const router = express.Router();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, skills, lat, lng, address } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already used' });

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user with address and coordinates if provided
    const userData = { name, email, passwordHash, phone, role };
    if (address) userData.address = address;
    if (lat !== undefined) userData.lat = parseFloat(lat);
    if (lng !== undefined) userData.lng = parseFloat(lng);
    
    const user = new User(userData);
    await user.save();

    if (role === 'technician') {
      // Use provided coordinates or default to [0,0]
      const coordinates = (lng !== undefined && lat !== undefined) 
        ? [parseFloat(lng), parseFloat(lat)] 
        : [0, 0];
      
      console.log('Creating technician with:', {
        skills: skills || [],
        coordinates,
        isAvailable: true
      });
      
      const tech = new Technician({ 
        user: user._id, 
        skills: skills || [], 
        isAvailable: true, 
        location: { 
          type: 'Point',
          coordinates 
        }
      });
      await tech.save();
      console.log('Technician created:', tech._id);
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role }});
  } catch (e) {
    console.error('Registration error:', e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role }});
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
