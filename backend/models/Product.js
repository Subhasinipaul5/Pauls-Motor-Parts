const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, sparse: true },
  description: { type: String, required: true },
  shortDescription: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  discountedPrice: { type: Number },
  hasDiscount: { type: Boolean, default: false },
  category: { type: String, required: true },
  subcategory: { type: String, default: '' },
  brand: { type: String, default: '' },
  partNumber: { type: String, default: '' },
  compatibility: [String],
  images: [String],
  stock: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  tags: [String],
  specifications: [{ key: String, value: String }],
  ratings: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } }
}, { timestamps: true });

productSchema.pre('save', function(next) {
  this.hasDiscount = this.discountPercent > 0;
  this.discountedPrice = this.hasDiscount
    ? Math.round(this.price * (1 - this.discountPercent / 100))
    : this.price;
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
