const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireSameSection } = require('../middleware/auth');

// All student routes require login
router.use(requireAuth);

async function logActivity(pool, sectionId, userId, userName, action, entityType, entityName) {
  try { await pool.query(`INSERT INTO activity_logs (section_id,user_id,user_name,action,entity_type,entity_name) VALUES ($1,$2,$3,$4,$5,$6)`, [sectionId,userId,userName,action,entityType,entityName]); } catch(e) {}
}

router.get('/section/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM students WHERE section_id=$1 ORDER BY last_name, first_name`, [req.params.sectionId]);
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id/profile', async (req, res) => {
  try {
    const student = await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id]);
    if (!student.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    // Section check — user must own this student's section
    if (req.user.role !== 'admin' && parseInt(student.rows[0].section_id) !== parseInt(req.user.section_id))
      return res.status(403).json({ success: false, message: 'Access denied' });
    const attendance = await pool.query(`SELECT ar.status, ar.notes, s.date, s.subject FROM attendance_records ar JOIN attendance_sessions s ON s.id=ar.session_id WHERE ar.student_id=$1 ORDER BY s.date DESC`, [req.params.id]);
    const payments = await pool.query(`SELECT fp.*, ft.name as fee_name, ft.amount as fee_amount FROM fee_payments fp JOIN fee_types ft ON ft.id=fp.fee_type_id WHERE fp.student_id=$1 ORDER BY fp.payment_date DESC`, [req.params.id]);
    const notes = await pool.query(`SELECT * FROM student_notes WHERE student_id=$1 ORDER BY created_at DESC`, [req.params.id]);
    res.json({ success: true, data: { student: student.rows[0], attendance: attendance.rows, payments: payments.rows, notes: notes.rows } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role !== 'admin' && parseInt(result.rows[0].section_id) !== parseInt(req.user.section_id))
      return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { section_id, student_id, first_name, last_name, middle_name, gender, contact_number, email, address, is_shifty, _user } = req.body;
    if (!section_id || !student_id || !first_name || !last_name)
      return res.status(400).json({ success: false, message: 'Required: section_id, student_id, first_name, last_name' });
    if (req.user.role !== 'admin' && parseInt(section_id) !== parseInt(req.user.section_id))
      return res.status(403).json({ success: false, message: 'Access denied' });
    const result = await pool.query(
      `INSERT INTO students (section_id,student_id,first_name,last_name,middle_name,gender,contact_number,email,address,is_shifty) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [section_id, student_id, first_name, last_name, middle_name||null, gender||null, contact_number||null, email||null, address||null, is_shifty||false]
    );
    if (_user) await logActivity(pool, section_id, _user.id, _user.name, `Added student ${first_name} ${last_name}`, 'student', `${first_name} ${last_name}`);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, message: 'Student ID already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/bulk-import', async (req, res) => {
  const client = await pool.connect();
  try {
    const { section_id, students, _user } = req.body;
    if (!section_id || !Array.isArray(students)) return res.status(400).json({ success: false, message: 'section_id and students array required' });
    if (req.user.role !== 'admin' && parseInt(section_id) !== parseInt(req.user.section_id))
      return res.status(403).json({ success: false, message: 'Access denied' });
    await client.query('BEGIN');
    let imported = 0, skipped = 0, errors = [];
    for (const s of students) {
      if (!s.student_id || !s.first_name || !s.last_name) { skipped++; errors.push(`Skipped row: missing required fields`); continue; }
      try {
        await client.query(
          `INSERT INTO students (section_id,student_id,first_name,last_name,gender,contact_number) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id) DO NOTHING`,
          [section_id, s.student_id, s.first_name, s.last_name, s.gender||null, s.contact_number||null]
        );
        imported++;
      } catch(e) { skipped++; errors.push(`${s.student_id}: ${e.message}`); }
    }
    await client.query('COMMIT');
    if (_user) await logActivity(pool, section_id, _user.id, _user.name, `Bulk imported ${imported} students`, 'student', `${imported} students`);
    res.json({ success: true, imported, skipped, errors: errors.slice(0, 10) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: err.message });
  } finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  try {
    const { first_name, last_name, middle_name, gender, contact_number, email, address, is_shifty, _user, section_id } = req.body;
    if (req.user.role !== 'admin' && parseInt(section_id) !== parseInt(req.user.section_id))
      return res.status(403).json({ success: false, message: 'Access denied' });
    const result = await pool.query(
      `UPDATE students SET first_name=$1,last_name=$2,middle_name=$3,gender=$4,contact_number=$5,email=$6,address=$7,is_shifty=$8 WHERE id=$9 RETURNING *`,
      [first_name, last_name, middle_name||null, gender||null, contact_number||null, email||null, address||null, is_shifty||false, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (_user) await logActivity(pool, section_id, _user.id, _user.name, `Updated student ${first_name} ${last_name}`, 'student', `${first_name} ${last_name}`);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const s = await pool.query('SELECT * FROM students WHERE id=$1', [req.params.id]);
    if (s.rows.length && req.user.role !== 'admin' && parseInt(s.rows[0].section_id) !== parseInt(req.user.section_id))
      return res.status(403).json({ success: false, message: 'Access denied' });
    await pool.query('DELETE FROM students WHERE id=$1', [req.params.id]);
    if (s.rows.length && req.body && req.body._user) {
      const { _user, section_id } = req.body;
      await logActivity(pool, section_id, _user.id, _user.name, `Deleted student ${s.rows[0].first_name} ${s.rows[0].last_name}`, 'student', `${s.rows[0].first_name} ${s.rows[0].last_name}`);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/notes', async (req, res) => {
  try {
    const { note, note_type, created_by } = req.body;
    const result = await pool.query(`INSERT INTO student_notes (student_id,note,note_type,created_by) VALUES ($1,$2,$3,$4) RETURNING *`, [req.params.id, note, note_type||'general', created_by||null]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    await pool.query('DELETE FROM student_notes WHERE id=$1 AND student_id=$2', [req.params.noteId, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
