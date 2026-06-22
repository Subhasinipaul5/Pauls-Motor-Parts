const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');
const Cart    = require('../models/Cart');
const { auth, adminAuth } = require('../middleware/auth');

// User: get my orders
router.get('/my', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// User: place order
router.post('/place', auth, async (req, res) => {
  try {
    const { paymentMethod, notes, customerInfo, items } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    const orderItems = items || cart?.items || [];
    if (!orderItems.length) return res.status(400).json({ success: false, message: 'Cart is empty' });

    const totalAmount   = orderItems.reduce((s,i) => s + i.price * i.quantity, 0);
    const discountAmount= orderItems.reduce((s,i) => s + (i.price - i.discountedPrice) * i.quantity, 0);
    const finalAmount   = orderItems.reduce((s,i) => s + i.discountedPrice * i.quantity, 0);

    const order = await Order.create({
      user: req.user._id, items: orderItems,
      totalAmount, discountAmount, finalAmount,
      payment: { method: paymentMethod || 'cod', status: 'pending' },
      customerInfo: customerInfo || { name: req.user.firstName+' '+req.user.lastName, email: req.user.email },
      notes
    });
    if (cart) { cart.items = []; await cart.save(); }
    res.json({ success: true, order, message: 'Order placed successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: get all orders
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate('user', 'firstName lastName email phone');
    res.json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: update order status — support both PUT routes
router.put('/admin/:id', adminAuth, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Cart sync
router.post('/cart/sync', auth, async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: req.body.items || [] }, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/cart', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    res.json({ success: true, items: cart?.items || [] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
