const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Middleware to verify JWT token
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Initialize Twilio (only if credentials are provided)
let twilioClient;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
} catch (error) {
  console.log('Twilio not configured:', error.message);
}

// Initialize Nodemailer
let emailTransporter;
try {
  const nodemailer = require('nodemailer');
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} catch (error) {
  console.log('Email service not configured:', error.message);
}

// Send 2FA code
router.post('/send', auth, async (req, res) => {
  try {
    const { method } = req.body; // 'sms' or 'email'
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save code with 5-minute expiry
    user.twoFactorCode = code;
    user.twoFactorCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    user.twoFactorMethod = method;
    await user.save();
    
    if (method === 'sms') {
      if (!twilioClient) {
        return res.status(503).json({ error: 'SMS service not configured' });
      }
      
      if (!user.phone) {
        return res.status(400).json({ error: 'Phone number not set' });
      }
      
      try {
        await twilioClient.messages.create({
          body: `Your QuickFix verification code is: ${code}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: user.phone
        });
      } catch (error) {
        console.error('SMS send error:', error);
        return res.status(500).json({ error: 'Failed to send SMS' });
      }
    } else if (method === 'email') {
      if (!emailTransporter) {
        return res.status(503).json({ error: 'Email service not configured' });
      }
      
      try {
        await emailTransporter.sendMail({
          from: process.env.EMAIL_USER || 'noreply@quickfix.com',
          to: user.email,
          subject: 'QuickFix Verification Code',
          html: `
            <h2>QuickFix Verification</h2>
            <p>Your verification code is:</p>
            <h1 style="color: #2196F3; font-size: 32px; letter-spacing: 5px;">${code}</h1>
            <p>This code will expire in 5 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          `
        });
      } catch (error) {
        console.error('Email send error:', error);
        return res.status(500).json({ error: 'Failed to send email' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid method' });
    }
    
    res.json({ 
      success: true,
      message: `Verification code sent via ${method}`
    });
  } catch (error) {
    console.error('Send 2FA code error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify 2FA code
router.post('/verify', auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if code exists and not expired
    if (!user.twoFactorCode || !user.twoFactorCodeExpiry) {
      return res.status(400).json({ error: 'No verification code found' });
    }
    
    if (user.twoFactorCodeExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification code expired' });
    }
    
    // Verify code
    if (user.twoFactorCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Clear code after successful verification
    user.twoFactorCode = undefined;
    user.twoFactorCodeExpiry = undefined;
    await user.save();
    
    res.json({ 
      success: true,
      message: 'Verification successful'
    });
  } catch (error) {
    console.error('Verify 2FA code error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enable 2FA
router.post('/enable', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.twoFactorEnabled = true;
    await user.save();
    
    res.json({ 
      success: true,
      message: 'Two-factor authentication enabled'
    });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disable 2FA
router.post('/disable', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.twoFactorEnabled = false;
    user.twoFactorCode = undefined;
    user.twoFactorCodeExpiry = undefined;
    await user.save();
    
    res.json({ 
      success: true,
      message: 'Two-factor authentication disabled'
    });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get 2FA status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      enabled: user.twoFactorEnabled || false,
      method: user.twoFactorMethod
    });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
