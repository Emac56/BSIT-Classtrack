async function renderAttendance() {
  const c = document.getElementById('page-attendance');
  const user = getUser();
  if (!user || !user.section_id) { c.innerHTML = noSectionHTML(); return; }
  c.innerHTML = loadingHTML();
  try {
    const res = await api.getSessions(user.section_id);
    window._sessions = res.data;
    renderSessionList(window._sessions);
  } catch(e) { c.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`; }
}

function renderSessionList(sessions) {
  const c = document.getElementById('page-attendance');
  const user = getUser();
  const canEdit = ['president','vice_president','secretary','officer'].includes(user.role);
  const rows = sessions.map(s => {
    const total = parseInt(s.total_records||0);
    const present = parseInt(s.present_count||0);
    const absent = parseInt(s.absent_count||0);
    const late = parseInt(s.late_count||0);
    const pct = total > 0 ? Math.round((present/total)*100) : 0;
    return `<tr>
      <td><strong>${fmtDate(s.date)}</strong></td>
      <td>${esc(s.subject||'—')}</td>
      <td><span class="badge badge-present">${present}</span></td>
      <td><span class="badge badge-absent">${absent}</span></td>
      <td><span class="badge badge-late">${late}</span></td>
      <td>
        <div class="progress-wrap" style="width:80px;display:inline-block">
          <div class="progress-bar ${pct>=80?'green':pct>=60?'primary':'amber'}" style="width:${pct}%"></div>
        </div>
        <span class="text-sm text-muted" style="margin-left:6px">${pct}%</span>
      </td>
      <td>
        ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openSessionEditor(${s.id})">✏️ Edit</button>` : `<button class="btn btn-outline btn-sm" onclick="openSessionEditor(${s.id})">👁️ View</button>`}
        <button class="btn btn-ghost btn-sm" onclick="exportSessionPDF(${s.id})">📄</button>
        ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="deleteSession(${s.id})">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');
  c.innerHTML = `
    <div class="card animate" style="margin-bottom:16px">
      <div class="card-header">
        <h2>📋 Attendance Sessions <span class="text-muted text-sm">(${sessions.length})</span></h2>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm" onclick="openAttSummary()">📊 Summary</button>
          <button class="btn btn-outline btn-sm" onclick="exportAllAttPDF()">📄 Export PDF</button>
          ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openNewSession()">+ New Session</button>` : ''}
        </div>
      </div>
      ${sessions.length === 0
        ? '<div class="empty-state"><span class="empty-icon">📋</span><h3>No sessions yet</h3><p>Create a new attendance session to get started.</p></div>'
        : `<div class="tbl-wrap"><table>
          <thead><tr><th>Date</th><th>Subject</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`}
    </div>`;
}

function openNewSession() {
  openModal('+ New Attendance Session', `
    <form onsubmit="submitNewSession(event)">
      <div class="form-grid">
        <div class="form-group"><label>Date *</label><input name="date" type="date" value="${todayISO()}" required></div>
        <div class="form-group"><label>Subject / Period</label><input name="subject" placeholder="e.g. Advisory, Math"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" placeholder="Optional notes..."></textarea></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create & Take Attendance</button>
      </div>
    </form>`);
}

async function submitNewSession(e) {
  e.preventDefault();
  const f = e.target, user = getUser();
  try {
    const res = await api.createSession({ section_id: user.section_id, date: f.date.value, subject: f.subject.value, notes: f.notes.value, _user: { id: user.id, name: user.full_name } });
    closeModal();
    renderAttendance();
    setTimeout(() => openSessionEditor(res.data.id), 200);
  } catch(e) { toast(e.message, 'error'); }
}

async function openSessionEditor(sessionId) {
  openModal('📋 Attendance', loadingHTML(), 700);
  try {
    const res = await api.getSessionRecords(sessionId);
    const session = res.session;
    const students = res.data;
    window._attState = {};
    students.forEach(s => { window._attState[s.id] = s.status || 'present'; });
    window._attStudents = students;
    window._attSessionId = sessionId;
    renderAttEditor(session, students);
  } catch(e) { const m = document.querySelector('#activeModal .modal-body'); if(m) m.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`; }
}

function renderAttEditor(session, students) {
  const m = document.querySelector('#activeModal .modal-body');
  if (!m) return;
  const att = window._attState;
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  students.forEach(s => { counts[att[s.id] || 'present']++; });
  const user = getUser();
  const canEdit = ['president','vice_president','secretary','officer'].includes(user.role);

  const rows = students.map(s => {
    const status = att[s.id] || 'present';
    return `<div class="att-student-row ${status}" id="arow-${s.id}">
      <div class="stu-avatar">${(s.last_name||'?').charAt(0)}</div>
      <div style="flex:1;min-width:0">
        <div class="att-name">${esc(s.last_name)}, ${esc(s.first_name)}</div>
        <div class="att-id">${esc(s.student_number||'')}</div>
      </div>
      ${canEdit ? `<div class="att-btn-group">
        <button class="att-btn ${status==='present'?'active-present':''}" onclick="setAtt(${s.id},'present')">Present</button>
        <button class="att-btn ${status==='absent'?'active-absent':''}" onclick="setAtt(${s.id},'absent')">Absent</button>
        <button class="att-btn ${status==='late'?'active-late':''}" onclick="setAtt(${s.id},'late')">Late</button>
        <button class="att-btn ${status==='excused'?'active-excused':''}" onclick="setAtt(${s.id},'excused')">Excused</button>
      </div>` : `<span class="badge badge-${status}">${status}</span>`}
    </div>`;
  }).join('');

  m.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <strong>${fmtDate(session.date)}</strong>${session.subject?' — '+esc(session.subject):''}
        <div class="text-sm text-muted" style="margin-top:2px">
          <span style="color:var(--green)">✅ ${counts.present} Present</span> ·
          <span style="color:var(--red)">❌ ${counts.absent} Absent</span> ·
          <span style="color:var(--amber)">🕐 ${counts.late} Late</span> ·
          <span style="color:var(--primary)">📝 ${counts.excused} Excused</span>
        </div>
      </div>
      ${canEdit ? `<div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="markAllAtt('present')">All Present</button>
        <button class="btn btn-outline btn-sm" onclick="markAllAtt('absent')">All Absent</button>
        <button class="btn btn-primary btn-sm" onclick="saveAttendance()">💾 Save</button>
      </div>` : ''}
    </div>
    <div id="attEditorList" style="max-height:400px;overflow-y:auto">${rows}</div>`;
}

function setAtt(studentId, status) {
  window._attState[studentId] = status;
  const row = document.getElementById('arow-' + studentId);
  if (!row) return;
  row.className = `att-student-row ${status}`;
  const btns = row.querySelectorAll('.att-btn');
  btns.forEach(btn => {
    ['present','absent','late','excused'].forEach(s => btn.classList.toggle('active-'+s, status===s && btn.textContent.toLowerCase()===s));
  });
  updateAttCounts();
}

function markAllAtt(status) {
  const students = window._attStudents || [];
  students.forEach(s => setAtt(s.id, status));
}

function updateAttCounts() {
  const att = window._attState, students = window._attStudents || [];
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  students.forEach(s => counts[att[s.id]||'present']++);
  // Update header counts if visible
  const m = document.querySelector('#activeModal .modal-body');
  if (m) {
    const p = m.querySelector('.text-muted');
    if (p) p.innerHTML = `<span style="color:var(--green)">✅ ${counts.present} Present</span> · <span style="color:var(--red)">❌ ${counts.absent} Absent</span> · <span style="color:var(--amber)">🕐 ${counts.late} Late</span> · <span style="color:var(--primary)">📝 ${counts.excused} Excused</span>`;
  }
}

async function saveAttendance() {
  const user = getUser();
  const students = window._attStudents || [];
  const records = students.map(s => ({ student_id: s.id, status: window._attState[s.id] || 'present' }));
  try {
    await api.saveAttendance(window._attSessionId, records, user, user.section_id);
    toast('Attendance saved!');
    closeModal();
    renderAttendance();
    if (window._currentPage === 'dashboard') renderDashboard();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteSession(id) {
  confirmAction('Delete this attendance session and all its records?', async function() {
    try { await api.deleteSession(id); toast('Session deleted'); renderAttendance(); } catch(e) { toast(e.message, 'error'); }
  });
}

async function openAttSummary() {
  openModal('📊 Attendance Summary', loadingHTML(), 700);
  try {
    const res = await api.getAttSummary(window.currentSectionId);
    const data = res.data;
    const rows = data.map(s => {
      const total = parseInt(s.total_days||0);
      const present = parseInt(s.present||0);
      const absent = parseInt(s.absent||0);
      const late = parseInt(s.late||0);
      const pct = total > 0 ? Math.round((present/total)*100) : 0;
      const atRisk = absent >= 3;
      return `<tr class="${atRisk?'at-risk':''}">
        <td><strong>${esc(s.last_name)}, ${esc(s.first_name)}</strong></td>
        <td class="text-muted">${esc(s.student_number||'')}</td>
        <td>${total}</td>
        <td><span class="badge badge-present">${present}</span></td>
        <td><span class="badge badge-absent">${absent}</span></td>
        <td><span class="badge badge-late">${late}</span></td>
        <td>
          <div class="progress-wrap" style="width:80px;display:inline-block">
            <div class="progress-bar ${pct>=80?'green':pct>=60?'primary':'amber'}" style="width:${pct}%"></div>
          </div> ${pct}%
        </td>
      </tr>`;
    }).join('');
    const m = document.querySelector('#activeModal .modal-body');
    if (!m) return;
    m.innerHTML = `
      <p class="text-sm text-muted" style="margin-bottom:10px">🔴 Highlighted rows = 3+ absences (at risk)</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Name</th><th>ID</th><th>Total Days</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  } catch(e) { const m = document.querySelector('#activeModal .modal-body'); if(m) m.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`; }
}

async function exportSessionPDF(sessionId) {
  try {
    const res = await api.getSessionRecords(sessionId);
    const { session, data } = res;
    exportPDF(
      `Attendance — ${fmtDate(session.date)}${session.subject?' ('+session.subject+')':''}`,
      ['Name','Student ID','Status','Notes'],
      data.map(s => [`${s.last_name}, ${s.first_name}`, s.student_number||'', s.status||'', s.notes||'']),
      `attendance-${session.date}.pdf`
    );
  } catch(e) { toast(e.message, 'error'); }
}

async function exportAllAttPDF() {
  const sessions = window._sessions || [];
  if (!sessions.length) { toast('No sessions to export', 'warning'); return; }
  exportPDF(
    `Attendance Sessions — ${window.currentSectionName||''}`,
    ['Date','Subject','Present','Absent','Late','Total'],
    sessions.map(s => [fmtDate(s.date), s.subject||'—', s.present_count||0, s.absent_count||0, s.late_count||0, s.total_records||0]),
    'attendance-sessions.pdf'
  );
}
