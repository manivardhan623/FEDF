const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get general chat messages
router.get('/messages/general', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ type: 'general' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username email');

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      page,
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Error fetching general messages:', error);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
});

// Get private messages between two users
router.get('/messages/private/:recipientEmail', authenticateToken, async (req, res) => {
  try {
    const { recipientEmail } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const messages = await Message.find({
      type: 'private',
      $or: [
        { sender: req.user._id, recipient: recipient._id },
        { sender: recipient._id, recipient: req.user._id }
      ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'username email')
    .populate('recipient', 'username email');

    // Mark messages as read
    await Message.updateMany({
      type: 'private',
      sender: recipient._id,
      recipient: req.user._id,
      isRead: false
    }, { isRead: true });

    res.json({
      messages: messages.reverse(),
      page,
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Error fetching private messages:', error);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
});

// Get group messages
router.get('/messages/group/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ 
      type: 'group',
      groupId: groupId
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'username email');

    res.json({
      messages: messages.reverse(),
      page,
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
});

// Save a message to database
router.post('/messages', authenticateToken, [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters'),
  body('type')
    .isIn(['general', 'private', 'group', 'hotspot'])
    .withMessage('Invalid message type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content, type, recipientEmail, groupId, groupName, hotspotColor, networkId } = req.body;

    const messageData = {
      sender: req.user._id,
      senderUsername: req.user.username,
      senderEmail: req.user.email,
      content,
      type
    };

    // Add type-specific fields
    if (type === 'private') {
      const recipient = await User.findOne({ email: recipientEmail });
      if (!recipient) {
        return res.status(404).json({ message: 'Recipient not found' });
      }
      messageData.recipient = recipient._id;
      messageData.recipientEmail = recipientEmail;
    } else if (type === 'group') {
      messageData.groupId = groupId;
      messageData.groupName = groupName;
    } else if (type === 'hotspot') {
      messageData.hotspotColor = hotspotColor;
      messageData.networkId = networkId;
    }

    const message = new Message(messageData);
    await message.save();

    res.status(201).json({
      message: 'Message saved successfully',
      messageId: message._id
    });

  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ message: 'Server error saving message' });
  }
});

// Get unread message count
router.get('/messages/unread', authenticateToken, async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      type: 'private',
      recipient: req.user._id,
      isRead: false
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error fetching unread count' });
  }
});

// Edit message
router.put('/messages/:messageId', authenticateToken, [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    // Check if message is deleted
    if (message.isDeleted) {
      return res.status(400).json({ error: 'Cannot edit deleted message' });
    }

    // Update message
    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({
      message: 'Message updated successfully',
      updatedMessage: message
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Server error editing message' });
  }
});

// Delete message
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = 'This message was deleted';
    await message.save();

    res.json({
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Server error deleting message' });
  }
});

// Search messages
router.get('/messages/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    const { type, limit = 20 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchFilter = {
      isDeleted: false,
      $text: { $search: query }
    };

    // Add type filter if specified
    if (type) {
      searchFilter.type = type;
    }

    // For private messages, only search user's conversations
    if (type === 'private') {
      searchFilter.$or = [
        { sender: req.user._id },
        { recipient: req.user._id }
      ];
    }

    const messages = await Message.find(searchFilter)
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .populate('sender', 'username email')
      .populate('recipient', 'username email');

    res.json({
      messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: 'Server error searching messages' });
  }
});

// Add reaction to message
router.post('/messages/:messageId/react', authenticateToken, [
  body('emoji')
    .trim()
    .notEmpty()
    .withMessage('Emoji is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: 'Cannot react to deleted message' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.userId.toString() === req.user._id.toString() && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction if already exists
      message.reactions = message.reactions.filter(
        r => !(r.userId.toString() === req.user._id.toString() && r.emoji === emoji)
      );
    } else {
      // Add new reaction
      message.reactions.push({
        userId: req.user._id,
        username: req.user.username,
        emoji
      });
    }

    await message.save();

    res.json({
      message: 'Reaction updated successfully',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Server error adding reaction' });
  }
});

// Remove reaction from message
router.delete('/messages/:messageId/react/:emoji', authenticateToken, async (req, res) => {
  try {
    const { messageId, emoji } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Remove user's reaction
    message.reactions = message.reactions.filter(
      r => !(r.userId.toString() === req.user._id.toString() && r.emoji === emoji)
    );

    await message.save();

    res.json({
      message: 'Reaction removed successfully',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Server error removing reaction' });
  }
});

module.exports = router;
