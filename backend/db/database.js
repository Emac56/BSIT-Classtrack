const { Pool } = require('pg');
require('dotenv').config();

const isCloud = process.env.DATABASE_URL && process.env.NODE_ENV === 'production';

const pool = new Pool(
  isCloud
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { database: process.env.DB_NAME || 'student_management', user: process.env.DB_USER || undefined }
);

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        school_year VARCHAR(20) NOT NULL,
        adviser VARCHAR(100),
        code VARCHAR(20) UNIQUE,
        collection_target DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(64) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        role VARCHAR(30) NOT NULL CHECK (role IN ('admin','president','vice_president','treasurer','auditor','secretary','officer')),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
        student_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        middle_name VARCHAR(100),
        gender VARCHAR(10),
        contact_number VARCHAR(20),
        email VARCHAR(150),
        address TEXT,
        is_shifty BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS student_notes (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        note_type VARCHAR(30) DEFAULT 'general',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS fee_types (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        due_date DATE,
        is_mandatory BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS fee_type_students (
        fee_type_id INTEGER REFERENCES fee_types(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        PRIMARY KEY (fee_type_id, student_id)
      );
      CREATE TABLE IF NOT EXISTS fee_payments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        fee_type_id INTEGER REFERENCES fee_types(id) ON DELETE CASCADE,
        amount_paid DECIMAL(10,2) NOT NULL,
        payment_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, fee_type_id)
      );
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        subject VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(section_id, date, subject)
      );
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
        notes TEXT,
        UNIQUE(session_id, student_id)
      );
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        due_date DATE,
        priority VARCHAR(20) DEFAULT 'normal',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        section_id INTEGER,
        user_id INTEGER,
        user_name VARCHAR(150),
        action TEXT NOT NULL,
        entity_type VARCHAR(50),
        entity_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(150),
        user_role VARCHAR(30),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE fee_types ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT true;
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS code VARCHAR(20);
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS collection_target DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS is_shifty BOOLEAN DEFAULT false;
      ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    const bcrypt = require('bcryptjs');
    const adminHash = await bcrypt.hash('admin123', 12);
    await client.query(`
      INSERT INTO users (username, password_hash, full_name, role, section_id)
      VALUES ('admin', $1, 'System Admin', 'admin', NULL)
      ON CONFLICT (username) DO NOTHING
    `, [adminHash]);
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
