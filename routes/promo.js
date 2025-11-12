const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const PromoCode = require('../models/PromoCode');

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

/**
 * Get all active promo codes
 * GET /api/promo/active
 */
router.get('/active', auth, async (req, res) => {
  try {
    const promoCodes = await PromoCode.find({
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    }).select('-createdBy');

    res.json({
      success: true,
      promoCodes,
      count: promoCodes.length
    });
  } catch (error) {
    console.error('Get active promos error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Validate promo code
 * POST /api/promo/validate
 * body: { code, serviceType, bookingAmount }
 */
router.post('/validate', auth, async (req, res) => {
  try {
    const { code, serviceType, bookingAmount } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    const promo = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!promo) {
      return res.status(404).json({ 
        success: false,
        message: 'Invalid or expired promo code' 
      });
    }

    // Check service type applicability
    if (promo.applicableServices.length > 0 && 
        !promo.applicableServices.includes(serviceType)) {
      return res.status(400).json({
        success: false,
        message: 'Promo code not applicable to this service'
      });
    }

    // Check minimum booking amount
    if (bookingAmount && bookingAmount < promo.minBookingAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum booking amount of LKR ${promo.minBookingAmount} required`
      });
    }

    // Check usage limit
    if (promo.usageLimit.total && promo.usedCount >= promo.usageLimit.total) {
      return res.status(400).json({
        success: false,
        message: 'Promo code usage limit reached'
      });
    }

    // Calculate discount
    let discount = 0;
    if (bookingAmount) {
      if (promo.type === 'percentage') {
        discount = (bookingAmount * promo.value) / 100;
        if (promo.maxDiscount && discount > promo.maxDiscount) {
          discount = promo.maxDiscount;
        }
      } else {
        discount = promo.value;
      }
    }

    res.json({
      success: true,
      valid: true,
      promo: {
        code: promo.code,
        description: promo.description,
        type: promo.type,
        value: promo.value,
        maxDiscount: promo.maxDiscount,
        minBookingAmount: promo.minBookingAmount
      },
      discount: Math.round(discount)
    });
  } catch (error) {
    console.error('Validate promo error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Create promo code (admin only)
 * POST /api/promo/create
 */
router.post('/create', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const {
      code,
      description,
      type,
      value,
      maxDiscount,
      minBookingAmount,
      usageLimit,
      validFrom,
      validUntil,
      applicableServices,
      applicableUserTypes
    } = req.body;

    // Validate required fields
    if (!code || !description || !type || !value || !validFrom || !validUntil) {
      return res.status(400).json({ 
        message: 'Missing required fields' 
      });
    }

    // Check if code already exists
    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Promo code already exists' });
    }

    const promoCode = await PromoCode.create({
      code: code.toUpperCase(),
      description,
      type,
      value,
      maxDiscount,
      minBookingAmount: minBookingAmount || 0,
      usageLimit: usageLimit || {},
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      applicableServices: applicableServices || [],
      applicableUserTypes: applicableUserTypes || ['all'],
      isActive: true,
      createdBy: req.user.userId
    });

    res.json({
      success: true,
      message: 'Promo code created successfully',
      promoCode
    });
  } catch (error) {
    console.error('Create promo error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Update promo code (admin only)
 * PUT /api/promo/:id
 */
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const promo = await PromoCode.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!promo) {
      return res.status(404).json({ message: 'Promo code not found' });
    }

    res.json({
      success: true,
      message: 'Promo code updated successfully',
      promoCode: promo
    });
  } catch (error) {
    console.error('Update promo error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Deactivate promo code (admin only)
 * DELETE /api/promo/:id
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const promo = await PromoCode.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!promo) {
      return res.status(404).json({ message: 'Promo code not found' });
    }

    res.json({
      success: true,
      message: 'Promo code deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate promo error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get all promo codes (admin only)
 * GET /api/promo/all
 */
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const promoCodes = await PromoCode.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      promoCodes,
      count: promoCodes.length
    });
  } catch (error) {
    console.error('Get all promos error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
