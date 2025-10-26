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
  priceEstimate: { type: Number }
});

module.exports = mongoose.model('Booking', BookingSchema);
