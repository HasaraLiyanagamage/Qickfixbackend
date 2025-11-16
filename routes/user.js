const express = require('express');
const User = require('../models/User');
const Booking = require('../models/Booking');
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
  } catch (e) { 
    return res.status(401).json({ message: 'Invalid token' }); 
  }
}

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Access denied. Users only.' });
    }

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      address: user.address || ''
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/update-profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Access denied. Users only.' });
    }

    const { name, phone, address } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        address: user.address || ''
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get service history
router.get('/service-history', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build query
    const query = {
      user: req.user.userId,
      status: 'completed'
    };
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Get completed bookings with populated technician user data
    const history = await Booking.find(query)
      .populate({
        path: 'technician',
        populate: {
          path: 'user',
          select: 'name phone email'
        }
      })
      .sort({ createdAt: -1 });
    
    res.json({ history });
  } catch (error) {
    console.error('Error fetching service history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get favorites (moved from separate route)
router.get('/favorites', auth, async (req, res) => {
  try {
    const Favorite = require('../models/Favorite');
    
    const favorites = await Favorite.find({ user: req.user.userId })
      .populate({
        path: 'technician',
        select: 'serviceType rating totalReviews skills user',
        populate: {
          path: 'user',
          select: 'name email phone'
        }
      })
      .sort({ createdAt: -1 });
    
    res.json({ favorites });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add favorite
router.post('/favorites', auth, async (req, res) => {
  try {
    const Favorite = require('../models/Favorite');
    const { technicianId } = req.body;
    
    if (!technicianId) {
      return res.status(400).json({ error: 'Technician ID required' });
    }
    
    // Check if already in favorites
    const existing = await Favorite.findOne({
      user: req.user.userId,
      technician: technicianId
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Already in favorites' });
    }
    
    // Create favorite
    const favorite = new Favorite({
      user: req.user.userId,
      technician: technicianId
    });
    
    await favorite.save();
    
    res.json({ 
      success: true,
      message: 'Added to favorites',
      favorite
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove favorite
router.delete('/favorites/:technicianId', auth, async (req, res) => {
  try {
    const Favorite = require('../models/Favorite');
    const { technicianId } = req.params;
    
    const result = await Favorite.findOneAndDelete({
      user: req.user.userId,
      technician: technicianId
    });
    
    if (!result) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
