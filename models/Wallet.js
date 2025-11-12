const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'LKR'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const TransactionSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['booking_payment', 'refund', 'top_up', 'referral_bonus', 'promo_credit', 'withdrawal', 'earnings'],
    required: true
  },
  description: String,
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  balanceBefore: Number,
  balanceAfter: Number,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes
WalletSchema.index({ user: 1 });
TransactionSchema.index({ wallet: 1, createdAt: -1 });
TransactionSchema.index({ booking: 1 });

const Wallet = mongoose.model('Wallet', WalletSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = { Wallet, Transaction };
