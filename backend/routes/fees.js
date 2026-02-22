const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireSameSection } = require('../middleware/auth');

// All fee routes require login
router.use(requireAuth);

async function logActivity(pool, sectionId, userId, userName, action, entityType, entityName) {
  try { await pool.query(`INSERT INTO activity_logs (section_id,user_id,user_name,action,entity_type,entity_name) VALUES ($1,$2,$3,$4,$5,$6)`, [sectionId,userId,userName,action,entityType,entityName]); } catch(e) {}
}

router.get('/types/section/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ft.*, COALESCE(json_agg(fts.student_id) FILTER (WHERE fts.student_id IS NOT NULL), '[]') as assigned_students
       FROM fee_types ft LEFT JOIN fee_type_students fts ON fts.fee_type_id = ft.id
       WHERE ft.section_id = $1 GROUP BY ft.id ORDER BY ft.is_mandatory DESC, ft.created_at`,
      [req.params.sectionId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/types', async (req, res) => {
  const client = await pool.connect();
  try {
    const { section_id, name, amount, description, due_date, is_mandatory, assigned_students, _user } = req.body;
    if (!section_id || !name || !amount) return res.status(400).json({ success: false, message: 'section_id, name, amount required' });
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO fee_types (section_id, name, amount, description, due_date, is_mandatory) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [section_id, name, amount, description||null, due_date||null, is_mandatory !== false]
    );
    const feeTypeId = result.rows[0].id;
    if (assigned_students && assigned_students.length > 0) {
      for (const sid of assigned_students) {
        await client.query(`INSERT INTO fee_type_students (fee_type_id,student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [feeTypeId, sid]);
      }
    }
    await client.query('COMMIT');
    if (_user) await logActivity(pool, section_id, _user.id, _user.name, `Created fee type "${name}"`, 'fee', name);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ success: false, message: err.message }); }
  finally { client.release(); }
});

router.put('/types/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, amount, description, due_date, is_mandatory, assigned_students } = req.body;
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE fee_types SET name=$1, amount=$2, description=$3, due_date=$4, is_mandatory=$5 WHERE id=$6 RETURNING *`,
      [name, amount, description||null, due_date||null, is_mandatory !== false, req.params.id]
    );
    await client.query(`DELETE FROM fee_type_students WHERE fee_type_id=$1`, [req.params.id]);
    if (assigned_students && assigned_students.length > 0) {
      for (const sid of assigned_students) {
        await client.query(`INSERT INTO fee_type_students (fee_type_id,student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, sid]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ success: false, message: err.message }); }
  finally { client.release(); }
});

router.delete('/types/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM fee_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/status/section/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { feeTypeId } = req.query;
    let query = `
      SELECT st.id as student_id, st.student_id as student_number, st.first_name, st.last_name,
        ft.id as fee_type_id, ft.name as fee_name, ft.amount as fee_amount, ft.is_mandatory, ft.due_date,
        fp.id as payment_id, fp.amount_paid, fp.payment_date, fp.notes,
        CASE WHEN fp.id IS NOT NULL THEN 'paid' ELSE 'unpaid' END as status
      FROM fee_types ft
      JOIN students st ON st.section_id = ft.section_id
      LEFT JOIN fee_type_students fts ON fts.fee_type_id = ft.id
      LEFT JOIN fee_payments fp ON fp.student_id = st.id AND fp.fee_type_id = ft.id
      WHERE ft.section_id = $1
        AND (NOT EXISTS (SELECT 1 FROM fee_type_students WHERE fee_type_id = ft.id) OR fts.student_id = st.id)
    `;
    const params = [sectionId];
    if (feeTypeId) { query += ` AND ft.id = $2`; params.push(feeTypeId); }
    query += ` ORDER BY ft.is_mandatory DESC, ft.name, st.last_name, st.first_name`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Monthly collection summary
router.get('/monthly/:sectionId', requireSameSection(req => req.params.sectionId), async (req, res) => {
  try {
    const { month, year } = req.query;
    const result = await pool.query(
      `SELECT ft.name, SUM(fp.amount_paid) as collected, COUNT(fp.id) as payment_count
       FROM fee_payments fp JOIN fee_types ft ON ft.id = fp.fee_type_id
       WHERE ft.section_id=$1
         AND EXTRACT(MONTH FROM fp.payment_date)=COALESCE($2, EXTRACT(MONTH FROM CURRENT_DATE))
         AND EXTRACT(YEAR FROM fp.payment_date)=COALESCE($3, EXTRACT(YEAR FROM CURRENT_DATE))
       GROUP BY ft.name ORDER BY collected DESC`,
      [req.params.sectionId, month||null, year||null]
    );
    const total = await pool.query(
      `SELECT COALESCE(SUM(fp.amount_paid),0) as total FROM fee_payments fp JOIN fee_types ft ON ft.id=fp.fee_type_id
       WHERE ft.section_id=$1 AND EXTRACT(MONTH FROM fp.payment_date)=COALESCE($2,EXTRACT(MONTH FROM CURRENT_DATE)) AND EXTRACT(YEAR FROM fp.payment_date)=COALESCE($3,EXTRACT(YEAR FROM CURRENT_DATE))`,
      [req.params.sectionId, month||null, year||null]
    );
    res.json({ success: true, data: result.rows, total: parseFloat(total.rows[0].total) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/pay', async (req, res) => {
  try {
    const { student_id, fee_type_id, amount_paid, payment_date, notes, _user, section_id } = req.body;
    if (!student_id || !fee_type_id || !amount_paid) return res.status(400).json({ success: false, message: 'Required fields missing' });
    const result = await pool.query(
      `INSERT INTO fee_payments (student_id, fee_type_id, amount_paid, payment_date, notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (student_id, fee_type_id) DO UPDATE SET amount_paid=$3, payment_date=$4, notes=$5 RETURNING *`,
      [student_id, fee_type_id, amount_paid, payment_date||new Date().toISOString().split('T')[0], notes||null]
    );
    const st = await pool.query('SELECT first_name, last_name FROM students WHERE id=$1', [student_id]);
    const ft = await pool.query('SELECT name FROM fee_types WHERE id=$1', [fee_type_id]);
    const sName = st.rows.length ? `${st.rows[0].first_name} ${st.rows[0].last_name}` : '';
    const fName = ft.rows.length ? ft.rows[0].name : '';
    if (_user) await logActivity(pool, section_id, _user.id, _user.name, `${sName} paid ₱${amount_paid} for ${fName}`, 'payment', sName);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/pay/:studentId/:feeTypeId', async (req, res) => {
  try {
    await pool.query('DELETE FROM fee_payments WHERE student_id=$1 AND fee_type_id=$2', [req.params.studentId, req.params.feeTypeId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
