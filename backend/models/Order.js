const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String, image: String,
    price: Number, discountedPrice: Number, quantity: Number
  }],
  totalAmount: Number,
  discountAmount: { type: Number, default: 0 },
  finalAmount: Number,
  payment: {
    method: { type: String, enum: ['razorpay', 'cod', 'whatsapp'], default: 'cod' },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' }
  },
  status: { type: String, enum: ['placed','confirmed','processing','ready','delivered','cancelled'], default: 'placed' },
  customerInfo: { name: String, phone: String, email: String },
  notes: String
}, { timestamps: true });

orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = 'PMP' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2,4).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
