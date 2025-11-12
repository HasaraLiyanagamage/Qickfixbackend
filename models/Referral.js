const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  referred: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    firstBookingCompleted: {
      type: Boolean,
      default: false
    },
    rewardClaimed: {
      type: Boolean,
      default: false
    }
  }],
  totalReferrals: {
    type: Number,
    default: 0
  },
  successfulReferrals: {
    type: Number,
    default: 0
  },
  totalRewardsEarned: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const ReferralRewardSchema = new mongoose.Schema({
  referral: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
    required: true
  },
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referred: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rewardType: {
    type: String,
    enum: ['credit', 'discount', 'cashback'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'credited', 'expired'],
    default: 'pending'
  },
  creditedAt: Date,
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes
ReferralSchema.index({ referrer: 1 });
ReferralSchema.index({ referralCode: 1 });
ReferralRewardSchema.index({ referrer: 1, status: 1 });

const Referral = mongoose.model('Referral', ReferralSchema);
const ReferralReward = mongoose.model('ReferralReward', ReferralRewardSchema);

module.exports = { Referral, ReferralReward };
