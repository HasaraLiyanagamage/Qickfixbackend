const mongoose = require('mongoose');

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UserSchema = new mongoose.Schema({
  name: { 
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name must be less than 100 characters']
  },
  email: { 
    type: String, 
    unique: true, 
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return emailRegex.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  passwordHash: { 
    type: String, 
    required: [true, 'Password is required']
  },
  phone: { 
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return /^(\+94|0)?[0-9]{9,10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  address: { type: String, trim: true },
  lat: { 
    type: Number,
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90']
  },
  lng: { 
    type: Number,
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180']
  },
  role: { 
    type: String, 
    enum: {
      values: ['user', 'technician', 'admin'],
      message: '{VALUE} is not a valid role'
    },
    default: 'user' 
  },
  socialProvider: { type: String },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorCode: { type: String },
  twoFactorCodeExpiry: { type: Date },
  twoFactorMethod: { 
    type: String, 
    enum: {
      values: ['sms', 'email'],
      message: '{VALUE} is not a valid 2FA method'
    }
  },
  createdAt: { type: Date, default: Date.now }
});

// Index for faster email lookups
UserSchema.index({ email: 1 });

module.exports = mongoose.model('User', UserSchema);
