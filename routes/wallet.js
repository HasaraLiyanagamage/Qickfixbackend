const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const walletService = require('../services/walletService');

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
 * Get wallet balance and summary
 * GET /api/wallet
 */
router.get('/', auth, async (req, res) => {
  try {
    const summary = await walletService.getSummary(req.user.userId);
    res.json({
      success: true,
      wallet: summary
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Add money to wallet
 * POST /api/wallet/add-money
 * body: { amount, paymentMethod, transactionId }
 */
router.post('/add-money', auth, async (req, res) => {
  try {
    const { amount, paymentMethod = 'card', transactionId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const transaction = await walletService.addMoney(req.user.userId, amount, {
      paymentMethod,
      transactionId
    });

    res.json({
      success: true,
      message: `LKR ${amount} added to wallet`,
      transaction,
      newBalance: transaction.balanceAfter
    });
  } catch (error) {
    console.error('Add money error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Get transaction history
 * GET /api/wallet/transactions
 * query: { limit, skip, category, startDate, endDate }
 */
router.get('/transactions', auth, async (req, res) => {
  try {
    const { limit, skip, category, startDate, endDate } = req.query;

    const transactions = await walletService.getTransactions(req.user.userId, {
      limit: parseInt(limit) || 50,
      skip: parseInt(skip) || 0,
      category,
      startDate,
      endDate
    });

    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Pay for booking using wallet
 * POST /api/wallet/pay
 * body: { bookingId, amount }
 */
router.post('/pay', auth, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({ message: 'Booking ID and amount are required' });
    }

    // Check sufficient balance
    const hasSufficient = await walletService.hasSufficientBalance(req.user.userId, amount);
    if (!hasSufficient) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    const transaction = await walletService.payForBooking(req.user.userId, bookingId, amount);

    res.json({
      success: true,
      message: 'Payment successful',
      transaction,
      remainingBalance: transaction.balanceAfter
    });
  } catch (error) {
    console.error('Wallet payment error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Check if user has sufficient balance
 * GET /api/wallet/check-balance/:amount
 */
router.get('/check-balance/:amount', auth, async (req, res) => {
  try {
    const amount = parseFloat(req.params.amount);
    const hasSufficient = await walletService.hasSufficientBalance(req.user.userId, amount);
    const balance = await walletService.getBalance(req.user.userId);

    res.json({
      success: true,
      hasSufficientBalance: hasSufficient,
      currentBalance: balance,
      requiredAmount: amount,
      shortfall: hasSufficient ? 0 : amount - balance
    });
  } catch (error) {
    console.error('Check balance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
