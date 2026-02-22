# 🎓 ClassTrack — Student Management System

A full-featured student management system for tracking attendance, fees, and payments for your section.

## ✨ Features

- **Dashboard** — Overview of students, attendance, and fee collection stats
- **Student Management** — Add, edit, delete students with all details
- **Attendance Tracking** — Create sessions, take attendance (Present/Absent/Late/Excused)
- **Fee Management** — Add custom fee types (SSG Membership, Miscellaneous, etc.)
- **Payment Status** — See all students' paid/unpaid status at a glance, click to toggle
- **PDF Export** — Export any report as a PDF for printing
- **Mobile Responsive** — Works great on phones and tablets
- **Multiple Sections** — Manage multiple class sections

---

## 🚀 Running Locally in Termux

### Step 1: Install dependencies
```bash
pkg install nodejs postgresql
```

### Step 2: Setup PostgreSQL
```bash
# Start postgres
pg_ctl -D $PREFIX/var/lib/postgresql start

# Create database
createdb student_management
```

### Step 3: Configure environment
```bash
cd backend
cp .env.example .env
# Edit .env and set:
# DATABASE_URL=postgresql://localhost/student_management
```

### Step 4: Install Node packages & start
```bash
# From project root
npm install

# Start the server
npm start
```

### Step 5: Open in browser
```
http://localhost:3000
```

---

## ☁️ FREE Deployment (Recommended: Railway)

Railway gives you a **free PostgreSQL database + free hosting** in one place. Best option!

### Deploy to Railway (Free)

1. **Create account** at [railway.app](https://railway.app) (free with GitHub)

2. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # Create repo on github.com, then:
   git remote add origin https://github.com/YOUR_USERNAME/classtrack.git
   git push -u origin main
   ```

3. **Deploy on Railway**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect Node.js

4. **Add PostgreSQL**
   - In your Railway project, click "+ New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL` environment variable

5. **Your site is live!** Railway gives you a `.railway.app` URL

---

### Alternative: Render (Also Free)

1. Create account at [render.com](https://render.com)
2. New → Web Service → Connect GitHub repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add PostgreSQL: New → PostgreSQL (free tier)
6. Copy the `DATABASE_URL` from Render PostgreSQL → add as environment variable

---

## 📁 Project Structure

```
classtrack/
├── backend/
│   ├── server.js          # Express server
│   ├── db/
│   │   └── database.js    # PostgreSQL connection + auto-setup
│   └── routes/
│       ├── sections.js    # Section management API
│       ├── students.js    # Student management API
│       ├── fees.js        # Fee types & payments API
│       └── attendance.js  # Attendance tracking API
├── frontend/
│   ├── index.html         # Main app shell
│   ├── css/
│   │   └── styles.css     # All styles (responsive)
│   └── js/
│       ├── api.js         # API helper functions
│       ├── utils.js       # Toast, modal, PDF export utilities
│       ├── app.js         # App routing & state
│       ├── dashboard.js   # Dashboard page
│       ├── students.js    # Students page
│       ├── attendance.js  # Attendance page
│       ├── fees.js        # Fees page
│       └── sections.js    # Sections & fee types settings
├── package.json
└── README.md
```

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/sections | List all sections |
| POST | /api/sections | Create section |
| GET | /api/students/section/:id | Get students in section |
| POST | /api/students | Add student |
| GET | /api/fees/types/section/:id | Get fee types |
| POST | /api/fees/types | Create fee type |
| GET | /api/fees/status/section/:id | Get paid/unpaid status |
| POST | /api/fees/pay | Record payment |
| DELETE | /api/fees/pay/:sid/:fid | Remove payment |
| GET | /api/attendance/sessions/section/:id | List sessions |
| POST | /api/attendance/sessions | Create session |
| POST | /api/attendance/sessions/:id/records | Save attendance |

---

## 💡 Tips

- **First time setup**: Go to Settings → Sections → Create your section
- **Adding fees**: Go to Settings → Fee Types → Add fees like "SSG Membership ₱50"
- **Taking attendance**: Click "+ New Session", set the date, then mark each student
- **Export reports**: Click the "📄 PDF" button on any page to download a printable report
