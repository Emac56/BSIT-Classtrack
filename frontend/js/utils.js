// TOAST
function toast(msg, type = 'success') {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || '💬'}</span>${esc(msg)}`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

// MODAL
function openModal(title, bodyHTML, size = 560) {
  closeModal();
  const c = document.getElementById('modalContainer');
  c.innerHTML = `
    <div class="modal-overlay" id="activeModal">
      <div class="modal" style="max-width:${size}px">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
      </div>
    </div>`;
  requestAnimationFrame(() => document.getElementById('activeModal').classList.add('open'));
  document.getElementById('activeModal').addEventListener('click', e => { if (e.target.id === 'activeModal') closeModal(); });
  document.body.classList.add('modal-open'); // prevent scroll behind modal on mobile
}

function closeModal() {
  const m = document.getElementById('activeModal');
  if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 200); }
  document.body.classList.remove('modal-open');
}

function confirmAction(msg, onYes, dangerLabel = 'Delete') {
  // Store callback globally — avoids closure loss from toString() serialization
  window._confirmCb = onYes;
  openModal('⚠️ Confirm', `
    <p style="margin-bottom:18px;color:var(--text2);font-size:.92rem;line-height:1.5">${msg}</p>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="closeModal();if(window._confirmCb){window._confirmCb();window._confirmCb=null;}">${dangerLabel}</button>
    </div>`, 380);
}

// DATE HELPERS
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtTime(d) {
  if (!d) return '';
  const now = new Date(), diff = now - new Date(d);
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return fmtDate(d);
}
function todayISO() { return new Date().toISOString().split('T')[0]; }
function monthName(m) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1] || ''; }
function isOverdue(dateStr) { return dateStr && new Date(dateStr) < new Date(); }

// ESC HTML
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// LOADING
function loadingHTML() { return '<div class="loading"><div class="spinner"></div></div>'; }

// NO SECTION
function noSectionHTML() {
  return '<div class="empty-state"><span class="empty-icon">🏫</span><h3>No Section Assigned</h3><p>Your account has no section. Contact your admin.</p></div>';
}

// CURRENCY
function peso(n) { return '₱' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// PDF EXPORT
function exportPDF(title, headers, rows, filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14); doc.text(title, 14, 16);
  doc.setFontSize(9); doc.setTextColor(120); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  doc.autoTable({ head: [headers], body: rows, startY: 28, styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [79,70,229], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248,247,255] } });
  doc.save(filename || 'report.pdf');
}

// CSV EXPORT
function exportCSV(headers, rows, filename) {
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'export.csv'; a.click();
}

// EXCEL EXPORT
function exportExcel(sheetName, headers, rows, filename) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename || 'export.xlsx');
}

// Toggle password visibility
function togglePwField(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

// Format role labels
const ROLE_LABELS = { president: '👑 President', vice_president: '⭐ Vice President', treasurer: '💰 Treasurer', auditor: '📊 Auditor', secretary: '📋 Secretary', officer: '👤 Officer', member: '👁️ Member', admin: '🔧 Admin' };
function roleLabel(r) { return ROLE_LABELS[r] || r; }
