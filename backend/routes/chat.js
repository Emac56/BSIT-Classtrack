const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireSameSection } = require('../middleware/auth');

router.use(requireAuth);

// GET last 50 messages for a section
router.get('/section/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM chat_messages WHERE section_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.sectionId]
    );
    res.json({ success: true, data: result.rows.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST a message (REST fallback — socket.io is primary)
router.post('/', async (req, res) => {
  try {
    const { section_id, message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message required' });
    if (req.user.role !== 'admin' && parseInt(section_id) !== parseInt(req.user.section_id))
      return res.status(403).json({ success: false, message: 'Access denied' });
    const result = await pool.query(
      `INSERT INTO chat_messages (section_id, user_id, user_name, user_role, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [section_id, req.user.id, req.user.username, req.user.role, message.trim()]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE a message (own only, or admin)
router.delete('/:id', async (req, res) => {
  try {
    const msg = await pool.query('SELECT * FROM chat_messages WHERE id=$1', [req.params.id]);
    if (!msg.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role !== 'admin' && msg.rows[0].user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Can only delete your own messages' });
    await pool.query('DELETE FROM chat_messages WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
