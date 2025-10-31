const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth authentication
 * @access  Public
 */
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email']
  })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback URL
 * @access  Public
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login.html?error=google_auth_failed',
    session: false // We're using JWT, not sessions
  }),
  (req, res) => {
    try {
      // Create JWT token
      const token = jwt.sign(
        { 
          id: req.user._id,
          email: req.user.email,
          username: req.user.username
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Redirect to frontend with token
      // Frontend will store this in localStorage
      res.redirect(`/?token=${token}&email=${req.user.email}&username=${req.user.username}`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('/login.html?error=token_generation_failed');
    }
  }
);

/**
 * @route   GET /api/auth/google/success
 * @desc    Get user info after successful Google auth
 * @access  Public (token in URL)
 */
router.get('/google/success', async (req, res) => {
  const token = req.query.token;
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'No token provided' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('../models/User');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        isGoogleAuth: user.isGoogleAuth
      },
      token
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
});

module.exports = router;
