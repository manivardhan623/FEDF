const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware for HTTP routes
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please log in to continue' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found. Please log in again.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth token error:', error.message);
    
    // Distinguish between expired and invalid tokens
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token has expired',
        message: 'Your session has expired. Please log in again.' 
      });
    }
    
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'Authentication failed. Please log in again.' 
    });
  }
};

// Middleware for Socket.IO connections
const authenticateSocket = async (socket, next) => {
  try {
    console.log('Authenticating socket:', socket.id);
    const token = socket.handshake.auth.token;
    console.log('Token received:', token ? 'Token exists' : 'No token');

    if (!token) {
      console.log('No token provided for socket:', socket.id);
      return next(new Error('Authentication error: No token provided'));
    }

    console.log('Verifying token...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token decoded successfully:', decoded.userId);
    
    const user = await User.findById(decoded.userId);
    console.log('User found:', user ? user.username : 'No user');

    if (!user) {
      console.log('Invalid token - user not found:', decoded.userId);
      return next(new Error('Authentication error: Invalid token'));
    }

    // Attach user info to socket
    socket.userId = user._id.toString();
    socket.username = user.username;
    socket.email = user.email;

    console.log('Socket authenticated successfully:', user.username);

    // Update user online status
    await User.findByIdAndUpdate(user._id, { 
      isOnline: true, 
      lastSeen: new Date() 
    });

    next();
  } catch (error) {
    console.error('Socket authentication failed:', error.message);
    next(new Error('Authentication error: Invalid or expired token'));
  }
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' }); // Extended to 30 days
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  generateToken,
  JWT_SECRET
};
