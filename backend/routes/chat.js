const express = require('express');
const router  = express.Router();
const Product = require('../models/Product');

router.post('/message', async (req, res) => {
  try {
    const { message = '', imageBase64 } = req.body;
    const lower = message.toLowerCase().trim();

    // ── Keywords to search ──────────────────────────────────
    const PART_WORDS = [
      'brake','engine','filter','oil','tyre','tire','battery','spark','clutch',
      'alternator','starter','sensor','gasket','belt','piston','bearing','shock',
      'absorber','headlight','bulb','wiper','horn','exhaust','radiator','coolant',
      'fuel','pump','valve','transmission','gearbox','steering','suspension',
      'wheel','rim','alloy','bosch','mrf','denso','ngk','exide','valeo','minda',
      'castrol','mobil','shell','apollo','ceat','jk','gates','brembo','hella',
      'michelin','maruti','swift','dzire','alto','wagonr','baleno','ertiga',
      'hyundai','i10','i20','creta','verna','xcent','honda','city','amaze','activa',
      'tata','mahindra','toyota','ford','volkswagen','kia','seltos','plug','pad',
      'disc','drum','shoe','kit','hose','mount','ring','head','cabin','air','fuel',
      'jack','mat','floor','inflator','synthetic','semi-synthetic','diesel','petrol'
    ];

    let searchTerms = imageBase64
      ? ['auto part','motor part','car part']
      : PART_WORDS.filter(k => lower.includes(k));

    if (!imageBase64 && searchTerms.length === 0 && lower.length > 2) {
      searchTerms = [lower];
    }

    // ── DB search ───────────────────────────────────────────
    let products = [];
    if (searchTerms.length > 0) {
      const orClauses = searchTerms.map(t => ({
        $or: [
          { name:          { $regex: t, $options: 'i' } },
          { description:   { $regex: t, $options: 'i' } },
          { brand:         { $regex: t, $options: 'i' } },
          { category:      { $regex: t, $options: 'i' } },
          { partNumber:    { $regex: t, $options: 'i' } },
          { tags:          { $in: [new RegExp(t, 'i')] } },
          { compatibility: { $in: [new RegExp(t, 'i')] } }
        ]
      }));
      products = await Product.find({ isActive: true, $or: orClauses }).limit(6);
    }

    // ── Try Anthropic Claude API ───────────────────────────
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant') && !process.env.ANTHROPIC_API_KEY.includes('XXXX')) {
      try {
        const msgs = imageBase64
          ? [{ role:'user', content:[
              { type:'image', source:{ type:'base64', media_type:'image/jpeg', data: imageBase64 } },
              { type:'text',  text: `Identify this auto part and describe it in 2 sentences. ${message ? 'User also said: '+message : ''}` }
            ]}]
          : [{ role:'user', content: message }];

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: 'You are the Pauls Motor Parts AI assistant. Help users find auto parts for Indian vehicles. Be concise and friendly. Keep replies under 3 sentences. If it\'s an image, identify the part shown.',
            messages: msgs
          })
        });
        const aiData = await aiRes.json();
        const aiText = aiData.content?.[0]?.text;
        if (aiText) return res.json({ success:true, message: aiText, products, source:'ai' });
      } catch { /* fall through */ }
    }

    // ── Rule-based fallback ─────────────────────────────────
    let reply = '';
    if (imageBase64) {
      reply = products.length
        ? `I analysed your photo and found ${products.length} matching part(s) in our catalog! Click any to view details or add to cart. 👇`
        : "I can see the part in your photo! We don't have an exact catalog match right now — reach us on WhatsApp with the photo for a direct quote. 📱";
    } else if (!lower || lower.length < 2) {
      reply = "👋 Welcome! Tell me what auto part you need, your vehicle make/model, or describe a problem — I'll find the right part for you!\n\nYou can also tap **📸 Photo** to search by image.";
    } else if (products.length > 0) {
      reply = `Found **${products.length}** matching part(s) for you! Here they are 👇`;
    } else if (lower.includes('discount') || lower.includes('offer') || lower.includes('sale')) {
      reply = "🏷️ Here are our currently discounted parts — great deals on top brands!";
      products = await Product.find({ hasDiscount: true, isActive: true }).limit(6);
    } else if (lower.includes('whatsapp') || lower.includes('contact') || lower.includes('call')) {
      reply = "📱 You can reach us directly on WhatsApp for bulk orders, rare parts, and fitment advice! Tap the WhatsApp link below to start a chat.";
    } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('help')) {
      reply = "🔧 Hi there! I'm your Pauls Motor Parts assistant. Ask me about any car or bike part — brakes, engine, filters, tyres, electrical, and more. Or take a photo of the part!";
    } else {
      reply = `I searched for **"${message}"** but couldn't find an exact match. Try a specific part name, brand (Bosch, MRF, NGK...), or your vehicle model (Swift, i20, Alto...).`;
    }

    res.json({ success: true, message: reply, products });
  } catch (err) {
    res.status(500).json({ success: false, message: "Something went wrong. Please try again!", products: [] });
  }
});

module.exports = router;
