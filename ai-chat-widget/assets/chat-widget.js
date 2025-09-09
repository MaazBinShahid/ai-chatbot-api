// assets/chat-widget.js
(function () {
  if (!document) return;

  const API_URL = (typeof aiChatSettings !== 'undefined' && aiChatSettings.apiUrl) ? aiChatSettings.apiUrl : '';
  const ROOT_ID = 'ai-chat-root';

  // Create widget markup
  function createWidget() {
    const root = document.getElementById(ROOT_ID) || (function () {
      const r = document.createElement('div');
      r.id = ROOT_ID;
      document.body.appendChild(r);
      return r;
    })();

    root.innerHTML = `
      <div id="ai-chat-widget" class="ai-chat-collapsed" aria-hidden="true">
        <button id="ai-chat-toggle" class="ai-chat-toggle">Chat</button>
        <div id="ai-chat-window" class="ai-chat-window" role="dialog" aria-label="AI Chat" style="display:none;">
          <div class="ai-chat-header">
            <span>AI Assistant</span>
            <button id="ai-chat-close" aria-label="Close">✕</button>
          </div>
          <div id="ai-chat-messages" class="ai-chat-messages"></div>
          <div class="ai-chat-input-row">
            <input id="ai-chat-input" placeholder="Ask a question..." autocomplete="off" />
            <button id="ai-chat-send">Send</button>
          </div>
        </div>
      </div>
    `;

    attachHandlers();
    loadSession();
  }

  // Handlers
  function attachHandlers() {
    const toggle = document.getElementById('ai-chat-toggle');
    const closeBtn = document.getElementById('ai-chat-close');
    const windowEl = document.getElementById('ai-chat-window');
    const sendBtn = document.getElementById('ai-chat-send');
    const input = document.getElementById('ai-chat-input');

    toggle && toggle.addEventListener('click', () => {
      toggle.style.display = 'none';
      windowEl.style.display = 'flex';
      document.getElementById('ai-chat-messages').scrollTop = 99999;
    });

    closeBtn && closeBtn.addEventListener('click', () => {
      windowEl.style.display = 'none';
      toggle.style.display = 'inline-block';
    });

    sendBtn && sendBtn.addEventListener('click', sendMessage);
    input && input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function appendMessage(who, text) {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'ai-chat-msg ' + (who === 'user' ? 'ai-chat-user' : 'ai-chat-bot');
    el.innerHTML = `<div class="ai-chat-bubble">${escapeHtml(text)}</div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    saveToSession({ who, text, ts: Date.now() });
  }

  function escapeHtml(s) {
    return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
  }

  function showTyping() {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'ai-chat-msg ai-chat-bot ai-typing';
    el.id = 'ai-typing';
    el.innerHTML = '<div class="ai-chat-bubble">Typing…</div>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById('ai-typing');
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }

  async function sendMessage() {
    const input = document.getElementById('ai-chat-input');
    const text = (input && input.value || '').trim();
    if (!text) return;
    appendMessage('user', text);
    input.value = '';
    if (!API_URL) {
      appendMessage('bot', '⚠️ Backend API not configured. Please set the API URL in the WP admin settings.');
      return;
    }

    try {
      showTyping();
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text })
      });

      hideTyping();

      if (!resp.ok) {
        appendMessage('bot', '⚠️ Error from server: ' + resp.status + ' — check browser console.');
        console.error('AI chat error:', await resp.text());
        return;
      }

      const data = await resp.json();
      const answer = data.answer || data?.message || 'No answer returned.';
      appendMessage('bot', answer);

    } catch (err) {
      hideTyping();
      appendMessage('bot', '⚠️ Network error, see console.');
      console.error(err);
    }
  }

  // Simple local session storage
  function saveToSession(msg) {
    try {
      const key = 'ai_chat_session_v1';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push(msg);
      if (arr.length > 100) arr.shift();
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) { /* ignore */ }
  }
  function loadSession() {
    try {
      const key = 'ai_chat_session_v1';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      const container = document.getElementById('ai-chat-messages');
      if (!container) return;
      container.innerHTML = '';
      arr.forEach(m => {
        const el = document.createElement('div');
        el.className = 'ai-chat-msg ' + (m.who === 'user' ? 'ai-chat-user' : 'ai-chat-bot');
        el.innerHTML = `<div class="ai-chat-bubble">${escapeHtml(m.text)}</div>`;
        container.appendChild(el);
      });
      container.scrollTop = container.scrollHeight;
    } catch (e) { /* ignore */ }
  }

  // init
  document.addEventListener('DOMContentLoaded', createWidget);
})();
