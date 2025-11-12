const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
  serviceType: { type: String, required: true }, // plumbing, electrical, etc.
  status: { 
    type: String, 
    enum: ['requested', 'matched', 'accepted', 'in_progress', 'arrived', 'completed', 'cancelled'], 
    default: 'requested' 
  },
  
  // Location details
  location: {
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    landmark: String,
    instructions: String
  },
  
  // Pricing details
  pricing: {
    baseFare: { type: Number, default: 0 },
    distanceFare: { type: Number, default: 0 },
    serviceFare: { type: Number, default: 0 },
    surgeFare: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    promoCode: String,
    totalFare: { type: Number, default: 0 },
    currency: { type: String, default: 'LKR' }
  },
  
  // Payment details
  payment: {
    method: { type: String, enum: ['cash', 'card', 'wallet', 'online'], default: 'cash' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    transactionId: String,
    paidAt: Date,
    refundAmount: Number,
    refundedAt: Date
  },
  
  // Tracking details
  tracking: {
    technicianLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date
    },
    distance: Number, // in kilometers
    estimatedArrival: Date,
    arrivedAt: Date,
    startedAt: Date,
    completedAt: Date
  },
  
  // Timestamps
  requestedAt: { type: Date, default: Date.now },
  scheduledFor: Date, // For scheduled bookings
  etaMinutes: { type: Number },
  
  // Rating and feedback
  rating: { 
    score: { type: Number, min: 1, max: 5 },
    review: { type: String },
    ratedAt: { type: Date }
  },
  
  // Additional details
  urgency: { type: String, enum: ['normal', 'urgent', 'emergency'], default: 'normal' },
  description: String,
  images: [String], // URLs to problem images
  
  // Cancellation details
  cancellation: {
    cancelledBy: { type: String, enum: ['user', 'technician', 'admin'] },
    reason: String,
    cancelledAt: Date,
    refundIssued: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
BookingSchema.index({ user: 1, createdAt: -1 });
BookingSchema.index({ technician: 1, createdAt: -1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ 'location.lat': 1, 'location.lng': 1 });

module.exports = mongoose.model('Booking', BookingSchema);
