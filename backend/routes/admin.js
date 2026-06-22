const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { adminAuth } = require('../middleware/auth');

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [totalProducts, totalOrders, totalUsers, recentOrders] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      User.countDocuments({ role: 'user' }),
      Order.find().sort({ createdAt: -1 }).limit(8).populate('user', 'firstName lastName email phone')
    ]);
    const revenue = await Order.aggregate([
      { $match: { 'payment.status': 'paid' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);
    res.json({ success: true, stats: { totalProducts, totalOrders, totalUsers, revenue: revenue[0]?.total || 0 }, recentOrders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['user', 'admin'] } }).select('-password').sort({ createdAt: -1 });
    // Fix undefined/missing names inline before sending
    users.forEach(u => {
      if (!u.firstName || u.firstName === 'undefined') u.firstName = '';
      if (!u.lastName  || u.lastName  === 'undefined' || u.lastName === '-') u.lastName = '';
    });
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Payments breakdown — revenue by method/status + full payment ledger
router.get('/payments', adminAuth, async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate('user', 'firstName lastName email phone');

    const byMethod = {};
    const byStatus = { paid: 0, pending: 0, failed: 0, refunded: 0 };
    let totalCollected = 0;

    orders.forEach(o => {
      const method = o.payment?.method || 'unknown';
      const status = o.payment?.status || 'pending';
      byMethod[method] = (byMethod[method] || 0) + (o.finalAmount || 0);
      byStatus[status] = (byStatus[status] || 0) + (o.finalAmount || 0);
      if (status === 'paid') totalCollected += (o.finalAmount || 0);
    });

    res.json({
      success: true,
      summary: { byMethod, byStatus, totalCollected, totalOrders: orders.length },
      payments: orders.map(o => ({
        orderId: o.orderId,
        customer: o.user ? `${o.user.firstName} ${o.user.lastName}` : (o.customerInfo?.name || 'Guest'),
        phone: o.user?.phone || o.customerInfo?.phone || '—',
        amount: o.finalAmount,
        method: o.payment?.method || '—',
        status: o.payment?.status || 'pending',
        razorpayPaymentId: o.payment?.razorpayPaymentId || null,
        createdAt: o.createdAt
      }))
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ── BULK FIX — patch all users with undefined/missing names ──
router.post('/fix-users', adminAuth, async (req, res) => {
  try {
    // Set isVerified=true for all unverified users so they can log in
    const r1 = await User.updateMany({ isVerified: { $ne: true } }, { $set: { isVerified: true } });
    // Fix undefined firstName
    const r2 = await User.updateMany(
      { $or: [{ firstName: { $exists: false } }, { firstName: '' }, { firstName: 'undefined' }] },
      { $set: { firstName: 'User' } }
    );
    res.json({ success: true, message: `Fixed ${r1.modifiedCount} unverified + ${r2.modifiedCount} unnamed users` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── RESET USER PASSWORD ──────────────────────────────────────
router.post('/reset-password/:id', adminAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = password;   // pre-save hook bcrypt-hashes it
    user.isVerified = true;     // also verify them so they can log in
    await user.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ── DELETE USER ──────────────────────────────────────────────
router.delete('/delete-user/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete an admin account' });
    await User.findByIdAndDelete(req.params.id);
    // Also remove their cart
    try { await require('../models/Cart').deleteOne({ user: req.params.id }); } catch {}
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Accept POST too (easier from browser fetch)
router.post('/delete-user/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete an admin account' });
    await User.findByIdAndDelete(req.params.id);
    try { await require('../models/Cart').deleteOne({ user: req.params.id }); } catch {}
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── MAKE ADMIN ───────────────────────────────────────────────
router.post('/make-admin/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.role = 'admin';
    user.isVerified = true;
    await user.save();
    res.json({ success: true, message: `${user.email} is now an admin` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
