// ============ APP.JS — MAIN CONTROLLER ============

function getUser() { try { return JSON.parse(localStorage.getItem('ct_user')); } catch(e) { return null; } }
function doLogout() { localStorage.removeItem('ct_user'); localStorage.removeItem('ct_token'); window.location.href = '/login.html'; }

const PERMS = {
  president:      ['dashboard','students','attendance','fees','fee-types','announcements','members','profile','game','chat'],
  vice_president: ['dashboard','students','attendance','fees','fee-types','announcements','members','profile','game','chat'],
  treasurer:      ['dashboard','fees','fee-types','profile','game','chat'],
  auditor:        ['dashboard','fees','profile','game','chat'],
  secretary:      ['dashboard','attendance','students','announcements','profile','game','chat'],
  officer:        ['dashboard','attendance','profile','game','chat'],
};

const PAGE_TITLES = {
  dashboard:'Dashboard', students:'Students', attendance:'Attendance',
  fees:'Fees & Payments', 'fee-types':'Fee Types', announcements:'Announcements',
  members:'Officers', profile:'Profile & Settings', game:'🎮 Mini Games', chat:'💬 Section Chat'
};

function canAccess(page) {
  const user = getUser();
  if (!user) return false;
  return (PERMS[user.role] || ['dashboard','profile']).includes(page);
}

function navigate(page) {
  if (!canAccess(page)) { toast('Access denied', 'error'); return; }
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || page;
  closeSidebar();
  const renders = { dashboard: renderDashboard, students: renderStudents, attendance: renderAttendance, fees: renderFees, 'fee-types': renderFeeTypes, announcements: renderAnnouncements, members: renderMembers, profile: renderProfile, game: renderGame, chat: renderChat };
  if (window._currentPage === 'chat' && page !== 'chat') cleanupChat();
  if (renders[page]) renders[page]();
  window._currentPage = page;
}

// ===== DARK MODE =====
function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('darkBtn').textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('ct_theme', next);
  const tog = document.getElementById('darkToggle');
  if (tog) tog.checked = !isDark;
}
function loadTheme() {
  const t = localStorage.getItem('ct_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('darkBtn');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
}

// ===== SIDEBAR =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}
function copyCode() {
  const user = getUser();
  if (user && user.section_code) {
    navigator.clipboard.writeText(user.section_code).then(() => toast('Section code copied!'));
  }
}

// ===== NAV BUILD =====
function buildNav() {
  const user = getUser();
  if (!user) return;
  document.getElementById('sbAvatar').textContent = (user.full_name || 'U').charAt(0).toUpperCase();
  document.getElementById('sbUserName').textContent = user.full_name;
  document.getElementById('sbUserRole').textContent = roleLabel(user.role);
  document.getElementById('sbSectionName').textContent = user.section_name || 'No Section';
  document.getElementById('sbSectionYear').textContent = user.school_year || '';
  if (user.section_code) {
    const codeEl = document.getElementById('sbCode');
    codeEl.style.display = 'inline-flex';
    document.getElementById('sbCodeVal').textContent = user.section_code;
  }
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.style.display = canAccess(item.dataset.page) ? '' : 'none';
  });
}

// ===== MEMBERS PAGE =====
async function renderMembers() {
  const c = document.getElementById('page-members');
  c.innerHTML = loadingHTML();
  const user = getUser();
  if (!user || !user.section_id) { c.innerHTML = noSectionHTML(); return; }
  try {
    const res = await api.getMembers(user.section_id);
    const members = res.data;
    const roleColors = { president:'#f59e0b',vice_president:'#8b5cf6',treasurer:'#10b981',auditor:'#06b6d4',secretary:'#ec4899',officer:'#64748b' };
    const rows = members.map(m => {
      const c = roleColors[m.role] || '#64748b';
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div class="sb-avatar" style="background:linear-gradient(135deg,${c},${c}99)">${(m.full_name||'?').charAt(0).toUpperCase()}</div>
          <strong>${esc(m.full_name)}</strong></div></td>
        <td><code>@${esc(m.username)}</code></td>
        <td><span class="badge" style="background:${c}22;color:${c}">${roleLabel(m.role)}</span></td>
        <td class="text-muted text-sm">${fmtDate(m.created_at)}</td>
      </tr>`;
    }).join('');
    c.innerHTML = `<div class="card animate">
      <div class="card-header"><h2>👤 Officers & Members <span class="text-muted text-sm">(${members.length})</span></h2></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Joined</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  } catch(e) { c.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`; }
}

// ===== PROFILE PAGE =====
function renderProfile() {
  const user = getUser();
  const c = document.getElementById('page-profile');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  c.innerHTML = `
    <div style="max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
      <div class="profile-header animate">
        <div class="profile-avatar-xl">${(user.full_name||'U').charAt(0).toUpperCase()}</div>
        <div>
          <div class="profile-name">${esc(user.full_name)}</div>
          <div class="profile-role">${roleLabel(user.role)}</div>
          ${user.section_name ? `<div style="font-size:.76rem;opacity:.8;margin-top:4px">📚 ${esc(user.section_name)}${user.school_year?' — '+esc(user.school_year):''}</div>` : ''}
          ${user.section_adviser ? `<div style="font-size:.76rem;opacity:.8;margin-top:2px">👩‍🏫 ${esc(user.section_adviser)}</div>` : ''}
        </div>
      </div>

      ${user.section_code ? `<div class="card animate animate-delay-1">
        <div class="card-header"><h2>🔑 Section Code</h2></div>
        <div class="card-body">
          <p class="text-sm text-muted" style="margin-bottom:10px">Share this code with other officers to join this section.</p>
          <div style="background:var(--primary-light);border:1.5px solid var(--primary-mid);border-radius:10px;padding:14px;text-align:center;cursor:pointer" onclick="navigator.clipboard.writeText('${esc(user.section_code)}').then(()=>toast('Code copied!'))">
            <div style="font-size:1.5rem;font-weight:800;letter-spacing:.15em;color:var(--primary);font-family:'DM Mono',monospace">${esc(user.section_code)}</div>
            <div style="font-size:.7rem;color:var(--text3);margin-top:4px">Click to copy</div>
          </div>
        </div>
      </div>` : ''}

      <div class="card animate animate-delay-2">
        <div class="card-header"><h2>🎨 Appearance</h2></div>
        <div class="card-body">
          <div class="toggle-row">
            <span>Dark Mode</span>
            <label class="toggle"><input type="checkbox" id="darkToggle" onchange="toggleDark()" ${isDark?'checked':''}><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <div class="card animate animate-delay-3">
        <div class="card-header"><h2>🔐 Change Password</h2></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
          <div class="form-group"><label>Current Password</label>
            <div class="input-pw"><input type="password" id="oldPw" placeholder="Current password"><button onclick="togglePwField('oldPw',this)">👁️</button></div>
          </div>
          <div class="form-group"><label>New Password</label>
            <div class="input-pw"><input type="password" id="newPw" placeholder="Min 6 characters"><button onclick="togglePwField('newPw',this)">👁️</button></div>
          </div>
          <div class="form-group"><label>Confirm New Password</label>
            <div class="input-pw"><input type="password" id="confirmPw" placeholder="Repeat new password"><button onclick="togglePwField('confirmPw',this)">👁️</button></div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" onclick="savePassword()">💾 Save Password</button></div>
        </div>
      </div>
    </div>`;
}

async function savePassword() {
  const old = document.getElementById('oldPw').value;
  const nw = document.getElementById('newPw').value;
  const conf = document.getElementById('confirmPw').value;
  if (!old || !nw) { toast('Fill all fields', 'error'); return; }
  if (nw !== conf) { toast('Passwords do not match', 'error'); return; }
  if (nw.length < 6) { toast('Min 6 characters', 'error'); return; }
  try {
    const user = getUser();
    await api.changePassword({ user_id: user.id, old_password: old, new_password: nw });
    toast('Password changed!');
    ['oldPw','newPw','confirmPw'].forEach(id => document.getElementById(id).value = '');
  } catch(e) { toast(e.message, 'error'); }
}

// ===== FEE TYPES PAGE =====
async function renderFeeTypes() {
  const c = document.getElementById('page-fee-types');
  const user = getUser();
  if (!user || !user.section_id) { c.innerHTML = noSectionHTML(); return; }
  c.innerHTML = loadingHTML();
  try {
    const [ftRes, stRes] = await Promise.all([api.getFeeTypes(user.section_id), api.getStudents(user.section_id)]);
    const feeTypes = ftRes.data, students = stRes.data;
    window._students = students;
    const canEdit = canAccess('fee-types') && ['president','vice_president','treasurer'].includes(user.role);
    // Store fee types by ID so onclick can look them up safely (avoids > arrow function HTML bug)
    window._feeTypesById = {};
    feeTypes.forEach(function(ft){ window._feeTypesById[ft.id] = ft; });
    const rows = feeTypes.map(ft => {
      const asgn = ft.assigned_students && ft.assigned_students.length > 0 ? `${ft.assigned_students.length} specific` : 'All students';
      const overdueCls = isOverdue(ft.due_date) ? 'overdue' : '';
      return `<tr>
        <td><strong>${esc(ft.name)}</strong><br><span class="text-sm text-muted">${esc(ft.description||'')}</span></td>
        <td><strong>${peso(ft.amount)}</strong></td>
        <td>${ft.is_mandatory ? '<span class="badge badge-absent">Mandatory</span>' : '<span class="badge badge-neutral">Optional</span>'}</td>
        <td class="${overdueCls}">${fmtDate(ft.due_date)}</td>
        <td class="text-muted text-sm">${asgn}</td>
        <td>
          <div class="action-btns">
          ${canEdit ? `<button class="btn btn-action-edit" onclick="openFeeTypeFormById(${ft.id})">✏️ Edit</button>
          <button class="btn btn-action-delete" onclick="deleteFeeType(${ft.id},'${esc(ft.name)}')">🗑️</button>` : '—'}
          </div>
        </td>
      </tr>`;
    }).join('');
    c.innerHTML = `<div class="card animate">
      <div class="card-header">
        <h2>🏷️ Fee Types <span class="text-muted text-sm">(${feeTypes.length})</span></h2>
        ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openFeeTypeForm()">+ Add Fee Type</button>` : ''}
      </div>
      ${feeTypes.length === 0 ? '<div class="empty-state"><span class="empty-icon">🏷️</span><h3>No fee types yet</h3><p>Add fee types to start tracking payments.</p></div>'
      : `<div class="tbl-wrap"><table>
        <thead><tr><th>Name</th><th>Amount</th><th>Type</th><th>Due Date</th><th>Assigned To</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`}
    </div>`;
  } catch(e) { c.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`; }
}

// Fixed: use ID lookup instead of serializing whole object into onclick attribute
function openFeeTypeFormById(id) {
  var ft = (window._feeTypesById && window._feeTypesById[id]) || {};
  openFeeTypeForm(ft);
}

function openFeeTypeForm(ft) {
  const isEdit = !!ft.id;
  const studs = window._students || [];
  const assigned = ft.assigned_students || [];
  const studRows = studs.map(s => `<label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:.82rem">
    <input type="checkbox" name="assigned_student" value="${s.id}" ${assigned.includes(s.id)?'checked':''} onchange="updateFeeSelectCount()"> ${esc(s.last_name)}, ${esc(s.first_name)} <code>${esc(s.student_id)}</code>
  </label>`).join('');
  openModal((isEdit ? '✏️ Edit' : '+ Add') + ' Fee Type', `
    <form onsubmit="submitFeeType(event,${isEdit?ft.id:'null'})">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1"><label>Fee Name *</label><input name="name" value="${esc(ft.name||'')}" required placeholder="e.g. Org Fee, T-shirt, Trip"></div>
        <div class="form-group"><label>Amount (₱) *</label><input name="amount" type="number" step="0.01" value="${ft.amount||''}" required placeholder="0.00"></div>
        <div class="form-group"><label>Due Date</label><input name="due_date" type="date" value="${ft.due_date?ft.due_date.split('T')[0]:''}"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Description</label><input name="description" value="${esc(ft.description||'')}" placeholder="Optional notes"></div>
        <div class="form-group" style="grid-column:1/-1">
          <div class="toggle-row" style="padding:10px 14px;background:var(--surface2);border-radius:9px">
            <label>Mandatory Fee</label>
            <label class="toggle"><input type="checkbox" name="is_mandatory" ${ft.is_mandatory!==false?'checked':''}><span class="toggle-slider"></span></label>
          </div>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <label style="margin:0">Assign to specific students <span class="text-muted text-sm">(wala = lahat)</span></label>
            <div style="display:flex;gap:6px">
              <button type="button" class="btn btn-outline btn-xs" onclick="feeSelectAll(true)">✅ Select All</button>
              <button type="button" class="btn btn-outline btn-xs" onclick="feeSelectAll(false)">⬜ Deselect All</button>
              <button type="button" class="btn btn-outline btn-xs" onclick="feeSelectNonShiftees()">🔄 Non-Shiftees Only</button>
            </div>
          </div>
          <div style="max-height:200px;overflow-y:auto;border:1.5px solid var(--border);border-radius:8px;padding:8px" id="feeStudentList">${studRows || '<span class="text-sm text-muted">No students yet</span>'}</div>
          <div class="text-sm text-muted" style="margin-top:4px" id="feeSelectCount">${assigned.length > 0 ? assigned.length + ' selected' : 'All students'}</div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit?'Update':'Create'} Fee Type</button>
      </div>
    </form>`, 600);
}

// ===== FEE TYPE — SELECT HELPERS =====
function feeSelectAll(checked) {
  document.querySelectorAll('input[name="assigned_student"]').forEach(cb => cb.checked = checked);
  updateFeeSelectCount();
}
function feeSelectNonShiftees() {
  const studs = window._students || [];
  document.querySelectorAll('input[name="assigned_student"]').forEach(cb => {
    const s = studs.find(x => x.id === parseInt(cb.value));
    cb.checked = s ? !s.is_shifty : true;
  });
  updateFeeSelectCount();
}
function updateFeeSelectCount() {
  const total = document.querySelectorAll('input[name="assigned_student"]').length;
  const checked = document.querySelectorAll('input[name="assigned_student"]:checked').length;
  const el = document.getElementById('feeSelectCount');
  if (el) el.textContent = checked === 0 ? 'All students' : checked === total ? 'All students selected' : checked + ' of ' + total + ' selected';
}

async function submitFeeType(e, id) {
  e.preventDefault();
  const f = e.target;
  const user = getUser();
  const checked = [...document.querySelectorAll('input[name="assigned_student"]:checked')].map(c => parseInt(c.value));
  const data = {
    section_id: user.section_id,
    name: f.name.value,
    amount: parseFloat(f.amount.value),
    description: f.description.value,
    due_date: f.due_date.value || null,
    is_mandatory: f.is_mandatory.checked,
    assigned_students: checked,
    _user: { id: user.id, name: user.full_name }
  };
  try {
    if (id) await api.updateFeeType(id, data);
    else await api.createFeeType(data);
    toast(id ? 'Fee type updated!' : 'Fee type created!');
    closeModal();
    renderFeeTypes();
    if (window._currentPage === 'fees') renderFees();
  } catch(err) { toast(err.message, 'error'); }
}

async function deleteFeeType(id, name) {
  confirmAction(`Delete fee type <strong>${esc(name)}</strong>? This will remove all payment records for this fee.`, async function() {
    try { await api.deleteFeeType(id); toast('Fee type deleted'); renderFeeTypes(); } catch(e) { toast(e.message, 'error'); }
  });
}

// ===== ANNOUNCEMENTS PAGE =====
async function renderAnnouncements() {
  const c = document.getElementById('page-announcements');
  const user = getUser();
  if (!user || !user.section_id) { c.innerHTML = noSectionHTML(); return; }
  c.innerHTML = loadingHTML();
  try {
    const res = await api.getAnnouncements(user.section_id);
    const anns = res.data;
    const canEdit = ['president','vice_president','secretary'].includes(user.role);
// Store announcements by ID for safe onclick access
window._annsById = {};
anns.forEach(function(a){ window._annsById[a.id] = a; });
    const list = anns.length === 0
      ? '<div class="empty-state"><span class="empty-icon">📢</span><h3>No announcements</h3><p>Post a meeting or deadline reminder.</p></div>'
      : anns.map(a => `
        <div class="ann-card priority-${a.priority||'normal'}">
          <div class="ann-title">${esc(a.title)}</div>
          ${a.content ? `<div class="ann-body">${esc(a.content)}</div>` : ''}
          <div class="ann-meta">
            ${a.due_date ? `<span>📅 Due: ${fmtDate(a.due_date)}</span>` : ''}
            <span style="color:var(--text3)">${fmtTime(a.created_at)}</span>
            <span class="badge badge-${a.priority==='high'?'absent':a.priority==='low'?'neutral':'paid'}">${(a.priority||'normal').toUpperCase()}</span>
          </div>
          ${canEdit ? `<div class="ann-actions">
            <button class="btn btn-action-edit" onclick="openAnnFormById(${a.id})">✏️ Edit</button>
            <button class="btn btn-action-delete" onclick="deleteAnn(${a.id})">🗑️</button>
          </div>` : ''}
        </div>`).join('');
    c.innerHTML = `<div style="max-width:700px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px" class="animate">
        <h2 style="font-size:1rem;font-weight:700">📢 Announcements & Reminders</h2>
        ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openAnnForm()">+ Post Announcement</button>` : ''}
      </div>
      <div class="animate animate-delay-1">${list}</div>
    </div>`;
  } catch(e) { c.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`; }
}

function openAnnFormById(id) {
  var a = (window._annsById && window._annsById[id]) || {};
  openAnnForm(a);
}

function openAnnForm(a) {
  a = a || {};
  const isEdit = !!a.id;
  const user = getUser();
  openModal((isEdit ? '✏️ Edit' : '+ New') + ' Announcement', `
    <form onsubmit="submitAnn(event,${isEdit?a.id:'null'})">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="form-group"><label>Title *</label><input name="title" value="${esc(a.title||'')}" required placeholder="Meeting, Deadline, Event..."></div>
        <div class="form-group"><label>Details</label><textarea name="content" placeholder="More details...">${esc(a.content||'')}</textarea></div>
        <div class="form-grid">
          <div class="form-group"><label>Due Date</label><input name="due_date" type="date" value="${a.due_date?a.due_date.split('T')[0]:''}"></div>
          <div class="form-group"><label>Priority</label>
            <select name="priority">
              <option value="low" ${a.priority==='low'?'selected':''}>Low</option>
              <option value="normal" ${(!a.priority||a.priority==='normal')?'selected':''}>Normal</option>
              <option value="high" ${a.priority==='high'?'selected':''}>High</option>
            </select>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit?'Update':'Post'}</button>
      </div>
    </form>`);
}

async function submitAnn(e, id) {
  e.preventDefault();
  const f = e.target, user = getUser();
  const data = { section_id: user.section_id, title: f.title.value, content: f.content.value, due_date: f.due_date.value||null, priority: f.priority.value, created_by: user.id };
  try {
    if (id) await api.updateAnnouncement(id, data);
    else await api.createAnnouncement(data);
    toast('Announcement saved!'); closeModal(); renderAnnouncements();
  } catch(err) { toast(err.message, 'error'); }
}

async function deleteAnn(id) {
  confirmAction('Delete this announcement?', async function() {
    try { await api.deleteAnnouncement(id); toast('Deleted'); renderAnnouncements(); } catch(e) { toast(e.message, 'error'); }
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  const user = getUser();
  if (!user) { window.location.href = '/login.html'; return; }
  if (user.role === 'admin') { window.location.href = '/admin.html'; return; }
  window.currentSectionId = user.section_id ? parseInt(user.section_id) : null;
  window.currentSectionName = user.section_name;
  loadTheme();
  buildNav();
  navigate('dashboard');
  initGlobalChat();
});

// ===== GLOBAL CHAT SOCKET (para sa badge kahit hindi pa bukas ang chat) =====
function initGlobalChat() {
  const token = localStorage.getItem('ct_token');
  const user = getUser();
  if (!token || !user || !user.section_id) return;
  const sock = io({ auth: { token } });
  sock.on('chat:message', (msg) => {
    if (msg.user_id === user.id) return;
    if (window._currentPage !== 'chat') {
      playChatSound();
      showChatBadge();
    }
  });
  window._globalChatSocket = sock;
}
