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

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  if (!phone) return true; // Optional field
  const phoneRegex = /^(\+94|0)?[0-9]{9,10}$/;
  return phoneRegex.test(phone);
};

const validateName = (name) => {
  return name && name.trim().length >= 2 && name.trim().length <= 100;
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, skills, lat, lng, address } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format. Please enter a valid email address (e.g., user@example.com)' 
      });
    }
    
    // Validate name
    if (!validateName(name)) {
      return res.status(400).json({ 
        message: 'Name must be between 2 and 100 characters' 
      });
    }
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long' 
      });
    }
    
    // Validate phone if provided
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ 
        message: 'Invalid phone number format. Use format: +94XXXXXXXXX or 0XXXXXXXXX' 
      });
    }
    
    // Validate coordinates if provided
    if (lat !== undefined && (lat < -90 || lat > 90)) {
      return res.status(400).json({ 
        message: 'Invalid latitude. Must be between -90 and 90' 
      });
    }
    
    if (lng !== undefined && (lng < -180 || lng > 180)) {
      return res.status(400).json({ 
        message: 'Invalid longitude. Must be between -180 and 180' 
      });
    }
    
    // Validate role
    const validRoles = ['user', 'technician', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ 
        message: 'Invalid role. Must be: user, technician, or admin' 
      });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user with validated data
    const userData = { 
      name: name.trim(), 
      email: email.toLowerCase().trim(), 
      passwordHash, 
      phone: phone?.trim(), 
      role: role || 'user'
    };
    if (address) userData.address = address.trim();
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
    res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name, role: user.role }});
  } catch (e) {
    console.error('Registration error:', e);
    
    // Handle Mongoose validation errors
    if (e.name === 'ValidationError') {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors 
      });
    }
    
    // Handle duplicate key error
    if (e.code === 11000) {
      return res.status(400).json({ 
        message: 'Email already registered' 
      });
    }
    
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format' 
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
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

// Social Login (Google, Apple, etc.)
router.post('/social-login', async (req, res) => {
  try {
    const { email, name, provider } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ message: 'Missing email or name' });
    }
    
    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format from social provider' 
      });
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      // Create new user for social login
      // No password hash needed for social login users
      user = new User({
        name,
        email,
        role: 'user', // Default role for social login
        passwordHash: await bcrypt.hash(Math.random().toString(36), 10), // Random hash (not used)
        socialProvider: provider
      });
      await user.save();
      console.log(`New user created via ${provider} login:`, user._id);
    } else {
      // Update social provider if not set
      if (!user.socialProvider) {
        user.socialProvider = provider;
        await user.save();
      }
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      }
    });
  } catch (e) {
    console.error('Social login error:', e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

module.exports = router;
