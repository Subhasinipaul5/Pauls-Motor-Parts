const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const Cart    = require('../models/Cart');
const { sendEmail } = require('../utils/email');
const { auth } = require('../middleware/auth');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── EMERGENCY ADMIN RESET (fixes corrupted hash in DB without restart) ──
// Secured by a secret key so only the real owner can call it.
router.post('/reset-admin', async (req, res) => {
  try {
    const { secret } = req.body;
    // Secret key — change this if you want extra security
    if (secret !== 'pauls-reset-2026') {
      return res.status(403).json({ success: false, message: 'Invalid secret' });
    }
    const ADMIN_EMAIL = 'paulsubhasini31@gmail.com';
    const ADMIN_PASS  = 'Admin@123';
    const hash = await bcrypt.hash(ADMIN_PASS, 12);
    const result = await User.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      { password: hash, role: 'admin', isVerified: true },
      { new: true, upsert: true, setDefaultsOnInsert: true,
        // Supply required fields for upsert case
        overwrite: false }
    );
    if (!result) {
      // upsert failed — create fresh
      await User.create({ firstName:'Paul', lastName:'Admin', email:ADMIN_EMAIL,
        phone:'9000000000', password: ADMIN_PASS, role:'admin', isVerified:true });
    }
    res.json({ success: true, message: `Admin password reset to Admin@123 for ${ADMIN_EMAIL}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── REGISTER ─────────────────────────────────────────────────
// Users are auto-verified immediately so login always works,
// even if the email service (Brevo) isn't configured yet.
// A welcome email is still attempted in the background (best-effort).
router.post('/register', async (req, res) => {
  try {
    // Safe extraction — never let undefined slip through to Mongoose
    const firstName = String(req.body.firstName || '').trim();
    const lastName  = String(req.body.lastName  || '').trim() || '-';
    const email     = String(req.body.email     || '').trim().toLowerCase();
    const phone     = String(req.body.phone     || '').trim();
    const password  = String(req.body.password  || '');

    // Validate each field individually with clear messages
    if (!firstName) return res.status(400).json({ success: false, message: 'First name is required.' });
    if (!email)     return res.status(400).json({ success: false, message: 'Email is required.' });
    if (!phone)     return res.status(400).json({ success: false, message: 'Phone number is required.' });
    if (!password)  return res.status(400).json({ success: false, message: 'Password is required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ success: false, message: 'This email is already registered. Please log in instead.' });

    // Create user — all fields are guaranteed non-empty strings at this point
    const user = await User.create({ firstName, lastName, email, phone, password, isVerified: true });
    await Cart.create({ user: user._id, items: [] });

    // Best-effort welcome email — never blocks registration
    sendEmail({ to: email, subject: 'Welcome to Pauls Motor Parts! 🔧',
      html: `<div style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;max-width:600px;margin:auto;border-radius:12px;">
        <h2 style="color:#4ade80;">Welcome, ${firstName}! 🔧</h2>
        <p style="color:#aaa;">Your account is ready. Start browsing genuine auto parts now!</p>
      </div>`
    }).catch(() => {});

    const token = signToken(user._id);
    return res.json({
      success: true,
      message: 'Account created successfully! You are now logged in.',
      token,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
      cart: []
    });
  } catch (err) {
    // Convert ALL errors to friendly messages — never expose Mongoose internals
    let msg = 'Registration failed. Please try again.';
    if (err.code === 11000)           msg = 'This email is already registered. Please log in instead.';
    else if (err.name === 'ValidationError') msg = 'Please fill in all required fields correctly.';
    return res.status(400).json({ success: false, message: msg });
  }
});

// ── EMAIL VERIFY (optional link, kept for completeness) ──────
router.get('/verify/:token', async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.send('<h2 style="font-family:sans-serif;text-align:center;margin-top:80px;color:red;">Invalid or expired link</h2>');
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    res.redirect(`${process.env.BASE_URL || ''}/?verified=1`);
  } catch { res.send('<h2 style="font-family:sans-serif;text-align:center;margin-top:80px;">Error</h2>'); }
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(400).json({ success: false, message: 'No account found with this email' });

    const match = await user.comparePassword(password);
    if (!match)
      return res.status(400).json({ success: false, message: 'Incorrect password' });

    // Auto-heal any legacy unverified accounts so nobody gets locked out
    if (!user.isVerified) { user.isVerified = true; await user.save(); }

    const token = signToken(user._id);
    const cart  = await Cart.findOne({ user: user._id });
    res.json({
      success: true,
      token,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
      cart: cart?.items || []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── FORGOT PASSWORD ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: (req.body.email||'').toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with that email' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken   = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const link = `${process.env.BASE_URL}/?reset=${token}`;
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset - Pauls Motor Parts',
        html: `<div style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;border-radius:12px;max-width:600px;margin:auto;">
          <h2 style="color:#f97316;">Password Reset</h2>
          <p style="color:#aaa;">Hi ${user.firstName}, click below to reset your password. Expires in 1 hour.</p>
          <a href="${link}" style="display:inline-block;margin:20px 0;padding:14px 32px;background:#f97316;color:#000;font-weight:700;text-decoration:none;border-radius:8px;">Reset Password</a>
        </div>`
      });
      res.json({ success: true, message: 'Reset link sent to your email' });
    } catch (emailErr) {
      // Email failed — still let them know the token exists, just inform them
      res.status(500).json({ success: false, message: 'Could not send email. Please contact support or try again later.' });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── RESET PASSWORD ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Token invalid or expired' });
    if (!password || password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    user.password = password;
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── CHANGE PASSWORD (authenticated) ───────────────────────────
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/me', auth, (req, res) => res.json({ success: true, user: req.user }));

module.exports = router;
