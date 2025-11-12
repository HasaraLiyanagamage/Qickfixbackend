const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // For users
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // For technicians
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
    required: true,
    enum: [
      'new_booking',
      'booking_confirmed',
      'booking_accepted',
      'booking_completed',
      'booking_cancelled',
      'technician_assigned',
      'new_technician',
      'payment_received',
      'rating_received',
      'new_message',
      'system_update'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);