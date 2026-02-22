const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { initDB } = require('./db/database');
const { JWT_SECRET, requireAuth, requireSameSection } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const sectionsRouter = require('./routes/sections');
const studentsRouter = require('./routes/students');
const feesRouter = require('./routes/fees');
const attendanceRouter = require('./routes/attendance');
const announcementsRouter = require('./routes/announcements');
const adminRouter = require('./routes/admin');
const chatRouter = require('./routes/chat');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ---- CORS ----
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5000'];

app.use(cors({
  origin: true,        
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Rate Limiting ----
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' } });
const apiLimiter = rateLimit({ windowMs: 60*1000, max: 300, message: { success: false, message: 'Too many requests.' } });
app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// ---- Static Frontend ----
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// ---- API Routes ----
app.use('/api/auth', authRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/fees', feesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ---- Dashboard (protected) ----
app.get('/api/dashboard/:sectionId', requireAuth, requireSameSection(req => req.params.sectionId), async (req, res) => {
  const { pool } = require('./db/database');
  try {
    const sid = req.params.sectionId;
    const todayDate = new Date().toISOString().split('T')[0];
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const [students, todaySess, collToday, collWeek, monthlyColl, collYear, unpaid, atRisk, recentLogs, announcements] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM students WHERE section_id=$1', [sid]),
      pool.query(`SELECT s.*, SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as present_count, SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END) as absent_count FROM attendance_sessions s LEFT JOIN attendance_records ar ON ar.session_id=s.id WHERE s.section_id=$1 AND s.date=$2 GROUP BY s.id`, [sid, todayDate]),
      pool.query(`SELECT COALESCE(SUM(fp.amount_paid),0) as total FROM fee_payments fp JOIN fee_types ft ON ft.id=fp.fee_type_id WHERE ft.section_id=$1 AND fp.payment_date::date=$2`, [sid, todayDate]),
      pool.query(`SELECT COALESCE(SUM(fp.amount_paid),0) as total FROM fee_payments fp JOIN fee_types ft ON ft.id=fp.fee_type_id WHERE ft.section_id=$1 AND fp.payment_date::date>=$2`, [sid, weekStartStr]),
      pool.query(`SELECT COALESCE(SUM(fp.amount_paid),0) as total FROM fee_payments fp JOIN fee_types ft ON ft.id=fp.fee_type_id WHERE ft.section_id=$1 AND EXTRACT(MONTH FROM fp.payment_date)=$2 AND EXTRACT(YEAR FROM fp.payment_date)=$3`, [sid, month, year]),
      pool.query(`SELECT COALESCE(SUM(fp.amount_paid),0) as total FROM fee_payments fp JOIN fee_types ft ON ft.id=fp.fee_type_id WHERE ft.section_id=$1 AND EXTRACT(YEAR FROM fp.payment_date)=$2`, [sid, year]),
      pool.query(`SELECT COUNT(DISTINCT st.id) as count FROM students st JOIN fee_types ft ON ft.section_id=st.section_id LEFT JOIN fee_payments fp ON fp.student_id=st.id AND fp.fee_type_id=ft.id WHERE st.section_id=$1 AND fp.id IS NULL`, [sid]),
      pool.query(`SELECT st.id, st.first_name, st.last_name, COUNT(ar.id) as absent_count FROM students st JOIN attendance_records ar ON ar.student_id=st.id JOIN attendance_sessions sess ON sess.id=ar.session_id WHERE sess.section_id=$1 AND ar.status='absent' GROUP BY st.id HAVING COUNT(ar.id)>=3 ORDER BY absent_count DESC LIMIT 5`, [sid]),
      pool.query(`SELECT * FROM activity_logs WHERE section_id=$1 ORDER BY created_at DESC LIMIT 5`, [sid]),
      pool.query(`SELECT * FROM announcements WHERE section_id=$1 ORDER BY created_at DESC LIMIT 5`, [sid]),
    ]);
    res.json({ success: true, total_students: parseInt(students.rows[0].count), today_sessions: todaySess.rows, collected_today: parseFloat(collToday.rows[0].total), collected_week: parseFloat(collWeek.rows[0].total), monthly_collected: parseFloat(monthlyColl.rows[0].total), collected_year: parseFloat(collYear.rows[0].total), students_unpaid: parseInt(unpaid.rows[0].count), at_risk: atRisk.rows, recent_logs: recentLogs.rows, announcements: announcements.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ---- Socket.IO — Real-time Chat ----
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'], // ← DAGDAG ITO
  allowEIO3: true                        // ← AT ITO
});

// Auth middleware for socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch(e) { next(new Error('Invalid token')); }
});

const { pool } = require('./db/database');

io.on('connection', (socket) => {
  const user = socket.user;
  const sectionRoom = `section_${user.section_id}`;

  // Join the section's chat room
  socket.join(sectionRoom);
  console.log(`💬 ${user.username} joined chat room: ${sectionRoom}`);

  // Send message
  socket.on('chat:send', async (data) => {
    try {
      const msg = (data.message || '').trim();
      if (!msg || msg.length > 1000) return;

      const result = await pool.query(
        `INSERT INTO chat_messages (section_id, user_id, user_name, user_role, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [user.section_id, user.id, user.username, user.role, msg]
      );

      const saved = result.rows[0];
      // Broadcast to everyone in the section room (including sender)
      io.to(sectionRoom).emit('chat:message', saved);
    } catch(e) {
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  });

  // Delete message
  socket.on('chat:delete', async (data) => {
    try {
      const msgRow = await pool.query('SELECT * FROM chat_messages WHERE id=$1', [data.id]);
      if (!msgRow.rows.length) return;
      const msg = msgRow.rows[0];
      // Only own messages or admin
      if (user.role !== 'admin' && msg.user_id !== user.id) return;
      await pool.query('DELETE FROM chat_messages WHERE id=$1', [data.id]);
      io.to(sectionRoom).emit('chat:deleted', { id: data.id });
    } catch(e) {}
  });

  // Typing indicator
  socket.on('chat:typing', () => {
    socket.to(sectionRoom).emit('chat:typing', { username: user.username });
  });

  socket.on('disconnect', () => {
    console.log(`💬 ${user.username} left chat`);
  });
});

// ---- Frontend routes ----
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(frontendPath, 'admin.html')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const startServer = async () => {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`🚀 ClassTrack v7.2 running on http://localhost:${PORT}`);
      console.log(`💬 Real-time chat enabled (socket.io)`);
      console.log(`🔒 JWT auth & bcrypt enabled`);
    });
  } catch (err) { console.error('❌ Failed to start:', err.message); process.exit(1); }
};

startServer();
