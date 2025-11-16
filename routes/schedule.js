const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const BlockedTimeSlot = require('../models/BlockedTimeSlot');

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

// Get technician schedule
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build query
    const query = { technician: req.user.id };
    
    if (startDate && endDate) {
      query.scheduledDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Get bookings
    const bookings = await Booking.find(query)
      .populate('user', 'name phone email')
      .sort({ scheduledDate: 1 });
    
    // Get blocked time slots
    const blockedSlots = await BlockedTimeSlot.find({
      technician: req.user.id,
      date: query.scheduledDate || { $gte: new Date() }
    }).sort({ date: 1 });
    
    res.json({ 
      schedule: bookings,
      blockedSlots
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Block time slot
router.post('/block-time', auth, async (req, res) => {
  try {
    const { date, startTime, endTime, reason } = req.body;
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Date, start time, and end time are required' });
    }
    
    // Check if slot already blocked
    const existing = await BlockedTimeSlot.findOne({
      technician: req.user.id,
      date: new Date(date),
      $or: [
        { startTime: { $lte: startTime }, endTime: { $gte: startTime } },
        { startTime: { $lte: endTime }, endTime: { $gte: endTime } }
      ]
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Time slot overlaps with existing block' });
    }
    
    // Create blocked time slot
    const blockedSlot = new BlockedTimeSlot({
      technician: req.user.id,
      date: new Date(date),
      startTime,
      endTime,
      reason: reason || ''
    });
    
    await blockedSlot.save();
    
    res.json({ 
      success: true,
      message: 'Time slot blocked successfully',
      blockedSlot
    });
  } catch (error) {
    console.error('Block time error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unblock time slot
router.delete('/unblock-time/:id', auth, async (req, res) => {
  try {
    const blockedSlot = await BlockedTimeSlot.findOneAndDelete({
      _id: req.params.id,
      technician: req.user.id
    });
    
    if (!blockedSlot) {
      return res.status(404).json({ error: 'Blocked time slot not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Time slot unblocked successfully'
    });
  } catch (error) {
    console.error('Unblock time error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available time slots for a date
router.get('/available/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date);
    
    // Get all bookings for the date
    const bookings = await Booking.find({
      technician: req.user.id,
      scheduledDate: {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lt: new Date(targetDate.setHours(23, 59, 59, 999))
      }
    });
    
    // Get blocked slots for the date
    const blockedSlots = await BlockedTimeSlot.find({
      technician: req.user.id,
      date: {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lt: new Date(targetDate.setHours(23, 59, 59, 999))
      }
    });
    
    // Generate available time slots (9 AM to 6 PM, 1-hour slots)
    const availableSlots = [];
    for (let hour = 9; hour < 18; hour++) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      
      // Check if slot is blocked
      const isBlocked = blockedSlots.some(slot => {
        const slotHour = parseInt(slot.startTime.split(':')[0]);
        return hour >= slotHour && hour < parseInt(slot.endTime.split(':')[0]);
      });
      
      // Check if slot has booking
      const hasBooking = bookings.some(booking => {
        const bookingHour = parseInt(booking.scheduledTime?.split(':')[0] || 0);
        return hour === bookingHour;
      });
      
      if (!isBlocked && !hasBooking) {
        availableSlots.push(timeSlot);
      }
    }
    
    res.json({ 
      date,
      availableSlots,
      bookedSlots: bookings.map(b => b.scheduledTime),
      blockedSlots: blockedSlots.map(s => ({ start: s.startTime, end: s.endTime }))
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
