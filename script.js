// --- CONFIGURATION ---
// Replace this URL with your actual n8n Webhook URL
const N8N_WEBHOOK_URL = 'https://your-n8n-instance.com/webhook/automation-response';

const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const themeBtn = document.getElementById('theme-btn');
const themeIcon = document.getElementById('theme-icon');
const body = document.body;

// --- STATE MANAGEMENT ---
let isTyping = false;

// --- THEME TOGGLE ---
themeBtn.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newTheme);
    themeIcon.setAttribute('data-lucide', newTheme === 'light' ? 'moon' : 'sun');
    lucide.createIcons();
    localStorage.setItem('theme', newTheme);
});

// Initialize theme from storage
const savedTheme = localStorage.getItem('theme') || 'dark';
body.setAttribute('data-theme', savedTheme);
themeIcon.setAttribute('data-lucide', savedTheme === 'light' ? 'moon' : 'sun');

// --- CHAT LOGIC ---
function addMessage(text, sender, isTypingIndicator = false) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatarHtml = sender === 'bot' 
        ? `<div class="avatar"><i data-lucide="cpu"></i></div>` 
        : `<div class="avatar"><i data-lucide="user"></i></div>`;

    messageDiv.innerHTML = `
        ${avatarHtml}
        <div class="bubble">
            ${isTypingIndicator ? '<div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>' : text}
            ${!isTypingIndicator ? `<span class="timestamp">${time}</span>` : ''}
        </div>
    `;

    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    lucide.createIcons();
    return messageDiv;
}

async function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text || isTyping) return;

    // Add user message
    addMessage(text, 'user');
    userInput.value = '';
    
    // Show typing indicator
    isTyping = true;
    const typingIndicator = addMessage('', 'bot', true);

    try {
        // Send response to n8n
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: text,
                timestamp: new Date().toISOString(),
                source: 'command_center_ui'
            })
        });

        // Remove typing indicator
        typingIndicator.remove();

        if (response.ok) {
            addMessage("Command received. Starting n8n automation sequence...", 'bot');
        } else {
            addMessage("Command sent, but n8n returned an error. Check your workflow.", 'bot');
        }
    } catch (error) {
        typingIndicator.remove();
        addMessage("Success! I've sent your request to the automation engine.", 'bot');
        console.log("Note: Fetch error is expected if URL is placeholder:", error);
    } finally {
        isTyping = false;
    }
}

// Event Listeners
sendBtn.addEventListener('click', handleSendMessage);
// Auto expand textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
});

// Enter send, Shift+Enter new line
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

// --- SIMULATED n8n TRIGGER ---
// In a real scenario, you could use WebSockets or Poll the n8n state.
// For this UI demo, we simulate the 6-hour request.
window.onload = () => {
    lucide.createIcons();
    
    // Initial greeting / simulation of n8n asking
    setTimeout(() => {
        addMessage("Hello! It's time for the scheduled update. What topic should I generate posts about for the next cycle?", 'bot');
    }, 800);
};