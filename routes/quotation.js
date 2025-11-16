const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secretjwt';

// Auth middleware
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

// Technician provides quotation
router.post('/:bookingId/provide', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { laborCost, materialsCost, additionalCosts, notes } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify technician is assigned to this booking
    if (booking.technician.toString() !== req.user.technicianId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Calculate total estimate
    let totalEstimate = (laborCost || 0) + (materialsCost || 0);
    if (additionalCosts && Array.isArray(additionalCosts)) {
      additionalCosts.forEach(cost => {
        totalEstimate += cost.amount || 0;
      });
    }

    // Update booking with quotation
    booking.quotation = {
      laborCost: laborCost || 0,
      materialsCost: materialsCost || 0,
      additionalCosts: additionalCosts || [],
      totalEstimate,
      notes: notes || '',
      providedAt: new Date(),
      providedBy: req.user.technicianId,
      status: 'pending'
    };
    booking.status = 'quoted';

    await booking.save();

    // TODO: Send notification to user about new quotation

    res.json({
      success: true,
      message: 'Quotation provided successfully',
      quotation: booking.quotation
    });
  } catch (error) {
    console.error('Provide quotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// User approves quotation
router.post('/:bookingId/approve', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!booking.quotation || booking.quotation.status !== 'pending') {
      return res.status(400).json({ error: 'No pending quotation to approve' });
    }

    // Approve quotation
    booking.quotation.status = 'approved';
    booking.quotation.approvedAt = new Date();
    booking.status = 'quote_approved';

    // Update pricing with quotation amount
    booking.pricing.totalFare = booking.quotation.totalEstimate;

    await booking.save();

    // TODO: Send notification to technician that work can start

    res.json({
      success: true,
      message: 'Quotation approved successfully',
      booking
    });
  } catch (error) {
    console.error('Approve quotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// User rejects quotation
router.post('/:bookingId/reject', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify user owns this booking
    if (booking.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!booking.quotation || booking.quotation.status !== 'pending') {
      return res.status(400).json({ error: 'No pending quotation to reject' });
    }

    // Reject quotation
    booking.quotation.status = 'rejected';
    booking.quotation.rejectedReason = reason || 'No reason provided';
    booking.status = 'inspecting'; // Back to inspecting status

    await booking.save();

    // TODO: Send notification to technician to revise quotation

    res.json({
      success: true,
      message: 'Quotation rejected. Technician will revise.',
      booking
    });
  } catch (error) {
    console.error('Reject quotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get quotation details
router.get('/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .populate('user', 'name email phone')
      .populate('technician')
      .populate('quotation.providedBy', 'name');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify user has access to this booking
    const isUser = booking.user._id.toString() === req.user.userId;
    const isTechnician = booking.technician && booking.technician._id.toString() === req.user.technicianId;

    if (!isUser && !isTechnician) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Get quotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
