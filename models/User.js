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
  socialProvider: { type: String }, // 'google', 'apple', etc.
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorCode: { type: String },
  twoFactorCodeExpiry: { type: Date },
  twoFactorMethod: { type: String, enum: ['sms', 'email'] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
