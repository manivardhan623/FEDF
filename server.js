// Load environment variables FIRST before anything else
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('./config/passport');
const User = require('./models/User');
const Message = require('./models/Message');
const Group = require('./models/Group');
const GroupMessage = require('./models/GroupMessage');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const authRoutes = require('./routes/auth');
const authGoogleRoutes = require('./routes/authGoogle');
const chatRoutes = require('./routes/chat');
const { authenticateSocket } = require('./middleware/auth');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// Allow multiple origins via comma-separated CLIENT_URL or wildcard in dev
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((s) => s.trim())
  : '*';

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});
console.log('Socket.IO CORS allowed origins:', allowedOrigins);

// Middleware - Disable CSP in development for easier testing
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());

// Security: Sanitize data against NoSQL injection
app.use(mongoSanitize());

// Session configuration for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Disable caching in development to avoid stale assets during LAN testing
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// Lightweight request logger (for debugging which server responds)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Diagnostic endpoints to confirm this exact server instance
app.get('/__health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/__version', (req, res) => {
  res.json({
    name: 'realtime-chat-app',
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    clientUrl: process.env.CLIENT_URL || '*',
    timestamp: new Date().toISOString()
  });
});

app.get('/__whoami', (req, res) => {
  res.send(`This is realtime-chat-app from ${__dirname} at ${new Date().toISOString()}`);
});

// Routes
app.use('/api/auth', authLimiter, authRoutes); // Strict rate limiting for auth
app.use('/api/auth', authGoogleRoutes); // Google OAuth routes
app.use('/api/chat', chatRoutes);

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve index.html for all other routes (SPA) - only for HTML routes
app.get('*', (req, res, next) => {
  // Skip static file requests
  if (req.path.startsWith('/socket.io/') || 
      req.path.endsWith('.js') || 
      req.path.endsWith('.css') || 
      req.path.endsWith('.json')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Store connected users and their network info
const connectedUsers = new Map();
const networkGroups = new Map();
const userColors = ['Red', 'Blue', 'Green', 'Purple', 'Orange', 'Pink', 'Cyan', 'Yellow', 'Lime', 'Indigo'];

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('=== NEW SOCKET CONNECTION ===');
  console.log('Socket ID:', socket.id);
  console.log('Client IP:', socket.handshake.address);
  console.log('Socket handshake auth:', socket.handshake.auth);
  console.log('User-Agent:', socket.handshake.headers['user-agent']);
  
  // Send a test event to confirm basic connection works
  socket.emit('connection-test', 'Server received your connection');
  
  // Authenticate the socket connection
  authenticateSocket(socket, (error) => {
    if (error) {
      console.error('=== SOCKET AUTHENTICATION FAILED ===');
      console.error('Error:', error.message);
      console.error('Socket handshake details:', {
        auth: socket.handshake.auth,
        headers: socket.handshake.headers
      });
      socket.emit('auth-error', error.message);
      socket.disconnect();
      return;
    }

    console.log(`User connected: ${socket.username} (${socket.email})`);
    
    // Store user info in connectedUsers
    connectedUsers.set(socket.id, {
      userId: socket.userId,
      username: socket.username,
      email: socket.email,
      socketId: socket.id
    });
    
    // Broadcast updated online users list
    broadcastOnlineUsers();

    // Network detection for hotspot groups
    const getClientIPv4 = () => {
      // Prefer X-Forwarded-For if present (proxies), else Socket.IO handshake address
      const xfwd = socket.handshake.headers['x-forwarded-for'];
      let ip = (Array.isArray(xfwd) ? xfwd[0] : xfwd)?.split(',')[0]?.trim() || socket.handshake.address || '';
      // Normalize IPv6-mapped IPv4 ::ffff:10.0.0.1 -> 10.0.0.1
      const v4match = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
      if (v4match) return v4match[1];
      // If ip already looks like IPv4
      const plain = ip.match(/(\d+\.\d+\.\d+\.\d+)/);
      return plain ? plain[1] : null;
    };

    const getNetworkIdFromIp = (ipv4) => {
      if (!ipv4) return null;
      // Only consider private ranges for hotspot grouping
      const isPrivate = (
        ipv4.startsWith('10.') ||
        ipv4.startsWith('192.168.') ||
        (ipv4.startsWith('172.') && (() => {
          const second = parseInt(ipv4.split('.')[1], 10);
          return second >= 16 && second <= 31;
        })())
      );
      if (!isPrivate) return null;
      const parts = ipv4.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}`; // Use first 3 octets
    };

    // Auto-detect network for hotspot groups
    try {
      const clientIp = getClientIPv4();
      const detectedNetworkId = getNetworkIdFromIp(clientIp);
      if (detectedNetworkId) {
        const userInfo = connectedUsers.get(socket.id);
        userInfo.networkId = detectedNetworkId;

        if (!networkGroups.has(detectedNetworkId)) {
          networkGroups.set(detectedNetworkId, {
            users: new Set(),
            usedColors: new Set(),
            roomName: `hotspot-${detectedNetworkId}`
          });
        }
        const networkGroup = networkGroups.get(detectedNetworkId);

        // Assign a unique color if not already assigned
        if (!userInfo.assignedColor) {
          const availableColors = userColors.filter(color => !networkGroup.usedColors.has(color));
          if (availableColors.length > 0) {
            const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
            userInfo.assignedColor = randomColor;
            networkGroup.usedColors.add(randomColor);
          } else {
            const randomColor = userColors[Math.floor(Math.random() * userColors.length)];
            userInfo.assignedColor = `${randomColor}${Math.floor(Math.random() * 100)}`;
          }
        }

        // Notify client that a hotspot group is available (do not auto-join)
        socket.emit('hotspot-group-available', {
          networkId: detectedNetworkId,
          assignedColor: userInfo.assignedColor,
          userCount: networkGroup.users.size
        });
      }
    } catch (e) {
      console.warn('Hotspot server-side detection failed:', e?.message || e);
    }

    // Handle joining general chat
    socket.on('join-general-chat', () => {
      console.log('User joining general chat:', socket.username);
      socket.join('general');
      socket.emit('joined-general-chat');
      
      // Broadcast user joined to general chat
      socket.to('general').emit('user-joined', {
        username: socket.username,
        message: `${socket.username} joined the chat`
      });
    });

    // Handle general chat messages
    socket.on('send-message', async (data) => {
      console.log('Received send-message:', data);
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        try {
          // Save to database with file support
          const message = new Message({
            sender: userInfo.userId,
            senderUsername: userInfo.username,
            senderEmail: userInfo.email,
            content: data.message,
            type: 'general',
            // Save file data if present
            fileData: data.fileData,
            fileType: data.fileData?.type,
            fileName: data.fileData?.name,
            fileSize: data.fileData?.size
          });
          await message.save();

          const messageData = {
            id: message._id,
            username: userInfo.username,
            email: userInfo.email,
            message: data.message,
            timestamp: message.createdAt,
            type: 'general',
            // Include file data in broadcast
            fileData: data.fileData,
            fileType: data.fileData?.type,
            fileName: data.fileData?.name,
            fileSize: data.fileData?.size
          };

          console.log('Broadcasting message to general room:', messageData);
          // Broadcast to general chat
          io.to('general').emit('new-message', messageData);
        } catch (error) {
          console.error('Error saving general message:', error);
        }
      } else {
        console.log('No user info found for socket:', socket.id);
      }
    });

    // Handle network detection for hotspot groups
    socket.on('detect-network', (networkInfo) => {
      const networkId = networkInfo.networkId || 'unknown';
      const userInfo = connectedUsers.get(socket.id);
      
      if (userInfo) {
        userInfo.networkId = networkId;
        
        // Check if this network already has a group
        if (!networkGroups.has(networkId)) {
          networkGroups.set(networkId, {
            users: new Set(),
            usedColors: new Set(),
            roomName: `hotspot-${networkId}`
          });
        }
        
        const networkGroup = networkGroups.get(networkId);
        
        // Assign a unique color if not already assigned
        if (!userInfo.assignedColor) {
          const availableColors = userColors.filter(color => !networkGroup.usedColors.has(color));
          if (availableColors.length > 0) {
            const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
            userInfo.assignedColor = randomColor;
            networkGroup.usedColors.add(randomColor);
          } else {
            const randomColor = userColors[Math.floor(Math.random() * userColors.length)];
            userInfo.assignedColor = `${randomColor}${Math.floor(Math.random() * 100)}`;
          }
        }
        
        // Notify client about hotspot group availability
        socket.emit('hotspot-group-available', {
          networkId: networkId,
          assignedColor: userInfo.assignedColor,
          userCount: networkGroup.users.size
        });
        
        console.log(`User ${userInfo.username} assigned to network ${networkId} as ${userInfo.assignedColor} User`);
      }
    });

    // Handle joining hotspot group
    socket.on('join-hotspot-group', () => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo && userInfo.networkId) {
        const networkGroup = networkGroups.get(userInfo.networkId);
        if (networkGroup) {
          // Join the hotspot room
          socket.join(networkGroup.roomName);
          networkGroup.users.add(socket.id);
          
          // Notify client they joined
          socket.emit('joined-hotspot-group', {
            networkId: userInfo.networkId,
            assignedColor: userInfo.assignedColor,
            userCount: networkGroup.users.size
          });
          
          console.log(`${userInfo.username} (${userInfo.assignedColor} User) joined hotspot group ${userInfo.networkId}. Total users: ${networkGroup.users.size}`);
          
          // Notify others in the hotspot group
          socket.to(networkGroup.roomName).emit('user-joined-hotspot', {
            color: userInfo.assignedColor,
            message: `${userInfo.assignedColor} User joined the hotspot group`
          });
        }
      }
    });

    // Handle hotspot group messages
    socket.on('send-hotspot-message', (data) => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo && userInfo.networkId) {
        const networkGroup = networkGroups.get(userInfo.networkId);
        if (networkGroup) {
          const messageData = {
            id: Date.now(),
            color: userInfo.assignedColor,
            message: data.message,
            timestamp: new Date(),
            type: 'hotspot',
            // Include file data if present
            fileData: data.fileData,
            fileType: data.fileData?.type,
            fileName: data.fileData?.name,
            fileSize: data.fileData?.size
          };

          // Broadcast to hotspot group (including sender)
          io.to(networkGroup.roomName).emit('new-hotspot-message', messageData);
        }
      }
    });

    // Handle private messages
    socket.on('send-private-message', async (data) => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        try {
          // Find recipient
          const recipientUser = await User.findOne({ email: data.to });
          if (!recipientUser) {
            socket.emit('user-not-found', { email: data.to });
            return;
          }

          // Save to database
          const message = new Message({
            sender: userInfo.userId,
            senderUsername: userInfo.username,
            senderEmail: userInfo.email,
            content: data.message,
            type: 'private',
            recipient: recipientUser._id,
            recipientEmail: data.to
          });
          await message.save();

          const messageData = {
            id: message._id,
            from: userInfo.username,
            fromEmail: userInfo.email,
            to: data.to,
            message: data.message,
            timestamp: message.createdAt,
            type: 'private'
          };

          // Find recipient socket
          const recipientSocket = Array.from(connectedUsers.entries())
            .find(([_, user]) => user.email === data.to);

          if (recipientSocket) {
            // Send to recipient
            io.to(recipientSocket[0]).emit('new-private-message', messageData);
            
            // Send delivered confirmation to sender
            socket.emit('message-delivered-receipt', {
              to: data.to,
              messageId: message._id,
              timestamp: message.createdAt
            });
            console.log(`Delivered receipt sent to ${userInfo.email} for message to ${data.to}`);
          }

          // Send confirmation to sender (so they see their own message)
          socket.emit('private-message-sent', messageData);

        } catch (error) {
          console.error('Error saving private message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      }
    });

    // Handle file messages (images/documents) in private chat
    socket.on('send-file-message', async (data) => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo && data.fileData) {
        try {
          // Find recipient
          const recipientUser = await User.findOne({ email: data.to });
          if (!recipientUser) {
            socket.emit('user-not-found', { email: data.to });
            return;
          }

          // Save to database with file data
          const message = new Message({
            sender: userInfo.userId,
            senderUsername: userInfo.username,
            senderEmail: userInfo.email,
            content: data.fileData.name || 'File',
            type: 'private',
            recipient: recipientUser._id,
            recipientEmail: data.to,
            // Save file data
            fileData: data.fileData,
            fileType: data.fileData.type,
            fileName: data.fileData.name,
            fileSize: data.fileData.size
          });
          await message.save();

          const messageData = {
            id: message._id,
            from: userInfo.username,
            fromEmail: userInfo.email,
            to: data.to,
            message: data.fileData.name,
            timestamp: message.createdAt,
            type: 'private',
            // Include file data
            fileData: data.fileData,
            fileType: data.fileData.type,
            fileName: data.fileData.name,
            fileSize: data.fileData.size
          };

          // Find recipient socket
          const recipientSocket = Array.from(connectedUsers.entries())
            .find(([_, user]) => user.email === data.to);

          if (recipientSocket) {
            // Send to recipient
            io.to(recipientSocket[0]).emit('new-private-message', messageData);
          }

          // Send confirmation to sender
          socket.emit('private-message-sent', messageData);

        } catch (error) {
          console.error('Error saving file message:', error);
          socket.emit('error', { message: 'Failed to send file' });
        }
      }
    });

    // Handle read receipts
    socket.on('message-read', (data) => {
      console.log('Read receipt received:', data);
      
      // Find sender socket
      const senderSocket = Array.from(connectedUsers.entries())
        .find(([_, user]) => user.email === data.from);
      
      if (senderSocket) {
        // Send read receipt to original sender
        io.to(senderSocket[0]).emit('message-read-receipt', {
          from: data.to,  // Who read it (recipient becomes "from" in receipt)
          messageId: data.messageId
        });
        console.log(`Read receipt sent to ${data.from}`);
      }
    });

    // Handle group creation
    socket.on('create-group', async (data) => {
      try {
        console.log('Creating group with data:', data);
        console.log('Socket user info:', {
          email: socket.email,
          username: socket.username
        });
        
        if (!data.name || !data.members) {
          console.error('Missing required fields:', { name: data.name, members: data.members });
          socket.emit('group-creation-error', 'Missing required fields');
          return;
        }
        
        const group = new Group({
          name: data.name,
          members: data.members,
          createdBy: socket.email
        });
        
        console.log('Saving group to database...');
        await group.save();
        console.log('Group saved successfully:', group._id);
        
        // Join creator to the group room
        socket.join(group._id.toString());
        
        // Notify all members about the new group
        data.members.forEach(memberEmail => {
          const memberSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.email === memberEmail);
          if (memberSocket) {
            memberSocket.join(group._id.toString());
          }
        });
        
        // Send success response
        socket.emit('group-created', {
          id: group._id,
          name: group.name,
          members: group.members
        });
        
        console.log('Group creation completed successfully');
        
        // Create system message
        const systemMessage = new GroupMessage({
          groupId: group._id,
          sender: 'system',
          senderName: 'System',
          message: `Group "${group.name}" created by ${socket.username}`,
          type: 'system'
        });
        await systemMessage.save();
        
      } catch (error) {
        console.error('Error creating group:', error);
        console.error('Error details:', error.message);
        socket.emit('group-creation-error', `Failed to create group: ${error.message}`);
      }
    });

    // Handle getting user's groups
    socket.on('get-groups', async () => {
      try {
        const groups = await Group.find({
          members: socket.email
        }).sort({ lastActivity: -1 });
        
        socket.emit('groups-list', groups);
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    });

    // Handle joining a group
    socket.on('join-group', async (data) => {
      try {
        const group = await Group.findById(data.groupId);
        if (group && group.members.includes(socket.email)) {
          socket.join(data.groupId);
          
          // Load recent messages
          const messages = await GroupMessage.find({
            groupId: data.groupId
          }).sort({ timestamp: -1 }).limit(50);
          
          socket.emit('group-messages', messages.reverse());
        }
      } catch (error) {
        console.error('Error joining group:', error);
      }
    });

    // Handle group messages
    socket.on('send-group-message', async (data) => {
      try {
        if (socket.username && data.groupId && data.message) {
          // Verify user is member of the group
          const group = await Group.findById(data.groupId);
          if (!group || !group.members.includes(socket.email)) {
            return;
          }
          
          // Save message to database with file data
          const groupMessage = new GroupMessage({
            groupId: data.groupId,
            sender: socket.email,
            senderName: socket.username,
            message: data.message,
            // Save file data if present
            fileData: data.fileData,
            fileType: data.fileData?.type,
            fileName: data.fileData?.name,
            fileSize: data.fileData?.size
          });
          await groupMessage.save();
          
          // Update group's last activity
          await Group.findByIdAndUpdate(data.groupId, {
            lastActivity: new Date()
          });
          
          const messageData = {
            sender: socket.email,
            senderName: socket.username,
            message: data.message,
            groupId: data.groupId,
            timestamp: new Date(),
            type: 'group',
            // Include file data in broadcast
            fileData: data.fileData,
            fileType: data.fileData?.type,
            fileName: data.fileData?.name,
            fileSize: data.fileData?.size
          };
          
          // Broadcast to group
          io.to(data.groupId).emit('group-message', messageData);
        }
      } catch (error) {
        console.error('Error sending group message:', error);
      }
    });

    // Handle getting group messages
    socket.on('get-group-messages', async (data) => {
      try {
        const group = await Group.findById(data.groupId);
        if (group && group.members.includes(socket.email)) {
          const messages = await GroupMessage.find({
            groupId: data.groupId
          }).sort({ timestamp: -1 }).limit(50);
          
          socket.emit('group-messages', messages.reverse());
        }
      } catch (error) {
        console.error('Error fetching group messages:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.userId);
      
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        // Clean up network group
        if (userInfo.networkId && networkGroups.has(userInfo.networkId)) {
          const networkGroup = networkGroups.get(userInfo.networkId);
          networkGroup.users.delete(socket.id);
          
          if (userInfo.assignedColor) {
            networkGroup.usedColors.delete(userInfo.assignedColor);
          }
          
          // If no users left in network group, clean it up
          if (networkGroup.users.size === 0) {
            networkGroups.delete(userInfo.networkId);
          } else {
            // Notify remaining users in hotspot group
            socket.to(networkGroup.roomName).emit('user-left-hotspot', {
              color: userInfo.assignedColor,
              message: `${userInfo.assignedColor} User left the hotspot group`
            });
          }
        }
        
        // Notify general chat
        socket.to('general').emit('user-left', {
          username: userInfo.username,
          message: `${userInfo.username} left the chat`
        });
      }
      
      connectedUsers.delete(socket.id);
      
      // Broadcast updated online users list
      broadcastOnlineUsers();
    });

  }); // Close authentication callback
}); // Close main connection handler

// Helper function to broadcast online users
function broadcastOnlineUsers() {
  const onlineUsers = Array.from(connectedUsers.values()).map(user => ({
    username: user.username,
    email: user.email,
    id: user.userId
  }));
  
  console.log(`Broadcasting ${onlineUsers.length} online users:`, onlineUsers.map(u => u.username));
  io.emit('online-users-updated', onlineUsers);
}

// Error Handling Middleware (Must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';
  
  // Find local IP address for network access
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
      }
    });
  });
  
  console.log('\n🚀 ChatFlow Server Started!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 MongoDB: ${process.env.MONGODB_URI ? 'Connected ✅' : 'Connecting...'}`);
  console.log('\n📱 Access URLs:');
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}`);
  console.log('\n💡 Mobile Access:');
  console.log(`   Connect your phone to the same WiFi`);
  console.log(`   Then open: http://${localIP}:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
