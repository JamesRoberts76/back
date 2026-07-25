document.addEventListener('DOMContentLoaded', () => {
    const chatLog = document.getElementById('chat-log');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    let conversationHistory = [];
    let isGenerating = false;

    async function handleSendMessage() {
        const text = userInput.value.trim();
        if (!text || isGenerating) return;

        isGenerating = true;
        sendBtn.disabled = true;
        sendBtn.querySelector('.btn-text').textContent = 'Thinking...';

        appendMessage(text, 'user-message');
        userInput.value = '';
        userInput.style.height = 'auto';
        
        conversationHistory.push({ role: 'user', content: text });
        scrollToBottom();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: conversationHistory,
                    node: 'back.guide'
                })
            });

            if (!response.ok) throw new Error('Network response failed');

            const data = await response.json();
            const reply = data.reply;

            appendMessage(reply, 'assistant-message');
            conversationHistory.push({ role: 'assistant', content: reply });

            scrollToBottom();

        } catch (err) {
            appendMessage("Connection interrupted. Let's try that again.", 'assistant-message');
            console.error(err);
        } finally {
            isGenerating = false;
            sendBtn.disabled = false;
            sendBtn.querySelector('.btn-text').textContent = 'Send';
            userInput.focus();
        }
    }

    function appendMessage(text, className) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${className}`;
        const p = document.createElement('p');
        p.textContent = text;
        msgDiv.appendChild(p);
        chatLog.appendChild(msgDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    });

    sendBtn.addEventListener('click', handleSendMessage);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
});
