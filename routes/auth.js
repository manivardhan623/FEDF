const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register route
router.post('/register', [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  try {
    console.log('=== REGISTER REQUEST ===');
    console.log('Body:', req.body);
    console.log('Headers:', req.headers);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ Duplicate email registration attempt:', email);
      return res.status(400).json({
        message: 'This email is already registered. Please use a different email or sign in instead.'
      });
    }

    // Check if username is taken
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        message: 'Username is already taken'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Server error during registration'
    });
  }
});

// Login route
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    console.log('=== LOGIN REQUEST ===');
    console.log('Body:', req.body);
    console.log('Headers:', req.headers);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Update online status
    await User.findByIdAndUpdate(user._id, { 
      isOnline: true, 
      lastSeen: new Date() 
    });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Server error during login'
    });
  }
});

// Logout route
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Update user offline status
    await User.findByIdAndUpdate(req.user._id, { 
      isOnline: false, 
      lastSeen: new Date() 
    });

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      message: 'Server error during logout'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        isOnline: req.user.isOnline,
        lastSeen: req.user.lastSeen
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      message: 'Server error fetching profile'
    });
  }
});

// Get all users (for private messaging)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('username email isOnline lastSeen')
      .sort({ username: 1 });

    res.json({ users });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      message: 'Server error fetching users'
    });
  }
});

// Search users by email or username
router.get('/users/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    console.log('🔍 User search request:', {
      query: q,
      requestedBy: req.user.email
    });
    
    if (!q || q.trim().length === 0) {
      console.log('⚠️ Empty search query');
      return res.json({ users: [] });
    }
    
    const searchQuery = q.trim();
    
    // Search by username or email (case-insensitive)
    const users = await User.find({
      _id: { $ne: req.user._id }, // Exclude current user
      $or: [
        { username: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } }
      ]
    })
      .select('username email isOnline lastSeen')
      .limit(10) // Limit to 10 results
      .sort({ username: 1 });

    console.log(`✅ Found ${users.length} users matching "${searchQuery}"`);
    console.log('📋 Results:', users.map(u => ({ username: u.username, email: u.email })));

    res.json({ users });
  } catch (error) {
    console.error('❌ User search error:', error);
    res.status(500).json({
      error: 'Server error searching users'
    });
  }
});

// Update username
router.put('/update-username', authenticateToken, [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const { username } = req.body;

    // Check if username is already taken by another user
    const existingUser = await User.findOne({ 
      username, 
      _id: { $ne: req.user._id } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        error: 'Username is already taken'
      });
    }

    // Update username
    req.user.username = username;
    await req.user.save();

    res.json({
      message: 'Username updated successfully',
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({
      error: 'Server error updating username'
    });
  }
});

// Update email
router.put('/update-email', authenticateToken, [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const { email } = req.body;

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email, 
      _id: { $ne: req.user._id } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        error: 'Email is already taken'
      });
    }

    // Update email
    req.user.email = email;
    await req.user.save();

    res.json({
      message: 'Email updated successfully',
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({
      error: 'Server error updating email'
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('oldPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const { oldPassword, newPassword } = req.body;

    // Verify old password
    const isPasswordValid = await req.user.comparePassword(oldPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    // Update password
    req.user.password = newPassword;
    await req.user.save();

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Server error changing password'
    });
  }
});

// Delete account
router.delete('/delete-account', authenticateToken, [
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const { password } = req.body;

    // Verify password
    const isPasswordValid = await req.user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Incorrect password'
      });
    }

    // Delete user account
    await User.findByIdAndDelete(req.user._id);

    res.json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Server error deleting account'
    });
  }
});

module.exports = router;
