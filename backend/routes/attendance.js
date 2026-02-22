const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireSameSection } = require('../middleware/auth');

router.use(requireAuth);

async function logActivity(pool, sectionId, userId, userName, action, entityType, entityName) {
  try { await pool.query(`INSERT INTO activity_logs (section_id,user_id,user_name,action,entity_type,entity_name) VALUES ($1,$2,$3,$4,$5,$6)`, [sectionId,userId,userName,action,entityType,entityName]); } catch(e) {}
}

router.get('/sessions/section/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COUNT(ar.id) as total_records,
        SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ar.status='late' THEN 1 ELSE 0 END) as late_count
       FROM attendance_sessions s
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       WHERE s.section_id = $1
       GROUP BY s.id ORDER BY s.date DESC`,
      [req.params.sectionId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/sessions/:sessionId/records', async (req, res) => {
  try {
    const session = await pool.query('SELECT * FROM attendance_sessions WHERE id=$1', [req.params.sessionId]);
    if (!session.rows.length) return res.status(404).json({ success: false, message: 'Session not found' });
    const result = await pool.query(
      `SELECT st.id, st.student_id as student_number, st.first_name, st.last_name,
        ar.id as record_id, ar.status, ar.notes
       FROM students st
       LEFT JOIN attendance_records ar ON ar.student_id = st.id AND ar.session_id = $1
       WHERE st.section_id = $2
       ORDER BY st.last_name, st.first_name`,
      [req.params.sessionId, session.rows[0].section_id]
    );
    res.json({ success: true, session: session.rows[0], data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/sessions', async (req, res) => {
  try {
    const { section_id, date, subject, notes, _user } = req.body;
    if (!section_id || !date) return res.status(400).json({ success: false, message: 'section_id and date required' });
    const result = await pool.query(
      `INSERT INTO attendance_sessions (section_id, date, subject, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
      [section_id, date, subject||null, notes||null]
    );
    if (_user) await logActivity(pool, section_id, _user.id, _user.name, `Created attendance session for ${date}`, 'attendance', date);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, message: 'Session already exists for this date and subject' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/records', async (req, res) => {
  const client = await pool.connect();
  try {
    const { records, _user, section_id } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'records array required' });
    await client.query('BEGIN');
    await client.query('DELETE FROM attendance_records WHERE session_id=$1', [req.params.sessionId]);
    for (const rec of records) {
      await client.query(
        `INSERT INTO attendance_records (session_id, student_id, status, notes) VALUES ($1,$2,$3,$4)`,
        [req.params.sessionId, rec.student_id, rec.status||'present', rec.notes||null]
      );
    }
    await client.query('COMMIT');
    const sess = await pool.query('SELECT date FROM attendance_sessions WHERE id=$1', [req.params.sessionId]);
    if (_user && sess.rows.length) await logActivity(pool, section_id, _user.id, _user.name, `Saved attendance for ${sess.rows[0].date}`, 'attendance', sess.rows[0].date);
    res.json({ success: true, message: 'Attendance saved' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally { client.release(); }
});

router.put('/sessions/:id', async (req, res) => {
  try {
    const { date, subject, notes } = req.body;
    const result = await pool.query(
      `UPDATE attendance_sessions SET date=$1, subject=$2, notes=$3 WHERE id=$4 RETURNING *`,
      [date, subject||null, notes||null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM attendance_sessions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/summary/section/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.id, st.student_id as student_number, st.first_name, st.last_name,
        COUNT(ar.id) as total_days,
        SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status='late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status='excused' THEN 1 ELSE 0 END) as excused
       FROM students st
       LEFT JOIN attendance_records ar ON ar.student_id = st.id
       LEFT JOIN attendance_sessions sess ON sess.id = ar.session_id AND sess.section_id = $1
       WHERE st.section_id = $1
       GROUP BY st.id ORDER BY st.last_name, st.first_name`,
      [req.params.sectionId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Today's attendance for a section
router.get('/today/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT s.*, 
        SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END) as absent_count
       FROM attendance_sessions s
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       WHERE s.section_id=$1 AND s.date=$2
       GROUP BY s.id`,
      [req.params.sectionId, today]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
