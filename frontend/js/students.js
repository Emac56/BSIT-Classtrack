async function renderStudents() {
  const c = document.getElementById('page-students');
  const user = getUser();
  if (!user || !user.section_id) { c.innerHTML = noSectionHTML(); return; }
  c.innerHTML = loadingHTML();
  try {
    const res = await api.getStudents(user.section_id);
    window._students = res.data;
    renderStudentList(window._students);
  } catch(e) { c.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`; }
}

function renderStudentList(students) {
  const c = document.getElementById('page-students');
  const user = getUser();
  const canEdit = canAccess('students') && ['president','vice_president','secretary'].includes(user.role);
  c.innerHTML = `
    <div class="card animate">
      <div class="card-header">
        <h2>👥 Students <span class="text-muted text-sm">(${students.length})</span></h2>
        <div class="btn-group">
          ${canEdit ? `<button class="btn btn-outline btn-sm" onclick="openImport()">📥 Import Excel</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="exportStudentsXLSX()">📊 Excel</button>
          <button class="btn btn-outline btn-sm" onclick="exportStudentsPDF()">📄 PDF</button>
          ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openStudentForm()">+ Add Student</button>` : ''}
        </div>
      </div>
      <div class="card-body" style="padding-bottom:0">
        <div class="toolbar">
          <div class="search-box"><span class="search-icon">🔍</span><input type="text" id="stuSearch" placeholder="Search name or ID..." oninput="filterStudents(this.value)"></div>
          <select class="filter-sel" id="genderFilter" onchange="filterStudents(document.getElementById('stuSearch').value)">
            <option value="">All Genders</option><option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
      </div>
      <div id="stuTableWrap">${buildStudentTable(students)}</div>
    </div>`;
}

function buildStudentTable(students) {
  if (!students.length) return '<div class="empty-state"><span class="empty-icon">👥</span><h3>No students yet</h3><p>Add your first student or import from Excel.</p></div>';
  // Store students in a lookup map so onclick can find them by ID safely (fixes > arrow function HTML bug)
  window._studentsById = {};
  (window._students || students).forEach(s => { window._studentsById[s.id] = s; });
  const user = getUser();
  const canEdit = ['president','vice_president','secretary'].includes(user.role);
  const rows = students.map((s,i) => `<tr>
    <td class="text-muted text-sm">${i+1}</td>
    <td><code>${esc(s.student_id)}</code></td>
    <td>
      <div style="display:flex;align-items:center;gap:9px">
        <div class="stu-avatar">${(s.last_name||'?').charAt(0)}</div>
        <div>
          <strong>${esc(s.last_name)}, ${esc(s.first_name)}</strong>${s.middle_name?' <span class="text-sm text-muted">'+esc(s.middle_name)+'</span>':''}
          ${s.is_shifty ? '<span class="badge badge-neutral" style="margin-left:4px">Shiftee</span>' : ''}
        </div>
      </div>
    </td>
    <td>${s.gender ? `<span class="badge badge-neutral">${esc(s.gender)}</span>` : '—'}</td>
    <td class="text-sm">${esc(s.contact_number)||'—'}</td>
    <td>
      <div class="action-btns">
        <button class="btn btn-action-view" onclick="openStudentProfile(${s.id})" title="View Profile">👁️ View</button>
        ${canEdit ? `<button class="btn btn-action-edit" onclick="openStudentFormById(${s.id})" title="Edit">✏️ Edit</button>
        <button class="btn btn-action-delete" onclick="deleteStudent(${s.id},'${esc(s.first_name)} ${esc(s.last_name)}')" title="Delete">🗑️</button>` : ''}
      </div>
    </td>
  </tr>`).join('');
  return `<div class="tbl-wrap"><table>
    <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Gender</th><th>Contact</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// Fixed: use ID lookup instead of arrow function in HTML attribute (arrow > breaks HTML parsing)
function openStudentFormById(id) {
  const s = (window._studentsById && window._studentsById[id]) || (window._students || []).find(function(x){ return x.id === id; });
  openStudentForm(s);
}

function filterStudents(q) {
  const gender = document.getElementById('genderFilter').value;
  q = (q||'').toLowerCase();
  const filtered = (window._students||[]).filter(s => {
    const mq = !q || (s.first_name+' '+s.last_name+' '+s.student_id).toLowerCase().includes(q);
    const mg = !gender || s.gender === gender;
    return mq && mg;
  });
  const w = document.getElementById('stuTableWrap');
  if (w) w.innerHTML = buildStudentTable(filtered);
}

function openStudentForm(s) {
  s = s || {};
  const isEdit = !!s.id;
  openModal((isEdit?'✏️ Edit':'+ Add') + ' Student', `
    <form onsubmit="submitStudent(event,${isEdit?s.id:'null'})">
      <div class="form-grid">
        <div class="form-group"><label>Student ID *</label><input name="student_id" value="${esc(s.student_id||'')}" required placeholder="e.g. 2024-001" ${isEdit?'readonly':''}></div>
        <div class="form-group"><label>Gender</label>
          <select name="gender"><option value="">Select...</option>
            <option ${s.gender==='Male'?'selected':''}>Male</option>
            <option ${s.gender==='Female'?'selected':''}>Female</option>
            <option ${s.gender==='Other'?'selected':''}>Other</option>
          </select>
        </div>
        <div class="form-group"><label>First Name *</label><input name="first_name" value="${esc(s.first_name||'')}" required placeholder="First name"></div>
        <div class="form-group"><label>Last Name *</label><input name="last_name" value="${esc(s.last_name||'')}" required placeholder="Last name"></div>
        <div class="form-group"><label>Middle Name</label><input name="middle_name" value="${esc(s.middle_name||'')}" placeholder="Middle name"></div>
        <div class="form-group"><label>Contact Number</label><input name="contact_number" value="${esc(s.contact_number||'')}" placeholder="09XXXXXXXXX"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Email</label><input name="email" type="email" value="${esc(s.email||'')}" placeholder="email@example.com"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Address</label><textarea name="address" placeholder="Student address">${esc(s.address||'')}</textarea></div>
        <div class="form-group" style="grid-column:1/-1">
          <div class="toggle-row" style="padding:10px 14px;background:var(--surface2);border-radius:9px">
            <div><label style="font-weight:600">🔄 Shiftee</label><div class="text-sm text-muted">Student transferring from another course</div></div>
            <label class="toggle"><input type="checkbox" name="is_shifty" ${s.is_shifty?'checked':''}><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit?'Update':'Add'} Student</button>
      </div>
    </form>`);
}

async function submitStudent(e, id) {
  e.preventDefault();
  const f = e.target, user = getUser();
  const data = {
    section_id: user.section_id,
    student_id: f.student_id.value,
    first_name: f.first_name.value,
    last_name: f.last_name.value,
    middle_name: f.middle_name.value,
    gender: f.gender.value,
    contact_number: f.contact_number.value,
    email: f.email.value,
    address: f.address.value,
    is_shifty: f.is_shifty.checked,
    _user: { id: user.id, name: user.full_name }
  };
  try {
    if (id) await api.updateStudent(id, data);
    else await api.createStudent(data);
    toast(id ? 'Student updated!' : 'Student added!');
    closeModal(); renderStudents();
  } catch(err) { toast(err.message, 'error'); }
}

async function deleteStudent(id, name) {
  confirmAction(`Delete <strong>${esc(name)}</strong>? This removes all attendance and payment records.`, async function() {
    try { await api.deleteStudent(id); toast('Student deleted'); renderStudents(); } catch(e) { toast(e.message, 'error'); }
  });
}

// STUDENT PROFILE
async function openStudentProfile(id) {
  openModal('👤 Student Profile', loadingHTML(), 660);
  try {
    const res = await api.getStudentProfile(id);
    const { student: s, attendance, payments, notes } = res.data;
    const user = getUser();
    const attRows = attendance.map(a => `<tr>
      <td>${fmtDate(a.date)}</td>
      <td>${esc(a.subject||'—')}</td>
      <td><span class="badge badge-${a.status}">${a.status}</span></td>
      <td class="text-sm text-muted">${esc(a.notes||'')}</td>
    </tr>`).join('');
    const payRows = payments.map(p => `<tr>
      <td>${fmtDate(p.payment_date)}</td>
      <td>${esc(p.fee_name)}</td>
      <td><strong>${peso(p.amount_paid)}</strong></td>
      <td class="text-sm text-muted">${esc(p.notes||'')}</td>
    </tr>`).join('');
    const notesList = notes.map(n => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <span class="badge badge-neutral" style="margin-right:6px">${esc(n.note_type)}</span>
          <span class="text-sm">${esc(n.note)}</span>
          <div class="text-sm text-muted" style="margin-top:2px">${fmtTime(n.created_at)}</div>
        </div>
        <button class="btn btn-ghost btn-xs" onclick="deleteStudentNote(${s.id},${n.id})">🗑️</button>
      </div>`).join('');
    const modal = document.querySelector('#activeModal .modal-body');
    if (!modal) return;
    modal.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)">
        <div class="stu-avatar" style="width:52px;height:52px;font-size:1.2rem">${(s.last_name||'?').charAt(0)}</div>
        <div>
          <div style="font-size:1.05rem;font-weight:800">${esc(s.last_name)}, ${esc(s.first_name)} ${esc(s.middle_name||'')}</div>
          <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
            <code>${esc(s.student_id)}</code>
            ${s.gender ? `<span class="badge badge-neutral">${esc(s.gender)}</span>` : ''}
            ${s.is_shifty ? '<span class="badge badge-neutral">Shiftee</span>' : ''}
          </div>
          <div class="text-sm text-muted">${esc(s.contact_number||'')} ${s.email?'· '+esc(s.email):''}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid var(--border)">
        <button class="btn btn-sm" id="spt-att" onclick="showSPTab('att')" style="border-radius:0;border-bottom:2px solid var(--primary);color:var(--primary)">Attendance (${attendance.length})</button>
        <button class="btn btn-ghost btn-sm" id="spt-pay" onclick="showSPTab('pay')">Payments (${payments.length})</button>
        <button class="btn btn-ghost btn-sm" id="spt-notes" onclick="showSPTab('notes')">Notes (${notes.length})</button>
      </div>

      <div id="sp-att">
        ${attendance.length ? `<div class="tbl-wrap"><table>
          <thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>${attRows}</tbody>
        </table></div>` : '<div class="empty-state" style="padding:16px"><span class="empty-icon">📋</span><p>No attendance records</p></div>'}
      </div>
      <div id="sp-pay" style="display:none">
        ${payments.length ? `<div class="tbl-wrap"><table>
          <thead><tr><th>Date</th><th>Fee</th><th>Amount</th><th>Notes</th></tr></thead>
          <tbody>${payRows}</tbody>
        </table></div>` : '<div class="empty-state" style="padding:16px"><span class="empty-icon">💰</span><p>No payment records</p></div>'}
      </div>
      <div id="sp-notes" style="display:none">
        <div style="margin-bottom:12px">
          <form onsubmit="addStudentNote(event,${s.id})" style="display:flex;gap:8px;flex-wrap:wrap">
            <select id="noteType" style="padding:7px;border-radius:8px;border:1.5px solid var(--border);font-family:inherit;font-size:.8rem;background:var(--surface);color:var(--text)">
              <option value="general">General</option>
              <option value="excuse">Excuse</option>
              <option value="promise_to_pay">Promise to Pay</option>
              <option value="behavior">Behavior</option>
            </select>
            <input id="noteText" placeholder="Add a note..." style="flex:1;padding:7px 10px;border-radius:8px;border:1.5px solid var(--border);font-family:inherit;font-size:.83rem;background:var(--surface);color:var(--text);outline:none" required>
            <button type="submit" class="btn btn-primary btn-sm">Add</button>
          </form>
        </div>
        ${notesList || '<div class="text-sm text-muted">No notes yet</div>'}
      </div>`;
  } catch(e) {
    const modal = document.querySelector('#activeModal .modal-body');
    if (modal) modal.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`;
  }
}

function showSPTab(tab) {
  ['att','pay','notes'].forEach(t => {
    document.getElementById('sp-'+t).style.display = t===tab ? '' : 'none';
    const btn = document.getElementById('spt-'+t);
    if (btn) { btn.className = t===tab ? 'btn btn-sm' : 'btn btn-ghost btn-sm'; btn.style.borderBottom = t===tab ? '2px solid var(--primary)' : 'none'; btn.style.color = t===tab ? 'var(--primary)' : ''; btn.style.borderRadius = '0'; }
  });
}

async function addStudentNote(e, studentId) {
  e.preventDefault();
  const note = document.getElementById('noteText').value;
  const note_type = document.getElementById('noteType').value;
  const user = getUser();
  try {
    await api.addNote(studentId, { note, note_type, created_by: user.id });
    toast('Note added!');
    openStudentProfile(studentId);
  } catch(err) { toast(err.message, 'error'); }
}

async function deleteStudentNote(studentId, noteId) {
  try { await api.deleteNote(studentId, noteId); toast('Note deleted'); openStudentProfile(studentId); }
  catch(e) { toast(e.message, 'error'); }
}

// EXCEL IMPORT
function openImport() {
  const user = getUser();
  openModal('📥 Import Students from Excel', `
    <p class="text-sm text-muted" style="margin-bottom:14px">
      Required columns: <code>Student ID</code>, <code>First Name</code>, <code>Last Name</code> or <code>Full Name</code>, <code>Gender</code><br>
      Optional: <code>Contact Number</code>, <code>Notes</code>
    </p>
    <div style="margin-bottom:14px">
      <button class="btn btn-outline btn-sm" onclick="downloadTemplate()">⬇️ Download Template</button>
    </div>
    <div class="form-group" style="margin-bottom:14px">
      <label>Select Excel / CSV File</label>
      <input type="file" id="importFile" accept=".xlsx,.xls,.csv" onchange="previewImport(this)">
    </div>
    <div id="importPreview"></div>
    <div class="form-actions" id="importActions" style="display:none">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doImport()">✅ Import Students</button>
    </div>`);
}

function downloadTemplate() {
  exportExcel('Students', ['Student ID','First Name','Last Name','Gender','Contact Number'], [['2024-001','Juan','Dela Cruz','Male','09123456789']], 'students-template.xlsx');
}

function previewImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data;
      if (file.name.endsWith('.csv')) {
        const text = e.target.result;
        const lines = text.split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
        const headers = lines[0].map(h => h.toLowerCase().trim());
        data = lines.slice(1).filter(r => r.some(c => c)).map(row => {
          const obj = {};
          headers.forEach((h,i) => obj[h] = row[i]||'');
          return obj;
        });
      } else {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        data = data.map(r => { const o={}; Object.keys(r).forEach(k => o[k.toLowerCase().trim()] = String(r[k]||'').trim()); return o; });
      }
      window._importData = processImportData(data);
      renderImportPreview(window._importData);
    } catch(err) { toast('Error reading file: ' + err.message, 'error'); }
  };
  if (file.name.endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function processImportData(rawRows) {
  return rawRows.map(r => {
    const sid = r['student id'] || r['studentid'] || r['id'] || r['student_id'] || '';
    const fn = r['first name'] || r['firstname'] || r['first_name'] || '';
    const ln = r['last name'] || r['lastname'] || r['last_name'] || '';
    const fullName = r['full name'] || r['fullname'] || r['full_name'] || r['name'] || '';
    let first_name = fn, last_name = ln;
    if (!first_name && fullName) {
      const parts = fullName.split(' ');
      first_name = parts[0];
      last_name = parts.slice(1).join(' ') || parts[0];
    }
    const gender = r['gender'] || r['sex'] || '';
    const contact = r['contact number'] || r['contact'] || r['phone'] || r['contact_number'] || '';
    const valid = !!sid && !!first_name && !!last_name;
    return { student_id: sid, first_name, last_name, gender, contact_number: contact, _valid: valid, _raw: JSON.stringify(r) };
  });
}

function renderImportPreview(data) {
  const validCount = data.filter(r => r._valid).length;
  const invalidCount = data.length - validCount;
  const rows = data.slice(0, 30).map(r => `<tr class="${r._valid?'import-row-ok':'import-row-err'}">
    <td>${r._valid ? '✅' : '❌'}</td>
    <td><code>${esc(r.student_id||'—')}</code></td>
    <td>${esc(r.last_name)}, ${esc(r.first_name)}</td>
    <td>${esc(r.gender||'—')}</td>
    <td class="text-sm">${esc(r.contact_number||'—')}</td>
  </tr>`).join('');
  document.getElementById('importPreview').innerHTML = `
    <div style="margin-bottom:10px;font-size:.82rem">
      Found <strong>${data.length}</strong> rows — <span style="color:var(--green)">${validCount} valid</span>, <span style="color:var(--red)">${invalidCount} will be skipped</span>
    </div>
    <div class="import-preview">
      <table style="width:100%;font-size:.78rem;border-collapse:collapse">
        <thead><tr><th style="padding:6px;background:var(--surface2)">✓</th><th style="padding:6px;background:var(--surface2)">ID</th><th style="padding:6px;background:var(--surface2)">Name</th><th style="padding:6px;background:var(--surface2)">Gender</th><th style="padding:6px;background:var(--surface2)">Contact</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  document.getElementById('importActions').style.display = validCount > 0 ? 'flex' : 'none';
}

async function doImport() {
  const data = window._importData || [];
  const valid = data.filter(r => r._valid);
  if (!valid.length) { toast('No valid rows to import', 'error'); return; }
  const user = getUser();
  try {
    const res = await api.bulkImport({ section_id: user.section_id, students: valid, _user: { id: user.id, name: user.full_name } });
    toast(`Imported ${res.imported} students${res.skipped?' ('+res.skipped+' skipped)':''}!`);
    if (res.errors && res.errors.length) console.warn('Import errors:', res.errors);
    closeModal(); renderStudents();
  } catch(e) { toast(e.message, 'error'); }
}

// EXPORT
function exportStudentsPDF() {
  const students = window._students || [];
  exportPDF('Student List — ' + (window.currentSectionName||''), ['#','Student ID','Last Name','First Name','Gender','Contact'],
    students.map((s,i) => [i+1, s.student_id, s.last_name, s.first_name, s.gender||'', s.contact_number||'']),
    'students.pdf');
}

function exportStudentsXLSX() {
  const students = window._students || [];
  exportExcel('Students', ['Student ID','Last Name','First Name','Middle Name','Gender','Contact','Email','Is Shiftee'],
    students.map(s => [s.student_id, s.last_name, s.first_name, s.middle_name||'', s.gender||'', s.contact_number||'', s.email||'', s.is_shifty?'Yes':'']),
    'students.xlsx');
}
