class TBAIComplianceChat {
    constructor() {
        this.webhookUrls = {
            test: 'https://topbermanai.app.n8n.cloud/webhook-test/bf4dd093-bb02-472c-9454-7ab9af97bd1d',
            production: 'https://topbermanai.app.n8n.cloud/webhook/bf4dd093-bb02-472c-9454-7ab9af97bd1d'
        };

        this.maxQueriesPerDay = 10;
        this.storageKey = 'tbai_queries';

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUI();
        this.checkRateLimit();
        this.startCountdownTimer();
    }

    bindEvents() {
        const sendButton = document.getElementById('send-button');
        const chatInput = document.getElementById('chat-input');
        const envToggle = document.getElementById('env-toggle');

        sendButton.addEventListener('click', () => this.handleSendMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        chatInput.addEventListener('input', () => this.updateCharCounter());
        envToggle.addEventListener('change', () => this.updateEnvironmentLabel());
    }

    updateCharCounter() {
        const chatInput = document.getElementById('chat-input');
        const charCount = document.getElementById('char-count');
        const currentLength = chatInput.value.length;
        charCount.textContent = `${currentLength}/500 characters`;
    }

    updateEnvironmentLabel() {
        const envToggle = document.getElementById('env-toggle');
        const toggleText = document.querySelector('.toggle-text');
        toggleText.textContent = envToggle.checked ? 'Production' : 'Test';
    }

    getRateLimitData() {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {
            return {
                queries: 0,
                lastReset: new Date().toDateString()
            };
        }

        try {
            return JSON.parse(stored);
        } catch (e) {
            return {
                queries: 0,
                lastReset: new Date().toDateString()
            };
        }
    }

    saveRateLimitData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    checkRateLimit() {
        const data = this.getRateLimitData();
        const today = new Date().toDateString();

        // Reset if it's a new day
        if (data.lastReset !== today) {
            data.queries = 0;
            data.lastReset = today;
            this.saveRateLimitData(data);
        }

        return data.queries < this.maxQueriesPerDay;
    }

    incrementQueryCount() {
        const data = this.getRateLimitData();
        data.queries++;
        this.saveRateLimitData(data);
        this.updateUI();
    }

    updateUI() {
        const data = this.getRateLimitData();
        const remaining = this.maxQueriesPerDay - data.queries;
        const queriesRemaining = document.getElementById('queries-remaining');

        queriesRemaining.textContent = `${remaining} queries remaining today`;

        const sendButton = document.getElementById('send-button');
        const chatInput = document.getElementById('chat-input');

        if (remaining <= 0) {
            sendButton.disabled = true;
            chatInput.disabled = true;
            chatInput.placeholder = 'Daily query limit reached. Try again tomorrow.';
            queriesRemaining.style.color = '#ef4444';
        } else {
            sendButton.disabled = false;
            chatInput.disabled = false;
            chatInput.placeholder = 'Ask about compliance regulations, policies, or best practices...';
            queriesRemaining.style.color = remaining <= 2 ? '#f59e0b' : '#64748b';
        }
    }

    async handleSendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();

        if (!message) return;

        if (!this.checkRateLimit()) {
            this.showRateLimitModal();
            return;
        }

        // Clear input and disable send button temporarily
        chatInput.value = '';
        this.updateCharCounter();

        // Add user message to chat
        this.addMessageToChat(message, 'user');

        // Show loading indicator
        this.showLoading(true);

        try {
            // Increment query count
            this.incrementQueryCount();

            // Send message to webhook
            const response = await this.sendToWebhook(message);

            // Hide loading and add AI response
            this.showLoading(false);
            this.addMessageToChat(response, 'ai');

        } catch (error) {
            console.error('Error sending message:', error);
            this.showLoading(false);
            this.addMessageToChat('Sorry, I encountered an error while processing your request. Please try again later.', 'ai', true);

            // Decrement query count on error
            const data = this.getRateLimitData();
            data.queries = Math.max(0, data.queries - 1);
            this.saveRateLimitData(data);
            this.updateUI();
        }
    }

    async sendToWebhook(message) {
        const envToggle = document.getElementById('env-toggle');
        const webhookUrl = envToggle.checked ? this.webhookUrls.production : this.webhookUrls.test;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                timestamp: new Date().toISOString(),
                environment: envToggle.checked ? 'production' : 'test'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.response || data.message || 'Thank you for your question. I\'ve received it and will provide assistance based on compliance best practices.';
    }

    addMessageToChat(message, sender, isError = false) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? 'U' : 'AI';

        const content = document.createElement('div');
        content.className = 'message-content';
        if (isError) {
            content.style.background = '#fef2f2';
            content.style.color = '#dc2626';
            content.style.borderColor = '#fecaca';
        }

        const text = document.createElement('div');
        text.textContent = message;

        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        content.appendChild(text);
        content.appendChild(time);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showLoading(show) {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (show) {
            loadingIndicator.classList.add('show');
        } else {
            loadingIndicator.classList.remove('show');
        }

        // Scroll to bottom
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showRateLimitModal() {
        const modal = document.getElementById('rate-limit-modal');
        modal.classList.add('show');
    }

    startCountdownTimer() {
        const updateCountdown = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const timeDiff = tomorrow - now;
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

            const countdownTimer = document.getElementById('countdown-timer');
            if (countdownTimer) {
                countdownTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        };

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }
}

// Global function to close modal
function closeModal() {
    const modal = document.getElementById('rate-limit-modal');
    modal.classList.remove('show');
}

// Initialize the chat application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TBAIComplianceChat();
});