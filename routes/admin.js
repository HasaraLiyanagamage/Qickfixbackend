const express = require('express');
const User = require('../models/User');
const Technician = require('../models/Technician');
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

// Get admin profile
router.get('/profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const user = await User.findById(req.user.userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update admin profile
router.put('/update-profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const { name, phone } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, runValidators: true }
    ).select('-passwordHash');

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
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users (both regular users and technicians)
router.get('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    // Get all users from User collection
    const users = await User.find().select('-passwordHash').lean();
    
    // Get all technicians from Technician collection
    const technicians = await Technician.find().lean();
    
    // Combine and format the data
    const allUsers = [
      ...users.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        status: user.status || 'active',
        createdAt: user.createdAt
      })),
      ...technicians.map(tech => ({
        _id: tech._id,
        name: tech.name,
        email: tech.email,
        phone: tech.phone || '',
        role: 'technician',
        status: tech.status || 'active',
        rating: tech.rating || 0,
        skills: tech.skills || [],
        isAvailable: tech.isAvailable,
        createdAt: tech.createdAt
      }))
    ];

    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user status (suspend/activate)
router.patch('/users/:userId/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be "active" or "suspended"' });
    }

    // Try to find in User collection first
    let user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).select('-passwordHash');

    // If not found in User, try Technician collection
    if (!user) {
      user = await Technician.findByIdAndUpdate(
        userId,
        { status },
        { new: true }
      );
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User status updated to ${status}`,
      user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const { userId } = req.params;

    // Try to delete from User collection first
    let deletedUser = await User.findByIdAndDelete(userId);

    // If not found in User, try Technician collection
    if (!deletedUser) {
      deletedUser = await Technician.findByIdAndDelete(userId);
    }

    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Also delete all bookings associated with this user
    await Booking.deleteMany({
      $or: [
        { userId: userId },
        { technicianId: userId }
      ]
    });

    res.json({
      message: 'User deleted successfully',
      deletedUser
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get system statistics
router.get('/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const [totalUsers, totalTechnicians, totalBookings, completedBookings] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Technician.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'completed' })
    ]);

    res.json({
      totalUsers,
      totalTechnicians,
      totalBookings,
      completedBookings
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
