const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireAdmin);

function hashPassword(password) { return crypto.createHash('sha256').update(password).digest('hex'); }

// Overview: sections + users
router.get('/overview', async (req, res) => {
  try {
    const sections = await pool.query(
      `SELECT s.*, COUNT(DISTINCT u.id) as member_count, COUNT(DISTINCT st.id) as student_count
       FROM sections s LEFT JOIN users u ON u.section_id=s.id LEFT JOIN students st ON st.section_id=s.id
       GROUP BY s.id ORDER BY s.created_at DESC`
    );
    const users = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.created_at, s.name as section_name
       FROM users u LEFT JOIN sections s ON s.id=u.section_id WHERE u.role != 'admin' ORDER BY u.created_at DESC`
    );
    res.json({ success: true, sections: sections.rows, users: users.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// User management
router.post('/users', async (req, res) => {
  try {
    const { username, password, full_name, role, section_id } = req.body;
    if (!username || !password || !full_name || !role) return res.status(400).json({ success: false, message: 'All fields required' });
    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, section_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, full_name, role, section_id, created_at`,
      [username, hashed, full_name, role, section_id||null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, message: 'Username already taken' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { full_name, role, section_id } = req.body;
    const result = await pool.query(
      `UPDATE users SET full_name=$1, role=$2, section_id=$3 WHERE id=$4 AND role!='admin' RETURNING id, username, full_name, role, section_id`,
      [full_name, role, section_id||null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found or is admin' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const check = await pool.query('SELECT role FROM users WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (check.rows[0].role === 'admin') return res.status(403).json({ success: false, message: 'Cannot delete admin' });
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2 AND role!=\'admin\'', [hashed, req.params.id]);
    res.json({ success: true, message: 'Password reset' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Reset requests
router.get('/reset-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.status, r.requested_at, u.username, u.full_name, u.role, s.name as section_name
       FROM password_reset_requests r JOIN users u ON u.id=r.user_id LEFT JOIN sections s ON s.id=u.section_id
       WHERE r.status='pending' ORDER BY r.requested_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/reset-requests/:id/resolve', async (req, res) => {
  try {
    const { new_password } = req.body;
    const reqRow = await pool.query('SELECT user_id FROM password_reset_requests WHERE id=$1', [req.params.id]);
    if (!reqRow.rows.length) return res.status(404).json({ success: false, message: 'Request not found' });
    const hashed = await bcrypt.hash(new_password || 'classtrack123', 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hashed, reqRow.rows[0].user_id]);
    await pool.query('UPDATE password_reset_requests SET status=\'resolved\', resolved_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Password reset' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Section management
router.get('/sections', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COUNT(DISTINCT u.id) as member_count, COUNT(DISTINCT st.id) as student_count
       FROM sections s LEFT JOIN users u ON u.section_id=s.id LEFT JOIN students st ON st.section_id=s.id
       GROUP BY s.id ORDER BY s.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/sections', async (req, res) => {
  try {
    const { name, school_year, adviser, collection_target } = req.body;
    if (!name || !school_year) return res.status(400).json({ success: false, message: 'name and school_year required' });
    const code = name.replace(/\s+/g,'').toUpperCase().slice(0,6) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const result = await pool.query(
      `INSERT INTO sections (name, school_year, adviser, code, collection_target) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, school_year, adviser||null, code, collection_target||0]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/sections/:id', async (req, res) => {
  try {
    const { name, school_year, adviser, collection_target } = req.body;
    const result = await pool.query(
      `UPDATE sections SET name=$1, school_year=$2, adviser=$3, collection_target=$4 WHERE id=$5 RETURNING *`,
      [name, school_year, adviser||null, collection_target||0, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/sections/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM attendance_records WHERE session_id IN (SELECT id FROM attendance_sessions WHERE section_id=$1)`, [req.params.id]);
    await client.query(`DELETE FROM attendance_sessions WHERE section_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM fee_payments WHERE student_id IN (SELECT id FROM students WHERE section_id=$1)`, [req.params.id]);
    await client.query(`DELETE FROM student_notes WHERE student_id IN (SELECT id FROM students WHERE section_id=$1)`, [req.params.id]);
    await client.query(`DELETE FROM fee_type_students WHERE fee_type_id IN (SELECT id FROM fee_types WHERE section_id=$1)`, [req.params.id]);
    await client.query(`DELETE FROM fee_types WHERE section_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM students WHERE section_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM announcements WHERE section_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM activity_logs WHERE section_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM password_reset_requests WHERE user_id IN (SELECT id FROM users WHERE section_id=$1)`, [req.params.id]);
    await client.query(`DELETE FROM users WHERE section_id=$1`, [req.params.id]);
    await client.query(`DELETE FROM sections WHERE id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally { client.release(); }
});

// Activity logs
router.get('/logs', async (req, res) => {
  try {
    const { section_id, date_from, date_to, limit } = req.query;
    let q = `SELECT l.*, s.name as section_name FROM activity_logs l LEFT JOIN sections s ON s.id=l.section_id WHERE 1=1`;
    const params = [];
    if (section_id) { params.push(section_id); q += ` AND l.section_id=$${params.length}`; }
    if (date_from) { params.push(date_from); q += ` AND l.created_at >= $${params.length}`; }
    if (date_to) { params.push(date_to + ' 23:59:59'); q += ` AND l.created_at <= $${params.length}`; }
    q += ` ORDER BY l.created_at DESC LIMIT $${params.length+1}`;
    params.push(parseInt(limit)||100);
    const result = await pool.query(q, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Full backup
router.get('/backup', async (req, res) => {
  try {
    const sections = await pool.query('SELECT * FROM sections ORDER BY id');
    const users = await pool.query('SELECT id, username, full_name, role, section_id, created_at FROM users ORDER BY id');
    const students = await pool.query('SELECT * FROM students ORDER BY id');
    const feeTypes = await pool.query('SELECT * FROM fee_types ORDER BY id');
    const feePayments = await pool.query('SELECT * FROM fee_payments ORDER BY id');
    const sessions = await pool.query('SELECT * FROM attendance_sessions ORDER BY id');
    const records = await pool.query('SELECT * FROM attendance_records ORDER BY id');
    const announcements = await pool.query('SELECT * FROM announcements ORDER BY id');
    const logs = await pool.query('SELECT * FROM activity_logs ORDER BY id');
    res.json({
      success: true,
      backup_date: new Date().toISOString(),
      data: { sections: sections.rows, users: users.rows, students: students.rows, fee_types: feeTypes.rows, fee_payments: feePayments.rows, attendance_sessions: sessions.rows, attendance_records: records.rows, announcements: announcements.rows, activity_logs: logs.rows }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Attendance summary across all sections
router.get('/attendance-summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.name as section_name, COUNT(DISTINCT sess.id) as total_sessions,
        SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as total_present,
        SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END) as total_absent
       FROM sections s
       LEFT JOIN attendance_sessions sess ON sess.section_id=s.id
       LEFT JOIN attendance_records ar ON ar.session_id=sess.id
       GROUP BY s.id ORDER BY s.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Collection summary across all sections
router.get('/collection-summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.name as section_name, s.collection_target, COALESCE(SUM(fp.amount_paid),0) as total_collected, COUNT(fp.id) as payment_count
       FROM sections s
       LEFT JOIN fee_types ft ON ft.section_id=s.id
       LEFT JOIN fee_payments fp ON fp.fee_type_id=ft.id
       GROUP BY s.id ORDER BY total_collected DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Notifications/Alerts for admin
router.get('/alerts', async (req, res) => {
  try {
    const atRisk = await pool.query(
      `SELECT st.first_name, st.last_name, s.name as section_name, COUNT(ar.id) as absent_count
       FROM attendance_records ar JOIN students st ON st.id=ar.student_id JOIN sections s ON s.id=st.section_id
       WHERE ar.status='absent' GROUP BY st.id, s.name HAVING COUNT(ar.id) >= 3 ORDER BY absent_count DESC LIMIT 20`
    );
    const overdue = await pool.query(
      `SELECT st.first_name, st.last_name, sec.name as section_name, ft.name as fee_name, ft.due_date
       FROM fee_types ft JOIN students st ON st.section_id=ft.section_id
       LEFT JOIN fee_payments fp ON fp.student_id=st.id AND fp.fee_type_id=ft.id
       LEFT JOIN sections sec ON sec.id=ft.section_id
       WHERE ft.due_date < CURRENT_DATE AND fp.id IS NULL LIMIT 30`
    );
    res.json({ success: true, at_risk: atRisk.rows, overdue: overdue.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
