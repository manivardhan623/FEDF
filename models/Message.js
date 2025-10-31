const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderUsername: {
    type: String,
    required: true
  },
  senderEmail: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['general', 'private', 'group', 'hotspot'],
    default: 'general'
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'private';
    }
  },
  recipientEmail: {
    type: String,
    required: function() {
      return this.type === 'private';
    }
  },
  groupId: {
    type: String,
    required: function() {
      return this.type === 'group';
    }
  },
  groupName: {
    type: String,
    required: function() {
      return this.type === 'group';
    }
  },
  hotspotColor: {
    type: String,
    required: function() {
      return this.type === 'hotspot';
    }
  },
  networkId: {
    type: String,
    required: function() {
      return this.type === 'hotspot';
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
}, {
  timestamps: true
});

// Index for efficient queries
messageSchema.index({ type: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ networkId: 1, createdAt: -1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ content: 'text' }); // Text index for search

module.exports = mongoose.model('Message', messageSchema);
