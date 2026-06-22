const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { adminAuth } = require('../middleware/auth');

// Ensure uploads dir exists
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2,6) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// Upload image file
router.post('/image', adminAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ success: true, url, message: 'Image uploaded successfully' });
});

// Upload base64 image (from camera)
router.post('/base64', adminAuth, (req, res) => {
  try {
    const { base64, filename } = req.body;
    if (!base64) return res.status(400).json({ success: false, message: 'No image data' });
    const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const data    = matches ? matches[2] : base64;
    const ext     = matches ? (matches[1].split('/')[1] || 'jpg') : 'jpg';
    const fname   = 'cam_' + Date.now() + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, fname), Buffer.from(data, 'base64'));
    res.json({ success: true, url: `/uploads/${fname}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
