// script.js

// ==================== কনফিগারেশন ====================
const CONFIG = {
    // আপনার ওয়েবসাইটের API এন্ডপয়েন্ট (যেখানে n8n HTTP request পাঠাবে)
    API_BASE_URL: window.location.origin, // নিজস্ব URL会自动detect
    API_ENDPOINTS: {
        GET_DATA: '/api/get-data',
        POST_DATA: '/api/post-data',
        UPDATE_DATA: '/api/update-data',
        DELETE_DATA: '/api/delete-data'
    },
    POLLING_INTERVAL: 5000, // n8n থেকে ডাটা চেক করার ইন্টারভাল
    AUTH_TOKEN: 'your-secret-token-here' // n8n থেকে পাঠানো টোকেন ভেরিফাই করার জন্য
};

// ==================== ডাটা স্টোর (টেম্পোরারি মেমোরি) ====================
let appData = {
    messages: [],        // n8n থেকে পাওয়া ডাটা
    commands: [],        // n8n থেকে পাঠানো কমান্ড
    notifications: [],   // n8n থেকে পাঠানো নোটিফিকেশন
    lastUpdate: null
};

// ==================== ডম এলিমেন্টস ====================
const elements = {
    chatWindow: document.getElementById('chat-window'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    themeBtn: document.getElementById('theme-btn'),
    themeIcon: document.getElementById('theme-icon')
};

// ==================== API এন্ডপয়েন্ট (n8n HTTP Node থেকে কল হবে) ====================

// GET API - n8n ডাটা রিট্রিভ করবে
window.handleGetData = async function(req) {
    console.log('📥 n8n GET Request received:', req);
    
    try {
        // অথেনটিকেশন চেক
        const authToken = req.headers?.authorization?.replace('Bearer ', '');
        if (authToken !== CONFIG.AUTH_TOKEN) {
            return {
                status: 401,
                body: {
                    success: false,
                    error: 'Unauthorized access'
                }
            };
        }

        // বিভিন্ন ধরণের GET রিকোয়েস্ট হ্যান্ডল করা
        const { type, id, limit = 50 } = req.query || {};
        
        let responseData = {
            success: true,
            timestamp: new Date().toISOString(),
            data: []
        };

        switch(type) {
            case 'messages':
                responseData.data = appData.messages.slice(-limit);
                break;
            case 'commands':
                responseData.data = appData.commands.slice(-limit);
                break;
            case 'notifications':
                responseData.data = appData.notifications.slice(-limit);
                break;
            case 'all':
                responseData = {
                    ...responseData,
                    messages: appData.messages.slice(-limit),
                    commands: appData.commands.slice(-limit),
                    notifications: appData.notifications.slice(-limit),
                    stats: {
                        totalMessages: appData.messages.length,
                        totalCommands: appData.commands.length,
                        totalNotifications: appData.notifications.length,
                        lastUpdate: appData.lastUpdate
                    }
                };
                break;
            case 'single':
                const item = findItemById(id);
                responseData.data = item ? [item] : [];
                break;
            default:
                responseData.data = appData.messages.slice(-limit);
        }

        return {
            status: 200,
            body: responseData,
            headers: {
                'Content-Type': 'application/json'
            }
        };

    } catch (error) {
        console.error('GET API Error:', error);
        return {
            status: 500,
            body: {
                success: false,
                error: error.message
            }
        };
    }
};

// POST API - n8n ডাটা পাঠাবে
window.handlePostData = async function(req) {
    console.log('📥 n8n POST Request received:', req);
    
    try {
        // অথেনটিকেশন চেক
        const authToken = req.headers?.authorization?.replace('Bearer ', '');
        if (authToken !== CONFIG.AUTH_TOKEN) {
            return {
                status: 401,
                body: {
                    success: false,
                    error: 'Unauthorized access'
                }
            };
        }

        const body = req.body || {};
        const { type, action, data } = body;

        // ডাটা টাইপ অনুযায়ী প্রসেস
        let processedData = {
            id: generateUniqueId(),
            timestamp: new Date().toISOString(),
            type: type,
            ...data
        };

        switch(type) {
            case 'message':
                appData.messages.push(processedData);
                showInChat('bot', processedData.content || processedData.text || 'নতুন মেসেজ এসেছে');
                break;
                
            case 'command':
                appData.commands.push(processedData);
                await executeCommand(processedData);
                break;
                
            case 'notification':
                appData.notifications.push(processedData);
                showNotification(processedData);
                break;
                
            case 'update':
                await updateData(processedData);
                break;
                
            default:
                appData.messages.push(processedData);
        }

        appData.lastUpdate = new Date().toISOString();

        return {
            status: 200,
            body: {
                success: true,
                message: 'ডাটা সফলভাবে প্রসেস করা হয়েছে',
                dataId: processedData.id,
                timestamp: processedData.timestamp
            }
        };

    } catch (error) {
        console.error('POST API Error:', error);
        return {
            status: 500,
            body: {
                success: false,
                error: error.message
            }
        };
    }
};

// PUT API - n8n ডাটা আপডেট করবে
window.handlePutData = async function(req) {
    console.log('📥 n8n PUT Request received:', req);
    
    try {
        // অথেনটিকেশন চেক
        const authToken = req.headers?.authorization?.replace('Bearer ', '');
        if (authToken !== CONFIG.AUTH_TOKEN) {
            return {
                status: 401,
                body: {
                    success: false,
                    error: 'Unauthorized access'
                }
            };
        }

        const body = req.body || {};
        const { id, type, updates } = body;

        if (!id) {
            return {
                status: 400,
                body: {
                    success: false,
                    error: 'ID required for update'
                }
            };
        }

        // আইডি অনুযায়ী ডাটা খুঁজে আপডেট
        let updated = false;
        let targetArray = [];

        switch(type) {
            case 'message':
                targetArray = appData.messages;
                break;
            case 'command':
                targetArray = appData.commands;
                break;
            case 'notification':
                targetArray = appData.notifications;
                break;
        }

        const index = targetArray.findIndex(item => item.id === id);
        if (index !== -1) {
            targetArray[index] = { ...targetArray[index], ...updates, updatedAt: new Date().toISOString() };
            updated = true;
        }

        return {
            status: updated ? 200 : 404,
            body: {
                success: updated,
                message: updated ? 'ডাটা আপডেট করা হয়েছে' : 'ডাটা পাওয়া যায়নি'
            }
        };

    } catch (error) {
        console.error('PUT API Error:', error);
        return {
            status: 500,
            body: {
                success: false,
                error: error.message
            }
        };
    }
};

// DELETE API - n8n ডাটা ডিলিট করবে
window.handleDeleteData = async function(req) {
    console.log('📥 n8n DELETE Request received:', req);
    
    try {
        // অথেনটিকেশন চেক
        const authToken = req.headers?.authorization?.replace('Bearer ', '');
        if (authToken !== CONFIG.AUTH_TOKEN) {
            return {
                status: 401,
                body: {
                    success: false,
                    error: 'Unauthorized access'
                }
            };
        }

        const { id, type } = req.query || {};

        if (!id) {
            return {
                status: 400,
                body: {
                    success: false,
                    error: 'ID required for delete'
                }
            };
        }

        // আইডি অনুযায়ী ডাটা ডিলিট
        let deleted = false;
        
        if (type === 'message' || !type) {
            const index = appData.messages.findIndex(item => item.id === id);
            if (index !== -1) {
                appData.messages.splice(index, 1);
                deleted = true;
            }
        }
        
        if (type === 'command' || !type) {
            const index = appData.commands.findIndex(item => item.id === id);
            if (index !== -1) {
                appData.commands.splice(index, 1);
                deleted = true;
            }
        }

        return {
            status: deleted ? 200 : 404,
            body: {
                success: deleted,
                message: deleted ? 'ডাটা ডিলিট করা হয়েছে' : 'ডাটা পাওয়া যায়নি'
            }
        };

    } catch (error) {
        console.error('DELETE API Error:', error);
        return {
            status: 500,
            body: {
                success: false,
                error: error.message
            }
        };
    }
};

// ==================== n8n থেকে কমান্ড এক্সিকিউট ====================
async function executeCommand(command) {
    console.log('Executing command from n8n:', command);
    
    const { action, parameters } = command;
    
    switch(action) {
        case 'showMessage':
            showInChat('bot', parameters.text);
            break;
            
        case 'updateUI':
            updateUI(parameters);
            break;
            
        case 'fetchData':
            await fetchAndDisplayData(parameters);
            break;
            
        case 'exportData':
            exportDataToFile(parameters);
            break;
            
        default:
            showInChat('bot', `অজানা কমান্ড: ${action}`);
    }
    
    // কমান্ড এক্সিকিউশনের রেজাল্ট UI-তে দেখান
    addToConsole('command', command);
}

// ==================== n8n থেকে ডাটা চেক করার পোলিং ====================
async function pollDataFromN8N() {
    try {
        // n8n HTTP Node-এ GET request পাঠানোর জন্য
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/poll-n8n`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.AUTH_TOKEN}`
            },
            body: JSON.stringify({
                type: 'poll',
                lastUpdate: appData.lastUpdate
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.newData && data.newData.length > 0) {
                processNewDataFromN8N(data.newData);
            }
        }
    } catch (error) {
        console.error('Polling error:', error);
    }
}

// ==================== ইউটিলিটি ফাংশনস ====================

// ইউনিক আইডি জেনারেট
function generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// চ্যাটে মেসেজ দেখান
function showInChat(sender, message) {
    if (!message) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = sender === 'user' ? 
        '<i data-lucide="user"></i>' : 
        '<i data-lucide="bot"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString('bn-BD');
    
    bubble.appendChild(timestamp);
    contentDiv.appendChild(bubble);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    elements.chatWindow.appendChild(messageDiv);
    
    // লুসাইড আইকন আপডেট
    if (window.lucide) {
        lucide.createIcons();
    }
    
    scrollToBottom();
}

// নোটিফিকেশন দেখান
function showNotification(notification) {
    // ব্রাউজার নোটিফিকেশন
    if (Notification.permission === 'granted') {
        new Notification(notification.title || 'n8n Notification', {
            body: notification.message || notification.content,
            icon: '/brand_image.png'
        });
    }
    
    // UI-তে নোটিফিকেশন দেখান
    showInChat('bot', `🔔 ${notification.message || notification.content}`);
}

// UI আপডেট করুন
function updateUI(params) {
    if (params.theme) {
        document.body.setAttribute('data-theme', params.theme);
        updateThemeIcon(params.theme);
    }
    
    if (params.title) {
        document.title = params.title;
    }
}

// ডাটা এক্সপোর্ট করুন
function exportDataToFile(params) {
    const { format = 'json', filename = 'n8n-data' } = params;
    
    let content, mimeType;
    
    if (format === 'json') {
        content = JSON.stringify(appData, null, 2);
        mimeType = 'application/json';
    } else if (format === 'csv') {
        content = convertToCSV(appData);
        mimeType = 'text/csv';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== n8n HTTP Node কনফিগারেশন গাইড ====================
// 
// GET Request উদাহরণ:
// URL: http://your-website.com
// Method: GET
// Headers: {
//   "Authorization": "Bearer your-secret-token-here"
// }
// Query Parameters: {
//   "type": "messages",
//   "limit": "10"
// }
// 
// POST Request উদাহরণ:
// URL: http://your-website.com
// Method: POST
// Headers: {
//   "Authorization": "Bearer your-secret-token-here",
//   "Content-Type": "application/json"
// }
// Body (JSON): {
//   "type": "message",
//   "action": "send",
//   "data": {
//     "content": "Hello from n8n!",
//     "priority": "high"
//   }
// }
// 
// PUT Request উদাহরণ:
// URL: http://your-website.com
// Method: PUT
// Headers: {
//   "Authorization": "Bearer your-secret-token-here"
// }
// Body: {
//   "id": "message-123",
//   "type": "message",
//   "updates": {
//     "content": "Updated message"
//   }
// }
// 
// DELETE Request উদাহরণ:
// URL: http://your-website.com?id=message-123&type=message
// Method: DELETE
// Headers: {
//   "Authorization": "Bearer your-secret-token-here"
// }

// ==================== ইনিশিয়ালাইজেশন ====================
async function initialize() {
    console.log('🚀 n8n HTTP Node Integration Initialized');
    
    // নোটিফিকেশন পারমিশন নিন
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
    }
    
    // API হ্যান্ডলার রেজিস্টার করুন
    window.n8nAPI = {
        GET: window.handleGetData,
        POST: window.handlePostData,
        PUT: window.handlePutData,
        DELETE: window.handleDeleteData
    };
    
    // ইন্টারসেপ্টর সেটআপ (যদি Express.js বা কোনো framework use করেন)
    setupRequestInterceptor();
    
    // ডিবাগ মোডে n8n থেকে ডাটা আসার সিমুলেশন
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        simulateN8NData();
    }
    
    console.log('✅ n8n HTTP Node ready to receive requests');
    showInChat('bot', 'n8n HTTP Node Integration Ready! 🚀');
}

// ==================== রিকোয়েস্ট ইন্টারসেপ্টর ====================
function setupRequestInterceptor() {
    // ফেচ ইন্টারসেপ্টর
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0].toString();
        
        // আমাদের API এন্ডপয়েন্টে কল ইন্টারসেপ্ট করুন
        if (url.includes('/api/')) {
            const method = args[1]?.method || 'GET';
            const headers = args[1]?.headers || {};
            const body = args[1]?.body ? JSON.parse(args[1].body) : {};
            
            // লোকাল API কল হ্যান্ডল করুন
            if (url.includes('/api/get-data')) {
                return handleLocalAPI({ method: 'GET', query: body, headers });
            }
            if (url.includes('/api/post-data')) {
                return handleLocalAPI({ method: 'POST', body, headers });
            }
        }
        
        return originalFetch.apply(this, args);
    };
}

// ==================== লোকাল API হ্যান্ডলার ====================
async function handleLocalAPI(request) {
    let response;
    
    switch(request.method) {
        case 'GET':
            response = await window.n8nAPI.GET(request);
            break;
        case 'POST':
            response = await window.n8nAPI.POST(request);
            break;
        case 'PUT':
            response = await window.n8nAPI.PUT(request);
            break;
        case 'DELETE':
            response = await window.n8nAPI.DELETE(request);
            break;
        default:
            response = { status: 405, body: { error: 'Method not allowed' } };
    }
    
    return new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: response.headers || { 'Content-Type': 'application/json' }
    });
}

// ==================== সিমুলেশন (ডেভেলপমেন্টের জন্য) ====================
function simulateN8NData() {
    // n8n থেকে POST request আসার সিমুলেশন
    setTimeout(() => {
        window.n8nAPI.POST({
            headers: { authorization: `Bearer ${CONFIG.AUTH_TOKEN}` },
            body: {
                type: 'message',
                data: {
                    content: 'Hello! This is a test message from n8n HTTP Node!'
                }
            }
        });
    }, 2000);
}

// স্ক্রল টু বটম
function scrollToBottom() {
    setTimeout(() => {
        elements.chatWindow.scrollTo({
            top: elements.chatWindow.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
}

// ==================== স্টার্ট ====================
document.addEventListener('DOMContentLoaded', initialize);