const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const referralService = require('../services/referralService');

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
 * Get my referral code and stats
 * GET /api/referral/code
 */
router.get('/code', auth, async (req, res) => {
  try {
    const stats = await referralService.getReferralStats(req.user.userId);
    
    res.json({
      success: true,
      referral: stats
    });
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Apply referral code
 * POST /api/referral/apply
 * body: { code }
 */
router.post('/apply', auth, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Referral code is required' });
    }

    const result = await referralService.applyReferralCode(req.user.userId, code);

    res.json(result);
  } catch (error) {
    console.error('Apply referral code error:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * Get referral rewards
 * GET /api/referral/rewards
 */
router.get('/rewards', auth, async (req, res) => {
  try {
    const { Referral, ReferralReward } = require('../models/Referral');
    
    const rewards = await ReferralReward.find({
      $or: [
        { referrer: req.user.userId },
        { referred: req.user.userId }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('referrer', 'name')
    .populate('referred', 'name');

    res.json({
      success: true,
      rewards,
      count: rewards.length
    });
  } catch (error) {
    console.error('Get rewards error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get referral leaderboard
 * GET /api/referral/leaderboard
 */
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const leaderboard = await referralService.getLeaderboard(parseInt(limit));

    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get referral configuration (admin only)
 * GET /api/referral/config
 */
router.get('/config', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const config = referralService.getConfig();

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Update referral configuration (admin only)
 * PUT /api/referral/config
 */
router.put('/config', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    referralService.updateConfig(req.body);

    res.json({
      success: true,
      message: 'Referral configuration updated',
      config: referralService.getConfig()
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
