async function renderFees() {
  const c = document.getElementById('page-fees');
  const user = getUser();
  if (!user || !user.section_id) { c.innerHTML = noSectionHTML(); return; }
  c.innerHTML = loadingHTML();
  try {
    const [ftRes, fsRes, srRes] = await Promise.all([
      api.getFeeTypes(user.section_id),
      api.getFeeStatus(user.section_id),
      api.getStudents(user.section_id)
    ]);
    window._feeTypes  = ftRes.data;
    window._feeStatus = fsRes.data;
    window._students  = srRes.data;
    const genderMap = {};
    window._students.forEach(s => { genderMap[s.id] = s.gender || ''; });
    window._feeStatus.forEach(r => { r._gender = genderMap[r.student_id] || ''; });
    renderFeeTable(window._feeTypes, window._feeStatus, user);
  } catch(e) {
    c.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>${esc(e.message)}</h3></div>`;
  }
}

function renderFeeTable(feeTypes, feeStatus, user) {
  const c = document.getElementById('page-fees');
  if (!feeTypes.length) {
    c.innerHTML = `<div class="empty-state"><span class="empty-icon">💰</span><h3>No fee types yet</h3><p>Go to Fee Types to add fees first.</p><button class="btn btn-primary" style="margin-top:12px" onclick="navigate('fee-types')">+ Add Fee Type</button></div>`;
    return;
  }
  const today  = new Date().toISOString().split('T')[0];
  const ftOpts = feeTypes.map(ft => `<option value="${ft.id}">${esc(ft.name)}</option>`).join('');
  const summary = {};
  feeTypes.forEach(ft => {
    summary[ft.id] = { name: ft.name, amount: parseFloat(ft.amount), paid: 0, total: 0, collected: 0, mandatory: ft.is_mandatory, due_date: ft.due_date };
  });
  feeStatus.forEach(r => {
    if (!summary[r.fee_type_id]) return;
    summary[r.fee_type_id].total++;
    if (r.status === 'paid') {
      summary[r.fee_type_id].paid++;
      summary[r.fee_type_id].collected += parseFloat(r.amount_paid || 0);
    }
  });
  const canEdit = ['president','vice_president','treasurer'].includes(user.role);
  c.innerHTML = `
    <div class="card animate" style="margin-bottom:16px">
      <div class="card-header">
        <h2>💰 Collection Summary</h2>
        <div class="btn-group">
          ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openBulkPaid()">⚡ Bulk Mark as Paid</button>` : ''}
          <button class="btn btn-ai btn-sm" onclick="openAIAssistant()">🤖 AI Summary</button>
          <button class="btn btn-outline btn-sm" onclick="exportFeesPDF()">📄 PDF</button>
          <button class="btn btn-outline btn-sm" onclick="exportFeesXLSX()">📊 Excel</button>
        </div>
      </div>
      <div class="card-body">
        ${Object.values(summary).map(f => {
          const pct = f.total > 0 ? Math.round((f.paid / f.total) * 100) : 0;
          const overdue = isOverdue(f.due_date);
          return `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;flex-wrap:wrap;gap:4px">
              <span style="font-weight:700;font-size:.86rem">${esc(f.name)}
                <span class="badge ${f.mandatory ? 'badge-absent' : 'badge-neutral'}" style="font-size:.6rem">${f.mandatory ? 'MANDATORY' : 'OPTIONAL'}</span>
              </span>
              <span class="text-sm text-muted">${peso(f.collected)} / ${peso(f.amount * f.total)} · ${f.paid}/${f.total} paid${f.due_date ? ` · <span class="${overdue ? 'overdue' : ''}">Due: ${fmtDate(f.due_date)}</span>` : ''}</span>
            </div>
            <div class="progress-wrap"><div class="progress-bar ${pct >= 100 ? 'green' : 'primary'}" style="width:${pct}%"></div></div>
            <div style="font-size:.7rem;color:var(--text3);margin-top:3px">${pct}% collected</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="card animate animate-delay-1">
      <div class="card-header"><h2>📋 Fee Status</h2></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--border);align-items:center">
        <div class="search-box" style="flex:1;min-width:160px">
          <span class="search-icon">🔍</span>
          <input type="text" id="feeNameSearch" placeholder="Search name..." oninput="applyFeeFilters()">
        </div>
        <select class="filter-sel" id="feeTypeFilter" onchange="applyFeeFilters()">
          <option value="">All Fee Types</option>${ftOpts}
        </select>
        <select class="filter-sel" id="feeStatusFilter" onchange="applyFeeFilters()">
          <option value="">All Status</option>
          <option value="unpaid">❌ Unpaid</option>
          <option value="paid">✅ Paid</option>
        </select>
        <select class="filter-sel" id="feeGenderFilter" onchange="applyFeeFilters()">
          <option value="">All Genders</option>
          <option value="Male">♂ Male</option>
          <option value="Female">♀ Female</option>
        </select>
      </div>
      <div id="feeStatusTable">${buildFeeStatusTable(feeStatus, canEdit, today)}</div>
    </div>

    <!-- ====== AI ASSISTANT PANEL ====== -->
    <div id="aiPanelOverlay" class="ai-panel-overlay" style="display:none" onclick="closeAIAssistant()"></div>
    <div id="aiAssistantPanel" class="ai-panel" style="display:none">
      <div class="ai-panel-inner">
        <div class="ai-panel-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="ai-avatar">🤖</div>
            <div>
              <div style="font-weight:800;font-size:.92rem;color:#fff">AI Payment Assistant</div>
              <div style="font-size:.65rem;color:rgba(255,255,255,.5)">Groq AI · Real-time data</div>
            </div>
          </div>
          <button onclick="closeAIAssistant()" class="ai-close-btn">✕</button>
        </div>
        <div id="aiMessages" class="ai-messages">
          <div class="ai-spacer"></div>
          <div class="ai-msg ai-msg-bot">
            <div class="ai-bubble">
              👋 <strong>Kamusta!</strong> Ako ang inyong AI Payment Assistant.<br><br>
              I-paste mo ang listahan ng mga bayad or magtanong — Taglish ok!
              <div class="ai-suggestions">
                <button onclick="askAI('Sino ang hindi pa nakabayad?')">Sino hindi pa bayad?</button>
                <button onclick="askAI('Ibigay ang buong payment summary')">Full summary</button>
                <button onclick="askAI('Sino may change?')">Sino may change?</button>
                <button onclick="askAI('Magkano pa ang kulang?')">Collection status</button>
              </div>
            </div>
          </div>
        </div>
        <div class="ai-input-area">
          <textarea id="aiChatInput" class="ai-input" rows="1"
            placeholder="I-paste ang listahan ng mga bayad o magtanong..."
            maxlength="2000"
            oninput="autoResizeAI(this)"
            onpaste="setTimeout(()=>smartDetectPaste(this),50)"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAIMessage();}"></textarea>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

function applyFeeFilters() {
  const q       = (document.getElementById('feeNameSearch')?.value || '').toLowerCase();
  const typeF   = document.getElementById('feeTypeFilter')?.value || '';
  const statusF = document.getElementById('feeStatusFilter')?.value || '';
  const genderF = document.getElementById('feeGenderFilter')?.value || '';
  const user    = getUser();
  const canEdit = ['president','vice_president','treasurer'].includes(user.role);
  const today   = new Date().toISOString().split('T')[0];
  let rows = window._feeStatus || [];
  if (q)       rows = rows.filter(r => (r.last_name + ' ' + r.first_name).toLowerCase().includes(q));
  if (typeF)   rows = rows.filter(r => String(r.fee_type_id) === String(typeF));
  if (statusF) rows = rows.filter(r => r.status === statusF);
  if (genderF) rows = rows.filter(r => r._gender === genderF);
  const tbl = document.getElementById('feeStatusTable');
  if (tbl) tbl.innerHTML = buildFeeStatusTable(rows, canEdit, today);
}

function buildFeeStatusTable(rows, canEdit, today) {
  if (!rows.length) return '<div class="empty-state" style="padding:24px"><span class="empty-icon">💰</span><h3>No results found</h3></div>';
  const rowsHTML = rows.map(r => {
    const isPaid  = r.status === 'paid';
    const overdue = !isPaid && r.due_date && r.due_date < today;
    const gBadge  = r._gender === 'Male' ? '♂' : r._gender === 'Female' ? '♀' : '';
    const gColor  = r._gender === 'Male' ? '#3b82f6' : '#ec4899';
    const paid    = parseFloat(r.amount_paid || 0);
    const total   = parseFloat(r.fee_amount || 0);
    const change  = paid - total;
    let amountDisplay = isPaid
      ? `<strong>${peso(paid)}</strong>${change > 0 ? `<br><span style="font-size:.7rem;color:var(--green)">+${peso(change)} change given</span>` : ''}`
      : `<span class="text-muted">${peso(total)}</span>`;
    let actionBtns = '';
    if (canEdit) {
      if (!isPaid) {
        actionBtns = `<button class="btn btn-action-pay" onclick="markPaidRow(${r.student_id},${r.fee_type_id},'${esc(r.last_name+', '+r.first_name.split(' ')[0])}','${esc(r.fee_name)}',${total})">✅ Mark as Paid</button>`;
      } else {
        actionBtns = `
          <button class="btn btn-action-edit" onclick="openEditPayment(${r.student_id},${r.fee_type_id},'${esc(r.last_name+', '+r.first_name.split(' ')[0])}','${esc(r.fee_name)}',${total},${paid},'${r.payment_date||''}')">✏️ Edit</button>
          <button class="btn btn-action-delete" onclick="undoPaymentRow(${r.student_id},${r.fee_type_id},'${esc(r.last_name+','+r.first_name.split(' ')[0])}')">↩ Undo</button>`;
      }
    }
    return `<tr id="fee-row-${r.student_id}-${r.fee_type_id}">
      <td><strong>${esc(r.last_name)}, ${esc(r.first_name.split(' ')[0])}</strong>${gBadge ? `<span style="margin-left:5px;font-size:.75rem;color:${gColor};font-weight:700">${gBadge}</span>` : ''}</td>
      <td><code>${esc(r.student_number || '')}</code></td>
      <td>${esc(r.fee_name)}</td>
      <td>${amountDisplay}</td>
      <td><span class="badge badge-${isPaid ? 'paid' : 'unpaid'}">${isPaid ? '✅ PAID' : '❌ UNPAID'}</span>${overdue ? '<br><span class="overdue" style="font-size:.7rem">OVERDUE</span>' : ''}</td>
      <td>${r.payment_date ? fmtDate(r.payment_date) : '—'}</td>
      <td><div class="action-btns">${actionBtns}</div></td>
    </tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table>
    <thead><tr><th>Name</th><th>Student ID</th><th>Fee</th><th>Amount Paid</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table></div>`;
}

async function markPaidRow(studentId, feeTypeId, studentName, feeName, feeAmount) {
  const rowId = `fee-row-${studentId}-${feeTypeId}`;
  const btn   = document.querySelector(`#${rowId} .btn-action-pay`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  const user = getUser();
  try {
    await api.recordPayment({ student_id: studentId, fee_type_id: feeTypeId, amount_paid: feeAmount, payment_date: todayISO(), notes: '', _user: { id: user.id, name: user.full_name }, section_id: user.section_id });
    const r = window._feeStatus.find(x => x.student_id === studentId && x.fee_type_id === feeTypeId);
    if (r) { r.status = 'paid'; r.amount_paid = feeAmount; r.payment_date = todayISO(); }
    toast('✅ ' + studentName + ' marked as paid!');
    applyFeeFilters();
  } catch(err) {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Mark as Paid'; }
    toast(err.message, 'error');
  }
}

function openEditPayment(studentId, feeTypeId, studentName, feeName, feeAmount, currentPaid, currentDate) {
  openModal('✏️ Edit Payment', `
    <div style="background:var(--surface2);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:.85rem;line-height:1.8">
      <div>👤 <strong>${esc(studentName)}</strong></div>
      <div>🏷️ ${esc(feeName)} — Fee: <strong>${peso(feeAmount)}</strong></div>
    </div>
    <div class="form-grid" style="margin-bottom:10px">
      <div class="form-group">
        <label>Amount Paid (₱) *</label>
        <input id="ep-amount" type="number" step="1" min="1" value="${currentPaid}" oninput="calcChange(${feeAmount})">
      </div>
      <div class="form-group">
        <label>Payment Date</label>
        <input id="ep-date" type="date" value="${currentDate ? currentDate.split('T')[0] : todayISO()}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Notes <span class="text-muted text-sm">(optional)</span></label>
        <input id="ep-notes" placeholder="e.g. Change given ₱20, downpayment, installment...">
      </div>
    </div>
    <div id="ep-change-box" style="border-radius:10px;padding:10px 14px;font-size:.88rem;font-weight:700;margin-bottom:14px;display:none"></div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="ep-save-btn" onclick="saveEditPayment(${studentId},${feeTypeId},'${esc(studentName)}',${feeAmount})">💾 Save Changes</button>
    </div>`, 460);
  setTimeout(() => calcChange(feeAmount), 100);
}

function calcChange(feeAmount) {
  const amtEl = document.getElementById('ep-amount');
  const box   = document.getElementById('ep-change-box');
  if (!amtEl || !box) return;
  const given  = parseFloat(amtEl.value) || 0;
  const change = given - feeAmount;
  if (given <= 0) { box.style.display = 'none'; }
  else if (change > 0) { box.style.display='block'; box.style.background='#d1fae5'; box.style.color='#065f46'; box.innerHTML=`💵 Change to give back: <span style="font-size:1.1rem">${peso(change)}</span>`; }
  else if (change < 0) { box.style.display='block'; box.style.background='#fef3c7'; box.style.color='#92400e'; box.innerHTML=`⚠️ Short by: <span style="font-size:1.1rem">${peso(Math.abs(change))}</span> (partial payment)`; }
  else { box.style.display='block'; box.style.background='#d1fae5'; box.style.color='#065f46'; box.innerHTML=`✅ Exact payment — no change`; }
}

async function saveEditPayment(studentId, feeTypeId, studentName, feeAmount) {
  const amount = parseFloat(document.getElementById('ep-amount')?.value);
  const date   = document.getElementById('ep-date')?.value;
  const notes  = document.getElementById('ep-notes')?.value || '';
  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  const btn = document.getElementById('ep-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }
  const user = getUser();
  const change = amount - feeAmount;
  try {
    await api.recordPayment({ student_id: studentId, fee_type_id: feeTypeId, amount_paid: amount, payment_date: date || todayISO(), notes, _user: { id: user.id, name: user.full_name }, section_id: user.section_id });
    const r = window._feeStatus.find(x => x.student_id === studentId && x.fee_type_id === feeTypeId);
    if (r) { r.status = 'paid'; r.amount_paid = amount; r.payment_date = date || todayISO(); }
    if (change > 0) toast(`💾 Saved! Change: ${peso(change)}`);
    else if (change < 0) toast(`💾 Saved! (Short by ${peso(Math.abs(change))})`);
    else toast('💾 Payment updated!');
    closeModal();
    applyFeeFilters();
  } catch(err) {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Changes'; }
    toast(err.message, 'error');
  }
}

async function undoPaymentRow(studentId, feeTypeId, name) {
  confirmAction(`Undo payment for <strong>${esc(name)}</strong>? This will mark them as unpaid.`, async function() {
    try {
      await api.deletePayment(studentId, feeTypeId);
      const r = window._feeStatus.find(x => x.student_id === studentId && x.fee_type_id === feeTypeId);
      if (r) { r.status = 'unpaid'; r.amount_paid = null; r.payment_date = null; }
      toast('Payment removed');
      applyFeeFilters();
    } catch(e) { toast(e.message, 'error'); }
  }, 'Undo Payment');
}

// ===== BULK MARK AS PAID =====
function openBulkPaid() {
  const feeTypes = window._feeTypes || [];
  if (!feeTypes.length) { toast('No fee types yet!', 'error'); return; }
  const ftOpts = feeTypes.map(ft => `<option value="${ft.id}" data-amount="${ft.amount}">${esc(ft.name)} — ${peso(ft.amount)}</option>`).join('');
  openModal('⚡ Bulk Mark as Paid', `
    <div style="margin-bottom:14px;font-size:.85rem;color:var(--text2);background:var(--surface2);padding:10px 14px;border-radius:9px">
      💡 Enter last names or first names (one per line). We'll find them and mark them as paid automatically!
    </div>
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1">
        <label>Select Fee *</label>
        <select id="bulk-fee-select" onchange="previewBulkMatch()">
          <option value="">— Select a fee —</option>
          ${ftOpts}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Names * <span class="text-muted text-sm">(one per line)</span></label>
        <textarea id="bulk-names-input" rows="6" placeholder="Macam&#10;Vicente&#10;Pedro" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text1);resize:vertical;font-size:.9rem" oninput="previewBulkMatch()"></textarea>
      </div>
    </div>
    <div id="bulk-preview" style="margin-bottom:12px"></div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="bulk-submit-btn" onclick="submitBulkPaid()" disabled>⚡ Mark All as Paid</button>
    </div>`, 520);
}

function previewBulkMatch() {
  const feeSelect = document.getElementById('bulk-fee-select');
  const textarea  = document.getElementById('bulk-names-input');
  const preview   = document.getElementById('bulk-preview');
  const submitBtn = document.getElementById('bulk-submit-btn');
  if (!feeSelect || !textarea || !preview) return;
  const feeId   = feeSelect.value;
  const rawText = textarea.value.trim();
  if (!feeId || !rawText) { preview.innerHTML = ''; if (submitBtn) submitBtn.disabled = true; return; }
  const names     = rawText.split('\n').map(n => n.trim().toLowerCase()).filter(Boolean);
  const students  = window._students || [];
  const feeStatus = window._feeStatus || [];
  const matched = [], notFound = [], alreadyPaid = [];
  names.forEach(name => {
    const found = students.find(s =>
      s.last_name.toLowerCase().includes(name) ||
      s.first_name.toLowerCase().includes(name) ||
      (s.last_name + ' ' + s.first_name).toLowerCase().includes(name)
    );
    if (!found) { notFound.push(name); return; }
    const sr = feeStatus.find(r => r.student_id === found.id && String(r.fee_type_id) === String(feeId));
    if (sr && sr.status === 'paid') { alreadyPaid.push(found.last_name + ', ' + found.first_name); return; }
    if (!matched.find(m => m.id === found.id)) matched.push(found);
  });
  window._bulkMatched   = matched;
  window._bulkFeeId     = feeId;
  window._bulkFeeAmount = parseFloat(feeSelect.options[feeSelect.selectedIndex]?.dataset?.amount || 0);
  let html = '';
  if (matched.length)     html += `<div style="background:#d1fae5;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:.83rem"><strong style="color:#065f46">✅ ${matched.length} will be marked as paid:</strong><br>${matched.map(s => `<span style="display:inline-block;background:#a7f3d0;border-radius:5px;padding:2px 8px;margin:2px;color:#065f46">${esc(s.last_name)}, ${esc(s.first_name)}</span>`).join('')}</div>`;
  if (alreadyPaid.length) html += `<div style="background:#fef3c7;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:.83rem"><strong style="color:#92400e">⚠️ Already paid (will be skipped):</strong><br>${alreadyPaid.map(n => `<span style="display:inline-block;background:#fde68a;border-radius:5px;padding:2px 8px;margin:2px;color:#92400e">${esc(n)}</span>`).join('')}</div>`;
  if (notFound.length)    html += `<div style="background:#fee2e2;border-radius:8px;padding:10px 14px;font-size:.83rem"><strong style="color:#991b1b">❌ Not found:</strong><br>${notFound.map(n => `<span style="display:inline-block;background:#fecaca;border-radius:5px;padding:2px 8px;margin:2px;color:#991b1b">${esc(n)}</span>`).join('')}</div>`;
  preview.innerHTML = html;
  if (submitBtn) submitBtn.disabled = matched.length === 0;
}

async function submitBulkPaid() {
  const matched   = window._bulkMatched || [];
  const feeId     = window._bulkFeeId;
  const feeAmount = window._bulkFeeAmount;
  if (!matched.length || !feeId) return;
  const btn = document.getElementById('bulk-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Processing...'; }
  const user = getUser();
  let successCount = 0;
  for (const student of matched) {
    try {
      await api.recordPayment({ student_id: student.id, fee_type_id: feeId, amount_paid: feeAmount, payment_date: todayISO(), notes: '', _user: { id: user.id, name: user.full_name }, section_id: user.section_id });
      const r = window._feeStatus.find(x => x.student_id === student.id && String(x.fee_type_id) === String(feeId));
      if (r) { r.status = 'paid'; r.amount_paid = feeAmount; r.payment_date = todayISO(); }
      successCount++;
    } catch(e) { toast(`Error: ${student.last_name} — ${e.message}`, 'error'); }
  }
  toast(`✅ ${successCount} students marked as paid!`);
  closeModal();
  renderFees();
}

function exportFeesPDF() {
  const rows = window._feeStatus || [];
  exportPDF('Fees & Payments — ' + (window.currentSectionName || ''),
    ['Name','Student ID','Gender','Fee','Fee Amount','Paid','Status','Date'],
    rows.map(r => [`${r.last_name}, ${r.first_name.split(' ')[0]}`, r.student_number||'', r._gender||'', r.fee_name, peso(r.fee_amount), r.status==='paid'?peso(r.amount_paid):'—', r.status.toUpperCase(), r.payment_date?fmtDate(r.payment_date):'—']),
    'fees.pdf');
}

function exportFeesXLSX() {
  const rows = window._feeStatus || [];
  exportExcel('Fees',
    ['Name','Student ID','Gender','Fee','Fee Amount','Amount Paid','Status','Date Paid'],
    rows.map(r => [`${r.last_name}, ${r.first_name.split(' ')[0]}`, r.student_number||'', r._gender||'', r.fee_name, r.fee_amount, r.amount_paid||'', r.status, r.payment_date||'']),
    'fees.xlsx');
}

// ============================================================
// ============================================================
//  🤖  AI PAYMENT ASSISTANT
// ============================================================

let _aiHistory    = [];
let _aiPendingMark = null; // stores {feeTypeId, students} waiting for confirmation

function autoResizeAI(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// Smart paste — detects payment list and auto-processes it
function smartDetectPaste(el) {
  const text = el.value.trim();
  if (!text) return;

  // Check if it looks like a payment list (multiple lines with names)
  const rawLines = text.split('\n').map(l => l.replace(/^[•\-\*\u200f\ufeff\s]+/, '').trim()).filter(Boolean);
  if (rawLines.length < 2) return; // too short, let them type normally

  // Try to detect fee name from first line (e.g. "NSTP 20 PESOS" or "IT FOOD 100")
  const firstLine = rawLines[0];
  const feeTypes  = window._feeTypes || [];
  const feeStatus = window._feeStatus || [];
  const students  = window._students || [];

  // Find matching fee type by name keywords
  let matchedFee = null;
  for (const ft of feeTypes) {
    const ftWords = ft.name.toLowerCase().split(/\s+/);
    const lineL   = firstLine.toLowerCase();
    if (ftWords.some(w => w.length > 2 && lineL.includes(w))) {
      matchedFee = ft;
      break;
    }
  }

  // Names start after first line (or all lines if no fee detected)
  const nameLines = matchedFee ? rawLines.slice(1) : rawLines;
  if (!nameLines.length) return;

  // Match names to students
  const newlyPaid = [], alreadyPaid = [], notFound = [];
  for (const name of nameLines) {
    const nl = name.toLowerCase();
    // Skip lines that look like amounts or headers
    if (/^\d/.test(name) || name.length < 2) continue;
    const found = students.find(s =>
      s.last_name.toLowerCase() === nl ||
      s.last_name.toLowerCase().includes(nl) ||
      nl.includes(s.last_name.toLowerCase())
    );
    if (!found) { notFound.push(name); continue; }
    if (matchedFee) {
      const sr = feeStatus.find(r => r.student_id === found.id && String(r.fee_type_id) === String(matchedFee.id));
      if (sr && sr.status === 'paid') { alreadyPaid.push(found.last_name); }
      else { newlyPaid.push(found.last_name); }
    } else {
      newlyPaid.push(found.last_name);
    }
  }

  if (!newlyPaid.length && !alreadyPaid.length) return; // nothing matched, send as normal message

  // Clear input
  el.value = '';
  el.style.height = 'auto';

  // Show pasted list as user message
  appendAIMessage('user', text);
  _aiHistory.push({ role: 'user', content: text });

  // Build AI response
  let reply = '';
  if (matchedFee) {
    reply += `📋 **${matchedFee.name}** — naprocess ko na ang listahan!\n\n`;
  } else {
    reply += `📋 Naprocess ko ang listahan!\n\n`;
  }
  if (newlyPaid.length) reply += `✅ **${newlyPaid.length} bagong bayad:**\n${newlyPaid.map(n => '• ' + n).join('\n')}\n\n`;
  if (alreadyPaid.length) reply += `⚠️ **Bayad na dati (${alreadyPaid.length}):** ${alreadyPaid.join(', ')}\n\n`;
  if (notFound.length) reply += `❓ **Hindi nahanap (${notFound.length}):** ${notFound.join(', ')}\n\n`;

  appendAIMessage('bot', reply);
  _aiHistory.push({ role: 'assistant', content: reply });

  // Show mark confirm if there are new payers and we know the fee
  if (newlyPaid.length && matchedFee) {
    appendMarkConfirmButton(matchedFee.id, newlyPaid);
  } else if (newlyPaid.length && !matchedFee) {
    // Ask which fee to mark
    appendAIMessage('bot', `💬 Para sa anong fee ko i-mark sila as paid? Piliin mo sa ibaba:`);
    appendFeeSelector(newlyPaid);
  }
}

function appendFeeSelector(students) {
  const el = document.getElementById('aiMessages');
  if (!el) return;
  const feeTypes = window._feeTypes || [];
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-bot';
  div.innerHTML = `<div class="ai-bubble" style="padding:10px 12px">
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${feeTypes.map(ft => `<button class="ai-fee-btn" onclick="appendMarkConfirmButton('${ft.id}',${JSON.stringify(students)});this.closest('.ai-msg').remove()">${esc(ft.name)} ₱${ft.amount}</button>`).join('')}
    </div>
  </div>`;
  el.appendChild(div);
  scrollAIToBottom();
}


function openAIAssistant() {
  const panel   = document.getElementById('aiAssistantPanel');
  const overlay = document.getElementById('aiPanelOverlay');
  if (!panel || !overlay) return;
  panel.style.display   = 'flex';
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    panel.classList.add('ai-panel-open');
    overlay.classList.add('ai-overlay-open');
  });
  setTimeout(() => document.getElementById('aiChatInput')?.focus(), 350);
}

function closeAIAssistant() {
  const panel   = document.getElementById('aiAssistantPanel');
  const overlay = document.getElementById('aiPanelOverlay');
  if (!panel || !overlay) return;
  panel.classList.remove('ai-panel-open');
  overlay.classList.remove('ai-overlay-open');
  setTimeout(() => { panel.style.display = 'none'; overlay.style.display = 'none'; }, 300);
}

function askAI(question) {
  const input = document.getElementById('aiChatInput');
  if (input) { input.value = question; autoResizeAI(input); }
  sendAIMessage();
}

function buildFeeContext() {
  const status = window._feeStatus || [];
  const types  = window._feeTypes  || [];
  const today  = new Date().toISOString().split('T')[0];
  const byType = {};
  types.forEach(ft => {
    byType[ft.id] = { name: ft.name, amount: parseFloat(ft.amount), paid: [], unpaid: [], withChange: [] };
  });
  status.forEach(r => {
    const grp = byType[r.fee_type_id];
    if (!grp) return;
    const name   = r.last_name;
    const amtPd  = parseFloat(r.amount_paid || 0);
    const fee    = parseFloat(r.fee_amount  || 0);
    const change = amtPd - fee;
    if (r.status === 'paid') {
      grp.paid.push(change > 0 ? `${name}(+${change})` : name);
      if (change > 0) grp.withChange.push(`${name}:+₱${change}`);
    } else {
      grp.unpaid.push((r.due_date && r.due_date < today) ? `${name}!OVERDUE` : name);
    }
  });
  let ctx = `AI payment assistant ng Filipino college section. Date:${new Date().toLocaleDateString('en-PH')}.
DATA:
`;
  for (const grp of Object.values(byType)) {
    const total = grp.paid.length + grp.unpaid.length;
    ctx += `[${grp.name} ₱${grp.amount} ${grp.paid.length}/${total}]`;
    if (grp.paid.length)       ctx += ` PAID:${grp.paid.join(',')}`;
    if (grp.unpaid.length)     ctx += ` UNPAID:${grp.unpaid.join(',')}`;
    if (grp.withChange.length) ctx += ` CHANGE:${grp.withChange.join(',')}`;
    ctx += '\n';
  }
  ctx += `RULES:
- Taglish, friendly, bullet points, ✅paid ❌unpaid 💵change, max 120 words.
- Kapag nag-paste ng listahan ng mga bayad, i-identify kung sino sa listahan ay HINDI PA NAKAREHISTRO bilang paid sa system.
- Kapag may bagong bayad na natukoy, lagyan ng MARK_ACTION tag sa dulo ng reply sa format: ##MARK_ACTION:fee_type_id:LastName1,LastName2##
- Halimbawa: ##MARK_ACTION:3:Jimenez,Santos,Pedro##
- Gamitin lang ang fee_type_id mula sa DATA, huwag mag-imbento.
- Kapag sinabi na "i-mark" o "i-confirm", gawin ang MARK_ACTION para sa mga nabanggit.`;
  return ctx;
}

function scrollAIToBottom() {
  const el = document.getElementById('aiMessages');
  if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

function appendAIMessage(role, text, isTyping = false) {
  const el = document.getElementById('aiMessages');
  if (!el) return null;
  // Remove spacer once we have messages
  const spacer = el.querySelector('.ai-spacer');
  if (spacer && el.children.length > 2) spacer.style.display = 'none';
  const div = document.createElement('div');
  div.className = `ai-msg ${role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`;
  if (isTyping) {
    div.innerHTML = `<div class="ai-bubble"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>`;
  } else {
    // Parse MARK_ACTION out of text before displaying
    const cleanText = text.replace(/##MARK_ACTION:[^#]+##/g, '').trim();
    const html = cleanText
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n/g,'<br>');
    div.innerHTML = `<div class="ai-bubble">${html}</div>`;
  }
  el.appendChild(div);
  scrollAIToBottom();
  return div;
}

function appendMarkConfirmButton(feeTypeId, students) {
  const el = document.getElementById('aiMessages');
  if (!el || !students.length) return;
  _aiPendingMark = { feeTypeId, students };
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-bot';
  div.id = 'ai-mark-confirm';
  div.innerHTML = `
    <div class="ai-bubble ai-mark-bubble">
      <div style="font-size:.8rem;color:rgba(255,255,255,.7);margin-bottom:8px">I-mark ba sila as paid?</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
        ${students.map(s => `<span class="ai-name-chip">${esc(s)}</span>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="ai-confirm-btn" onclick="executeAIMark()">✅ I-mark lahat (${students.length})</button>
        <button class="ai-cancel-btn" onclick="cancelAIMark()">✕ Cancel</button>
      </div>
    </div>`;
  el.appendChild(div);
  scrollAIToBottom();
}

async function executeAIMark() {
  if (!_aiPendingMark) return;
  const { feeTypeId, students } = _aiPendingMark;
  _aiPendingMark = null;

  const confirmEl = document.getElementById('ai-mark-confirm');
  if (confirmEl) {
    confirmEl.innerHTML = `<div class="ai-bubble"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>`;
  }

  const feeStatus  = window._feeStatus  || [];
  const allStudents = window._students  || [];
  const user = getUser();
  let successCount = 0;
  const notFound = [];

  for (const lastName of students) {
    const normalized = lastName.trim().toLowerCase();
    // Find student in _students
    const found = allStudents.find(s =>
      s.last_name.toLowerCase() === normalized ||
      s.last_name.toLowerCase().includes(normalized)
    );
    if (!found) { notFound.push(lastName); continue; }
    // Check if already paid for this fee
    const existing = feeStatus.find(r => r.student_id === found.id && String(r.fee_type_id) === String(feeTypeId));
    if (!existing || existing.status === 'paid') { successCount++; continue; } // already paid, count as ok
    // Get fee amount
    const feeAmount = parseFloat(existing.fee_amount || 0);
    try {
      await api.recordPayment({
        student_id: found.id,
        fee_type_id: feeTypeId,
        amount_paid: feeAmount,
        payment_date: todayISO(),
        notes: 'Marked via AI',
        _user: { id: user.id, name: user.full_name },
        section_id: user.section_id
      });
      existing.status = 'paid';
      existing.amount_paid = feeAmount;
      existing.payment_date = todayISO();
      successCount++;
    } catch(e) {
      notFound.push(lastName + ' (error)');
    }
  }

  if (confirmEl) confirmEl.remove();

  let resultMsg = `✅ ${successCount} estudyante na-mark as paid!`;
  if (notFound.length) resultMsg += `\n\n⚠️ Hindi nahanap: ${notFound.join(', ')}`;
  appendAIMessage('bot', resultMsg);
  _aiHistory.push({ role: 'assistant', content: resultMsg });

  // Update the table
  applyFeeFilters();
  renderFees();
}

function cancelAIMark() {
  _aiPendingMark = null;
  const el = document.getElementById('ai-mark-confirm');
  if (el) el.remove();
  appendAIMessage('bot', 'Okay, hindi na i-mark. 👍');
}

async function sendAIMessage() {
  const input = document.getElementById('aiChatInput');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  input.style.height = 'auto';
  input.disabled = true;

  appendAIMessage('user', msg);
  _aiHistory.push({ role: 'user', content: msg });

  const typingEl = appendAIMessage('bot', '', true);

  try {
    const systemPrompt = buildFeeContext();
    const messages = _aiHistory.map(m => ({ role: m.role, content: m.content }));

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('ct_token') || '')
      },
      body: JSON.stringify({ system: systemPrompt, messages })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error ${res.status}`);
    }

    const data  = await res.json();
    const reply = data.reply || '(No response)';

    if (typingEl) typingEl.remove();
    appendAIMessage('bot', reply);
    _aiHistory.push({ role: 'assistant', content: reply });
    if (_aiHistory.length > 20) _aiHistory = _aiHistory.slice(-20);

    // Check for MARK_ACTION in reply
    const markMatch = reply.match(/##MARK_ACTION:(\d+):([^#]+)##/);
    if (markMatch) {
      const feeTypeId = markMatch[1];
      const students  = markMatch[2].split(',').map(s => s.trim()).filter(Boolean);
      if (students.length) appendMarkConfirmButton(feeTypeId, students);
    }

  } catch(e) {
    if (typingEl) typingEl.remove();
    appendAIMessage('bot', `❌ Error: ${e.message}\n\nI-check ang koneksyon o subukan ulit.`);
  } finally {
    input.disabled = false;
    input.focus();
  }
}
