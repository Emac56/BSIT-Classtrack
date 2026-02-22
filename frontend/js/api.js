// ============ API.JS — HTTP CLIENT WITH JWT AUTH ============

const API = '/api';

// ---- Token helpers ----
function getToken() { return localStorage.getItem('ct_token'); }
function setToken(token) { localStorage.setItem('ct_token', token); }
function clearToken() { localStorage.removeItem('ct_token'); }

const api = {
  _req: async function(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    // Attach JWT token to every request
    const token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API + path, opts);

    // Auto-logout on 401 (expired/invalid token)
    if (res.status === 401) {
      clearToken();
      localStorage.removeItem('ct_user');
      window.location.href = '/login.html';
      return;
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      throw new Error(res.status === 404 ? 'Not found (404)' : `Server error ${res.status} — check if server is running`);
    }
    if (!data.success) throw new Error(data.message || 'Request failed');
    return data;
  },
  get: function(path) { return this._req('GET', path); },
  post: function(path, body) { return this._req('POST', path, body); },
  put: function(path, body) { return this._req('PUT', path, body); },
  delete: function(path) { return this._req('DELETE', path); },

  // Dashboard
  dashboard: function(sid) { return this.get('/dashboard/' + sid); },

  // Students
  getStudents: function(sid) { return this.get('/students/section/' + sid); },
  getStudentProfile: function(id) { return this.get('/students/' + id + '/profile'); },
  createStudent: function(d) { return this.post('/students', d); },
  updateStudent: function(id, d) { return this.put('/students/' + id, d); },
  deleteStudent: function(id) { return this.delete('/students/' + id); },
  bulkImport: function(d) { return this.post('/students/bulk-import', d); },
  addNote: function(id, d) { return this.post('/students/' + id + '/notes', d); },
  deleteNote: function(sid, nid) { return this.delete('/students/' + sid + '/notes/' + nid); },

  // Attendance
  getSessions: function(sid) { return this.get('/attendance/sessions/section/' + sid); },
  createSession: function(d) { return this.post('/attendance/sessions', d); },
  updateSession: function(id, d) { return this.put('/attendance/sessions/' + id, d); },
  deleteSession: function(id) { return this.delete('/attendance/sessions/' + id); },
  getSessionRecords: function(id) { return this.get('/attendance/sessions/' + id + '/records'); },
  saveAttendance: function(id, records, user, sid) { return this.post('/attendance/sessions/' + id + '/records', { records, _user: { id: user.id, name: user.full_name }, section_id: sid }); },
  getAttSummary: function(sid) { return this.get('/attendance/summary/section/' + sid); },
  getTodayAtt: function(sid) { return this.get('/attendance/today/' + sid); },

  // Fees
  getFeeTypes: function(sid) { return this.get('/fees/types/section/' + sid); },
  createFeeType: function(d) { return this.post('/fees/types', d); },
  updateFeeType: function(id, d) { return this.put('/fees/types/' + id, d); },
  deleteFeeType: function(id) { return this.delete('/fees/types/' + id); },
  getFeeStatus: function(sid) { return this.get('/fees/status/section/' + sid); },
  getMonthlyColl: function(sid) { return this.get('/fees/monthly/' + sid); },
  recordPayment: function(d) { return this.post('/fees/pay', d); },
  deletePayment: function(sid, ftid) { return this.delete('/fees/pay/' + sid + '/' + ftid); },

  // Announcements
  getAnnouncements: function(sid) { return this.get('/announcements/section/' + sid); },
  createAnnouncement: function(d) { return this.post('/announcements', d); },
  updateAnnouncement: function(id, d) { return this.put('/announcements/' + id, d); },
  deleteAnnouncement: function(id) { return this.delete('/announcements/' + id); },

  // Auth
  getMembers: function(sid) { return this.get('/auth/members/' + sid); },
  changePassword: function(d) { return this.post('/auth/change-password', d); },

  // Chat
  getChatMessages: function(sid) { return this.get('/chat/section/' + sid); },

  // Admin
  adminOverview: function() { return this.get('/admin/overview'); },
  adminSections: function() { return this.get('/admin/sections'); },
  adminCreateSection: function(d) { return this.post('/admin/sections', d); },
  adminUpdateSection: function(id, d) { return this.put('/admin/sections/' + id, d); },
  adminDeleteSection: function(id) { return this.delete('/admin/sections/' + id); },
  adminCreateUser: function(d) { return this.post('/admin/users', d); },
  adminUpdateUser: function(id, d) { return this.put('/admin/users/' + id, d); },
  adminDeleteUser: function(id) { return this.delete('/admin/users/' + id); },
  adminResetPassword: function(id, pw) { return this.post('/admin/users/' + id + '/reset-password', { new_password: pw }); },
  adminResetRequests: function() { return this.get('/admin/reset-requests'); },
  adminResolveReset: function(id, pw) { return this.post('/admin/reset-requests/' + id + '/resolve', { new_password: pw }); },
  adminLogs: function(p) { return this.get('/admin/logs' + (p ? '?' + new URLSearchParams(p).toString() : '')); },
  adminBackup: function() { return this.get('/admin/backup'); },
  adminAttSummary: function() { return this.get('/admin/attendance-summary'); },
  adminCollSummary: function() { return this.get('/admin/collection-summary'); },
  adminAlerts: function() { return this.get('/admin/alerts'); },
};
