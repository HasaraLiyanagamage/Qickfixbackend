const express = require('express');
const router = express.Router();
const Favorite = require('../models/Favorite');
const Technician = require('../models/Technician');

// Middleware to verify JWT token
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get user's favorites
router.get('/', auth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.id })
      .populate({
        path: 'technician',
        select: 'name email phone serviceType rating totalReviews skills'
      })
      .sort({ createdAt: -1 });
    
    res.json({ favorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add favorite
router.post('/', auth, async (req, res) => {
  try {
    const { technicianId } = req.body;
    
    if (!technicianId) {
      return res.status(400).json({ error: 'Technician ID required' });
    }
    
    // Check if technician exists
    const technician = await Technician.findById(technicianId);
    if (!technician) {
      return res.status(404).json({ error: 'Technician not found' });
    }
    
    // Check if already in favorites
    const existing = await Favorite.findOne({
      user: req.user.id,
      technician: technicianId
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Already in favorites' });
    }
    
    // Create favorite
    const favorite = new Favorite({
      user: req.user.id,
      technician: technicianId
    });
    
    await favorite.save();
    
    res.json({ 
      success: true,
      message: 'Added to favorites',
      favorite
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove favorite
router.delete('/:technicianId', auth, async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    const result = await Favorite.findOneAndDelete({
      user: req.user.id,
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
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if technician is favorited
router.get('/check/:technicianId', auth, async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    const favorite = await Favorite.findOne({
      user: req.user.id,
      technician: technicianId
    });
    
    res.json({ 
      isFavorite: !!favorite
    });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
