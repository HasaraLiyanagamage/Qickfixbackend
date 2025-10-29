const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  role: { type: String, enum: ['user','technician','admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
