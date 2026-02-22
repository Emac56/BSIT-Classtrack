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
        actionBtns = `<button class="btn btn-action-pay" onclick="markPaidRow(${r.student_id},${r.fee_type_id},'${esc(r.last_name+', '+r.first_name)}','${esc(r.fee_name)}',${total})">✅ Mark as Paid</button>`;
      } else {
        actionBtns = `
          <button class="btn btn-action-edit" onclick="openEditPayment(${r.student_id},${r.fee_type_id},'${esc(r.last_name+', '+r.first_name)}','${esc(r.fee_name)}',${total},${paid},'${r.payment_date||''}')">✏️ Edit</button>
          <button class="btn btn-action-delete" onclick="undoPaymentRow(${r.student_id},${r.fee_type_id},'${esc(r.last_name+','+r.first_name)}')">↩ Undo</button>`;
      }
    }
    return `<tr id="fee-row-${r.student_id}-${r.fee_type_id}">
      <td><strong>${esc(r.last_name)}, ${esc(r.first_name)}</strong>${gBadge ? `<span style="margin-left:5px;font-size:.75rem;color:${gColor};font-weight:700">${gBadge}</span>` : ''}</td>
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
        <input id="ep-notes" placeholder="e.g. May sukli ₱20, downpayment, installment...">
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
  else if (change < 0) { box.style.display='block'; box.style.background='#fef3c7'; box.style.color='#92400e'; box.innerHTML=`⚠️ Short by: <span style="font-size:1.1rem">${peso(Math.abs(change))}</span>`; }
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
      💡 Ilagay ang mga apelyido o pangalan (isa bawat linya). Automatic hahanapin at imi-mark bilang paid!
    </div>
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1">
        <label>Piliin ang Fee *</label>
        <select id="bulk-fee-select" onchange="previewBulkMatch()">
          <option value="">— Pumili ng fee —</option>
          ${ftOpts}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Mga Pangalan * <span class="text-muted text-sm">(isa bawat linya)</span></label>
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
  if (matched.length)     html += `<div style="background:#d1fae5;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:.83rem"><strong style="color:#065f46">✅ ${matched.length} na imi-mark as paid:</strong><br>${matched.map(s => `<span style="display:inline-block;background:#a7f3d0;border-radius:5px;padding:2px 8px;margin:2px;color:#065f46">${esc(s.last_name)}, ${esc(s.first_name)}</span>`).join('')}</div>`;
  if (alreadyPaid.length) html += `<div style="background:#fef3c7;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:.83rem"><strong style="color:#92400e">⚠️ Paid na (lalaktawan):</strong><br>${alreadyPaid.map(n => `<span style="display:inline-block;background:#fde68a;border-radius:5px;padding:2px 8px;margin:2px;color:#92400e">${esc(n)}</span>`).join('')}</div>`;
  if (notFound.length)    html += `<div style="background:#fee2e2;border-radius:8px;padding:10px 14px;font-size:.83rem"><strong style="color:#991b1b">❌ Hindi nahanap:</strong><br>${notFound.map(n => `<span style="display:inline-block;background:#fecaca;border-radius:5px;padding:2px 8px;margin:2px;color:#991b1b">${esc(n)}</span>`).join('')}</div>`;
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
    rows.map(r => [`${r.last_name}, ${r.first_name}`, r.student_number||'', r._gender||'', r.fee_name, peso(r.fee_amount), r.status==='paid'?peso(r.amount_paid):'—', r.status.toUpperCase(), r.payment_date?fmtDate(r.payment_date):'—']),
    'fees.pdf');
}

function exportFeesXLSX() {
  const rows = window._feeStatus || [];
  exportExcel('Fees',
    ['Name','Student ID','Gender','Fee','Fee Amount','Amount Paid','Status','Date Paid'],
    rows.map(r => [`${r.last_name}, ${r.first_name}`, r.student_number||'', r._gender||'', r.fee_name, r.fee_amount, r.amount_paid||'', r.status, r.payment_date||'']),
    'fees.xlsx');
}
