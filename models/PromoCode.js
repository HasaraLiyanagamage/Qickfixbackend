const mongoose = require('mongoose');

const PromoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  maxDiscount: {
    type: Number // Maximum discount for percentage type
  },
  minBookingAmount: {
    type: Number,
    default: 0
  },
  usageLimit: {
    total: { type: Number }, // Total usage limit
    perUser: { type: Number, default: 1 } // Per user limit
  },
  usedCount: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  applicableServices: [{
    type: String // Empty array means all services
  }],
  applicableUserTypes: [{
    type: String,
    enum: ['new', 'existing', 'all'],
    default: 'all'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster lookups
PromoCodeSchema.index({ code: 1 });
PromoCodeSchema.index({ validFrom: 1, validUntil: 1 });

module.exports = mongoose.model('PromoCode', PromoCodeSchema);
