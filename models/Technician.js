const mongoose = require('mongoose');

const TechnicianSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  skills: [String],
  rating: { type: Number, default: 5 },
  reviews: [{ user: String, rating: Number, comment: String }],
  isAvailable: { type: Boolean, default: true },
  // last known location
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0,0] } // [lng, lat]
  },
  updatedAt: { type: Date, default: Date.now }
});

TechnicianSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Technician', TechnicianSchema);
