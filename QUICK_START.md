# 🚀 ChatFlow - Quick Start Guide

## ⚡ Quick Setup (5 Minutes)

### **Step 1: Install Dependencies**

```bash
npm install
```

This installs all required packages including:
- ✅ Express.js (server framework)
- ✅ Socket.IO (real-time communication)
- ✅ MongoDB/Mongoose (database)
- ✅ Passport (authentication)
- ✅ JWT (tokens)
- ✅ bcryptjs (password hashing)
- ✅ And more security packages

---

### **Step 2: Configure Environment**

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file** with your settings:
   ```env
   # MongoDB
   MONGODB_URI=mongodb://localhost:27017/chatapp

   # JWT Secret (generate a random string)
   JWT_SECRET=your-super-secret-jwt-key-here

   # Server
   PORT=3002
   NODE_ENV=development

   # Client URL
   CLIENT_URL=http://localhost:3002

   # Google OAuth (get from Google Cloud Console)
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

   # Session Secret (generate a random string)
   SESSION_SECRET=your-session-secret-here
   ```

**Generate Random Secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### **Step 3: Start MongoDB**

**Windows:**
```bash
mongod
```

**Mac/Linux:**
```bash
sudo systemctl start mongod
```

**Verify MongoDB is running:**
```bash
mongosh
# Should connect without errors
```

---

### **Step 4: Start the Server**

```bash
npm run dev
```

Expected output:
```
Server running on port 3002
Connected to MongoDB
Socket.IO initialized
```

---

### **Step 5: Open in Browser**

```
http://localhost:3002
```

You should see the beautiful ChatFlow splash screen! 🎉

---

## 🔐 Google OAuth Setup (Optional but Recommended)

**If you want "Sign in with Google" to work:**

1. **Follow the detailed guide:**
   - Open `GOOGLE_OAUTH_SETUP.md`
   - Complete all steps (takes 10-15 minutes)

2. **Quick Summary:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable OAuth consent screen
   - Create OAuth 2.0 credentials
   - Get Client ID and Client Secret
   - Add to `.env` file

3. **Test:**
   - Click "Sign in with Google" button
   - Should redirect to Google login
   - After approval, redirects back to chat
   - You're logged in! ✅

---

## 📱 Features Available

### **✅ Working Features:**
- [x] User Registration & Login
- [x] Google OAuth Sign-In
- [x] Real-time Chat (General)
- [x] Private Messages (1-on-1)
- [x] Group Chats
- [x] Hotspot Detection (WiFi-based anonymous chat)
- [x] Online/Offline Status
- [x] Last Seen
- [x] Message Status (Sent/Delivered/Read)
- [x] Status Circles (🔴🟡🟢)
- [x] File Upload
- [x] Beautiful UI with Gradients
- [x] Responsive Design
- [x] Dark/Light Theme
- [x] Message History
- [x] Read Receipts

---

## 🧪 Testing the App

### **Test 1: Registration & Login**

1. **Open app:** `http://localhost:3002`
2. **Click "Sign Up"**
3. **Fill form:**
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `password123`
4. **Click "Sign Up"**
5. **You should be logged in!** ✅

---

### **Test 2: Google Sign-In**

1. **Click "Sign in with Google"**
2. **Choose your Google account**
3. **Allow permissions**
4. **Redirected back to chat** ✅
5. **You're logged in!**

---

### **Test 3: Private Chat**

**Open two browser windows:**

**Window 1 (User A):**
```
Login as: karthik@example.com
Password: password123
```

**Window 2 (User B):**
```
Login as: mani@example.com
Password: password123
```

**Send messages:**
1. Window 1: Click on "mani" in search
2. Type "Hello!" and send
3. Window 2: Message appears instantly! ✅

**Check status:**
- Window 1 should show: 🔴 (sent) → 🟡 (delivered)
- Window 2: Click on chat
- Window 1 should now show: 🟢 (read) ✅

---

### **Test 4: Group Chat**

1. **Click "Create Group"**
2. **Enter group name:** "Team Chat"
3. **Select members** (check users in list)
4. **Click "Create"**
5. **Send message in group**
6. **All members see it!** ✅

---

### **Test 5: File Upload**

1. **Click attachment icon** 📎
2. **Select an image** (jpg, png)
3. **File uploads and appears in chat** ✅
4. **Click to view full size**

---

## 🎨 Project Structure

```
chatflow/
├── config/
│   └── passport.js          # Google OAuth config
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── rateLimiter.js       # Rate limiting
│   └── errorHandler.js      # Error handling
├── models/
│   ├── User.js              # User schema
│   ├── Message.js           # Message schema
│   ├── Group.js             # Group schema
│   └── GroupMessage.js      # Group message schema
├── public/
│   ├── index.html           # Main UI
│   ├── app.js               # Frontend logic
│   └── styles.css           # Styling
├── routes/
│   ├── auth.js              # Auth endpoints
│   ├── authGoogle.js        # Google OAuth
│   └── chat.js              # Chat endpoints
├── server.js                # Main server file
├── package.json             # Dependencies
├── .env                     # Configuration
└── README.md                # Documentation
```

---

## 📊 Architecture Overview

```
┌──────────────┐
│   Browser    │  ← HTML/CSS/JavaScript
│   (Client)   │  ← Socket.IO Client
└──────┬───────┘
       │
       │ HTTP/WebSocket
       ▼
┌──────────────┐
│  Node.js     │  ← Express.js
│  (Server)    │  ← Socket.IO Server
│              │  ← Passport (OAuth)
└──────┬───────┘
       │
       │ Mongoose
       ▼
┌──────────────┐
│   MongoDB    │  ← NoSQL Database
│  (Database)  │  ← JSON Documents
└──────────────┘
       │
       │ Network
       ▼
┌──────────────┐
│  Google API  │  ← OAuth 2.0
│   (Cloud)    │  ← Authentication
└──────────────┘
```

---

## 🔒 Security Features

✅ **Password Hashing** - bcrypt with salt rounds  
✅ **JWT Tokens** - Stateless authentication  
✅ **Google OAuth** - Third-party authentication  
✅ **Rate Limiting** - Prevent brute-force attacks  
✅ **Input Validation** - Sanitize user input  
✅ **NoSQL Injection Prevention** - express-mongo-sanitize  
✅ **Secure Headers** - helmet middleware  
✅ **CORS Protection** - Cross-origin control  
✅ **Session Security** - httpOnly cookies  

---

## 🐛 Troubleshooting

### **Issue: MongoDB Connection Failed**

**Error:**
```
MongooseError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
```bash
# Start MongoDB
mongod

# Or on Linux/Mac:
sudo systemctl start mongod
```

---

### **Issue: Port Already in Use**

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3002
```

**Solution:**
```bash
# Find and kill the process
# Windows:
netstat -ano | findstr :3002
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3002 | xargs kill -9
```

---

### **Issue: Google OAuth Not Working**

**Error:** "redirect_uri_mismatch"

**Solution:**
1. Check `.env` file:
   ```env
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   ```

2. Verify it matches EXACTLY in Google Cloud Console

3. Restart server after changing `.env`

---

### **Issue: Can't Create Users**

**Error:** "User validation failed: password: Path `password` is required"

**Solution:**
- Clear MongoDB if corrupted:
  ```bash
  mongosh
  use chatapp
  db.dropDatabase()
  ```
- Restart app and register again

---

## 📚 Documentation Files

- **`GOOGLE_OAUTH_SETUP.md`** - Detailed Google OAuth guide
- **`PROJECT_ARCHITECTURE.md`** - Complete system architecture
- **`README.md`** - Project overview
- **`QUICK_START.md`** - This file!

---

## 🎯 Next Steps

### **For Development:**
1. ✅ Add more features (see `PROJECT_ARCHITECTURE.md`)
2. ✅ Write unit tests
3. ✅ Add TypeScript (optional)
4. ✅ Improve error handling
5. ✅ Add logging (Winston)

### **For Production:**
1. ✅ Deploy to cloud (Heroku/AWS/Google Cloud)
2. ✅ Use MongoDB Atlas (cloud database)
3. ✅ Add SSL certificate (HTTPS)
4. ✅ Configure CDN for static assets
5. ✅ Set up CI/CD pipeline
6. ✅ Enable monitoring (Sentry)

---

## 🆘 Getting Help

**Read Documentation:**
- Check `GOOGLE_OAUTH_SETUP.md` for OAuth issues
- Read `PROJECT_ARCHITECTURE.md` for system design
- Review code comments in `server.js` and `app.js`

**Common Commands:**
```bash
# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Check for errors
npm run lint
```

---

## ✅ Success Checklist

Before sharing your project:

- [ ] MongoDB running
- [ ] Server starts without errors
- [ ] Can register new users
- [ ] Can login with credentials
- [ ] Google Sign-In works (optional)
- [ ] Private messages work
- [ ] Group chats work
- [ ] File upload works
- [ ] Status circles update (🔴🟡🟢)
- [ ] UI looks good (no broken styles)
- [ ] No console errors
- [ ] All buttons/links work
- [ ] Responsive on mobile
- [ ] Read the architecture document

---

## 🎉 You're Ready!

Your ChatFlow app is now:
- ✅ **Installed** - All dependencies ready
- ✅ **Configured** - Environment variables set
- ✅ **Running** - Server active on port 3002
- ✅ **Functional** - All features working
- ✅ **Secure** - Authentication & protection enabled
- ✅ **Beautiful** - Modern UI with gradients
- ✅ **Real-time** - WebSocket communication active
- ✅ **Cloud-ready** - Can deploy anytime

---

**Start chatting and enjoy your beautiful real-time chat application!** 💬✨

**Questions?** Check the other documentation files or review the code comments!
