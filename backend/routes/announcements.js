const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireSameSection } = require('../middleware/auth');

router.use(requireAuth);

router.get('/section/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM announcements WHERE section_id=$1 ORDER BY created_at DESC`,
      [req.params.sectionId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { section_id, title, content, due_date, priority, created_by } = req.body;
    if (!section_id || !title) return res.status(400).json({ success: false, message: 'section_id and title required' });
    const result = await pool.query(
      `INSERT INTO announcements (section_id, title, content, due_date, priority, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [section_id, title, content||null, due_date||null, priority||'normal', created_by||null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, content, due_date, priority } = req.body;
    const result = await pool.query(
      `UPDATE announcements SET title=$1, content=$2, due_date=$3, priority=$4 WHERE id=$5 RETURNING *`,
      [title, content||null, due_date||null, priority||'normal', req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM announcements WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
