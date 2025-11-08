require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketio = require('socket.io');
const authRoutes = require('./routes/auth');
const techRoutes = require('./routes/technician');
const bookingRoutes = require('./routes/booking');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const messageRoutes = require('./routes/message');

const app = express();

// CORS configuration - allow all origins for development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

const server = http.createServer(app);
const io = socketio(server, {
  cors: { origin: "*" }
});

// attach io to app for routes/controllers that need it
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/technician', techRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/message', messageRoutes);

io.on('connection', socket => {
  console.log('Socket connected', socket.id);

  // User joins their personal room
  socket.on('user:join', ({ userId }) => {
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined room user_${userId}`);
  });

  // Technician location updates - technician should join room with their techId
  socket.on('tech:join', ({ techId }) => {
    socket.join(`tech_${techId}`);
    console.log(`Socket ${socket.id} joined room tech_${techId}`);
  });

  socket.on('tech:location', data => {
    const room = `tech_${data.techId}`;
    io.to(room).emit('tech:location', data);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';


mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected successfully');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
  });
