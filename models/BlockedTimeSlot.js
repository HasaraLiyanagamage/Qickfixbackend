const mongoose = require('mongoose');

const BlockedTimeSlotSchema = new mongoose.Schema({
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technician',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
BlockedTimeSlotSchema.index({ technician: 1, date: 1 });

module.exports = mongoose.model('BlockedTimeSlot', BlockedTimeSlotSchema);
