# ClassTrack v7.1 — Security & Bug Fixes

## 🔒 Security Fixes

### 1. JWT Authentication (CRITICAL)
- All API routes now require a valid JWT token in the `Authorization: Bearer <token>` header
- Login and Register return a `token` saved to `localStorage`
- Token expires in 7 days; expired tokens auto-redirect to login page
- Set `JWT_SECRET` in your `.env` file for production!

### 2. bcrypt Password Hashing (CRITICAL)  
- Passwords now hashed with `bcryptjs` (12 rounds) instead of plain SHA-256
- **Backward compatible** — existing SHA-256 passwords still work on first login, then auto-upgraded to bcrypt silently

### 3. Section Isolation
- Users can only access data from their own section
- Admin role bypasses section check (can see all)
- Prevents users from reading other sections' students, fees, attendance

### 4. Admin Route Protection
- All `/api/admin/*` routes now require both login AND admin role

### 5. CORS Restriction
- In production, only origins listed in `ALLOWED_ORIGINS` env var are accepted
- Set `ALLOWED_ORIGINS=https://yourdomain.com` in production `.env`

### 6. Rate Limiting
- Login: max 20 attempts per 15 minutes per IP (brute force protection)
- All API routes: max 300 requests per minute per IP

## 📱 Mobile/UX Fixes

### 7. Modal scroll lock
- Body scroll is locked when a modal is open (prevents background scroll on iOS)

### 8. 360px device support
- Extra compact styles for very small phones (text, padding, button sizes)
- Toast notifications go full-width on mobile
- Search box takes full row on mobile

### 9. Logout clears token
- `doLogout()` now removes both `ct_user` and `ct_token` from localStorage

## 🔧 New Dependencies (run `npm install` in /backend)
- `bcryptjs` — secure password hashing
- `jsonwebtoken` — JWT creation & verification  
- `express-rate-limit` — rate limiting middleware

## Setup

1. `cd backend && npm install`
2. Add to `.env`:
   ```
   JWT_SECRET=your-super-secret-random-string-here
   ALLOWED_ORIGINS=http://localhost:3000
   NODE_ENV=development
   ```
3. `npm start`
