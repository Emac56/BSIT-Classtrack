// ============ CHAT.JS — Real-time Section Chat ============

let _chatSocket = null;
let _chatSectionId = null;
let _chatUser = null;
let _typingTimeout = null;
let _typingTimer = null;
let _chatUnread = 0;

function playChatSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.connect(g1); g1.connect(ctx.destination);
    o1.frequency.value = 880;
    o1.type = 'sine';
    g1.gain.setValueAtTime(0, ctx.currentTime);
    g1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    g1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    o1.start(ctx.currentTime);
    o1.stop(ctx.currentTime + 0.15);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.frequency.value = 1100;
    o2.type = 'sine';
    g2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
    g2.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.12);
    g2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.28);
    o2.start(ctx.currentTime + 0.1);
    o2.stop(ctx.currentTime + 0.28);
  } catch(e) {}
}

function showChatBadge() {
  const badge = document.getElementById('chatBadge');
  if (badge) badge.style.display = 'inline-block';
}
function hideChatBadge() {
  _chatUnread = 0;
  const badge = document.getElementById('chatBadge');
  if (badge) badge.style.display = 'none';
}

async function renderChat() {
  const c = document.getElementById('page-chat');
  const user = getUser();
  _chatUser = user;
  hideChatBadge();
  if (!user || !user.section_id) { c.innerHTML = noSectionHTML(); return; }
  _chatSectionId = user.section_id;
  c.innerHTML = `
    <div class="chat-wrap animate">
      <div class="card" style="display:flex;flex-direction:column;height:calc(100vh - 110px);min-height:400px">
        <div class="card-header">
          <div>
            <h2>💬 Section Chat</h2>
            <div class="text-sm text-muted" id="chatOnlineStatus">Connecting...</div>
          </div>
          <div id="typingIndicator" class="text-sm text-muted" style="font-style:italic;min-height:18px"></div>
        </div>
        <div id="chatMessages" style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:8px">
          <div class="loading"><div class="spinner"></div></div>
        </div>
        <div style="border-top:1px solid var(--border);padding:12px 14px">
          <div class="chat-input-row">
            <input type="text" id="chatInput" class="chat-input" placeholder="Type a message..." maxlength="1000"
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatMessage();}"
              oninput="onChatTyping()">
            <button class="btn btn-primary" onclick="sendChatMessage()">Send 📤</button>
          </div>
          <div class="text-sm text-muted" style="margin-top:4px;text-align:right" id="chatCharCount">0/1000</div>
        </div>
      </div>
    </div>`;
  await loadChatHistory();
  connectChatSocket();
}

async function loadChatHistory() {
  const user = getUser();
  try {
    const res = await api.get('/chat/section/' + user.section_id);
    const msgEl = document.getElementById('chatMessages');
    if (!msgEl) return;
    msgEl.innerHTML = '';
    if (!res.data.length) {
      msgEl.innerHTML = '<div class="empty-state"><span class="empty-icon">💬</span><h3>No messages yet</h3><p>Maging una sa mag-message!</p></div>';
      return;
    }
    res.data.forEach(msg => appendChatMessage(msg, false));
    scrollChatToBottom();
  } catch(e) {
    const msgEl = document.getElementById('chatMessages');
    if (msgEl) msgEl.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><h3>${esc(e.message)}</h3></div>`;
  }
}

function connectChatSocket() {
  const token = localStorage.getItem('ct_token');
  if (!token) return;
  if (_chatSocket) { _chatSocket.disconnect(); _chatSocket = null; }
  _chatSocket = io({ auth: { token } });
  _chatSocket.on('connect', () => {
    const el = document.getElementById('chatOnlineStatus');
    if (el) el.innerHTML = '<span style="color:var(--green)">● Online</span>';
  });
  _chatSocket.on('disconnect', () => {
    const el = document.getElementById('chatOnlineStatus');
    if (el) el.innerHTML = '<span style="color:var(--red)">● Disconnected</span>';
  });
  _chatSocket.on('chat:message', (msg) => {
    const user = getUser();
    const isMe = msg.user_id === user.id;
    const isOnChatPage = window._currentPage === 'chat';
    const emptyEl = document.querySelector('#chatMessages .empty-state');
    if (emptyEl) emptyEl.remove();
    if (isOnChatPage) {
      appendChatMessage(msg, true);
      scrollChatToBottom();
    }
    if (!isMe) {
      playChatSound();
      if (!isOnChatPage) {
        _chatUnread++;
        showChatBadge();
      }
    }
  });
  _chatSocket.on('chat:deleted', ({ id }) => {
    const el = document.getElementById('chat-msg-' + id);
    if (el) { el.style.opacity = '0'; el.style.transform = 'scale(.95)'; setTimeout(() => el.remove(), 250); }
  });
  _chatSocket.on('chat:typing', ({ username }) => {
    const el = document.getElementById('typingIndicator');
    if (el) {
      el.textContent = username + ' is typing...';
      clearTimeout(_typingTimer);
      _typingTimer = setTimeout(() => { if (el) el.textContent = ''; }, 2000);
    }
  });
  _chatSocket.on('chat:error', ({ message }) => { toast(message, 'error'); });
}

function appendChatMessage(msg, animate) {
  const user = getUser();
  const isMe = msg.user_id === user.id;
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const time = new Date(msg.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const roleColors = { president:'#f59e0b', vice_president:'#8b5cf6', treasurer:'#10b981', auditor:'#06b6d4', secretary:'#ec4899', officer:'#64748b', admin:'#ef4444' };
  const roleColor = roleColors[msg.user_role] || '#64748b';
  const canDelete = isMe || (user.role === 'admin');
  const div = document.createElement('div');
  div.id = 'chat-msg-' + msg.id;
  div.className = 'chat-msg' + (isMe ? ' chat-msg-me' : '') + (animate ? ' animate' : '');
  div.innerHTML = `
    <div class="chat-bubble${isMe ? ' chat-bubble-me' : ''}">
      ${!isMe ? `<div class="chat-sender" style="color:${roleColor}">${esc(msg.user_name)} <span style="font-size:.65rem;opacity:.7">${roleLabel(msg.user_role)}</span></div>` : ''}
      <div class="chat-text">${esc(msg.message)}</div>
      <div class="chat-meta">
        <span>${time}</span>
        ${canDelete ? `<button class="chat-del-btn" onclick="deleteChatMessage(${msg.id})" title="Delete">🗑</button>` : ''}
      </div>
    </div>`;
  el.appendChild(div);
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  if (!_chatSocket || !_chatSocket.connected) { toast('Not connected. Reconnecting...', 'warning'); connectChatSocket(); return; }
  _chatSocket.emit('chat:send', { message: msg });
  input.value = '';
  document.getElementById('chatCharCount').textContent = '0/1000';
}

function deleteChatMessage(id) {
  if (!_chatSocket) return;
  _chatSocket.emit('chat:delete', { id });
}

function onChatTyping() {
  const input = document.getElementById('chatInput');
  const counter = document.getElementById('chatCharCount');
  if (counter && input) counter.textContent = input.value.length + '/1000';
  if (_chatSocket && _chatSocket.connected) {
    clearTimeout(_typingTimeout);
    _chatSocket.emit('chat:typing');
    _typingTimeout = setTimeout(() => {}, 1000);
  }
}

function scrollChatToBottom() {
  const el = document.getElementById('chatMessages');
  if (el) el.scrollTop = el.scrollHeight;
}

function cleanupChat() {
  if (_chatSocket) { _chatSocket.disconnect(); _chatSocket = null; }
}
