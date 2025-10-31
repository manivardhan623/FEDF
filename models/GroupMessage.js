const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  sender: {
    type: String, // Email of sender
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['text', 'system'],
    default: 'text'
  },
  // File/Image data fields
  fileData: {
    type: mongoose.Schema.Types.Mixed, // Stores full file data (base64)
    required: false
  },
  fileType: {
    type: String, // 'image', 'document', etc.
    required: false
  },
  fileName: {
    type: String,
    required: false
  },
  fileSize: {
    type: Number,
    required: false
  }
});

// Index for efficient queries
groupMessageSchema.index({ groupId: 1, timestamp: -1 });

module.exports = mongoose.model('GroupMessage', groupMessageSchema);
