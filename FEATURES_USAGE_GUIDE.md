# 📖 NEW FEATURES USAGE GUIDE

Complete guide on how to use the newly added features in your chat application.

---

## 🎯 FEATURES OVERVIEW

1. **Edit Messages** - Modify sent messages
2. **Delete Messages** - Remove messages (soft delete)
3. **Search Messages** - Find messages by content
4. **Message Reactions** - React with emojis

---

## 1️⃣ EDIT MESSAGES

### How Users See It:
1. **Hover over YOUR message** → Three dots (⋮) appear
2. **Click the dots** → Menu opens
3. **Click "Edit"** → Dialog box appears
4. **Enter new text** → Click OK
5. **Message updates** with "(edited)" tag

### Example Usage:
When a message is displayed, the edit button appears automatically for your own messages.

### Backend API:
```javascript
PUT /api/chat/messages/:messageId
Body: { "content": "New message text" }
Headers: Authorization: Bearer <token>
```

### Response:
```json
{
  "message": "Message updated successfully",
  "updatedMessage": {
    "_id": "message-id",
    "content": "New message text",
    "isEdited": true,
    "editedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Programmatic Usage:
```javascript
// Edit a message
await editMessage('message-id-here', 'New content');
```

---

## 2️⃣ DELETE MESSAGES

### How Users See It:
1. **Hover over YOUR message** → Three dots (⋮) appear
2. **Click the dots** → Menu opens
3. **Click "Delete"** → Confirmation dialog
4. **Click "OK"** → Message shows "This message was deleted"

### Backend API:
```javascript
DELETE /api/chat/messages/:messageId
Headers: Authorization: Bearer <token>
```

### Response:
```json
{
  "message": "Message deleted successfully"
}
```

### Notes:
- **Soft Delete**: Message is marked as deleted, not removed from database
- **Content Changed**: Displays "This message was deleted"
- **Only Your Messages**: Can only delete messages you sent

### Programmatic Usage:
```javascript
// Delete a message
await deleteMessage('message-id-here');
```

---

## 3️⃣ SEARCH MESSAGES

### How to Add Search UI:

Add this to your HTML (in the chat header area):

```html
<!-- Add this search bar in your sidebar header -->
<div class="search-messages-container">
    <input type="text" 
           id="messageSearchInput" 
           placeholder="Search messages..." 
           class="search-messages-input">
    <button id="searchMessagesBtn" class="search-btn">
        <i class="fas fa-search"></i>
    </button>
</div>

<!-- Search results container -->
<div id="searchResults" class="search-results-panel hidden"></div>
```

### Add JavaScript Handler:

```javascript
// In your app.js, add this:
const searchInput = document.getElementById('messageSearchInput');
const searchBtn = document.getElementById('searchMessagesBtn');
const searchResults = document.getElementById('searchResults');

searchBtn?.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
        searchResults.classList.remove('hidden');
        const results = await searchMessages(query, 'general');
    } else {
        showNotification('Please enter at least 2 characters', 'error');
    }
});

// Search on Enter key
searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// Close search results
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-messages-container') && 
        !e.target.closest('#searchResults')) {
        searchResults?.classList.add('hidden');
    }
});
```

### Backend API:
```javascript
GET /api/chat/messages/search/:query?type=general&limit=20
Headers: Authorization: Bearer <token>
```

### Response:
```json
{
  "messages": [
    {
      "_id": "message-id",
      "senderUsername": "john",
      "content": "Hello world!",
      "type": "general",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Programmatic Usage:
```javascript
// Search messages
const results = await searchMessages('hello', 'general');
console.log(results); // Array of matching messages
```

---

## 4️⃣ MESSAGE REACTIONS

### How Users See It:
1. **Hover over ANY message** → Smiley face (😊) appears
2. **Click the smiley** → Emoji picker opens
3. **Click an emoji** → Reaction added
4. **Reactions appear below message** with count
5. **Click same emoji again** → Removes your reaction

### Available Emojis:
❤️ 👍 😂 😮 😢 🔥 🎉 👏

### Backend API:
```javascript
// Add reaction
POST /api/chat/messages/:messageId/react
Body: { "emoji": "❤️" }
Headers: Authorization: Bearer <token>

// Remove reaction  
DELETE /api/chat/messages/:messageId/react/:emoji
Headers: Authorization: Bearer <token>
```

### Response:
```json
{
  "message": "Reaction updated successfully",
  "reactions": [
    {
      "userId": "user-id",
      "username": "john",
      "emoji": "❤️",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Programmatic Usage:
```javascript
// Add a reaction
await addReaction('message-id-here', '❤️');

// Toggle reaction (add if not exists, remove if exists)
await addReaction('message-id-here', '👍');
```

---

## 🔧 INTEGRATION INTO MESSAGE DISPLAY

To automatically add edit/delete/reaction buttons to messages, update your message display function:

### Find your message rendering function and add:

```javascript
function displayMessage(message) {
    // Your existing message display code...
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.dataset.messageId = message._id;
    
    // ... your existing message HTML creation ...
    
    // ADD THESE LINES:
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const isSender = message.sender._id === currentUser.id || 
                     message.senderEmail === currentUser.email;
    
    // Add edit/delete buttons for own messages
    if (isSender && !message.isDeleted) {
        addMessageActions(messageElement, message._id, true);
    }
    
    // Add reaction button for all messages
    if (!message.isDeleted) {
        addReactionPicker(messageElement, message._id);
    }
    
    // Display existing reactions
    if (message.reactions && message.reactions.length > 0) {
        updateReactionsUI(message._id, message.reactions);
    }
    
    // Show edited indicator
    if (message.isEdited) {
        const contentElement = messageElement.querySelector('.message-text');
        const editedTag = document.createElement('span');
        editedTag.className = 'edited-tag';
        editedTag.textContent = ' (edited)';
        contentElement.appendChild(editedTag);
    }
    
    // Append message to chat
    messagesContainer.appendChild(messageElement);
}
```

---

## 🎨 SEARCH UI CSS (Add to styles.css)

```css
.search-messages-container {
    display: flex;
    gap: 8px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    margin: 10px;
}

.search-messages-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #e1e5e9;
    border-radius: 6px;
    font-size: 0.9rem;
    outline: none;
}

.search-messages-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-btn {
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.search-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.search-results-panel {
    position: absolute;
    top: 60px;
    left: 10px;
    right: 10px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-height: 400px;
    overflow-y: auto;
}

.search-results-panel.hidden {
    display: none;
}

[data-theme="dark"] .search-results-panel {
    background: #2a3942;
}
```

---

## 🧪 TESTING THE FEATURES

### Test Edit:
1. Send a message: "Hello"
2. Hover over it → Click ⋮ → Edit
3. Change to "Hello World"
4. Verify "(edited)" tag appears

### Test Delete:
1. Send a message
2. Hover → Click ⋮ → Delete → Confirm
3. Verify shows "This message was deleted"

### Test Search:
1. Send several messages
2. Type search query (min 2 chars)
3. Click search button
4. Verify results appear

### Test Reactions:
1. Hover over any message
2. Click 😊 button
3. Select an emoji
4. Verify reaction appears below message
5. Click same emoji again → Verify it's removed

---

## 📱 REAL-TIME UPDATES

All features support real-time updates via Socket.IO:

- **Edit**: Other users see edited messages instantly
- **Delete**: Deletion appears in real-time for everyone
- **Reactions**: Reactions update live for all users

### Socket Events Emitted:
```javascript
socket.emit('message-edited', { messageId, content });
socket.emit('message-deleted', { messageId });
socket.emit('message-reaction', { messageId, reactions });
```

### Socket Events Received:
```javascript
socket.on('message-edited', (data) => { /* update UI */ });
socket.on('message-deleted', (data) => { /* update UI */ });
socket.on('message-reaction', (data) => { /* update UI */ });
```

---

## 🔐 SECURITY & PERMISSIONS

### Edit/Delete:
- ✅ Only message sender can edit/delete
- ✅ Verified on backend via JWT token
- ✅ Cannot edit/delete already deleted messages

### Search:
- ✅ Only searches user's accessible messages
- ✅ Private messages: Only searches your conversations
- ✅ Requires authentication

### Reactions:
- ✅ Any authenticated user can react
- ✅ One reaction per user per emoji
- ✅ Toggle behavior (click again to remove)

---

## 💡 QUICK REFERENCE

| Feature | Keyboard Shortcut | API Endpoint |
|---------|------------------|--------------|
| Edit | Click ⋮ → Edit | `PUT /api/chat/messages/:id` |
| Delete | Click ⋮ → Delete | `DELETE /api/chat/messages/:id` |
| Search | Type + Enter | `GET /api/chat/messages/search/:query` |
| React | Click 😊 | `POST /api/chat/messages/:id/react` |

---

## 🐛 TROUBLESHOOTING

### Edit/Delete buttons not showing:
- Ensure you're hovering over YOUR messages
- Check if `addMessageActions()` is called
- Verify `data-message-id` attribute exists

### Search not working:
- Minimum 2 characters required
- Check if JWT token is valid
- Verify MongoDB text index created

### Reactions not appearing:
- Ensure `addReactionPicker()` is called
- Check if message has `.message-content` element
- Verify socket connection active

---

## 🚀 NEXT STEPS

1. **Install packages**: `npm install`
2. **Restart server**: `npm run dev`
3. **Test features** in your browser
4. **Customize emojis** in the reactions array
5. **Style to match** your theme

---

**All features are now ready to use! 🎉**
