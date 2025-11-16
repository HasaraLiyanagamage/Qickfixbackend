const mongoose = require('mongoose');

const ServicePackageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'emergency', 'subscription'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  services: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  discount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ServicePackage', ServicePackageSchema);
