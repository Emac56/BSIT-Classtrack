// ============ AUTH MIDDLEWARE ============
// Verifies JWT token on every protected API route

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'classtrack-secret-change-in-production-2024';

/**
 * requireAuth — attach this to any route that needs login.
 * Reads the Bearer token from Authorization header,
 * verifies it, and puts the decoded user in req.user.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized — please log in' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, section_id }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired — please log in again' });
  }
}

/**
 * requireAdmin — only allow admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

/**
 * requireSameSection — make sure the user can only access their own section's data.
 * Checks if sectionId param/body matches req.user.section_id (admins bypass).
 */
function requireSameSection(sectionIdGetter) {
  return (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next(); // admins see all
    const requestedSectionId = parseInt(sectionIdGetter(req));
    const userSectionId = parseInt(req.user && req.user.section_id);
    if (!requestedSectionId || !userSectionId || requestedSectionId !== userSectionId) {
      return res.status(403).json({ success: false, message: 'Access denied — wrong section' });
    }
    next();
  };
}

module.exports = { requireAuth, requireAdmin, requireSameSection, JWT_SECRET };
