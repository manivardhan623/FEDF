const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

/**
 * Passport Google OAuth 2.0 Strategy Configuration
 * 
 * This handles authentication via Google OAuth.
 * Users can sign in with their Google account.
 */

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('Google OAuth Profile:', profile);
      
      // Check if user already exists with this Google ID
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        // User exists, return user
        console.log('Existing Google user found:', user.email);
        return done(null, user);
      }
      
      // Check if user exists with this email
      user = await User.findOne({ email: profile.emails[0].value });
      
      if (user) {
        // User exists with this email, link Google account
        user.googleId = profile.id;
        user.avatar = profile.photos[0]?.value;
        await user.save();
        console.log('Linked Google account to existing user:', user.email);
        return done(null, user);
      }
      
      // Create new user
      user = await User.create({
        googleId: profile.id,
        email: profile.emails[0].value,
        username: profile.displayName || profile.emails[0].value.split('@')[0],
        avatar: profile.photos[0]?.value,
        isGoogleAuth: true,
        isVerified: true // Google users are pre-verified
      });
      
      console.log('New Google user created:', user.email);
      return done(null, user);
      
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }
));

/**
 * Serialize user for session storage
 * Stores only user ID in session
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session
 * Retrieves full user object from database
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
