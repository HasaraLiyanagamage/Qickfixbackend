const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Booking = require('../models/Booking');

// Middleware to verify JWT token
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quickfix_secret_key_2024');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get messages for a booking
router.get('/booking/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    // Verify user has access to this booking
    const booking = await Booking.findById(bookingId).populate('user technician');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check if user is part of this booking
    const isUser = booking.user && booking.user._id.toString() === req.userId;
    const isTechnician = booking.technician && booking.technician.user && 
                         booking.technician.user.toString() === req.userId;
    
    if (!isUser && !isTechnician) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const messages = await Message.find({ booking: bookingId })
      .populate('sender', 'name email')
      .sort({ timestamp: 1 });
    
    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message
router.post('/send', auth, async (req, res) => {
  try {
    const { bookingId, message } = req.body;
    
    if (!bookingId || !message) {
      return res.status(400).json({ error: 'Booking ID and message are required' });
    }
    
    // Verify booking exists and user has access
    const booking = await Booking.findById(bookingId).populate('user technician');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Determine sender role
    const isUser = booking.user && booking.user._id.toString() === req.userId;
    const isTechnician = booking.technician && booking.technician.user && 
                         booking.technician.user.toString() === req.userId;
    
    if (!isUser && !isTechnician) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const senderRole = isUser ? 'user' : 'technician';
    
    const newMessage = new Message({
      booking: bookingId,
      sender: req.userId,
      senderRole,
      message
    });
    
    await newMessage.save();
    await newMessage.populate('sender', 'name email');
    
    // Emit socket event to notify the other party
    const io = req.app.get('io');
    if (io) {
      const recipientId = isUser ? booking.technician?.user : booking.user?._id;
      if (recipientId) {
        io.to(`user_${recipientId.toString()}`).emit('message:new', {
          bookingId,
          message: newMessage
        });
      }
    }
    
    res.json(newMessage);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark messages as read
router.patch('/read/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    await Message.updateMany(
      { 
        booking: bookingId,
        sender: { $ne: req.userId },
        read: false
      },
      { read: true }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
