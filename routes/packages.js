const express = require('express');
const router = express.Router();
const ServicePackage = require('../models/ServicePackage');
const Booking = require('../models/Booking');

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

// Get all active packages
router.get('/', auth, async (req, res) => {
  try {
    const packages = await ServicePackage.find({ isActive: true })
      .sort({ price: 1 });
    
    res.json({ packages });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get package by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const package = await ServicePackage.findById(req.params.id);
    
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json({ package });
  } catch (error) {
    console.error('Get package error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Book a package
router.post('/:id/book', auth, async (req, res) => {
  try {
    const packageId = req.params.id;
    const { location, scheduledDate, scheduledTime, technicianId } = req.body;
    
    console.log('=== Package Booking ===');
    console.log('Package ID:', packageId);
    console.log('User ID:', req.user.id || req.user.userId);
    console.log('Technician ID:', technicianId);
    console.log('Location:', location);
    
    // Get package details
    const package = await ServicePackage.findById(packageId);
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    if (!package.isActive) {
      return res.status(400).json({ error: 'Package is not available' });
    }
    
    // Handle userId compatibility
    const userId = req.user.id || req.user.userId;
    
    // Create booking with package details
    const booking = new Booking({
      user: userId,
      technician: technicianId || null,
      serviceType: package.name,
      description: `Package: ${package.name} - ${package.services.join(', ')}`,
      location: location || {},
      packageId: packageId,
      pricing: {
        totalFare: package.price,
        estimatedDuration: package.duration,
      },
      scheduledDate: scheduledDate || new Date(),
      scheduledTime: scheduledTime || 'ASAP',
      status: technicianId ? 'accepted' : 'pending',
      payment: {
        status: 'pending',
        method: null
      }
    });
    
    await booking.save();
    
    // Populate user and technician for response
    await booking.populate('user', 'name email');
    if (technicianId) {
      await booking.populate('technician');
    }
    
    res.json({ 
      success: true,
      message: 'Package booked successfully',
      booking: {
        id: booking._id.toString(),
        _id: booking._id,
        ...booking.toObject()
      }
    });
  } catch (error) {
    console.error('Book package error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Create package
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, description, type, price, duration, services, discount } = req.body;
    
    const package = new ServicePackage({
      name,
      description,
      type,
      price,
      duration,
      services,
      discount: discount || 0
    });
    
    await package.save();
    
    res.json({ 
      success: true,
      message: 'Package created successfully',
      package
    });
  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update package
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, description, type, price, duration, services, discount, isActive } = req.body;
    
    const package = await ServicePackage.findByIdAndUpdate(
      req.params.id,
      { name, description, type, price, duration, services, discount, isActive },
      { new: true }
    );
    
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Package updated successfully',
      package
    });
  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete package
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Soft delete by setting isActive to false
    const package = await ServicePackage.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
