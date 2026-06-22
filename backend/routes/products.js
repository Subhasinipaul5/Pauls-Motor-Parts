const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { adminAuth } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { category, search, featured, brand, sort, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (category && category !== 'All') filter.category = category;
    if (brand) filter.brand = brand;
    if (featured === 'true') filter.isFeatured = true;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { partNumber: { $regex: search, $options: 'i' } },
        { compatibility: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    const sortOptions = { 'price-asc': { discountedPrice: 1 }, 'price-desc': { discountedPrice: -1 }, 'newest': { createdAt: -1 }, 'featured': { isFeatured: -1 } };
    const sortBy = sortOptions[sort] || { createdAt: -1 };
    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortBy).skip(skip).limit(Number(limit)),
      Product.countDocuments(filter)
    ]);
    res.json({ success: true, products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json({ success: true, categories });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product, message: 'Product created' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const data = req.body;
    data.hasDiscount = (data.discountPercent || 0) > 0;
    data.discountedPrice = data.hasDiscount ? Math.round(data.price * (1 - data.discountPercent / 100)) : data.price;
    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: false });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product, message: 'Product updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
