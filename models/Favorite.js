const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technician',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  notes: String,
  bookingCount: {
    type: Number,
    default: 0
  },
  lastBookedAt: Date
}, {
  timestamps: true
});

// Compound index to ensure unique user-technician pairs
FavoriteSchema.index({ user: 1, technician: 1 }, { unique: true });
FavoriteSchema.index({ user: 1, addedAt: -1 });

module.exports = mongoose.model('Favorite', FavoriteSchema);
