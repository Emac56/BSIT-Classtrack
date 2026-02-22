const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

// GET all sections
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COUNT(st.id) as student_count 
       FROM sections s 
       LEFT JOIN students st ON st.section_id = s.id 
       GROUP BY s.id ORDER BY s.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single section
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sections WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Section not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create section
router.post('/', async (req, res) => {
  try {
    const { name, school_year, adviser } = req.body;
    if (!name || !school_year) return res.status(400).json({ success: false, message: 'Name and school_year required' });
    const result = await pool.query(
      `INSERT INTO sections (name, school_year, adviser) VALUES ($1,$2,$3) RETURNING *`,
      [name, school_year, adviser]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update section
router.put('/:id', async (req, res) => {
  try {
    const { name, school_year, adviser } = req.body;
    const result = await pool.query(
      `UPDATE sections SET name=$1, school_year=$2, adviser=$3 WHERE id=$4 RETURNING *`,
      [name, school_year, adviser, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Section not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE section
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sections WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
