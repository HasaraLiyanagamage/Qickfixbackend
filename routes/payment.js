const express = require('express');
const router = express.Router();
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

// Initialize Stripe (only if key is provided)
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  console.log('Stripe not configured:', error.message);
}

// Create payment intent
router.post('/create-intent', auth, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service not configured' });
    }
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // amount in cents
      currency: 'lkr',
      metadata: { 
        bookingId,
        userId: req.user.id 
      }
    });
    
    res.json({
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment
router.post('/confirm', auth, async (req, res) => {
  try {
    const { bookingId, paymentIntentId } = req.body;
    
    // Find and update booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Update booking with payment info
    booking.paymentStatus = 'paid';
    booking.paymentMethod = 'card';
    booking.paymentIntentId = paymentIntentId;
    booking.paidAt = new Date();
    await booking.save();
    
    res.json({ 
      success: true,
      message: 'Payment confirmed successfully'
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm cash payment (user initiates)
router.post('/cash', auth, async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    // Find and update booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Verify user owns this booking
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Update booking for cash payment - awaiting technician confirmation
    booking.payment.method = 'cash';
    booking.payment.status = 'pending'; // Waiting for technician to confirm receipt
    booking.status = 'payment_pending';
    await booking.save();
    
    res.json({ 
      success: true,
      message: 'Cash payment initiated. Waiting for technician confirmation.'
    });
  } catch (error) {
    console.error('Cash payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm card payment (user initiates)
router.post('/card', auth, async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    // Find and update booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Verify user owns this booking
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Update booking for card payment - awaiting technician confirmation
    booking.payment.method = 'card';
    booking.payment.status = 'pending'; // Waiting for technician to confirm receipt
    booking.status = 'payment_pending';
    await booking.save();
    
    res.json({ 
      success: true,
      message: 'Card payment initiated. Waiting for technician confirmation.'
    });
  } catch (error) {
    console.error('Card payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Technician confirms payment received
router.post('/confirm-received', auth, async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate('technician');
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Verify technician is assigned to this booking
    const Technician = require('../models/Technician');
    const technician = await Technician.findOne({ user: req.user.id });
    
    if (!technician || booking.technician._id.toString() !== technician._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Verify payment is pending
    if (booking.payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment is not pending confirmation' });
    }
    
    // Mark payment as completed
    booking.payment.status = 'completed';
    booking.payment.paidAt = new Date();
    booking.status = 'completed';
    await booking.save();
    
    res.json({ 
      success: true,
      message: 'Payment confirmed successfully',
      booking
    });
  } catch (error) {
    console.error('Confirm payment received error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.user.id,
      'payment.status': 'completed'
    })
    .populate('technician')
    .populate('user', 'name email')
    .sort({ 'payment.paidAt': -1 });
    
    // Format payment history
    const payments = bookings.map(booking => ({
      _id: booking._id,
      bookingId: booking._id,
      serviceType: booking.serviceType,
      amount: booking.quotation?.totalEstimate || booking.pricing?.totalFare || 0,
      paymentMethod: booking.payment.method,
      paidAt: booking.payment.paidAt,
      technician: booking.technician ? {
        name: booking.technician.user?.name || 'Unknown',
        phone: booking.technician.phone
      } : null,
      status: booking.status,
      location: booking.location
    }));
    
    res.json({ payments });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
