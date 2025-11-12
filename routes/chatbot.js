const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');

const CHATBOT_SERVICE_URL = process.env.CHATBOT_SERVICE_URL || 'https://quickfix-chatbot.onrender.com';

// Chat with bot
router.post('/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }
    
    // Call Python chatbot service
    const response = await axios.post(`${CHATBOT_SERVICE_URL}/chat`, {
      message,
      userId: req.user.id,
      sessionId: req.sessionID || 'default'
    }, {
      timeout: 10000 // 10 second timeout
    });
    
    // Save conversation to database (optional)
    // await ChatMessage.create({
    //   user: req.user.id,
    //   message,
    //   response: response.data.message,
    //   intent: response.data.intent,
    //   timestamp: new Date()
    // });
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Chatbot error:', error.message);
    
    // Fallback response if chatbot service is down
    res.json({
      message: "I'm currently experiencing technical difficulties. Please try again in a moment, or contact our support team for immediate assistance.",
      intent: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get chatbot health status
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${CHATBOT_SERVICE_URL}/health`, {
      timeout: 5000
    });
    res.json(response.data);
  } catch (error) {
    res.status(503).json({
      status: 'unavailable',
      message: 'Chatbot service is currently unavailable'
    });
  }
});

// Get available intents
router.get('/intents', async (req, res) => {
  try {
    const response = await axios.get(`${CHATBOT_SERVICE_URL}/intents`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch intents' });
  }
});

// Get FAQ
router.get('/faq', async (req, res) => {
  try {
    const response = await axios.get(`${CHATBOT_SERVICE_URL}/faq`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch FAQ' });
  }
});

module.exports = router;
