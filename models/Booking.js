const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
  serviceType: { type: String, required: true }, // plumbing, electrical, etc.
  status: { type: String, enum: ['requested','matched','accepted','in_progress','completed','cancelled'], default: 'requested' },
  location: {
    address: String,
    lat: Number,
    lng: Number
  },
  requestedAt: { type: Date, default: Date.now },
  etaMinutes: { type: Number },
  priceEstimate: { type: Number },
  rating: { 
    score: { type: Number, min: 1, max: 5 },
    review: { type: String },
    ratedAt: { type: Date }
  }
});

module.exports = mongoose.model('Booking', BookingSchema);
