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

// Confirm cash payment
router.post('/cash', auth, async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    // Find and update booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Update booking for cash payment
    booking.paymentMethod = 'cash';
    booking.paymentStatus = 'pending'; // Will be marked as paid after service completion
    await booking.save();
    
    res.json({ 
      success: true,
      message: 'Cash payment method selected'
    });
  } catch (error) {
    console.error('Cash payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.user.id,
      paymentStatus: 'paid'
    })
    .populate('technician', 'name')
    .sort({ paidAt: -1 });
    
    res.json({ payments: bookings });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
