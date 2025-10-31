# API Documentation

## Base URL
```
http://localhost:3002/api
```

## Authentication
All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "username": "string (3-30 chars)",
  "email": "string (valid email)",
  "password": "string (min 6 chars)"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "username": "username",
    "email": "email@example.com"
  }
}
```

**Rate Limit:** 5 requests per 15 minutes

---

### 2. Login User
**POST** `/auth/login`

Authenticate and receive a JWT token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "username": "username",
    "email": "email@example.com"
  }
}
```

**Rate Limit:** 5 requests per 15 minutes

---

### 3. Logout User
**POST** `/auth/logout`

Logout and update user status.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Logout successful"
}
```

---

### 4. Get Current User Profile
**GET** `/auth/profile`

Get currently logged-in user information.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "user-id",
    "username": "username",
    "email": "email@example.com",
    "isOnline": true,
    "lastSeen": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 5. Get All Users
**GET** `/auth/users`

Get list of all registered users.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "users": [
    {
      "_id": "user-id",
      "username": "username",
      "email": "email@example.com",
      "isOnline": true,
      "lastSeen": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 6. Update Username
**PUT** `/auth/update-username`

Update current user's username.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "username": "newusername"
}
```

**Response (200):**
```json
{
  "message": "Username updated successfully",
  "user": {
    "id": "user-id",
    "username": "newusername",
    "email": "email@example.com"
  }
}
```

---

### 7. Update Email
**PUT** `/auth/update-email`

Update current user's email.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": "newemail@example.com"
}
```

**Response (200):**
```json
{
  "message": "Email updated successfully",
  "user": {
    "id": "user-id",
    "username": "username",
    "email": "newemail@example.com"
  }
}
```

---

### 8. Change Password
**PUT** `/auth/change-password`

Change user password.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "oldPassword": "current-password",
  "newPassword": "new-password"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

---

### 9. Delete Account
**DELETE** `/auth/delete-account`

Permanently delete user account.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "password": "user-password"
}
```

**Response (200):**
```json
{
  "message": "Account deleted successfully"
}
```

---

## Chat Endpoints

### 1. Get General Chat Messages
**GET** `/chat/messages/general?page=1&limit=50`

Get paginated general chat messages.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50)

**Response (200):**
```json
{
  "messages": [
    {
      "_id": "message-id",
      "sender": {
        "_id": "user-id",
        "username": "username",
        "email": "email@example.com"
      },
      "content": "Hello world!",
      "type": "general",
      "isEdited": false,
      "isDeleted": false,
      "reactions": [],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "page": 1,
  "hasMore": true
}
```

---

### 2. Get Private Messages
**GET** `/chat/messages/private/:recipientEmail?page=1&limit=50`

Get private conversation with a specific user.

**Headers:** `Authorization: Bearer <token>`

**URL Parameters:**
- `recipientEmail`: Email of the other user

**Response (200):**
```json
{
  "messages": [...],
  "page": 1,
  "hasMore": false
}
```

---

### 3. Get Group Messages
**GET** `/chat/messages/group/:groupId?page=1&limit=50`

Get messages from a specific group.

**Headers:** `Authorization: Bearer <token>`

**URL Parameters:**
- `groupId`: ID of the group

**Response (200):**
```json
{
  "messages": [...],
  "page": 1,
  "hasMore": false
}
```

---

### 4. Send Message
**POST** `/chat/messages`

Send a new message.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Message text",
  "type": "general|private|group|hotspot",
  "recipientEmail": "recipient@example.com", // For private messages
  "groupId": "group-id", // For group messages
  "groupName": "Group Name", // For group messages
  "hotspotColor": "#ff0000", // For hotspot messages
  "networkId": "192.168.1" // For hotspot messages
}
```

**Response (201):**
```json
{
  "message": "Message saved successfully",
  "messageId": "message-id"
}
```

---

### 5. Edit Message
**PUT** `/chat/messages/:messageId`

Edit an existing message (own messages only).

**Headers:** `Authorization: Bearer <token>`

**URL Parameters:**
- `messageId`: ID of the message to edit

**Request Body:**
```json
{
  "content": "Updated message text"
}
```

**Response (200):**
```json
{
  "message": "Message updated successfully",
  "updatedMessage": {
    "_id": "message-id",
    "content": "Updated message text",
    "isEdited": true,
    "editedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 6. Delete Message
**DELETE** `/chat/messages/:messageId`

Delete a message (soft delete - own messages only).

**Headers:** `Authorization: Bearer <token>`

**URL Parameters:**
- `messageId`: ID of the message to delete

**Response (200):**
```json
{
  "message": "Message deleted successfully"
}
```

---

### 7. Search Messages
**GET** `/chat/messages/search/:query?type=general&limit=20`

Search messages by content.

**Headers:** `Authorization: Bearer <token>`

**URL Parameters:**
- `query`: Search term (min 2 characters)

**Query Parameters:**
- `type` (optional): Message type filter
- `limit` (optional): Max results (default: 20)

**Response (200):**
```json
{
  "messages": [...],
  "count": 5
}
```

---

### 8. Add Reaction
**POST** `/chat/messages/:messageId/react`

Add or toggle a reaction to a message.

**Headers:** `Authorization: Bearer <token>`

**URL Parameters:**
- `messageId`: ID of the message

**Request Body:**
```json
{
  "emoji": "👍"
}
```

**Response (200):**
```json
{
  "message": "Reaction updated successfully",
  "reactions": [
    {
      "userId": "user-id",
      "username": "username",
      "emoji": "👍",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 9. Remove Reaction
**DELETE** `/chat/messages/:messageId/react/:emoji`

Remove a specific reaction from a message.

**Headers:** `Authorization: Bearer <token>`

**URL Parameters:**
- `messageId`: ID of the message
- `emoji`: URL-encoded emoji to remove

**Response (200):**
```json
{
  "message": "Reaction removed successfully",
  "reactions": []
}
```

---

### 10. Get Unread Count
**GET** `/chat/messages/unread`

Get count of unread private messages.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "unreadCount": 5
}
```

---

## Rate Limits

| Endpoint Type | Rate Limit |
|--------------|------------|
| Authentication | 5 requests per 15 minutes |
| General API | 100 requests per 15 minutes |
| Messages | 30 messages per minute |
| File Upload | 10 uploads per hour |

---

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [...]
}
```

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Invalid token. Please log in again!"
}
```

### 403 Forbidden
```json
{
  "error": "You can only edit your own messages"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Can't find /api/invalid-route on this server!"
}
```

### 429 Too Many Requests
```json
{
  "message": "Too many requests from this IP, please try again later."
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Something went wrong!"
}
```

---

## WebSocket Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `send-message` | `{ content, type, ... }` | Send a message |
| `typing` | `{ recipientEmail }` | User is typing |
| `stop-typing` | `{ recipientEmail }` | User stopped typing |
| `join-group` | `{ groupId }` | Join a group chat |
| `leave-group` | `{ groupId }` | Leave a group chat |
| `disconnect` | - | User disconnected |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `receive-message` | `{ message object }` | New message received |
| `user-typing` | `{ username, email }` | Someone is typing |
| `user-stopped-typing` | `{ username, email }` | Someone stopped typing |
| `online-users-updated` | `[{ username, email, id }]` | Online users list |
| `message-edited` | `{ messageId, content }` | Message was edited |
| `message-deleted` | `{ messageId }` | Message was deleted |
| `message-reaction` | `{ messageId, reactions }` | Reaction added/removed |

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Never share your JWT_SECRET**
3. **Implement CORS** properly for your domain
4. **Validate all user input** on both client and server
5. **Use environment variables** for sensitive data
6. **Keep dependencies updated** regularly
7. **Implement proper session management**
8. **Use strong passwords** (enforce password policies)

---

## Examples

### cURL Examples

**Register:**
```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

**Send Message:**
```bash
curl -X POST http://localhost:3002/api/chat/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"content":"Hello!","type":"general"}'
```

---

For more information, visit the [README](./README.md).
