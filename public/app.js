// ============================================
// AUTOMATIC TOKEN VALIDATION & TOKEN KEY SYNC
// ============================================
function checkTokenValidity() {
    // Check both possible token keys (token and chatToken)
    let token = localStorage.getItem('token') || localStorage.getItem('chatToken');
    
    // Sync tokens - if one exists, copy to both keys
    if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('chatToken', token);
        
        try {
            // Decode JWT token
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            
            // Check if token is expired
            const expiryTime = payload.exp * 1000; // Convert to milliseconds
            const currentTime = new Date().getTime();
            
            if (currentTime >= expiryTime) {
                console.log('🔄 Token expired. Auto-clearing old session...');
                localStorage.clear();
                sessionStorage.clear();
                
                // Show message and redirect
                alert('Your session has expired. Please log in again.');
                window.location.href = '/';
                return false;
            } else {
                const daysLeft = Math.floor((expiryTime - currentTime) / (1000 * 60 * 60 * 24));
                console.log('✅ Token valid. Days remaining:', daysLeft);
                return true;
            }
        } catch (error) {
            console.log('⚠️ Invalid token detected. Auto-clearing...');
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/';
            return false;
        }
    }
    return true; // No token is fine (might be on login page)
}

// Check token on page load
checkTokenValidity();

// Periodic token check every 5 minutes
setInterval(() => {
    checkTokenValidity();
}, 5 * 60 * 1000);

// Global variables
let socket = null;
let currentUser = null;
let currentChat = { type: 'general', target: null };
let networkInfo = null;
let activePrivateChats = new Map(); // Track active private conversations
let hotspotMessages = []; // Store hotspot messages for the session
let recentChats = new Map(); // Store recent chat history
let groupChats = new Map(); // Store group chat info (unread counts, status)
let allUsers = new Map(); // Store all users (online/offline)

// Debug functions - can be called from browser console
window.testSendMessage = function(testMessage = 'Test message from console') {
    console.log('=== TESTING MESSAGE SEND ===');
    console.log('messageInput:', messageInput);
    console.log('sendMessageBtn:', sendMessageBtn); 
    console.log('socket:', socket);
    console.log('currentChat:', currentChat);
    
    if (messageInput) {
        messageInput.value = testMessage;
        sendMessage();
    } else {
        console.error('Cannot test - messageInput not found');
    }
};

window.testConnection = function() {
    console.log('=== CONNECTION TEST ===');
    console.log('Socket:', socket);
    console.log('Socket connected:', socket?.connected);
    console.log('Current URL:', window.location.href);
    console.log('Token exists:', !!localStorage.getItem('chatToken'));
    console.log('Token value:', localStorage.getItem('chatToken'));
    
    // Test server connectivity
    fetch('/api/auth/profile', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('chatToken')}`
        }
    })
    .then(response => {
        console.log('Server response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Server response data:', data);
    })
    .catch(error => {
        console.error('Server connection error:', error);
    });
};

window.forceReconnect = function() {
    console.log('=== FORCING SOCKET RECONNECTION ===');
    if (socket) {
        socket.disconnect();
    }
    setTimeout(() => {
        initializeSocket();
    }, 1000);
};

// DOM elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loadingOverlay = document.getElementById('loadingOverlay');
const notificationContainer = document.getElementById('notificationContainer');

// Auth elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const loginFormElement = document.getElementById('loginForm');
const registerFormElement = document.getElementById('registerForm');

// Chat elements
const currentUsername = document.getElementById('currentUsername');
const currentUserEmail = document.getElementById('currentUserEmail');
const logoutBtn = document.getElementById('logoutBtn');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const messagesList = document.getElementById('messagesList');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const networkDetectBtn = document.getElementById('networkDetectBtn');
const hotspotTab = document.getElementById('hotspotTab');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('JavaScript is loading...');
    
    // Handle Google OAuth callback
    handleGoogleOAuthCallback();
    
    // Show splash screen animation, then show appropriate screen
    setTimeout(() => {
        const splashScreen = document.getElementById('splashScreen');
        const authContainer = document.getElementById('auth-container');
        const chatContainer = document.getElementById('chat-container');
        
        // After splash animation completes, check token and show correct screen
        setTimeout(() => {
            const token = localStorage.getItem('token') || localStorage.getItem('chatToken');
            
            if (token) {
                // Has token - validate and show chat if valid
                console.log('Token found, validating...');
                chatContainer.classList.remove('hidden');
                authContainer.classList.add('hidden');
            } else {
                // No token - show auth
                console.log('No token, showing auth...');
                authContainer.classList.remove('hidden');
                chatContainer.classList.add('hidden');
            }
        }, 4300); // Show after splash fades out (3.5s animation + 0.8s fade)
    }, 100);
    
    initializeApp();
});

function initializeApp() {
    // Check for existing token
    const token = localStorage.getItem('chatToken');
    if (token) {
        validateTokenAndConnect(token);
    }

    // Auth event listeners
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    loginFormElement.addEventListener('submit', handleLogin);
    registerFormElement.addEventListener('submit', handleRegister);

    // Chat event listeners
    logoutBtn.addEventListener('click', handleLogout);
    
    if (sendMessageBtn) {
        console.log('Adding click listener to send button');
        sendMessageBtn.addEventListener('click', sendMessage);
    } else {
        console.error('Send message button not found!');
    }
    
    if (messageInput) {
        console.log('Adding keypress listener to message input');
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter key pressed, sending message');
                sendMessage();
            }
        });
    } else {
        console.error('Message input not found!');
    }

    networkDetectBtn.addEventListener('click', detectNetwork);

    // Emoji button functionality
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    if (emojiBtn && emojiPicker) {
        console.log('Setting up emoji button listener directly');
        emojiBtn.addEventListener('click', (e) => {
            console.log('Emoji button clicked directly!');
            e.preventDefault();
            e.stopPropagation();
            emojiPicker.classList.toggle('hidden');
            if (!emojiPicker.classList.contains('hidden')) {
                initializeEmojiGrid();
            }
        });
    } else {
        console.error('Emoji button or picker not found in main setup!');
    }

    // File sharing functionality
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');
    
    if (attachBtn && fileInput) {
        console.log('Setting up file sharing functionality');
        
        // Attach button click
        attachBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                handleFileUpload(files);
            }
        });
        
        // Drag and drop functionality
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer && fileUploadArea) {
            chatContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.classList.add('active');
            });
            
            chatContainer.addEventListener('dragleave', (e) => {
                if (!chatContainer.contains(e.relatedTarget)) {
                    fileUploadArea.classList.remove('active');
                }
            });
            
            chatContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('active');
                
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    handleFileUpload(files);
                }
            });
        }
    } else {
        console.error('File sharing elements not found!');
    }

    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Chat item clicks
    document.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem) {
            const chatType = chatItem.dataset.chat;
            switchToChat(chatType);
            
            // Update active state
            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
            chatItem.classList.add('active');
        }
    });

    // Group chat functionality
    const createGroupBtn = document.getElementById('createGroupBtn');
    const detectNetworkBtn = document.getElementById('detectNetworkBtn');
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', createGroup);
    }
    
    if (detectNetworkBtn) {
        detectNetworkBtn.addEventListener('click', detectNetwork);
    }
}

// Authentication functions
function showRegisterForm() {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
}

function showLoginForm() {
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
}

/**
 * Handle Google OAuth callback
 * Extracts token from URL parameters after Google redirects back
 */
function handleGoogleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');
    const username = urlParams.get('username');

    if (token && email) {
        console.log('✅ Google OAuth successful!');
        console.log('  - Email:', email);
        console.log('  - Username:', username);
        
        // Store credentials in localStorage
        localStorage.setItem('chatToken', token);
        localStorage.setItem('token', token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('username', username);
        
        // Remove URL parameters (clean URL)
        window.history.replaceState({}, document.title, '/');
        
        // Show success notification
        setTimeout(() => {
            showNotification(`Welcome ${username}! Signed in with Google`, 'success');
        }, 1000);
        
        console.log('✅ Google OAuth login complete, credentials stored');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    console.log('=== LOGIN ATTEMPT ===');
    showLoading(true);

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    console.log('Login data:', { email, password });

    try {
        console.log('Sending login request...');
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Login response status:', response.status);

        const data = await response.json();

        if (response.ok) {
            // Save token to both keys for consistency
            localStorage.setItem('token', data.token);
            localStorage.setItem('chatToken', data.token);
            currentUser = data.user;
            showNotification('Login successful!', 'success');
            initializeChat();
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('=== REGISTER ATTEMPT ===');
    showLoading(true);

    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    console.log('Register data:', { username, email, password });

    try {
        console.log('Sending register request...');
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        console.log('Register response status:', response.status);

        const data = await response.json();

        if (response.ok) {
            // Save token to both keys for consistency
            localStorage.setItem('token', data.token);
            localStorage.setItem('chatToken', data.token);
            currentUser = data.user;
            showNotification('Registration successful!', 'success');
            initializeChat();
        } else {
            showNotification(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function validateTokenAndConnect(token) {
    showLoading(true);

    try {
        console.log('Validating token...');
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Token validation response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Token validation successful, user data:', data);
            currentUser = data.user;
            
            if (currentUser) {
                console.log('Initializing chat for user:', currentUser.username);
                initializeChat();
            } else {
                console.error('No user data received');
                localStorage.removeItem('chatToken');
                showNotification('Invalid user data. Please login again.', 'error');
            }
        } else {
            console.log('Token validation failed, status:', response.status);
            localStorage.removeItem('chatToken');
            showNotification('Session expired. Please login again.', 'warning');
        }
    } catch (error) {
        console.error('Token validation error:', error);
        localStorage.removeItem('chatToken');
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function handleLogout() {
    // Clear both token keys and user data
    localStorage.removeItem('chatToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userEmail');
    
    if (socket) {
        socket.disconnect();
    }
    
    // Reset state
    currentUser = null;
    socket = null;
    
    // Clear hotspot session messages
    clearHotspotSession();
    
    // Show auth container, hide chat
    chatContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    
    showNotification('Logged out successfully', 'success');
}

// Chat initialization
function initializeChat() {
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    
    // Update user display
    if (currentUser) {
        console.log('Setting user display:', currentUser);
        if (currentUsername) {
            currentUsername.textContent = currentUser.username;
        }
        if (currentUserEmail) {
            currentUserEmail.textContent = currentUser.email;
        }
        
        // Store user email for profile picture storage
        localStorage.setItem('userEmail', currentUser.email);
        
        // Load user-specific profile picture
        loadUserProfilePicture();
    } else {
        console.log('No currentUser data available');
    }
    
    // Load recent chats from storage
    loadRecentChatsFromStorage();
    loadGroupChatsFromStorage();
    
    // Initialize socket connection
    initializeSocket();
    
    // Note: Event listeners are set up individually throughout the code
    // No need for central setupEventListeners function
    
    // Set default tab to groups (where General Chat now lives)
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activate groups tab by default
    document.querySelector('[data-tab="groups"]').classList.add('active');
    document.getElementById('groupsTab').classList.add('active');
    
    // Set default chat to general and activate the general chat item
    switchToChat('general');
    document.querySelector('[data-chat="general"]')?.classList.add('active');
    
    // Test message display function
    setTimeout(() => {
        console.log('Testing message display...');
        const testMessage = {
            id: 'test-123',
            username: 'System',
            email: 'system@test.com',
            message: 'Test message - if you see this, the display function works!',
            timestamp: new Date(),
            type: 'general'
        };
        displayMessage(testMessage);
    }, 2000);
    
    // Join general chat by default
    socket.emit('join-general-chat');
    
    // Initialize user search
    initializeUserSearch();
}

// ============================================
// USER SEARCH FUNCTIONALITY
// ============================================
function initializeUserSearch() {
    const chatSearchInput = document.getElementById('chatSearch');
    const searchResultsDropdown = document.getElementById('userSearchResults');
    
    console.log('🔧 Initializing user search...');
    console.log('📋 Search input found:', !!chatSearchInput);
    console.log('📋 Dropdown found:', !!searchResultsDropdown);
    
    if (!chatSearchInput || !searchResultsDropdown) {
        console.error('❌ Search elements not found!');
        return;
    }
    
    console.log('✅ User search initialized successfully');
    
    let searchTimeout;
    
    // Search as user types
    chatSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        console.log('⌨️ User typed:', query);
        
        // Clear previous timeout
        clearTimeout(searchTimeout);
        
        if (query.length === 0) {
            searchResultsDropdown.classList.add('hidden');
            return;
        }
        
        // Show loading state immediately
        searchResultsDropdown.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Searching...</p>
            </div>
        `;
        searchResultsDropdown.classList.remove('hidden');
        
        // Wait 300ms after user stops typing
        searchTimeout = setTimeout(() => {
            console.log('🚀 Triggering search for:', query);
            searchUsers(query);
        }, 300);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResultsDropdown.classList.add('hidden');
        }
    });
    
    // Keep dropdown open when clicking inside search
    chatSearchInput.addEventListener('focus', () => {
        if (chatSearchInput.value.trim()) {
            searchUsers(chatSearchInput.value.trim());
        }
    });
}

async function searchUsers(query) {
    const searchResultsDropdown = document.getElementById('userSearchResults');
    
    console.log('🔍 searchUsers called with:', query);
    console.log('🔍 Dropdown element found?', !!searchResultsDropdown);
    
    if (!searchResultsDropdown) {
        console.error('❌ userSearchResults element not found in DOM!');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        console.log('🔍 Searching for:', query);
        
        const response = await fetch(`/api/auth/users/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📡 Search response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📋 Search results:', data.users);
            console.log('📊 Found', data.users?.length || 0, 'users');
            console.log('🎯 About to call displayUserSearchResults with', data.users?.length || 0, 'users');
            console.log('🎯 displayUserSearchResults function exists?', typeof displayUserSearchResults);
            displayUserSearchResults(data.users || []);
            console.log('🎯 displayUserSearchResults call completed');
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Search failed:', response.status, errorData);
            searchResultsDropdown.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error searching users (${response.status})</p>
                    <p style="font-size: 0.85rem; margin-top: 5px;">${errorData.error || 'Please try again'}</p>
                </div>
            `;
            searchResultsDropdown.classList.remove('hidden');
        }
    } catch (error) {
        console.error('❌ Search error:', error);
        searchResultsDropdown.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-wifi-slash"></i>
                <p>Network error. Please try again.</p>
            </div>
        `;
        searchResultsDropdown.classList.remove('hidden');
    }
}

function displayUserSearchResults(users) {
    console.log('🎨 displayUserSearchResults STARTED');
    
    try {
        const searchResultsDropdown = document.getElementById('userSearchResults');
        
        console.log('🎨 Dropdown element:', searchResultsDropdown);
        console.log('🎨 Users received:', users);
        console.log('🎨 Displaying search results:', {
            totalUsers: users.length,
            currentUserEmail: currentUser?.email,
            users: users.map(u => ({ username: u.username, email: u.email }))
        });
    
    if (users.length === 0) {
        console.log('⚠️ No users to display');
        searchResultsDropdown.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-user-slash"></i>
                <p>No users found</p>
                <p style="font-size: 0.85rem; margin-top: 5px;">Try searching by email or username</p>
            </div>
        `;
        searchResultsDropdown.classList.remove('hidden');
        return;
    }
    
    // Filter out current user
    const filteredUsers = users.filter(user => user.email !== currentUser?.email);
    
    console.log('🔍 After filtering current user:', {
        filteredCount: filteredUsers.length,
        filteredUsers: filteredUsers.map(u => ({ username: u.username, email: u.email }))
    });
    
    if (filteredUsers.length === 0) {
        searchResultsDropdown.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-user-slash"></i>
                <p>No other users found</p>
            </div>
        `;
        searchResultsDropdown.classList.remove('hidden');
        return;
    }
    
    searchResultsDropdown.innerHTML = filteredUsers.map(user => {
        const initials = user.username.charAt(0).toUpperCase();
        return `
            <div class="search-result-item" data-email="${user.email}" data-username="${user.username}">
                <div class="search-result-avatar">${initials}</div>
                <div class="search-result-info">
                    <div class="search-result-name">${user.username}</div>
                    <div class="search-result-email">${user.email}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click listeners to result items
    searchResultsDropdown.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const email = item.dataset.email;
            const username = item.dataset.username;
            startChatWithUser(email, username);
        });
    });
    
    searchResultsDropdown.classList.remove('hidden');
    console.log('✅ Dropdown shown with', filteredUsers.length, 'users');
    console.log('📍 Dropdown element:', {
        exists: !!searchResultsDropdown,
        hasHiddenClass: searchResultsDropdown.classList.contains('hidden'),
        innerHTML: searchResultsDropdown.innerHTML.substring(0, 100) + '...'
    });
    } catch (error) {
        console.error('❌ ERROR in displaySearchResults:', error);
        console.error('❌ Error stack:', error.stack);
    }
}

function startChatWithUser(email, username) {
    // Hide search results
    document.getElementById('userSearchResults').classList.add('hidden');
    document.getElementById('chatSearch').value = '';
    
    // Switch to CHATS tab
    switchTab('chats');
    
    // Start private chat
    currentChat = { type: 'private', target: email };
    updateChatHeader(`Chat with ${username}`, email);
    clearMessages();
    
    // Load previous messages
    loadPrivateMessages(email);
    
    // Add to recent chats if not already there
    addToRecentChats(email, username, '', new Date(), true);
    
    showNotification(`Started chat with ${username}`, 'success');
}

function initializeSocket() {
    const token = localStorage.getItem('chatToken');
    console.log('Initializing socket with token:', token ? 'Token exists' : 'No token');
    
    if (!token) {
        console.error('No authentication token found');
        showNotification('Authentication error: Please login again', 'error');
        return;
    }
    
    socket = io({
        auth: {
            token: token
        },
        timeout: 5000,
        forceNew: true
    });

    // Socket event listeners
    socket.on('connect', () => {
        console.log('=== SOCKET CONNECTED SUCCESSFULLY ===');
        console.log('Socket ID:', socket.id);
        showNotification('Connected to chat server', 'success');
        
        // Join general chat by default
        socket.emit('join-general-chat');
        
        // Load groups list
        updateGroupsList();
    });
    
    socket.on('connection-test', (message) => {
        console.log('Connection test received:', message);
        showNotification('Basic connection working', 'success');
    });
    
    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        showNotification('Connection failed: ' + error.message, 'error');
        
        // If it's an auth error, redirect to login
        if (error.message.includes('Authentication')) {
            localStorage.removeItem('chatToken');
            window.location.reload();
        }
    });
    
    socket.on('auth-error', (message) => {
        console.error('Authentication error:', message);
        showNotification('Authentication failed: ' + message, 'error');
        localStorage.removeItem('chatToken');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        showNotification('Disconnected from server', 'warning');
    });

    // Chat event listeners
    socket.on('joined-general-chat', () => {
        loadGeneralMessages();
    });

    socket.on('new-message', (message) => {
        console.log('Received new message:', message);
        console.log('Current chat type:', currentChat.type);
        
        // Skip if it's from yourself (already displayed optimistically)
        if (message.email === currentUser?.email) {
            console.log('Skipping own message (already displayed)');
            return;
        }
        
        if (currentChat.type === 'general') {
            console.log('Displaying message in general chat');
            displayMessage(message);
            scrollToBottom(); // Force scroll to show new message
        } else {
            console.log('Not displaying message - wrong chat type:', currentChat.type);
        }
    });

    // REMOVED DUPLICATE HANDLER - keeping the one at line ~1078 which uses recentChats

    socket.on('private-message-sent', (message) => {
        console.log('Private message sent confirmation:', message);
        
        // Add recipient to active chats if not already there
        if (!activePrivateChats.has(message.to)) {
            activePrivateChats.set(message.to, {
                email: message.to,
                username: message.to, // We might not have the username
                lastMessage: null,
                unreadCount: 0
            });
        }
        
        // Update last message
        const chatInfo = activePrivateChats.get(message.to);
        chatInfo.lastMessage = message.message.length > 30 ? 
            message.message.substring(0, 30) + '...' : message.message;
        
        updateActivePrivateChats();
        
        // Add to recent chats with sent status
        const recipientUser = allUsers.get(message.to);
        const recipientName = recipientUser?.username || message.to;
        addToRecentChats(message.to, recipientName, message.message, message.timestamp, recipientUser?.isOnline || false, 'sent', 0, true);
        
        // Display the message immediately in the current chat
        if (currentChat.type === 'private' && currentChat.target === message.to) {
            console.log('✅ Displaying sent private message immediately');
            console.log('Message data:', message);
            console.log('Current chat target:', currentChat.target);
            
            // Format message properly for display
            const formattedMessage = {
                ...message,
                username: currentUser.username,
                email: currentUser.email,
                senderEmail: currentUser.email,
                senderName: currentUser.username
            };
            
            displayMessage(formattedMessage);
        } else {
            console.log('❌ Not displaying - viewing different chat or wrong type');
            console.log('currentChat.type:', currentChat.type, 'currentChat.target:', currentChat.target, 'message.to:', message.to);
        }
    });

    // Match server event name 'group-message'
    socket.on('group-message', (message) => {
        const isViewingThisGroup = currentChat.type === 'group' && currentChat.target === message.groupId;
        const isSentByMe = message.senderEmail === currentUser?.email;
        
        if (isViewingThisGroup) {
            displayMessage(message);
            // Update group info with read status
            const groupInfo = groupChats.get(message.groupId) || {};
            groupInfo.lastMessageTime = message.timestamp;
            groupInfo.isSentByMe = isSentByMe;
            groupInfo.messageStatus = 'read';
            groupInfo.unreadCount = 0;
            groupChats.set(message.groupId, groupInfo);
            saveGroupChatsToStorage();
        } else {
            // Not viewing this group
            if (!isSentByMe) {
                // Received message from someone else - increment unread
                const groupInfo = groupChats.get(message.groupId) || { unreadCount: 0 };
                groupInfo.lastMessageTime = message.timestamp;
                groupInfo.unreadCount = (groupInfo.unreadCount || 0) + 1;
                groupInfo.isSentByMe = false;
                groupInfo.messageStatus = 'delivered';
                groupChats.set(message.groupId, groupInfo);
                saveGroupChatsToStorage();
                // Refresh groups list to show unread badge
                updateGroupsList();
            } else {
                // Your own message in another group - show sent status
                const groupInfo = groupChats.get(message.groupId) || {};
                groupInfo.lastMessageTime = message.timestamp;
                groupInfo.isSentByMe = true;
                groupInfo.messageStatus = 'sent';
                groupChats.set(message.groupId, groupInfo);
                saveGroupChatsToStorage();
                updateGroupsList();
            }
            // Show push notification
            createNotificationForMessage(message, 'group');
        }
        
        if (message.groupName && !isSentByMe) {
            showNotification(`New message in ${message.groupName}`, 'info');
        }
    });

    // Handle loading previous group messages
    socket.on('group-messages', (messages) => {
        console.log('Received group messages:', messages);
        clearMessages();
        messages.forEach(message => {
            const messageData = {
                username: message.senderName,
                email: message.sender,
                message: message.message,
                timestamp: message.timestamp,
                type: 'group',
                // Include file data if present
                fileData: message.fileData,
                fileUrl: message.fileUrl,
                fileType: message.fileType,
                fileName: message.fileName,
                fileSize: message.fileSize
            };
            displayMessage(messageData);
        });
    });

    socket.on('new-hotspot-message', (message) => {
        console.log('Received hotspot message:', message);
        hotspotMessages.push(message);
        
        // Display only if currently viewing hotspot
        if (currentChat.type === 'hotspot') {
            displayMessage(message);
        } else {
            // Show push notification if not viewing hotspot
            createNotificationForMessage(message, 'hotspot');
        }
    });

    socket.on('user-joined', (data) => {
        if (currentChat.type === 'general') {
            displaySystemMessage(data.message);
        }
    });

    socket.on('user-left', (data) => {
        if (currentChat.type === 'general') {
            displaySystemMessage(data.message);
        }
    });

    // Hotspot event listeners
    socket.on('hotspot-group-available', (data) => {
        networkInfo = data;
        showHotspotTab();
        updateHotspotStatus(`Connected to hotspot network. You are ${data.assignedColor} User.`);
        showNotification(`Hotspot group available! You are ${data.assignedColor} User`, 'info');
        // Auto-join as soon as hotspot is available so messages are received
        socket.emit('join-hotspot-group');
        // If user is already viewing hotspot tab, update the header
        if (currentChat && currentChat.type === 'hotspot') {
            updateChatHeader('Hotspot Group', `Anonymous chat as ${data.assignedColor} User`);
        }
    });

    socket.on('joined-hotspot-group', (data) => {
        // Don't change currentChat here, let switchTab handle it
        updateChatHeader('Hotspot Group', `Anonymous chat with ${data.userCount} users`);
        // Don't clear messages here - let switchTab handle message display
    });

    socket.on('user-joined-hotspot', (data) => {
        if (currentChat.type === 'hotspot') {
            displaySystemMessage(data.message);
        }
    });

    socket.on('user-left-hotspot', (data) => {
        if (currentChat.type === 'hotspot') {
            displaySystemMessage(data.message);
        }
    });

    socket.on('joined-hotspot-group', (data) => {
        // Don't change currentChat here, let switchTab handle it
        updateChatHeader('Hotspot Group', `Anonymous chat with ${data.userCount} users`);
        // Don't clear messages here - let switchTab handle message display
    });

    // Online users list
    socket.on('online-users-updated', (users) => {
        console.log('Online users updated:', users);
        updateOnlineUsersList(users);
    });

    // Private message event listeners
    socket.on('new-private-message', (message) => {
        console.log('Received private message:', message);
        console.log('Current chat:', currentChat);
        console.log('Message from:', message.from);
        console.log('Current target:', currentChat.target);
        console.log('Chat type match:', currentChat.type === 'private');
        console.log('Target match:', currentChat.target === message.fromEmail);
        
        // Display message if currently viewing this private chat
        const isViewingThisChat = currentChat.type === 'private' && currentChat.target === message.fromEmail;
        
        if (isViewingThisChat) {
            console.log('✅ Displaying received private message');
            displayMessage(message);
            // Add to recent chats with no unread count (already viewing)
            addToRecentChats(message.fromEmail, message.from, message.message, message.timestamp, true, 'read', 0, false);
            
            // Send read receipt to sender
            socket.emit('message-read', {
                messageId: message._id,
                from: message.fromEmail,
                to: currentUser.email
            });
        } else {
            console.log('❌ Not displaying message - chat mismatch');
            // Add to recent chats with unread count incremented
            addToRecentChats(message.fromEmail, message.from, message.message, message.timestamp, true, 'delivered', 1, false);
        }
        
        // Add to private chat if it exists, or create new one
        // FIX: Use fromEmail as the key
        if (!activePrivateChats.has(message.fromEmail)) {
            createPrivateChatItem(message.fromEmail, message.from);
        }
        
        // Show push notification for new private message
        createNotificationForMessage(message, 'private');
        
        // Update private chat preview
        // FIX: Use fromEmail
        updatePrivateChatPreview(message.fromEmail, message.message);
    });

    // Listen for read receipts
    socket.on('message-read-receipt', (data) => {
        console.log('📗 Message read receipt received:', data);
        console.log('  - From (who read it):', data.from);
        console.log('  - Current user:', currentUser?.email);
        
        // Update chat list status to green (read)
        const chat = recentChats.get(data.from);
        console.log('  - Chat found:', chat);
        console.log('  - Chat isSentByMe:', chat?.isSentByMe);
        
        if (chat) {
            // Always update to read when receipt comes in
            chat.messageStatus = 'read';
            saveRecentChatsToStorage();
            updateRecentChatsList();
            console.log(`✅ Chat with ${data.from} marked as read (green)`);
        } else {
            console.log('❌ Chat not found in recentChats for:', data.from);
        }
        
        // Update all visible messages in this chat to read status
        if (currentChat.type === 'private' && currentChat.target === data.from) {
            const messages = document.querySelectorAll('.message.own');
            messages.forEach(msg => {
                const statusElement = msg.querySelector('.message-status');
                if (statusElement) {
                    statusElement.classList.remove('sent', 'delivered');
                    statusElement.classList.add('read');
                    const statusIcon = statusElement.querySelector('span');
                    if (statusIcon) {
                        statusIcon.className = 'status-read';
                    }
                }
            });
        }
    });

    // Listen for delivered receipts
    socket.on('message-delivered-receipt', (data) => {
        console.log('📤 Message delivered receipt received:', data);
        console.log('  - To:', data.to);
        console.log('  - Current user:', currentUser?.email);
        
        // Update chat list status to yellow (delivered)
        const chat = recentChats.get(data.to);
        console.log('  - Chat found:', chat);
        
        if (chat && chat.messageStatus === 'sent') {
            // Update from sent to delivered
            chat.messageStatus = 'delivered';
            saveRecentChatsToStorage();
            updateRecentChatsList();
            console.log(`✅ Chat with ${data.to} marked as delivered (yellow)`);
        }
        
        // Update all visible messages in this chat to delivered status
        if (currentChat.type === 'private' && currentChat.target === data.to) {
            const messages = document.querySelectorAll('.message.own');
            messages.forEach(msg => {
                const statusElement = msg.querySelector('.message-status');
                if (statusElement && statusElement.classList.contains('sent')) {
                    statusElement.classList.remove('sent');
                    statusElement.classList.add('delivered');
                    const statusIcon = statusElement.querySelector('span');
                    if (statusIcon && statusIcon.className === 'status-sent') {
                        statusIcon.className = 'status-delivered';
                    }
                }
            });
            console.log(`✅ Visible messages to ${data.to} updated to delivered`);
        }
    });

    // Group chat events
    socket.on('group-created', (group) => {
        console.log('Group created:', group);
        showNotification(`Group "${group.name}" created successfully!`, 'success');
        
        // Refresh groups list
        updateGroupsList();
        
        // Switch to groups tab to show the new group
        switchTab('groups');
    });
    
    // Listen for groups list from server
    socket.on('groups-list', (groups) => {
        console.log('Received groups list:', groups);
        displayGroupsList(groups);
    });
    
    socket.on('group-creation-error', (error) => {
        console.error('Group creation error:', error);
        showNotification(`Failed to create group: ${error}`, 'error');
    });
    
    // Enhanced error handling
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showNotification(`Connection error: ${error.message || error}`, 'error');
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showNotification('Unable to connect to server. Please check your internet connection.', 'error');
    });
    
    socket.on('disconnect', (reason) => {
        console.warn('Disconnected:', reason);
        if (reason === 'io server disconnect') {
            showNotification('You have been disconnected by the server.', 'warning');
        } else {
            showNotification('Connection lost. Attempting to reconnect...', 'warning');
        }
    });
    
    socket.on('reconnect', () => {
        console.log('Reconnected to server');
        showNotification('Connection restored!', 'success');
    });
    
    // Initialize push notifications
    initializePushNotifications();
    
    // Setup notification toggle
    setupNotificationToggle();
    
    // Setup dark mode toggle
    setupDarkModeToggle();
}

async function detectNetwork() {
    try {
        showNotification('Detecting network...', 'info');
        
        // Use a consistent network ID for demo purposes
        // In a real scenario, this would be based on actual network detection
        const consistentNetworkId = 'local-wifi-network-demo';
        
        // Simulate a short delay for better UX
        setTimeout(() => {
            if (socket && socket.connected) {
                socket.emit('detect-network', { networkId: consistentNetworkId });
                showNotification('Network detected successfully!', 'success');
            } else {
                showNotification('Not connected to server', 'error');
            }
        }, 500);
        
    } catch (error) {
        console.error('Network detection error:', error);
        // Use consistent fallback
        const fallbackNetworkId = 'local-wifi-network-demo';
        if (socket && socket.connected) {
            socket.emit('detect-network', { networkId: fallbackNetworkId });
            showNotification('Network detected (demo mode)', 'info');
        } else {
            showNotification('Cannot detect network: Not connected', 'error');
        }
    }
}

async function getNetworkId() {
    // Try multiple methods for network detection
    return new Promise((resolve) => {
        let resolved = false;
        
        // Method 1: WebRTC (most accurate but may be blocked)
        try {
            const pc = new RTCPeerConnection({ 
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
            });
            
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});
            
            pc.onicecandidate = (ice) => {
                if (resolved) return;
                if (ice && ice.candidate && ice.candidate.candidate) {
                    const candidate = ice.candidate.candidate;
                    const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                    if (ipMatch) {
                        const ip = ipMatch[1];
                        if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
                            const networkId = ip.split('.').slice(0, 3).join('.');
                            resolved = true;
                            pc.close();
                            resolve(networkId);
                        }
                    }
                }
            };
        } catch (error) {
            console.log('WebRTC method failed:', error);
        }
        
        // Method 2: Browser fingerprinting fallback (faster)
        setTimeout(() => {
            if (!resolved) {
                const browserFingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
                const hash = btoa(browserFingerprint).substr(0, 8);
                resolved = true;
                resolve('fp-' + hash);
            }
        }, 1000);
        
        // Method 3: Final fallback after 2 seconds (faster)
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve('demo-' + Math.random().toString(36).substr(2, 6));
            }
        }, 2000);
    });
}

// Tab switching for CHATS/GROUPS tabs
function switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Load groups when switching to groups tab
    if (tabName === 'groups' && socket && socket.connected) {
        updateGroupsList();
    }
}

// Switch to specific chat (general, hotspot, private, group)
function switchToChat(chatType, target = null) {
    console.log('🔄 switchToChat called:');
    console.log('  - chatType:', chatType);
    console.log('  - target:', target);
    
    // DON'T set currentChat here yet - let each case handle it
    // This was causing currentChat.target to be null before validation
    
    // Update chat based on type
    switch (chatType) {
        case 'general':
            currentChat = { type: 'general', target: null };
            updateChatHeader('General Chat', 'Welcome to the community chat', 'general');
            clearMessages();
            loadGeneralMessages();
            break;
            
        case 'hotspot':
            currentChat = { type: 'hotspot', target: null };
            if (networkInfo) {
                updateChatHeader('Hotspot Group', `Anonymous chat as ${networkInfo.assignedColor} User`, 'hotspot');
                socket.emit('join-hotspot-group');
            } else {
                updateChatHeader('Hotspot Group', 'Detecting network...', 'hotspot');
                detectNetwork();
            }
            clearMessages();
            loadHotspotMessages();
            break;
            
        case 'private':
            console.log('🔄 switchToChat - private case:');
            console.log('  - target:', target);
            console.log('  - typeof target:', typeof target);
            console.log('  - target is truthy?', !!target);
            
            // Set currentChat EVEN if target is falsy (to avoid error spam)
            currentChat = { type: 'private', target: target };
            console.log('  - currentChat set to:', currentChat);
            
            if (!target) {
                console.error('❌ ERROR: No target provided for private chat!');
                // DON'T show notification - just log it
                console.error('Skipping chat open - no target');
                return;
            }
            
            const chatData = activePrivateChats.get(target) || recentChats.get(target);
            const username = chatData?.username || target;
            
            // Format last seen
            let lastSeenText = 'last seen recently';
            if (chatData) {
                if (chatData.isOnline) {
                    lastSeenText = 'online';
                } else if (chatData.lastSeen) {
                    lastSeenText = formatLastSeen(chatData.lastSeen);
                }
            }
            
            updateChatHeader(username, lastSeenText, 'private');
            clearMessages();
            loadPrivateMessages(target);
            
            // ALWAYS send read receipt when opening a chat (not just when unread > 0)
            // This ensures messages turn green when the recipient views them
            socket.emit('message-read', {
                from: target,
                to: currentUser?.email
            });
            console.log(`📗 Sent read receipt to ${target}`);
            
            // Clear unread count
            const recentChat = recentChats.get(target);
            if (recentChat) {
                recentChat.unreadCount = 0;
                recentChat.messageStatus = 'read';
                saveRecentChatsToStorage();
                updateRecentChatsList();
            }
            break;
            
        case 'group':
            if (target) {
                currentChat = { 
                    type: 'group', 
                    target: target._id || target,
                    groupName: target.name || target  // FIX: Add groupName here too
                };
                updateChatHeader(target.name, `Group chat with ${target.members.length} members`);
                clearMessages();
                loadGroupMessages(target._id);
            }
            break;
    }
}

// Message functions
function sendMessage() {
    console.log('sendMessage function called');
    console.log('messageInput element:', messageInput);
    console.log('socket:', socket);
    console.log('currentChat:', currentChat);
    
    if (!messageInput) {
        console.error('Message input element not found!');
        showNotification('Error: Message input not found', 'error');
        return;
    }
    
    if (!socket) {
        console.error('Socket not connected!');
        showNotification('Error: Not connected to server', 'error');
        return;
    }
    
    const message = messageInput.value.trim();
    console.log('Message content:', message);
    
    if (!message) {
        console.log('Empty message, not sending');
        return;
    }

    const messageData = { message };
    console.log('Sending message:', messageData, 'Chat type:', currentChat.type);

    try {
        switch (currentChat.type) {
            case 'general':
                console.log('Emitting general message');
                socket.emit('send-message', messageData);
                
                // Display immediately for sender (optimistic update)
                displayMessage({
                    username: currentUser.username,
                    email: currentUser.email,
                    message: message,
                    timestamp: new Date(),
                    type: 'general'
                });
                scrollToBottom();
                break;
            case 'private':
                console.log('📤 Sending private message:');
                console.log('  - Current chat:', currentChat);
                console.log('  - Target (recipient):', currentChat.target);
                
                if (!currentChat.target) {
                    console.error('❌ ERROR: No recipient in currentChat.target');
                    showNotification('Error: No recipient selected', 'error');
                    return;
                }
                
                messageData.to = currentChat.target;
                console.log('  - Message data:', messageData);
                socket.emit('send-private-message', messageData);
                break;
            case 'group':
                console.log('📤 Sending group message:');
                console.log('  - Current chat:', currentChat);
                console.log('  - Group ID:', currentChat.target);
                console.log('  - Group Name:', currentChat.groupName);
                
                if (!currentChat.target) {
                    console.error('❌ ERROR: No group ID in currentChat.target');
                    showNotification('Error: No group selected', 'error');
                    return;
                }
                
                if (!currentChat.groupName) {
                    console.error('❌ ERROR: No groupName in currentChat');
                    showNotification('Error: Group name missing', 'error');
                    return;
                }
                
                messageData.groupId = currentChat.target;
                messageData.groupName = currentChat.groupName;
                console.log('  - Message data:', messageData);
                socket.emit('send-group-message', messageData);
                break;
            case 'hotspot':
                console.log('Sending hotspot message');
                socket.emit('send-hotspot-message', messageData);
                break;
            default:
                console.error('Unknown chat type:', currentChat.type);
                showNotification('Error: Unknown chat type', 'error');
                return;
        }

        messageInput.value = '';
        console.log('Message sent successfully, input cleared');
        
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message. Please try again.', 'error');
        
        // Restore message in input if sending failed
        if (messageInput && message) {
            messageInput.value = message;
        }
    }
}

function displayMessage(message) {
    console.log('Displaying message:', message);
    console.log('Current user:', currentUser);
    console.log('Messages list element:', messagesList);
    console.log('Messages list dimensions:', {
        width: messagesList?.offsetWidth,
        height: messagesList?.offsetHeight,
        children: messagesList?.children.length
    });
    
    const messageElement = document.createElement('div');
    
    // Fix: Check all possible email fields for message ownership
    const isOwnMessage = currentUser && (
        (message.email === currentUser.email) || 
        (message.senderEmail === currentUser.email) ||
        (message.fromEmail === currentUser.email) ||
        (message.from === currentUser.email)
    );
    
    messageElement.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    
    if (message.type === 'hotspot') {
        messageElement.classList.add('hotspot');
    }

    // Create content bubble
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    
    // Create header inside bubble
    const headerElement = document.createElement('div');
    headerElement.className = 'message-header';
    
    const senderElement = document.createElement('span');
    senderElement.className = 'message-sender';
    
    if (message.type === 'hotspot') {
        senderElement.textContent = `${message.color} User`;
        senderElement.style.color = getColorForUser(message.color);
    } else {
        senderElement.textContent = message.username || message.from || message.senderName;
    }
    
    headerElement.appendChild(senderElement);
    
    // Create message text or file content
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    
    // Check if message has file/image data
    if (message.fileData || message.fileUrl) {
        const fileData = message.fileData || { 
            type: message.fileType,
            data: message.fileUrl,
            name: message.fileName,
            size: message.fileSize
        };
        
        if (fileData.type === 'image' || (fileData.data && fileData.data.startsWith('data:image/'))) {
            // Display image
            const img = document.createElement('img');
            img.src = fileData.data;
            img.alt = fileData.name || 'Image';
            img.style.maxWidth = '300px';
            img.style.borderRadius = '8px';
            img.style.cursor = 'pointer';
            img.onclick = () => openImageModal(fileData.data, fileData.name);
            messageText.appendChild(img);
        } else if (fileData.type === 'document' || fileData.type === 'file') {
            // Display file
            const fileIcon = getFileIcon(fileData.mimeType || 'application/octet-stream');
            const fileSize = formatFileSize(fileData.size || 0);
            messageText.innerHTML = `
                <div class="file-info" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                    <div class="file-icon" style="font-size: 2rem;">
                        <i class="fas ${fileIcon}"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name" style="font-weight: 500;">${fileData.name}</div>
                        <div class="file-size" style="font-size: 0.85rem; opacity: 0.7;">${fileSize}</div>
                    </div>
                </div>
            `;
        }
        
        // Add text if there's also a message
        if (message.message || message.content) {
            const textDiv = document.createElement('div');
            textDiv.textContent = message.message || message.content;
            textDiv.style.marginTop = '8px';
            messageText.appendChild(textDiv);
        }
    } else {
        // Regular text message
        messageText.textContent = message.message || message.content;
    }
    
    // Create time element inside bubble
    const timeElement = document.createElement('span');
    timeElement.className = 'message-time';
    timeElement.textContent = formatTime(new Date(message.timestamp));
    
    // Add message status for own messages
    if (isOwnMessage && message.type !== 'hotspot') {
        const statusElement = document.createElement('span');
        statusElement.className = 'message-status';
        
        // Determine status based on message properties
        const status = message.status || 'sent';
        statusElement.classList.add(status);
        
        // Add status indicator
        const statusIcon = document.createElement('span');
        statusIcon.className = `status-${status}`;
        statusElement.appendChild(statusIcon);
        
        timeElement.appendChild(statusElement);
    }
    
    // Assemble the bubble: header + text + time
    contentElement.appendChild(headerElement);
    contentElement.appendChild(messageText);
    contentElement.appendChild(timeElement);
    
    messageElement.appendChild(contentElement);

    // Add message ID and simulate delivery for own messages
    if (isOwnMessage && message.type !== 'hotspot') {
        const messageId = addMessageId(messageElement, message);
        
        // Start delivery simulation
        simulateMessageDelivery(messageId);
    }

    messagesList.appendChild(messageElement);
    scrollToBottom();
}

function displaySystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message system';

    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.textContent = message;

    messageElement.appendChild(contentElement);
    messagesList.appendChild(messageElement);
    scrollToBottom();
}

function clearMessages() {
    messagesList.innerHTML = '';
}

async function loadGeneralMessages() {
    try {
        const token = localStorage.getItem('chatToken');
        const response = await fetch('/api/chat/messages/general', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            clearMessages();
            data.messages.forEach(message => {
                displayMessage({
                    ...message,
                    senderEmail: message.senderEmail,
                    username: message.senderUsername,
                    message: message.content,
                    timestamp: message.createdAt,
                    // Include file data if present
                    fileData: message.fileData,
                    fileType: message.fileType,
                    fileName: message.fileName,
                    fileSize: message.fileSize
                });
            });
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Private chat functions
async function startPrivateChat() {
    const email = document.getElementById('userSearch').value.trim();
    if (!email) return;

    if (email === currentUser.email) {
        showNotification('You cannot chat with yourself', 'warning');
        return;
    }

    currentChat = { type: 'private', target: email };
    updateChatHeader(`Private Chat`, `Chatting with ${email}`);
    clearMessages();
    loadPrivateMessages(email);
    document.getElementById('userSearch').value = '';
}

async function loadPrivateMessages(recipientEmail) {
    try {
        const token = localStorage.getItem('chatToken');
        const response = await fetch(`/api/chat/messages/private/${recipientEmail}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            clearMessages();
            data.messages.forEach(message => {
                displayMessage({
                    ...message,
                    senderEmail: message.senderEmail,
                    username: message.senderUsername,
                    message: message.content,
                    timestamp: message.createdAt,
                    // Include file data if present
                    fileData: message.fileData,
                    fileType: message.fileType,
                    fileName: message.fileName,
                    fileSize: message.fileSize
                });
            });
        }
    } catch (error) {
        console.error('Error loading private messages:', error);
    }
}

// Group chat functions
function createGroup() {
    const groupName = document.getElementById('groupNameInput').value.trim();
    const memberEmails = document.getElementById('memberEmailsInput').value.trim();
    
    if (!groupName) {
        showNotification('Please enter a group name', 'error');
        return;
    }

    // Parse member emails
    const members = memberEmails ? 
        memberEmails.split(',').map(email => email.trim()).filter(email => email) : 
        [];
    
    // Add current user to members
    if (!members.includes(currentUser.email)) {
        members.push(currentUser.email);
    }

    const groupData = {
        name: groupName,
        members: members,
        createdBy: currentUser.email
    };

    console.log('Creating group with data:', groupData);
    socket.emit('create-group', groupData);
    
    // Clear inputs
    document.getElementById('groupNameInput').value = '';
    document.getElementById('memberEmailsInput').value = '';
    
    showNotification(`Creating group "${groupName}"...`, 'info');
}

// Hotspot functions
function showHotspotTab() {
    // Update hotspot group item to show it's available
    const hotspotItem = document.querySelector('[data-chat="hotspot"]');
    if (hotspotItem) {
        hotspotItem.classList.add('available');
        const preview = hotspotItem.querySelector('.chat-preview');
        if (preview) {
            preview.textContent = 'Hotspot group available!';
        }
    }
}

function updateHotspotStatus(status) {
    // Update chat subtitle with hotspot status
    if (currentChat.type === 'hotspot') {
        const subtitle = document.getElementById('chatSubtitle');
        if (subtitle) {
            subtitle.textContent = status;
        }
    }
}

function loadHotspotMessages() {
    // Display all stored hotspot messages for the current session
    hotspotMessages.forEach(message => {
        displayMessage(message);
    });
}

function clearHotspotSession() {
    // Clear hotspot messages when user logs out
    hotspotMessages = [];
}

function getColorForUser(colorName) {
    const colorMap = {
        'Red': '#dc3545',
        'Blue': '#007bff', 
        'Green': '#28a745',
        'Purple': '#6f42c1',
        'Orange': '#fd7e14',
        'Pink': '#e83e8c',
        'Cyan': '#17a2b8',
        'Yellow': '#ffc107',
        'Lime': '#32cd32',
        'Indigo': '#6610f2'
    };
    return colorMap[colorName] || '#333';
}

// Utility functions
function updateChatHeader(title, subtitle, avatarType = 'general') {
    chatTitle.textContent = title;
    chatSubtitle.textContent = subtitle;
    
    // Update the contact avatar based on chat type
    const contactAvatar = document.querySelector('.contact-avatar');
    const avatarIcon = contactAvatar.querySelector('i');
    
    if (contactAvatar && avatarIcon) {
        // Remove existing classes
        contactAvatar.className = 'contact-avatar';
        avatarIcon.className = 'fas';
        
        // Add appropriate classes based on avatar type
        switch (avatarType) {
            case 'general':
                contactAvatar.classList.add('general-avatar');
                avatarIcon.classList.add('fa-users');
                break;
            case 'hotspot':
                contactAvatar.classList.add('hotspot-avatar');
                avatarIcon.classList.add('fa-wifi');
                break;
            case 'group':
                contactAvatar.classList.add('group-avatar');
                avatarIcon.classList.add('fa-users');
                break;
            case 'private':
                contactAvatar.classList.add('private-avatar');
                avatarIcon.classList.add('fa-user');
                break;
            default:
                contactAvatar.classList.add('general-avatar');
                avatarIcon.classList.add('fa-users');
        }
    }
}

function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    // For older messages, show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
        // Today - show time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
        // Yesterday
        return 'Yesterday';
    } else {
        // Older - show date
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

function scrollToBottom() {
    if (messagesList) {
        messagesList.scrollTop = messagesList.scrollHeight;
        console.log('Scrolled to bottom, messagesList height:', messagesList.scrollHeight);
    } else {
        console.error('messagesList element not found!');
    }
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function updateOnlineUsersList(users) {
    // Update General tab online users (no create group button)
    const generalUsersContainer = document.querySelector('#generalTab .users-list');
    if (generalUsersContainer) {
        generalUsersContainer.innerHTML = '';
        
        users.forEach(user => {
            if (user.email !== currentUser.email) { // Don't show current user
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.innerHTML = `
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-details">
                        <div class="username">${user.username}</div>
                        <div class="email">${user.email}</div>
                    </div>
                `;
                
                userElement.addEventListener('click', () => {
                    startPrivateChatWithUser(user.email);
                });
                
                generalUsersContainer.appendChild(userElement);
            }
        });
        
        if (users.filter(u => u.email !== currentUser.email).length === 0) {
            generalUsersContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No other users online</p>';
        }
    }
    
    // Update Private tab users list (with create group button and active chats)
    const privateUsersContainer = document.querySelector('#privateTab .users-list');
    if (privateUsersContainer) {
        privateUsersContainer.innerHTML = '';
        
        // Add section for active private chats
        const activeChatSection = document.createElement('div');
        activeChatSection.className = 'chat-section';
        activeChatSection.innerHTML = `
            <h4 style="margin: 10px 0; color: #666; font-size: 0.9rem;">
                <i class="fas fa-comments"></i> Active Private Chats
            </h4>
            <div id="activePrivateChats"></div>
        `;
        privateUsersContainer.appendChild(activeChatSection);
        
        // Add "Create Group Chat" button
        const createGroupBtn = document.createElement('div');
        createGroupBtn.className = 'user-item create-group-btn';
        createGroupBtn.innerHTML = `
            <div class="user-avatar">
                <i class="fas fa-plus"></i>
            </div>
            <div class="user-details">
                <div class="username">Create Group Chat</div>
                <div class="email">Select multiple users</div>
            </div>
        `;
        createGroupBtn.addEventListener('click', () => {
            showGroupCreationModal(users);
        });
        privateUsersContainer.appendChild(createGroupBtn);
        
        // Add section for online users
        const onlineUsersSection = document.createElement('div');
        onlineUsersSection.className = 'chat-section';
        onlineUsersSection.innerHTML = `
            <h4 style="margin: 15px 0 10px 0; color: #666; font-size: 0.9rem;">
                <i class="fas fa-users"></i> Start New Private Chat
            </h4>
        `;
        privateUsersContainer.appendChild(onlineUsersSection);
        
        users.forEach(user => {
            if (user.email !== currentUser.email) { // Don't show current user
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.innerHTML = `
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-details">
                        <div class="username">${user.username}</div>
                        <div class="email">${user.email}</div>
                    </div>
                    <div class="chat-action">
                        <i class="fas fa-comment" title="Start private chat"></i>
                    </div>
                `;
                
                userElement.addEventListener('click', () => {
                    startPrivateChatWithUser(user.email, user.username);
                });
                
                privateUsersContainer.appendChild(userElement);
            }
        });
        
        // Update active private chats display
        updateActivePrivateChats();
    }
}

function startPrivateChatWithUser(email, username) {
    // Add to active private chats if not already there
    if (!activePrivateChats.has(email)) {
        activePrivateChats.set(email, {
            email: email,
            username: username || email,
            lastMessage: null,
            unreadCount: 0
        });
        updateActivePrivateChats();
    }
    
    currentChat = { type: 'private', target: email };
    updateChatHeader(`Private Chat`, `Chatting with ${username || email}`);
    clearMessages();
    loadPrivateMessages(email);
    
    // Mark as read
    if (activePrivateChats.has(email)) {
        activePrivateChats.get(email).unreadCount = 0;
        updateActivePrivateChats();
    }
}

function updateActivePrivateChats() {
    const activeChatsContainer = document.getElementById('activePrivateChats');
    if (!activeChatsContainer) return;
    
    activeChatsContainer.innerHTML = '';
    
    if (activePrivateChats.size === 0) {
        activeChatsContainer.innerHTML = `
            <p style="text-align: center; color: #999; font-size: 0.8rem; padding: 10px;">
                No active private chats
            </p>
        `;
        return;
    }
    
    activePrivateChats.forEach((chatInfo, email) => {
        const chatElement = document.createElement('div');
        chatElement.className = `user-item private-chat-item ${currentChat.type === 'private' && currentChat.target === email ? 'active' : ''}`;
        
        const unreadBadge = chatInfo.unreadCount > 0 ? 
            `<span class="unread-badge">${chatInfo.unreadCount}</span>` : '';
        
        chatElement.innerHTML = `
            <div class="user-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="user-details">
                <div class="username">${chatInfo.username}</div>
                <div class="email">${chatInfo.lastMessage || 'Click to start chatting'}</div>
            </div>
            <div class="chat-actions">
                ${unreadBadge}
                <button class="close-chat-btn" title="Close chat">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Click to open chat
        chatElement.addEventListener('click', (e) => {
            if (!e.target.closest('.close-chat-btn')) {
                startPrivateChatWithUser(email, chatInfo.username);
            }
        });
        
        // Close chat button
        chatElement.querySelector('.close-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            activePrivateChats.delete(email);
            updateActivePrivateChats();
            
            // If this was the current chat, switch to general
            if (currentChat.type === 'private' && currentChat.target === email) {
                switchTab('general');
            }
        });
        
        activeChatsContainer.appendChild(chatElement);
    });
}

function showGroupCreationModal(users) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'group-creation-modal';
    modal.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    `;
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2 style="color: #667eea; margin-bottom: 20px;">
                <i class="fas fa-users"></i> Create Group Chat
            </h2>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label for="groupName">Group Name:</label>
                <input type="text" id="groupName" placeholder="Enter group name..." 
                       style="width: 100%; padding: 12px; border: 2px solid #e1e5e9; border-radius: 10px; margin-bottom: 20px;">
            </div>
            <div class="form-group">
                <label>Select Members:</label>
                <div id="usersList" style="max-height: 200px; overflow-y: auto; border: 1px solid #e1e5e9; border-radius: 10px; padding: 10px;">
                    ${users.filter(user => user.email !== currentUser.email).map(user => `
                        <div class="user-checkbox" style="display: flex; align-items: center; padding: 8px; margin: 5px 0; border-radius: 8px; cursor: pointer; transition: background 0.3s;">
                            <input type="checkbox" id="user_${user.id}" value="${user.email}" 
                                   style="margin-right: 10px; transform: scale(1.2);">
                            <div class="user-avatar" style="width: 30px; height: 30px; background: #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; margin-right: 10px;">
                                <i class="fas fa-user" style="font-size: 12px;"></i>
                            </div>
                            <div>
                                <div style="font-weight: 600;">${user.username}</div>
                                <div style="font-size: 0.8rem; color: #666;">${user.email}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            <button id="cancelGroupBtn" style="padding: 12px 20px; background: #f8f9fa; border: 1px solid #e1e5e9; border-radius: 8px; cursor: pointer;">
                Cancel
            </button>
            <button id="createGroupBtn" style="padding: 12px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer;">
                <i class="fas fa-plus"></i> Create Group
            </button>
        </div>
    `;
    
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Add hover effects to user checkboxes
    modal.querySelectorAll('.user-checkbox').forEach(checkbox => {
        checkbox.addEventListener('mouseenter', () => {
            checkbox.style.background = '#f8f9fa';
        });
        checkbox.addEventListener('mouseleave', () => {
            checkbox.style.background = 'transparent';
        });
        checkbox.addEventListener('click', () => {
            const input = checkbox.querySelector('input[type="checkbox"]');
            input.checked = !input.checked;
        });
    });
    
    // Handle cancel
    modal.querySelector('#cancelGroupBtn').addEventListener('click', () => {
        modalOverlay.remove();
    });
    
    // Handle create group
    modal.querySelector('#createGroupBtn').addEventListener('click', () => {
        const groupName = modal.querySelector('#groupName').value.trim();
        const selectedUsers = Array.from(modal.querySelectorAll('input[type="checkbox"]:checked'))
            .map(input => input.value);
        
        if (!groupName) {
            showNotification('Please enter a group name', 'error');
            return;
        }
        
        if (selectedUsers.length === 0) {
            showNotification('Please select at least one member', 'error');
            return;
        }
        
        createGroupChat(groupName, selectedUsers);
        modalOverlay.remove();
    });
    
    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
}

function createGroupChat(groupName, memberEmails) {
    const groupData = {
        name: groupName,
        members: [...memberEmails, currentUser.email], // Include current user
        createdBy: currentUser.email
    };
    
    socket.emit('create-group', groupData);
    showNotification(`Creating group "${groupName}"...`, 'info');
}

function updateGroupsList() {
    socket.emit('get-groups');
}

function displayGroupsList(groups) {
    const groupsContainer = document.querySelector('#groupsTab .groups-list');
    if (!groupsContainer) return;
    
    groupsContainer.innerHTML = '';
    
    if (groups.length === 0) {
        groupsContainer.innerHTML = `
            <div style="text-align: center; color: #666; padding: 20px;">
                <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i>
                <p>No groups yet</p>
                <p style="font-size: 0.9rem;">Create a group from the Private tab</p>
            </div>
        `;
        return;
    }
    
    groups.forEach(group => {
        const groupElement = document.createElement('div');
        groupElement.className = 'group-item chat-item';
        
        // Get group info from storage or use defaults
        const groupInfo = groupChats.get(group._id) || {
            unreadCount: 0,
            messageStatus: 'read',
            isSentByMe: false,
            lastMessageTime: group.createdAt
        };
        
        // Status indicator (colored circle - only if last message was sent by me)
        let statusIcon = '';
        if (groupInfo.isSentByMe && groupInfo.messageStatus) {
            if (groupInfo.messageStatus === 'read') {
                statusIcon = '<span class="status-icon read" title="Read (Green)"></span>';
            } else if (groupInfo.messageStatus === 'delivered') {
                statusIcon = '<span class="status-icon delivered" title="Delivered (Yellow)"></span>';
            } else if (groupInfo.messageStatus === 'sent') {
                statusIcon = '<span class="status-icon sent" title="Sent (Red)"></span>';
            }
        }
        
        groupElement.innerHTML = `
            <div class="chat-avatar group-avatar">
                <i class="fas fa-users"></i>
            </div>
            <div class="chat-info">
                <div class="chat-name">
                    ${group.name}
                    ${groupInfo.unreadCount > 0 ? `<span class="unread-count-badge">${groupInfo.unreadCount}</span>` : ''}
                </div>
                <div class="chat-status">
                    ${statusIcon}
                    <span class="member-count">${group.members.length} members</span>
                </div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${groupInfo.lastMessageTime ? formatTime(new Date(groupInfo.lastMessageTime)) : ''}</div>
            </div>
        `;
        
        groupElement.addEventListener('click', () => {
            // Clear unread count when opening group
            const info = groupChats.get(group._id);
            if (info) {
                info.unreadCount = 0;
                saveGroupChatsToStorage();
                displayGroupsList(groups); // Refresh display
            }
            joinGroup(group._id, group.name, group.members);
        });
        
        groupsContainer.appendChild(groupElement);
    });
}

function joinGroup(groupId, groupName, members) {
    console.log('🏠 Joining group:');
    console.log('  - Group ID:', groupId);
    console.log('  - Group Name:', groupName);
    console.log('  - Members:', members);
    
    currentChat = { 
        type: 'group', 
        target: groupId,
        groupName: groupName  // FIX: Add groupName so sendMessage can access it
    };
    
    console.log('  - currentChat set to:', currentChat);
    
    updateChatHeader(`Group: ${groupName}`, `${members.length} members`);
    clearMessages();
    
    // Join the group room
    socket.emit('join-group', { groupId });
    
    // Load group messages
    loadGroupMessages(groupId);
}

function loadGroupMessages(groupId) {
    socket.emit('get-group-messages', { groupId });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    notificationContainer.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);

    // Remove on click
    notification.addEventListener('click', () => {
        notification.remove();
    });
}

// Private messaging functions
function updateOnlineUsersList(users) {
    // Update all users map with online status
    users.forEach(user => {
        allUsers.set(user.email, { ...user, isOnline: true, lastSeen: new Date() });
    });
    
    // Update online status in recent chats
    recentChats.forEach((chat, email) => {
        const user = users.find(u => u.email === email);
        if (user) {
            chat.isOnline = true;
            chat.lastSeen = new Date();
        } else {
            chat.isOnline = false;
        }
    });
    
    // Only update recent chats list - no separate online/offline lists
    updateRecentChatsList();
}

// Removed updateOfflineUsersList - using WhatsApp-style recent chats only

function startPrivateChat(username, email) {
    console.log('💬 Starting private chat:');
    console.log('  - Username:', username);
    console.log('  - Email:', email);
    console.log('  - typeof email:', typeof email);
    console.log('  - email is truthy?', !!email);
    
    if (!email || email === 'undefined' || email === 'null') {
        console.error('❌ ERROR: Invalid email passed to startPrivateChat!');
        showNotification('Error: Cannot open chat - invalid user', 'error');
        return;
    }
    
    // Create private chat item if it doesn't exist
    if (!activePrivateChats.has(email)) {
        createPrivateChatItem(email, username);
    }
    
    // Switch to private chat
    switchToChat('private', email);
    
    console.log('  - currentChat after switch:', currentChat);
    
    // Update active state
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    const privateChatItem = document.querySelector(`[data-chat="private"][data-target="${email}"]`);
    if (privateChatItem) {
        privateChatItem.classList.add('active');
    }
}

function createPrivateChatItem(userEmail, username) {
    const privateChatsList = document.getElementById('privateChatsList');
    if (!privateChatsList) return;
    
    // Check if chat item already exists
    if (document.querySelector(`[data-chat="private"][data-target="${userEmail}"]`)) {
        return;
    }
    
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.setAttribute('data-chat', 'private');
    chatItem.setAttribute('data-target', userEmail);
    
    chatItem.innerHTML = `
        <div class="chat-avatar private-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="chat-info">
            <div class="chat-name">${username}</div>
            <div class="chat-preview">Click to start chatting</div>
        </div>
        <div class="chat-meta">
            <div class="chat-time">now</div>
        </div>
    `;
    
    chatItem.onclick = () => {
        switchToChat('private', userEmail);
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
        chatItem.classList.add('active');
    };
    
    privateChatsList.appendChild(chatItem);
    activePrivateChats.set(userEmail, { username, element: chatItem });
}

function updatePrivateChatPreview(userEmail, message) {
    const chatItem = document.querySelector(`[data-chat="private"][data-target="${userEmail}"]`);
    if (chatItem) {
        const preview = chatItem.querySelector('.chat-preview');
        const time = chatItem.querySelector('.chat-time');
        
        if (preview) {
            preview.textContent = message.length > 30 ? message.substring(0, 30) + '...' : message;
        }
        if (time) {
            time.textContent = formatTime(new Date());
        }
    }
}

async function loadPrivateMessages(recipientEmail) {
    try {
        const token = localStorage.getItem('chatToken');
        const response = await fetch(`/api/chat/messages/private/${recipientEmail}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            clearMessages();
            data.messages.forEach(message => {
                displayMessage({
                    ...message,
                    senderEmail: message.senderEmail,
                    username: message.senderUsername,
                    message: message.content,
                    timestamp: message.createdAt,
                    // Include file data if present
                    fileData: message.fileData,
                    fileType: message.fileType,
                    fileName: message.fileName,
                    fileSize: message.fileSize
                });
            });
        } else {
            clearMessages();
            console.log(`No previous messages with ${recipientEmail}`);
        }
    } catch (error) {
        console.error('Error loading private messages:', error);
        clearMessages();
    }
}

// Recent Chats Management
function addToRecentChats(userEmail, username, message, timestamp, isOnline = true, messageStatus = 'sent', unreadCount = 0, isSentByMe = false) {
    const existingChat = recentChats.get(userEmail);
    
    const chatData = {
        email: userEmail,
        username: username,
        lastMessage: message,
        timestamp: timestamp,
        isOnline: isOnline,
        messageStatus: messageStatus, // 'sent', 'delivered', 'read'
        unreadCount: isSentByMe ? 0 : (existingChat?.unreadCount || 0) + unreadCount,
        isSentByMe: isSentByMe
    };
    
    recentChats.set(userEmail, chatData);
    saveRecentChatsToStorage();
    updateRecentChatsList();
}

function updateRecentChatsList() {
    const recentChatsList = document.getElementById('recentChatsList');
    if (!recentChatsList) {
        console.error('❌ recentChatsList element not found!');
        return;
    }
    
    console.log('🔄 Updating recent chats list...');
    recentChatsList.innerHTML = '';
    
    // Sort by timestamp (most recent first) and filter out current user
    const sortedChats = Array.from(recentChats.values())
        .filter(chat => chat.email !== currentUser?.email) // Don't show yourself!
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedChats.forEach(chat => {
        // Skip if email is missing
        if (!chat.email) {
            console.error('❌ Skipping chat with missing email:', chat);
            return;
        }
        
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.setAttribute('data-chat', 'private');
        chatItem.setAttribute('data-target', chat.email);
        
        // Format last seen
        const lastSeenText = chat.isOnline ? 'online' : formatLastSeen(chat.lastSeen || chat.timestamp);
        
        // Determine status icon (colored circle)
        let statusIcon = '';
        
        // Show status for ALL chats (not just isSentByMe)
        // The status represents the last interaction with this chat
        if (chat.messageStatus) {
            if (chat.messageStatus === 'read') {
                statusIcon = '<span class="status-icon read" title="Read (Green)">🟢</span>';
            } else if (chat.messageStatus === 'delivered') {
                statusIcon = '<span class="status-icon delivered" title="Delivered (Yellow)">🟡</span>';
            } else if (chat.messageStatus === 'sent') {
                statusIcon = '<span class="status-icon sent" title="Sent (Red)">🔴</span>';
            }
        }
        
        console.log(`📊 ${chat.username}: isSentByMe=${chat.isSentByMe}, status=${chat.messageStatus}, icon=${statusIcon ? 'yes' : 'no'}`);
        
        chatItem.innerHTML = `
            <div class="chat-avatar">
                ${chat.username.charAt(0).toUpperCase()}
            </div>
            <div class="chat-info">
                <div class="chat-name">
                    ${chat.username}
                    ${chat.unreadCount > 0 ? `<span class="unread-count-badge">${chat.unreadCount}</span>` : ''}
                </div>
                <div class="chat-status">
                    ${statusIcon}
                </div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${formatTime(new Date(chat.timestamp))}</div>
            </div>
        `;
        
        // DON'T use onclick - use event delegation instead
        recentChatsList.appendChild(chatItem);
    });
    
    // Remove old event listener if exists
    const oldHandler = recentChatsList._clickHandler;
    if (oldHandler) {
        console.log('🗑️ Removing old click handler');
        recentChatsList.removeEventListener('click', oldHandler);
    }
    
    console.log('➕ Adding new event delegation handler');
    
    // Add single event listener using delegation
    const clickHandler = (event) => {
        const chatItem = event.target.closest('.chat-item[data-chat="private"]');
        if (!chatItem) return;
        
        event.stopPropagation();  // Prevent multiple handlers
        event.preventDefault();
        
        console.log('📱 Chat item clicked (via delegation):');
        console.log('  - event.target:', event.target);
        console.log('  - chatItem:', chatItem);
        
        const email = chatItem.getAttribute('data-target');
        const usernameEl = chatItem.querySelector('.chat-name');
        const username = usernameEl ? usernameEl.textContent.trim().split('\n')[0] : email;
        
        console.log('  - email from data-target:', email);
        console.log('  - username:', username);
        
        if (!email) {
            console.error('❌ ERROR: Chat email is missing from data-target!');
            showNotification('Error: Invalid chat data. Please refresh.', 'error');
            return;
        }
        
        startPrivateChat(username, email);
        
        // Mark as read in the stored data
        const storedChat = recentChats.get(email);
        if (storedChat) {
            storedChat.unreadCount = 0;
            saveRecentChatsToStorage();
            updateRecentChatsList();
        }
    };
    
    recentChatsList._clickHandler = clickHandler;
    recentChatsList.addEventListener('click', clickHandler);
    console.log('✅ Event delegation handler attached successfully');
}

// Format last seen like WhatsApp
function formatLastSeen(timestamp) {
    if (!timestamp) return 'last seen recently';
    
    const now = new Date();
    const lastSeen = new Date(timestamp);
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'last seen just now';
    if (diffMins < 60) return `last seen ${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) {
        const hours = lastSeen.getHours();
        const minutes = lastSeen.getMinutes().toString().padStart(2, '0');
        return `last seen today at ${hours}:${minutes}`;
    }
    if (diffDays === 1) {
        const hours = lastSeen.getHours();
        const minutes = lastSeen.getMinutes().toString().padStart(2, '0');
        return `last seen yesterday at ${hours}:${minutes}`;
    }
    
    const day = lastSeen.getDate();
    const month = lastSeen.getMonth() + 1;
    const year = lastSeen.getFullYear();
    return `last seen ${day}/${month}/${year}`;
}

// Delete functions removed per user request

// Simple emoji grid initialization
function initializeEmojiGrid() {
    console.log('Initializing emoji grid...');
    const emojiGrid = document.getElementById('emojiGrid');
    const messageInput = document.getElementById('messageInput');
    
    if (!emojiGrid || !messageInput) {
        console.error('Emoji grid or message input not found!');
        return;
    }
    
    // Clear existing emojis
    emojiGrid.innerHTML = '';
    
    // Add some basic emojis
    const basicEmojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'];
    
    basicEmojis.forEach(emoji => {
        const emojiButton = document.createElement('button');
        emojiButton.className = 'emoji-item';
        emojiButton.textContent = emoji;
        emojiButton.title = emoji;
        
        emojiButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Insert emoji into message input
            const cursorPos = messageInput.selectionStart || 0;
            const textBefore = messageInput.value.substring(0, cursorPos);
            const textAfter = messageInput.value.substring(messageInput.selectionEnd || cursorPos);
            
            messageInput.value = textBefore + emoji + textAfter;
            messageInput.focus();
            
            // Set cursor position after the emoji
            const newCursorPos = cursorPos + emoji.length;
            messageInput.setSelectionRange(newCursorPos, newCursorPos);
            
            // Close emoji picker
            document.getElementById('emojiPicker').classList.add('hidden');
            
            console.log('Emoji inserted:', emoji);
        });
        
        emojiGrid.appendChild(emojiButton);
    });
    
    console.log('Emoji grid populated with', basicEmojis.length, 'emojis');
}

// File sharing functions
function handleFileUpload(files) {
    console.log('Handling file upload:', files);
    
    // Allow files in all chat types
    files.forEach(file => {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showNotification(`File "${file.name}" is too large. Maximum size is 10MB.`, 'error');
            return;
        }
        
        if (file.type.startsWith('image/')) {
            handleImageUpload(file);
        } else {
            handleDocumentUpload(file);
        }
    });
}

function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = {
            type: 'image',
            name: file.name,
            size: file.size,
            data: e.target.result,
            timestamp: new Date().toISOString()
        };
        
        // Display image immediately
        displayFileMessage(imageData, true);
        
        // Send to other users (in a real app, you'd upload to server)
        sendFileMessage(imageData);
    };
    reader.readAsDataURL(file);
}

function handleDocumentUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const fileData = {
            type: 'document',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            data: e.target.result,
            timestamp: new Date().toISOString()
        };
        
        // Display file immediately
        displayFileMessage(fileData, true);
        
        // Send to other users (in a real app, you'd upload to server)
        sendFileMessage(fileData);
    };
    reader.readAsDataURL(file);
}

function sendFileMessage(fileData) {
    if (!socket) return;
    
    if (currentChat.type === 'private') {
        const messageData = {
            type: 'file',
            fileData: fileData,
            to: currentChat.target
        };
        console.log('Sending private file message:', messageData);
        socket.emit('send-file-message', messageData);
    } else if (currentChat.type === 'group') {
        const messageData = {
            groupId: currentChat.target,
            message: fileData.name,
            fileData: fileData
        };
        console.log('Sending group file message:', messageData);
        socket.emit('send-group-message', messageData);
    } else if (currentChat.type === 'general') {
        const messageData = {
            message: fileData.name,
            fileData: fileData
        };
        console.log('Sending general file message:', messageData);
        socket.emit('send-message', messageData);
    } else if (currentChat.type === 'hotspot') {
        const messageData = {
            message: fileData.name,
            fileData: fileData
        };
        console.log('Sending hotspot file message:', messageData);
        socket.emit('send-hotspot-message', messageData);
    }
}

function displayFileMessage(fileData, isOwn = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwn ? 'own' : 'other'}`;
    
    if (fileData.type === 'image') {
        messageElement.innerHTML = `
            <div class="image-message">
                <img src="${fileData.data}" alt="${fileData.name}" onclick="openImageModal('${fileData.data}', '${fileData.name}')">
            </div>
            <div class="message-time">${formatTime(new Date(fileData.timestamp))}</div>
        `;
    } else {
        const fileIcon = getFileIcon(fileData.mimeType);
        const fileSize = formatFileSize(fileData.size);
        
        messageElement.innerHTML = `
            <div class="file-message ${isOwn ? 'own' : ''}">
                <div class="file-info">
                    <div class="file-icon">
                        <i class="fas ${fileIcon}"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name">${fileData.name}</div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                </div>
            </div>
            <div class="message-time">${formatTime(new Date(fileData.timestamp))}</div>
        `;
        
        // Add click to download functionality
        messageElement.querySelector('.file-message').addEventListener('click', () => {
            downloadFile(fileData);
        });
    }
    
    messagesList.appendChild(messageElement);
    scrollToBottom();
}

function getFileIcon(mimeType) {
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
    if (mimeType.includes('text')) return 'fa-file-alt';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'fa-file-archive';
    return 'fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function downloadFile(fileData) {
    const link = document.createElement('a');
    link.href = fileData.data;
    link.download = fileData.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function openImageModal(src, name) {
    // Create modal for image viewing
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    modal.innerHTML = `
        <img src="${src}" alt="${name}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
        <div style="position: absolute; top: 20px; right: 20px; color: white; font-size: 2rem; cursor: pointer;">&times;</div>
    `;
    
    modal.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    document.body.appendChild(modal);
}

// Push Notifications System
let notificationPermission = 'default';
let isWindowFocused = true;
let notificationsEnabled = true;

async function initializePushNotifications() {
    console.log('Initializing push notifications...');
    
    // Check if browser supports notifications
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }
    
    // Check current permission
    notificationPermission = Notification.permission;
    console.log('Current notification permission:', notificationPermission);
    
    // Request permission if not granted
    if (notificationPermission === 'default') {
        try {
            notificationPermission = await Notification.requestPermission();
            console.log('Notification permission result:', notificationPermission);
            
            if (notificationPermission === 'granted') {
                showNotification('Desktop notifications enabled! 🔔', 'success');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }
    
    // Track window focus for smart notifications
    window.addEventListener('focus', () => {
        isWindowFocused = true;
        console.log('Window focused - notifications will be suppressed');
    });
    
    window.addEventListener('blur', () => {
        isWindowFocused = false;
        console.log('Window blurred - notifications will be shown');
    });
}

function showPushNotification(title, options = {}) {
    // Only show push notifications if:
    // 1. Permission is granted
    // 2. Window is not focused (user is away)
    // 3. Browser supports notifications
    // 4. User has notifications enabled
    
    if (notificationPermission !== 'granted') {
        console.log('Push notification blocked - no permission');
        return;
    }
    
    if (!notificationsEnabled) {
        console.log('Push notification suppressed - disabled by user');
        return;
    }
    
    if (isWindowFocused) {
        console.log('Push notification suppressed - window is focused');
        return;
    }
    
    try {
        const notification = new Notification(title, {
            icon: '/favicon.ico', // You can add a ChatFlow icon
            badge: '/favicon.ico',
            tag: 'chatflow-message', // Prevents duplicate notifications
            requireInteraction: false,
            silent: false,
            ...options
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);
        
        // Click to focus window
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        console.log('Push notification shown:', title);
        
    } catch (error) {
        console.error('Error showing push notification:', error);
    }
}

function createNotificationForMessage(message, chatType = 'private') {
    let title, body, options = {};
    
    switch (chatType) {
        case 'private':
            title = message.senderName || message.username || 'New Message';
            body = message.message || message.content;
            options.icon = '/favicon.ico';
            break;
            
        case 'group':
            title = `${message.groupName || 'Group Chat'}`;
            body = `${message.senderName}: ${message.message || message.content}`;
            options.icon = '/favicon.ico';
            break;
            
        case 'hotspot':
            title = 'Hotspot Group';
            body = `${message.color} User: ${message.message}`;
            options.icon = '/favicon.ico';
            break;
            
        default:
            title = 'ChatFlow';
            body = message.message || message.content || 'New message received';
    }
    
    // Truncate long messages
    if (body && body.length > 100) {
        body = body.substring(0, 97) + '...';
    }
    
    showPushNotification(title, {
        body: body,
        ...options
    });
}

function setupNotificationToggle() {
    const notificationToggle = document.getElementById('notificationToggle');
    if (!notificationToggle) {
        console.error('Notification toggle button not found');
        return;
    }
    
    // Load saved preference
    const savedState = localStorage.getItem('notificationsEnabled');
    if (savedState !== null) {
        notificationsEnabled = JSON.parse(savedState);
    }
    
    // Update button appearance
    updateNotificationToggleUI();
    
    // Add click handler
    notificationToggle.addEventListener('click', async () => {
        if (notificationPermission !== 'granted') {
            // Request permission first
            try {
                notificationPermission = await Notification.requestPermission();
                if (notificationPermission === 'granted') {
                    notificationsEnabled = true;
                    showNotification('Desktop notifications enabled! 🔔', 'success');
                } else {
                    showNotification('Notification permission denied', 'error');
                    return;
                }
            } catch (error) {
                console.error('Error requesting notification permission:', error);
                return;
            }
        } else {
            // Toggle notifications
            notificationsEnabled = !notificationsEnabled;
            
            if (notificationsEnabled) {
                showNotification('Desktop notifications enabled 🔔', 'success');
            } else {
                showNotification('Desktop notifications disabled 🔕', 'info');
            }
        }
        
        // Save preference
        localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
        
        // Update UI
        updateNotificationToggleUI();
    });
}

function updateNotificationToggleUI() {
    const notificationToggle = document.getElementById('notificationToggle');
    if (!notificationToggle) return;
    
    // Remove existing classes
    notificationToggle.classList.remove('enabled', 'disabled');
    
    if (notificationPermission === 'granted' && notificationsEnabled) {
        notificationToggle.classList.add('enabled');
        notificationToggle.title = 'Notifications enabled - Click to disable';
        notificationToggle.innerHTML = '<i class="fas fa-bell"></i>';
    } else if (notificationPermission === 'denied') {
        notificationToggle.classList.add('disabled');
        notificationToggle.title = 'Notifications blocked by browser';
        notificationToggle.innerHTML = '<i class="fas fa-bell-slash"></i>';
    } else if (!notificationsEnabled) {
        notificationToggle.classList.add('disabled');
        notificationToggle.title = 'Notifications disabled - Click to enable';
        notificationToggle.innerHTML = '<i class="fas fa-bell-slash"></i>';
    } else {
        notificationToggle.title = 'Click to enable notifications';
        notificationToggle.innerHTML = '<i class="fas fa-bell"></i>';
    }
}

// Dark Mode System
let isDarkMode = false;

function setupDarkModeToggle() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (!darkModeToggle) {
        console.error('Dark mode toggle button not found');
        return;
    }
    
    // Load saved theme preference
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme !== null) {
        isDarkMode = JSON.parse(savedTheme);
    } else {
        // Check system preference
        isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    // Apply initial theme
    applyTheme(isDarkMode);
    
    // Add click handler
    darkModeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        applyTheme(isDarkMode);
        
        // Save preference
        localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
        
        // Show notification
        showNotification(
            isDarkMode ? 'Dark mode enabled 🌙' : 'Light mode enabled ☀️', 
            'success'
        );
    });
    
    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (localStorage.getItem('darkMode') === null) {
                isDarkMode = e.matches;
                applyTheme(isDarkMode);
            }
        });
    }
}

function applyTheme(dark) {
    const body = document.body;
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    if (dark) {
        body.setAttribute('data-theme', 'dark');
        if (darkModeToggle) {
            darkModeToggle.classList.remove('light');
            darkModeToggle.classList.add('dark');
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            darkModeToggle.title = 'Switch to light mode';
        }
    } else {
        body.removeAttribute('data-theme');
        if (darkModeToggle) {
            darkModeToggle.classList.remove('dark');
            darkModeToggle.classList.add('light');
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            darkModeToggle.title = 'Switch to dark mode';
        }
    }
    
    console.log(`Theme applied: ${dark ? 'dark' : 'light'} mode`);
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
    // Apply theme early to prevent flash
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme !== null) {
        const isDark = JSON.parse(savedTheme);
        applyTheme(isDark);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme(true);
    }
});

// Message Status System
function updateMessageStatus(messageId, status) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    const statusElement = messageElement.querySelector('.message-status');
    if (!statusElement) return;
    
    // Remove existing status classes
    statusElement.classList.remove('sent', 'delivered', 'read', 'failed');
    statusElement.classList.add(status);
    
    // Update status icon
    const statusIcon = statusElement.querySelector('span');
    if (statusIcon) {
        statusIcon.className = `status-${status}`;
    }
    
    console.log(`Message ${messageId} status updated to: ${status}`);
    
    // Update chat list status circle color
    if (currentChat.type === 'private' && currentChat.target) {
        const chat = recentChats.get(currentChat.target);
        if (chat && chat.isSentByMe) {
            chat.messageStatus = status;
            saveRecentChatsToStorage();
            updateRecentChatsList();
            console.log(`Chat list updated to ${status} status for ${currentChat.target}`);
        }
    } else if (currentChat.type === 'group' && currentChat.target) {
        const groupInfo = groupChats.get(currentChat.target);
        if (groupInfo && groupInfo.isSentByMe) {
            groupInfo.messageStatus = status;
            saveGroupChatsToStorage();
            updateGroupsList();
            console.log(`Group list updated to ${status} status for group ${currentChat.target}`);
        }
    }
}

function simulateMessageDelivery(messageId) {
    // Small chance of message failure (5%)
    if (Math.random() < 0.05) {
        setTimeout(() => {
            updateMessageStatus(messageId, 'failed');
            addRetryButton(messageId);
        }, 2000 + Math.random() * 3000);
        return;
    }
    
    // Simulate realistic delivery timing
    setTimeout(() => {
        updateMessageStatus(messageId, 'delivered');
    }, 1000 + Math.random() * 2000); // 1-3 seconds
    
    // DON'T automatically mark as read
    // Messages should only turn green when recipient opens the chat
    // This will be handled by socket events from the server
}

function addRetryButton(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    const statusElement = messageElement.querySelector('.message-status');
    if (!statusElement) return;
    
    // Add retry button
    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.innerHTML = '↻';
    retryBtn.title = 'Retry sending message';
    retryBtn.style.cssText = `
        background: none;
        border: none;
        color: #f44336;
        cursor: pointer;
        margin-left: 4px;
        font-size: 0.9rem;
        padding: 2px;
        border-radius: 2px;
        transition: background 0.2s ease;
    `;
    
    retryBtn.addEventListener('click', () => {
        updateMessageStatus(messageId, 'sent');
        retryBtn.remove();
        
        // Retry delivery simulation
        setTimeout(() => {
            simulateMessageDelivery(messageId);
        }, 500);
        
        showNotification('Retrying message...', 'info');
    });
    
    retryBtn.addEventListener('mouseenter', () => {
        retryBtn.style.background = 'rgba(244, 67, 54, 0.1)';
    });
    
    retryBtn.addEventListener('mouseleave', () => {
        retryBtn.style.background = 'none';
    });
    
    statusElement.appendChild(retryBtn);
}

function addMessageId(messageElement, messageData) {
    // Generate unique message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    messageElement.setAttribute('data-message-id', messageId);
    
    // Store message data for potential resending
    messageElement.messageData = messageData;
    
    return messageId;
}

// Emoji data moved to initializeEmojiGrid function for better organization

// Removed duplicate emoji picker function - using simplified version in main setup

function saveRecentChatsToStorage() {
    try {
        const chatsArray = Array.from(recentChats.entries());
        localStorage.setItem('recentChats', JSON.stringify(chatsArray));
    } catch (error) {
        console.error('Error saving recent chats:', error);
    }
}

function loadRecentChatsFromStorage() {
    try {
        const saved = localStorage.getItem('recentChats');
        if (saved) {
            const chatsArray = JSON.parse(saved);
            recentChats = new Map(chatsArray);
            updateRecentChatsList();
        }
    } catch (error) {
        console.error('Error loading recent chats:', error);
    }
}

function saveGroupChatsToStorage() {
    try {
        const groupsArray = Array.from(groupChats.entries());
        localStorage.setItem('groupChats', JSON.stringify(groupsArray));
    } catch (error) {
        console.error('Error saving group chats:', error);
    }
}

function loadGroupChatsFromStorage() {
    try {
        const saved = localStorage.getItem('groupChats');
        if (saved) {
            const groupsArray = JSON.parse(saved);
            groupChats = new Map(groupsArray);
        }
    } catch (error) {
        console.error('Error loading group chats:', error);
    }
}

// Profile Settings Modal Functionality
const profileModal = document.getElementById('profileModal');
const userProfileBtn = document.getElementById('userProfileBtn');
const closeProfileModal = document.getElementById('closeProfileModal');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const avatarSelector = document.getElementById('avatarSelector');

// Open profile modal
if (userProfileBtn) {
    userProfileBtn.addEventListener('click', () => {
        profileModal.classList.remove('hidden');
        loadCurrentUserData();
    });
}

// Close profile modal
if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
        profileModal.classList.add('hidden');
    });
}

// Close modal when clicking outside
profileModal?.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        profileModal.classList.add('hidden');
    }
});

// Load current user data into profile modal
function loadCurrentUserData() {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const usernameInput = document.getElementById('newUsername');
    const emailInput = document.getElementById('newEmail');
    
    if (usernameInput) usernameInput.placeholder = currentUser.username || 'Enter new username';
    if (emailInput) emailInput.placeholder = currentUser.email || 'Enter new email';
}

// Upload photo button
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const profilePhotoInput = document.getElementById('profilePhotoInput');

uploadPhotoBtn?.addEventListener('click', () => {
    profilePhotoInput.click();
});

profilePhotoInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Image size must be less than 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const imgData = event.target.result;
        updateProfilePicture(imgData);
        
        // Save per-user profile picture
        const userEmail = currentUser?.email || localStorage.getItem('userEmail') || 'default';
        localStorage.setItem(`profilePicture_${userEmail}`, imgData);
        localStorage.removeItem('profileAvatar_' + userEmail); // Clear avatar if photo is uploaded
        
        showNotification('Profile picture updated!', 'success');
    };
    reader.readAsDataURL(file);
});

// Choose avatar button
const chooseAvatarBtn = document.getElementById('chooseAvatarBtn');
chooseAvatarBtn?.addEventListener('click', () => {
    avatarSelector.classList.toggle('hidden');
});

// Choose GIF button
const chooseGifBtn = document.getElementById('chooseGifBtn');
chooseGifBtn?.addEventListener('click', () => {
    showNotification('GIF picker coming soon! For now, use Choose Avatar or upload a photo.', 'info');
    // TODO: Integrate with a GIF API like GIPHY
});

// Avatar selection
const avatarOptions = document.querySelectorAll('.avatar-option');
avatarOptions.forEach(option => {
    option.addEventListener('click', () => {
        const avatarEmoji = option.dataset.avatar;
        updateProfilePicture(null, avatarEmoji);
        
        // Save per-user avatar
        const userEmail = currentUser?.email || localStorage.getItem('userEmail') || 'default';
        localStorage.setItem(`profileAvatar_${userEmail}`, avatarEmoji);
        localStorage.removeItem('profilePicture_' + userEmail); // Clear photo if avatar is selected
        
        avatarSelector.classList.add('hidden');
        showNotification('Avatar updated!', 'success');
    });
});

// Update profile picture display
function updateProfilePicture(imgData, emoji) {
    const profilePic = document.getElementById('currentProfilePicture');
    const userAvatar = document.querySelector('.user-avatar');
    
    if (imgData) {
        profilePic.innerHTML = `<img src="${imgData}" alt="Profile">`;
        userAvatar.innerHTML = `<img src="${imgData}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else if (emoji) {
        profilePic.innerHTML = emoji;
        profilePic.style.fontSize = '3rem';
        userAvatar.innerHTML = emoji;
        userAvatar.style.fontSize = '1.2rem';
    }
}

// Update username
const updateUsernameBtn = document.getElementById('updateUsernameBtn');
updateUsernameBtn?.addEventListener('click', async () => {
    const newUsername = document.getElementById('newUsername').value.trim();
    
    if (!newUsername) {
        showNotification('Please enter a username', 'error');
        return;
    }
    
    if (newUsername.length < 3) {
        showNotification('Username must be at least 3 characters', 'error');
        return;
    }
    
    try {
        showLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/update-username', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username: newUsername })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update user in localStorage
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.username = newUsername;
                localStorage.setItem('user', JSON.stringify(user));
            } catch (e) {
                console.log('Could not update user in localStorage:', e);
            }
            
            // Update UI
            const currentUsernameEl = document.getElementById('currentUsername');
            if (currentUsernameEl) {
                currentUsernameEl.textContent = newUsername;
            }
            document.getElementById('newUsername').value = '';
            showNotification('Username updated successfully!', 'success');
        } else {
            console.error('Username update failed:', response.status, data);
            showNotification(data.error || data.message || 'Failed to update username', 'error');
        }
    } catch (error) {
        console.error('Update username error:', error);
        showNotification('Failed to update username. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
});

// Update email
const updateEmailBtn = document.getElementById('updateEmailBtn');
updateEmailBtn?.addEventListener('click', async () => {
    const newEmail = document.getElementById('newEmail').value.trim();
    
    if (!newEmail) {
        showNotification('Please enter an email address', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        showLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/update-email', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email: newEmail })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update user in localStorage
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.email = newEmail;
                localStorage.setItem('user', JSON.stringify(user));
            } catch (e) {
                console.log('Could not update user in localStorage:', e);
            }
            
            // Clear input and show success
            document.getElementById('newEmail').value = '';
            showNotification('Email updated successfully!', 'success');
        } else {
            console.error('Email update failed:', response.status, data);
            showNotification(data.error || data.message || 'Failed to update email', 'error');
        }
    } catch (error) {
        console.error('Update email error:', error);
        showNotification('Failed to update email. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
});

// Change password
const changePasswordBtn = document.getElementById('changePasswordBtn');
changePasswordBtn?.addEventListener('click', async () => {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!oldPassword || !newPassword || !confirmPassword) {
        showNotification('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('New password must be at least 6 characters', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }
    
    try {
        showLoading(true);
        const token = localStorage.getItem('token');
        
        // Check if token exists
        if (!token) {
            showNotification('Session expired. Please log in again.', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }
        
        const response = await fetch('/api/auth/change-password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            showNotification('Password changed successfully!', 'success');
        } else {
            console.error('Password change failed:', data);
            const errorMessage = data.error || data.message || 'Failed to change password';
            
            // Handle token expiration (check both error and message fields)
            if (response.status === 401 || response.status === 403) {
                const fullError = `${data.error || ''} ${data.message || ''}`.toLowerCase();
                
                if (fullError.includes('token') || fullError.includes('expired') || fullError.includes('authentication')) {
                    // Don't trigger redirect if it's just wrong password
                    if (!fullError.includes('password is incorrect')) {
                        showNotification('Your session has expired. Please log in again.', 'error');
                        setTimeout(() => {
                            localStorage.clear();
                            window.location.href = '/';
                        }, 2000);
                        return;
                    }
                }
            }
            
            showNotification(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Change password error:', error);
        showNotification('Network error. Please check your connection and try again.', 'error');
    } finally {
        showLoading(false);
    }
});

// Delete account
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

deleteAccountBtn?.addEventListener('click', () => {
    deleteConfirmModal.classList.remove('hidden');
});

cancelDeleteBtn?.addEventListener('click', () => {
    deleteConfirmModal.classList.add('hidden');
    document.getElementById('deleteConfirmPassword').value = '';
});

confirmDeleteBtn?.addEventListener('click', async () => {
    const password = document.getElementById('deleteConfirmPassword').value;
    
    if (!password) {
        showNotification('Please enter your password to confirm', 'error');
        return;
    }
    
    try {
        showLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/delete-account', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Account deleted successfully', 'success');
            setTimeout(() => {
                localStorage.clear();
                window.location.reload();
            }, 2000);
        } else {
            showNotification(data.error || 'Failed to delete account', 'error');
        }
    } catch (error) {
        console.error('Delete account error:', error);
        showNotification('Failed to delete account', 'error');
    } finally {
        showLoading(false);
        deleteConfirmModal.classList.add('hidden');
    }
});

// Function to load user-specific profile picture
function loadUserProfilePicture() {
    const userEmail = currentUser?.email || localStorage.getItem('userEmail');
    if (!userEmail) return;
    
    const savedPicture = localStorage.getItem(`profilePicture_${userEmail}`);
    const savedAvatar = localStorage.getItem(`profileAvatar_${userEmail}`);
    
    if (savedPicture) {
        updateProfilePicture(savedPicture);
    } else if (savedAvatar) {
        updateProfilePicture(null, savedAvatar);
    }
}

// Load saved profile picture on page load
window.addEventListener('load', () => {
    loadUserProfilePicture();
});

// ============================================
// NEW FEATURES: Edit, Delete, Search, Reactions
// ============================================

// Edit Message Function
async function editMessage(messageId, newContent) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/chat/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: newContent })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Message edited successfully!', 'success');
            
            // Update message in UI
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                const contentElement = messageElement.querySelector('.message-text');
                if (contentElement) {
                    contentElement.textContent = newContent;
                    
                    // Add edited indicator
                    let editedTag = messageElement.querySelector('.edited-tag');
                    if (!editedTag) {
                        editedTag = document.createElement('span');
                        editedTag.className = 'edited-tag';
                        editedTag.textContent = ' (edited)';
                        editedTag.style.fontSize = '0.75rem';
                        editedTag.style.opacity = '0.6';
                        editedTag.style.fontStyle = 'italic';
                        contentElement.appendChild(editedTag);
                    }
                }
            }
            
            // Emit socket event for real-time update
            socket.emit('message-edited', {
                messageId,
                content: newContent
            });
            
            return true;
        } else {
            showNotification(data.error || 'Failed to edit message', 'error');
            return false;
        }
    } catch (error) {
        console.error('Edit message error:', error);
        showNotification('Failed to edit message', 'error');
        return false;
    }
}

// Delete Message Function
async function deleteMessage(messageId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/chat/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Message deleted successfully!', 'success');
            
            // Update message in UI
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                const contentElement = messageElement.querySelector('.message-text');
                if (contentElement) {
                    contentElement.textContent = 'This message was deleted';
                    contentElement.style.fontStyle = 'italic';
                    contentElement.style.opacity = '0.6';
                    
                    // Remove edit/delete buttons
                    const actionsMenu = messageElement.querySelector('.message-actions-menu');
                    if (actionsMenu) actionsMenu.remove();
                }
            }
            
            // Emit socket event for real-time update
            socket.emit('message-deleted', { messageId });
            
            return true;
        } else {
            showNotification(data.error || 'Failed to delete message', 'error');
            return false;
        }
    } catch (error) {
        console.error('Delete message error:', error);
        showNotification('Failed to delete message', 'error');
        return false;
    }
}

// Search Messages Function
async function searchMessages(query, type = 'general') {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/chat/messages/search/${encodeURIComponent(query)}?type=${type}&limit=20`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            displaySearchResults(data.messages);
            return data.messages;
        } else {
            showNotification(data.error || 'Search failed', 'error');
            return [];
        }
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Search failed', 'error');
        return [];
    }
}

// Display Search Results
function displaySearchResults(messages) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    if (messages.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">No messages found</p>';
        return;
    }

    resultsContainer.innerHTML = messages.map(msg => `
        <div class="search-result-item" data-message-id="${msg._id}">
            <div class="search-result-header">
                <strong>${msg.senderUsername}</strong>
                <span class="search-result-time">${new Date(msg.createdAt).toLocaleString()}</span>
            </div>
            <div class="search-result-content">${escapeHtml(msg.content)}</div>
            <div class="search-result-type">${msg.type}</div>
        </div>
    `).join('');
}

// Add Reaction Function
async function addReaction(messageId, emoji) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/chat/messages/${messageId}/react`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ emoji })
        });

        const data = await response.json();

        if (response.ok) {
            // Update reactions in UI
            updateReactionsUI(messageId, data.reactions);
            
            // Emit socket event for real-time update
            socket.emit('message-reaction', {
                messageId,
                reactions: data.reactions
            });
            
            return true;
        } else {
            showNotification(data.error || 'Failed to add reaction', 'error');
            return false;
        }
    } catch (error) {
        console.error('Reaction error:', error);
        showNotification('Failed to add reaction', 'error');
        return false;
    }
}

// Update Reactions UI
function updateReactionsUI(messageId, reactions) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    let reactionsContainer = messageElement.querySelector('.message-reactions');
    
    if (!reactionsContainer) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions';
        messageElement.querySelector('.message-content')?.appendChild(reactionsContainer);
    }

    if (reactions.length === 0) {
        reactionsContainer.innerHTML = '';
        return;
    }

    // Group reactions by emoji
    const reactionGroups = {};
    reactions.forEach(reaction => {
        if (!reactionGroups[reaction.emoji]) {
            reactionGroups[reaction.emoji] = [];
        }
        reactionGroups[reaction.emoji].push(reaction.username);
    });

    // Display grouped reactions
    reactionsContainer.innerHTML = Object.entries(reactionGroups).map(([emoji, users]) => `
        <span class="reaction-group" data-emoji="${emoji}" title="${users.join(', ')}">
            ${emoji} ${users.length}
        </span>
    `).join('');
}

// Add message actions menu to each message
function addMessageActions(messageElement, messageId, isSender) {
    if (!isSender) return; // Only sender can edit/delete

    const messageContent = messageElement.querySelector('.message-content');
    if (!messageContent) return;

    // Check if actions already exist
    if (messageElement.querySelector('.message-actions-menu')) return;

    // Create actions button
    const actionsBtn = document.createElement('button');
    actionsBtn.className = 'message-actions-btn';
    actionsBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
    actionsBtn.title = 'Message actions';

    // Create actions menu
    const actionsMenu = document.createElement('div');
    actionsMenu.className = 'message-actions-menu hidden';
    actionsMenu.innerHTML = `
        <button class="action-btn edit-btn" data-message-id="${messageId}">
            <i class="fas fa-edit"></i> Edit
        </button>
        <button class="action-btn delete-btn" data-message-id="${messageId}">
            <i class="fas fa-trash"></i> Delete
        </button>
    `;

    // Toggle menu
    actionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        actionsMenu.classList.toggle('hidden');
    });

    // Edit handler
    actionsMenu.querySelector('.edit-btn').addEventListener('click', () => {
        const messageText = messageContent.querySelector('.message-text');
        const currentText = messageText.textContent.replace(' (edited)', '');
        
        const newText = prompt('Edit message:', currentText);
        if (newText && newText.trim() && newText !== currentText) {
            editMessage(messageId, newText.trim());
        }
        actionsMenu.classList.add('hidden');
    });

    // Delete handler
    actionsMenu.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this message?')) {
            deleteMessage(messageId);
        }
        actionsMenu.classList.add('hidden');
    });

    messageContent.appendChild(actionsBtn);
    messageContent.appendChild(actionsMenu);
}

// Add reaction picker to each message
function addReactionPicker(messageElement, messageId) {
    const messageContent = messageElement.querySelector('.message-content');
    if (!messageContent) return;

    // Check if reaction button already exists
    if (messageElement.querySelector('.reaction-picker-btn')) return;

    // Create reaction button
    const reactionBtn = document.createElement('button');
    reactionBtn.className = 'reaction-picker-btn';
    reactionBtn.innerHTML = '<i class="fas fa-smile"></i>';
    reactionBtn.title = 'Add reaction';

    // Create reaction picker
    const reactionPicker = document.createElement('div');
    reactionPicker.className = 'reaction-picker hidden';
    const emojis = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉', '👏'];
    reactionPicker.innerHTML = emojis.map(emoji => 
        `<span class="emoji-option" data-emoji="${emoji}">${emoji}</span>`
    ).join('');

    // Toggle picker
    reactionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        reactionPicker.classList.toggle('hidden');
    });

    // Emoji selection
    reactionPicker.addEventListener('click', (e) => {
        if (e.target.classList.contains('emoji-option')) {
            const emoji = e.target.dataset.emoji;
            addReaction(messageId, emoji);
            reactionPicker.classList.add('hidden');
        }
    });

    messageContent.appendChild(reactionBtn);
    messageContent.appendChild(reactionPicker);
}

// Listen for real-time updates
socket.on('message-edited', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        const contentElement = messageElement.querySelector('.message-text');
        if (contentElement) {
            contentElement.textContent = data.content;
            
            let editedTag = messageElement.querySelector('.edited-tag');
            if (!editedTag) {
                editedTag = document.createElement('span');
                editedTag.className = 'edited-tag';
                editedTag.textContent = ' (edited)';
                editedTag.style.fontSize = '0.75rem';
                editedTag.style.opacity = '0.6';
                editedTag.style.fontStyle = 'italic';
                contentElement.appendChild(editedTag);
            }
        }
    }
});

socket.on('message-deleted', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        const contentElement = messageElement.querySelector('.message-text');
        if (contentElement) {
            contentElement.textContent = 'This message was deleted';
            contentElement.style.fontStyle = 'italic';
            contentElement.style.opacity = '0.6';
        }
    }
});

socket.on('message-reaction', (data) => {
    updateReactionsUI(data.messageId, data.reactions);
});

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Search Panel Event Handlers
// ============================================

const openSearchBtn = document.getElementById('openSearchBtn');
const closeSearchPanelBtn = document.getElementById('closeSearchPanelBtn');
const messageSearchPanel = document.getElementById('messageSearchPanel');
const messageSearchInput = document.getElementById('messageSearchInput');

// Open search panel
openSearchBtn?.addEventListener('click', () => {
    messageSearchPanel.classList.remove('hidden');
    messageSearchInput.focus();
});

// Close search panel
closeSearchPanelBtn?.addEventListener('click', () => {
    messageSearchPanel.classList.add('hidden');
    messageSearchInput.value = '';
    document.getElementById('searchResults').innerHTML = '<p class="search-hint">Type to search messages...</p>';
});

// Search as user types (debounced)
let searchTimeout;
messageSearchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        document.getElementById('searchResults').innerHTML = '<p class="search-hint">Type at least 2 characters...</p>';
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        document.getElementById('searchResults').innerHTML = '<p class="search-hint">Searching...</p>';
        await searchMessages(query, 'general');
    }, 500); // Wait 500ms after user stops typing
});

// Close search panel with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !messageSearchPanel.classList.contains('hidden')) {
        closeSearchPanelBtn.click();
    }
});
