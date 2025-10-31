# 🔐 Google OAuth Setup Guide for ChatFlow

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Google Cloud Console Setup](#google-cloud-console-setup)
3. [Backend Configuration](#backend-configuration)
4. [Frontend Integration](#frontend-integration)
5. [Testing](#testing)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

---

## 📦 Prerequisites

Before starting, ensure you have:
- ✅ Google Account
- ✅ Node.js installed
- ✅ MongoDB running
- ✅ Project dependencies installed

---

## 🌐 Google Cloud Console Setup

### Step 1: Create/Select Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a Project"** dropdown at the top
3. Click **"NEW PROJECT"**
   - **Project Name**: `ChatFlow` (or your preferred name)
   - **Organization**: Leave as default
4. Click **"CREATE"**
5. Wait for project creation (takes a few seconds)
6. Select your new project from the dropdown

---

### Step 2: Configure OAuth Consent Screen

1. In the left sidebar, click **"APIs & Services"** → **"OAuth consent screen"**

2. **Choose User Type:**
   - Select **"External"** (for public use)
   - Click **"CREATE"**

3. **App Information:**
   ```
   App name: ChatFlow
   User support email: your-email@example.com
   App logo: (optional)
   ```

4. **App domain** (optional for testing):
   ```
   Application home page: http://localhost:3002
   Application privacy policy link: http://localhost:3002/privacy
   Application terms of service link: http://localhost:3002/terms
   ```

5. **Authorized domains:**
   - Leave empty for local development
   - For production, add: `your-domain.com`

6. **Developer contact information:**
   ```
   Email addresses: your-email@example.com
   ```

7. Click **"SAVE AND CONTINUE"**

8. **Scopes:**
   - Click **"ADD OR REMOVE SCOPES"**
   - Select:
     - ✅ `.../auth/userinfo.email`
     - ✅ `.../auth/userinfo.profile`
     - ✅ `openid`
   - Click **"UPDATE"**
   - Click **"SAVE AND CONTINUE"**

9. **Test users** (if Publishing status is "Testing"):
   - Click **"+ ADD USERS"**
   - Add your Google email: `your-email@gmail.com`
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

10. **Summary:**
    - Review your settings
    - Click **"BACK TO DASHBOARD"**

---

### Step 3: Create OAuth 2.0 Client ID

1. In the left sidebar, click **"APIs & Services"** → **"Credentials"**

2. Click **"+ CREATE CREDENTIALS"** at the top

3. Select **"OAuth client ID"**

4. **Application type:**
   - Select **"Web application"**

5. **Name:**
   ```
   ChatFlow Web Client
   ```

6. **Authorized JavaScript origins:**
   ```
   http://localhost:3002
   http://127.0.0.1:3002
   ```

7. **Authorized redirect URIs:**
   ```
   http://localhost:5000/api/auth/google/callback
   http://localhost:3002/api/auth/google/callback
   ```
   ⚠️ **IMPORTANT**: Use the EXACT URL your backend server uses!

8. Click **"CREATE"**

9. **Save Your Credentials:**
   ```
   Your Client ID: 
   123456789-abcdefghijklmnop.apps.googleusercontent.com
   
   Your Client Secret: 
   GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
   ```
   
   ⚠️ **IMPORTANT**: Copy these NOW! You'll need them for `.env` file.

10. Click **"OK"**

---

## ⚙️ Backend Configuration

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- `passport` - Authentication middleware
- `passport-google-oauth20` - Google OAuth 2.0 strategy
- `express-session` - Session management

---

### Step 2: Create `.env` File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Google credentials:
   ```env
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/chatapp

   # JWT Secret
   JWT_SECRET=your-super-secret-jwt-key-change-in-production

   # Server Configuration
   PORT=3002
   NODE_ENV=development

   # Client URL (for CORS)
   CLIENT_URL=http://localhost:3002

   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

   # Session Secret
   SESSION_SECRET=your-session-secret-key-change-in-production
   ```

3. **Replace** the placeholder values with your actual credentials

---

### Step 3: Start the Server

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

## 🎨 Frontend Integration

### Method 1: Direct Link (Simple)

Add this button to your `login.html` or `index.html`:

```html
<!-- Google Sign-In Button -->
<button onclick="window.location.href='/api/auth/google'" class="google-btn">
  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
  Sign in with Google
</button>

<style>
.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: white;
  color: #444;
  border: 1px solid #ddd;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: box-shadow 0.3s;
}

.google-btn:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.google-btn img {
  width: 20px;
  height: 20px;
}
</style>
```

---

### Method 2: JavaScript Implementation

Add to your `app.js`:

```javascript
// Handle Google OAuth callback
function handleGoogleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const email = urlParams.get('email');
  const username = urlParams.get('username');

  if (token && email) {
    // Store credentials
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('username', username);
    
    // Remove parameters from URL
    window.history.replaceState({}, document.title, '/');
    
    // Initialize chat
    initializeChat();
    
    console.log('✅ Google OAuth login successful');
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', handleGoogleCallback);
```

---

## ✅ Testing

### Local Testing Checklist

1. **Start MongoDB**:
   ```bash
   mongod
   ```

2. **Start Backend**:
   ```bash
   npm run dev
   ```

3. **Open Browser**:
   ```
   http://localhost:3002
   ```

4. **Click "Sign in with Google"**

5. **Expected Flow**:
   ```
   ✅ Redirects to Google login page
   ✅ Shows app name: "ChatFlow"
   ✅ Asks for email/profile permissions
   ✅ After approval, redirects back to your app
   ✅ User is logged in automatically
   ✅ Chat interface appears
   ```

---

### Test User Data in MongoDB

Check if user was created:

```bash
mongosh

use chatapp

db.users.find({ isGoogleAuth: true }).pretty()
```

Expected output:
```json
{
  "_id": ObjectId("..."),
  "username": "John Doe",
  "email": "john.doe@gmail.com",
  "googleId": "123456789012345678901",
  "avatar": "https://lh3.googleusercontent.com/...",
  "isGoogleAuth": true,
  "isVerified": true,
  "isOnline": false,
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

---

## 🚀 Production Deployment

### Step 1: Update Google OAuth

1. Go back to [Google Cloud Console](https://console.cloud.google.com/)
2. **Credentials** → Click your OAuth Client ID
3. **Add Production URLs**:
   
   **Authorized JavaScript origins:**
   ```
   https://your-domain.com
   https://www.your-domain.com
   ```
   
   **Authorized redirect URIs:**
   ```
   https://your-domain.com/api/auth/google/callback
   https://www.your-domain.com/api/auth/google/callback
   ```

4. Click **"SAVE"**

---

### Step 2: Update `.env` for Production

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatapp
CLIENT_URL=https://your-domain.com
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback
```

---

### Step 3: Publishing Status

If you want anyone to use Google login:

1. Go to **"OAuth consent screen"**
2. Click **"PUBLISH APP"**
3. Click **"CONFIRM"**
4. ⚠️ **Note**: Google may require verification for production apps

---

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"

**Problem**: Callback URL doesn't match

**Solution**:
1. Check your `.env` file:
   ```env
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   ```
2. Verify it EXACTLY matches the URL in Google Console
3. Remember: Port number matters!
4. Restart your server after changing `.env`

---

### Error: "Access blocked: This app's request is invalid"

**Problem**: OAuth consent screen not configured

**Solution**:
1. Go to **"OAuth consent screen"**
2. Add your email as a test user
3. Make sure scopes include:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

---

### Error: "User not found" after Google login

**Problem**: Token not being generated/stored

**Solution**:
1. Check console for errors
2. Verify JWT_SECRET in `.env`
3. Check MongoDB is running
4. Check network tab for `/api/auth/google/callback` response

---

### Google Login Works but User Not Created

**Problem**: Database connection or model issue

**Solution**:
1. Check MongoDB connection:
   ```javascript
   console.log('MongoDB URI:', process.env.MONGODB_URI);
   ```
2. Check User model has all fields:
   - `googleId`
   - `avatar`
   - `isGoogleAuth`
   - `isVerified`
3. Check server logs for errors

---

### Multiple Users with Same Email

**Problem**: Email uniqueness not enforced

**Solution**:
- User model already handles this
- It links Google account to existing email
- Check logs: "Linked Google account to existing user"

---

## 📊 Architecture Overview

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ 1. Click "Sign in with Google"
       │
       ▼
┌─────────────────────┐
│   Express Server    │
│  /api/auth/google   │
└──────┬──────────────┘
       │ 2. Redirect to Google
       │
       ▼
┌─────────────────────┐
│  Google OAuth API   │
│  (accounts.google)  │
└──────┬──────────────┘
       │ 3. User approves
       │
       ▼
┌─────────────────────────────┐
│   Express Server            │
│  /api/auth/google/callback  │
└──────┬──────────────────────┘
       │ 4. Exchange code for profile
       │ 5. Create/update user in MongoDB
       │ 6. Generate JWT token
       │
       ▼
┌─────────────┐
│   Browser   │
│  /?token=...│
└─────────────┘
   7. Store token
   8. Initialize chat
```

---

## 🔒 Security Best Practices

1. **Never commit `.env` file**:
   - Already in `.gitignore`
   - Use `.env.example` for documentation

2. **Use strong secrets**:
   ```bash
   # Generate random secrets
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Enable HTTPS in production**:
   - Use SSL certificate
   - Set `secure: true` for cookies

4. **Regularly rotate secrets**:
   - JWT_SECRET
   - SESSION_SECRET

5. **Monitor OAuth usage**:
   - Check Google Cloud Console
   - Review API quotas

---

## 📚 Additional Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Documentation](http://www.passportjs.org/docs/)
- [Express Session Documentation](https://github.com/expressjs/session)

---

## ✅ Checklist

Before going live, ensure:

- [ ] Google OAuth credentials configured
- [ ] Test users added (if Publishing status = Testing)
- [ ] `.env` file created with correct values
- [ ] Dependencies installed (`npm install`)
- [ ] MongoDB running
- [ ] Server starts without errors
- [ ] Google login button added to frontend
- [ ] Callback handler implemented
- [ ] Tested login flow end-to-end
- [ ] User data appears in MongoDB
- [ ] Existing email users can link Google account
- [ ] Error handling in place
- [ ] Production URLs added (for deployment)

---

## 🎉 Success!

If everything works, you should see:
- ✅ Google login button on your app
- ✅ Smooth OAuth flow
- ✅ User created/updated in database
- ✅ JWT token generated
- ✅ Chat interface loads automatically

**Need help?** Check the troubleshooting section or review server logs!

---

**Created for ChatFlow Project**  
*Last Updated: 2025*
