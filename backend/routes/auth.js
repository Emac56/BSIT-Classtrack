const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAuth, requireSameSection, JWT_SECRET } = require('../middleware/auth');

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, section_id: user.section_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function sha256(password) { return crypto.createHash('sha256').update(password).digest('hex'); }
function isBcrypt(hash) { return hash && hash.startsWith('$2'); }

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, full_name, role, section_code, section_name, school_year, adviser } = req.body;
    if (!username || !password || !full_name || !role)
      return res.status(400).json({ success: false, message: 'All fields required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const isLeader = ['president', 'vice_president'].includes(role);
    let section_id = null;

    if (isLeader && section_code) {
      const sr = await pool.query('SELECT * FROM sections WHERE code=$1', [section_code]);
      if (!sr.rows.length) return res.status(400).json({ success: false, message: 'Invalid section code' });
      section_id = sr.rows[0].id;
    } else if (isLeader && section_name && school_year) {
      const code = section_name.replace(/\s+/g,'').toUpperCase().slice(0,6) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const sr = await pool.query(`INSERT INTO sections (name,school_year,adviser,code) VALUES ($1,$2,$3,$4) RETURNING *`, [section_name, school_year, adviser||null, code]);
      section_id = sr.rows[0].id;
    } else if (isLeader) {
      return res.status(400).json({ success: false, message: 'Provide section details or code' });
    } else if (section_code) {
      const sr = await pool.query('SELECT * FROM sections WHERE code=$1', [section_code]);
      if (!sr.rows.length) return res.status(400).json({ success: false, message: 'Invalid section code' });
      section_id = sr.rows[0].id;
    }

    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username,password_hash,full_name,role,section_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,username,full_name,role,section_id`,
      [username, hashed, full_name, role, section_id]
    );

    let section = null;
    if (section_id) { const s = await pool.query('SELECT * FROM sections WHERE id=$1', [section_id]); section = s.rows[0]; }
    const user = { ...result.rows[0], section_name: section?.name, section_code: section?.code, school_year: section?.school_year, section_adviser: section?.adviser };
    const token = signToken(user);
    res.status(201).json({ success: true, data: user, token });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, message: 'Username already taken' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username and password required' });

    const result = await pool.query(
      `SELECT u.*, s.name as section_name, s.code as section_code, s.school_year, s.adviser as section_adviser, s.collection_target
       FROM users u LEFT JOIN sections s ON s.id=u.section_id WHERE u.username=$1`,
      [username]
    );
    if (!result.rows.length)
      return res.status(401).json({ success: false, message: 'Invalid username or password' });

    const row = result.rows[0];
    let passwordMatch = false;

    if (isBcrypt(row.password_hash)) {
      passwordMatch = await bcrypt.compare(password, row.password_hash);
    } else {
      // Legacy SHA-256 — verify then silently upgrade to bcrypt
      passwordMatch = sha256(password) === row.password_hash;
      if (passwordMatch) {
        const newHash = await bcrypt.hash(password, 12);
        await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [newHash, row.id]);
      }
    }

    if (!passwordMatch)
      return res.status(401).json({ success: false, message: 'Invalid username or password' });

    const user = { ...row };
    delete user.password_hash;
    const token = signToken(user);
    res.json({ success: true, data: user, token });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/auth/section-info/:code (public — for registration)
router.get('/section-info/:code', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, school_year, adviser FROM sections WHERE code=$1', [req.params.code]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Invalid section code' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/auth/members/:sectionId (protected)
router.get('/members/:sectionId', requireAuth, requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, role, created_at FROM users WHERE section_id=$1 ORDER BY created_at`,
      [req.params.sectionId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/auth/change-password (protected)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { user_id, old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ success: false, message: 'All fields required' });
    if (new_password.length < 6) return res.status(400).json({ success: false, message: 'Min 6 characters' });
    if (req.user.id !== parseInt(user_id) && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Access denied' });

    const check = await pool.query('SELECT password_hash FROM users WHERE id=$1', [user_id]);
    if (!check.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    const storedHash = check.rows[0].password_hash;
    let oldMatch = isBcrypt(storedHash) ? await bcrypt.compare(old_password, storedHash) : sha256(old_password) === storedHash;
    if (!oldMatch) return res.status(400).json({ success: false, message: 'Current password incorrect' });

    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [newHash, user_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/auth/reset-request (public)
router.post('/reset-request', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
    if (!user.rows.length) return res.status(404).json({ success: false, message: 'Username not found' });
    await pool.query('INSERT INTO password_reset_requests (user_id) VALUES ($1)', [user.rows[0].id]);
    res.json({ success: true, message: 'Reset request sent. Contact your admin.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
