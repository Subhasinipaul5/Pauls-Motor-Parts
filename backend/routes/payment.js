const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const { auth } = require('../middleware/auth');

let Razorpay;
try { Razorpay = require('razorpay'); } catch(e) {}

router.post('/create-order', auth, async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const isConfigured = Razorpay && keyId && !keyId.includes('XXXX');
    if (!isConfigured) {
      return res.json({ success: false, message: 'Razorpay not configured. Using WhatsApp order instead.' });
    }
    const rzp = new Razorpay({ key_id: keyId, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const { amount } = req.body;
    const options = { amount: Math.round(amount * 100), currency: 'INR', receipt: 'pmp_' + Date.now() };
    const order = await rzp.orders.create(options);
    res.json({ success: true, order, key: keyId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;
    const sign = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret').update(sign).digest('hex');
    if (expectedSign !== razorpaySignature)
      return res.status(400).json({ success: false, message: 'Payment verification failed' });

    await Order.findByIdAndUpdate(orderId, {
      'payment.razorpayOrderId': razorpayOrderId,
      'payment.razorpayPaymentId': razorpayPaymentId,
      'payment.razorpaySignature': razorpaySignature,
      'payment.status': 'paid',
      status: 'confirmed'
    });
    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
