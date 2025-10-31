const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  members: [{
    type: String, // Store email addresses
    required: true
  }],
  createdBy: {
    type: String, // Email of creator
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
groupSchema.index({ members: 1 });
groupSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Group', groupSchema);
