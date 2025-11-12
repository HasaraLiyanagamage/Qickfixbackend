const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  booking: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking', 
    required: true,
    index: true
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  senderRole: { 
    type: String, 
    enum: ['user', 'technician', 'admin'], 
    required: true 
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'voice', 'location', 'system'],
    default: 'text'
  },
  message: { 
    type: String 
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'voice', 'document']
    },
    url: String,
    filename: String,
    size: Number
  }],
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  read: { 
    type: Boolean, 
    default: false 
  },
  readAt: Date,
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Indexes for better query performance
MessageSchema.index({ booking: 1, timestamp: -1 });
MessageSchema.index({ sender: 1, timestamp: -1 });
MessageSchema.index({ read: 1 });

module.exports = mongoose.model('Message', MessageSchema);
