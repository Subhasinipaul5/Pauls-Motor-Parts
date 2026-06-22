const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Please log in to continue.' });

    const token = header.split(' ')[1];
    if (!token)
      return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Please log in to continue.' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verifyErr) {
      const code = verifyErr.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      const msg  = verifyErr.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Your session is no longer valid. Please log in again.';
      return res.status(401).json({ success: false, code, message: msg });
    }

    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user)
      return res.status(401).json({ success: false, code: 'USER_NOT_FOUND', message: 'Your account could not be found. Please log in again.' });

    next();
  } catch (err) {
    res.status(401).json({ success: false, code: 'AUTH_ERROR', message: 'Authentication error. Please log in again.' });
  }
};

const adminAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, code: 'NOT_ADMIN', message: 'Admin access required' });
    next();
  });
};

module.exports = { auth, adminAuth };
