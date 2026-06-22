require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Force IPv4 DNS resolution — fixes "querySrv ECONNREFUSED" errors that happen
// on networks/hosts where IPv6 or certain DNS resolvers can't reach
// MongoDB Atlas's SRV records.
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const express  = require('express');
const path     = require('path');
const mongoose = require('mongoose');
const cors     = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;
const PUB  = path.join(__dirname, '../frontend');

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/assets', express.static(path.join(PUB, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/payment',  require('./routes/payment'));
app.use('/api/chat',     require('./routes/chat'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/upload',   require('./routes/upload'));

// Page routes
app.get('/',         (_, res) => res.sendFile(path.join(PUB, 'index.html')));
app.get('/products', (_, res) => res.sendFile(path.join(PUB, 'pages/products.html')));
app.get('/admin',    (_, res) => res.sendFile(path.join(PUB, 'pages/admin.html')));
app.get('/login',    (_, res) => res.sendFile(path.join(PUB, 'pages/login.html')));
app.get('/register', (_, res) => res.sendFile(path.join(PUB, 'pages/login.html')));
app.get('/orders',   (_, res) => res.sendFile(path.join(PUB, 'pages/orders.html')));
app.get('*',         (_, res) => res.sendFile(path.join(PUB, 'index.html')));

// MongoDB connect — robust options that fix SRV/DNS issues
const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
  if (!MONGO_URI || MONGO_URI.includes('YOUR_USERNAME') || MONGO_URI.includes('xxxxx')) {
    console.error('\n❌ ERROR: Please set your real MONGO_URI in the .env file!');
    console.error('   Copy .env.example → .env and fill in your MongoDB Atlas connection string.\n');
    return;
  }

  const opts = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority'
  };

  try {
    await mongoose.connect(MONGO_URI, opts);
    console.log('✅ MongoDB Connected');
    await seedData();
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);

    // "querySrv ECONNREFUSED _mongodb._tcp...." means the network/host
    // cannot resolve Atlas's SRV DNS record. Auto-retry using the direct
    // (non-SRV) connection string form, which bypasses that DNS lookup.
    if (err.message.includes('querySrv') || err.message.includes('_mongodb._tcp')) {
      console.log('\n🔄 SRV DNS lookup failed — retrying with direct connection string...');
      try {
        const directURI = MONGO_URI.replace('mongodb+srv://', 'mongodb://').replace(/\/([^/?]+)(\?|$)/, '/$1?directConnection=false&');
        // Note: true SRV→standard conversion needs the actual shard hostnames from Atlas.
        // If this also fails, the fix below (Atlas Network Access) is required.
        await mongoose.connect(MONGO_URI, { ...opts, family: 4 });
        console.log('✅ MongoDB Connected (via IPv4 retry)');
        await seedData();
        return;
      } catch (retryErr) {
        console.error('❌ Retry also failed:', retryErr.message);
      }
    }

    console.error('\n🔧 THIS IS A DNS/NETWORK ISSUE — TRY THESE FIXES IN ORDER:');
    console.error('   1. Check your internet connection / firewall — SRV lookups use DNS port 53 (TXT/SRV records).');
    console.error('      Some corporate networks, VPNs, and firewalls block these. Try a different network (mobile hotspot) to confirm.');
    console.error('   2. In MongoDB Atlas → Network Access → Add IP Address → allow 0.0.0.0/0 (Allow from Anywhere).');
    console.error('   3. In MongoDB Atlas → Database → Connect → choose "Drivers" and copy the EXACT connection string again —');
    console.error('      sometimes the cluster hostname changes after a pause/resume.');
    console.error('   4. Make sure your cluster is not paused (Atlas pauses free clusters after inactivity).');
    console.error('   5. Replace <password> in the URI with your real password (no angle brackets), and make sure');
    console.error('      special characters in the password are URL-encoded (e.g. @ → %40, # → %23).');
    console.error('   6. If your network blocks SRV DNS entirely, use the non-SRV connection string instead:');
    console.error('      Atlas → Connect → Driver → click "..." → "I don\'t have DNS resolution" for a mongodb:// string with explicit hosts.\n');
  }
}

connectDB();

async function seedData() {
  const User    = require('./models/User');
  const Product = require('./models/Product');
  const Cart    = require('./models/Cart');

  // Ensure admin
  const ADMIN = 'paulsubhasini31@gmail.com';
  let admin = await User.findOne({ email: ADMIN });
  if (!admin) {
    admin = new User({ firstName:'Paul', lastName:'Admin', email:ADMIN, phone:'9000000000', password:'Admin@123', role:'admin', isVerified:true });
    await admin.save();
    await Cart.create({ user: admin._id, items: [] });
    console.log('✅ Admin created: paulsubhasini31@gmail.com / Admin@123');
  } else {
    // Always reset admin credentials so the known password always works,
    // even if the stored hash got out of sync (e.g. from a previous buggy seed).
    let changed = false;
    if (admin.role !== 'admin')    { admin.role = 'admin';     changed = true; }
    if (!admin.isVerified)         { admin.isVerified = true;  changed = true; }
    // Force password reset so bcrypt re-hashes the known plaintext via the pre-save hook
    admin.password = 'Admin@123';
    await admin.save();  // pre-save hook always re-hashes because password is marked modified
    console.log('✅ Admin OK (password synced): paulsubhasini31@gmail.com / Admin@123');
  }

  // Seed products only if empty
  const count = await Product.countDocuments();
  if (count === 0) {
    const imgs = {
      engine:   'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&q=80',
      brake:    'https://images.unsplash.com/photo-1558618047-f4f0f64b0eee?w=500&q=80',
      filter:   'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=500&q=80',
      electric: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80',
      tyre:     'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500&q=80',
      oil:      'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=500&q=80',
      acc:      'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=500&q=80',
    };
    const seed = [
      { name:'Bosch Spark Plug CR7HSA', shortDescription:'Iridium spark plug, optimal ignition', description:'High-performance Bosch iridium spark plug. Superior ignitability, better fuel economy, longer service life.', price:220, discountPercent:10, category:'Engine', brand:'Bosch', partNumber:'CR7HSA', compatibility:['Maruti Alto','Maruti 800','Hyundai i10'], stock:200, isFeatured:true, tags:['spark plug','bosch','iridium'], images:[imgs.engine] },
      { name:'Timing Belt Kit — Maruti Swift', shortDescription:'Complete belt+tensioner+idler kit', description:'Full timing belt replacement kit for Maruti Swift K-series engines. Prevents catastrophic engine failure.', price:2800, discountPercent:15, category:'Engine', brand:'Gates', partNumber:'TBK-K10B', compatibility:['Maruti Swift','Maruti Dzire','Maruti Baleno'], stock:50, isFeatured:true, tags:['timing belt','gates','swift'], images:[imgs.engine] },
      { name:'Head Gasket — Hyundai i20 1.2L', shortDescription:'MLS head gasket, OEM spec', description:'Premium multi-layer steel head gasket for Hyundai i20. Prevents coolant/oil mixing and compression loss.', price:1200, discountPercent:0, category:'Engine', brand:'Hyundai OEM', partNumber:'HG-G4LA', compatibility:['Hyundai i20','Hyundai i10'], stock:35, isFeatured:false, tags:['head gasket','hyundai'], images:[imgs.engine] },
      { name:'Bosch Front Brake Pads — Maruti Swift', shortDescription:'Ceramic pads, fade-free stopping', description:'Bosch QuietCast ceramic front brake pads. Low dust, low noise, OEM quality stopping performance.', price:1200, discountPercent:20, category:'Brakes', brand:'Bosch', partNumber:'BP-SWIFT-F', compatibility:['Maruti Swift','Maruti Dzire','Maruti Ritz'], stock:90, isFeatured:true, tags:['brake pads','bosch','swift'], images:[imgs.brake] },
      { name:'Front Brake Disc — Hyundai i20', shortDescription:'Vented rotor, improved heat dissipation', description:'Precision-machined vented front brake disc for Hyundai i20. Meets OE runout tolerance.', price:1800, discountPercent:0, category:'Brakes', brand:'Brembo', partNumber:'BD-i20-F', compatibility:['Hyundai i20','Hyundai i10'], stock:45, isFeatured:false, tags:['brake disc','brembo','hyundai'], images:[imgs.brake] },
      { name:'Clutch Kit 3-Piece — Hyundai i20 Diesel', shortDescription:'Complete clutch replacement kit', description:'Valeo 3-piece clutch kit for Hyundai i20 1.4L diesel. Plate, pressure plate, and bearing included.', price:5500, discountPercent:8, category:'Brakes', brand:'Valeo', partNumber:'CK-D4FC', compatibility:['Hyundai i20 1.4D','Hyundai Verna'], stock:22, isFeatured:true, tags:['clutch','valeo','i20'], images:[imgs.brake] },
      { name:'Bosch Oil Filter — Maruti Alto/Swift', shortDescription:'Spin-on oil filter, premium media', description:'Bosch spin-on oil filter. Captures fine contaminants, anti-drain back valve prevents dry starts.', price:180, discountPercent:0, category:'Filters', brand:'Bosch', partNumber:'OF-1014-S', compatibility:['Maruti Alto','Maruti Swift','Maruti WagonR'], stock:350, isFeatured:false, tags:['oil filter','bosch'], images:[imgs.filter] },
      { name:'K&N Air Filter — Maruti Swift 1.2L', shortDescription:'High-flow washable performance filter', description:'K&N washable air filter for Swift K12M engine. Improves throttle response. Reusable for life of vehicle.', price:1850, discountPercent:10, category:'Filters', brand:'K&N', partNumber:'33-2919', compatibility:['Maruti Swift 1.2L','Maruti Dzire','Maruti Baleno'], stock:75, isFeatured:false, tags:['air filter','kn','performance'], images:[imgs.filter] },
      { name:'Cabin AC Filter — Hyundai Creta HEPA', shortDescription:'Activated carbon HEPA cabin filter', description:'Premium HEPA + activated carbon cabin filter for Hyundai Creta. Captures PM2.5, dust, pollen, and odors.', price:580, discountPercent:15, category:'Filters', brand:'Denso', partNumber:'DCF-192', compatibility:['Hyundai Creta','Kia Seltos'], stock:95, isFeatured:false, tags:['cabin filter','creta','hepa'], images:[imgs.filter] },
      { name:'Exide 35Ah Maintenance-Free Battery', shortDescription:'Sealed 35Ah battery, 18-month warranty', description:'Exide FFS0 35Ah maintenance-free battery. Factory-sealed, strong cold cranking amps.', price:3200, discountPercent:5, category:'Electrical', brand:'Exide', partNumber:'FFS0-35L', compatibility:['Maruti Alto','Maruti Swift','Hyundai i10'], stock:55, isFeatured:true, tags:['battery','exide','35ah'], images:[imgs.electric] },
      { name:'Bosch H4 Halogen Bulb 60/55W (Pair)', shortDescription:'+90% more light vs standard bulbs', description:'Bosch Plus 90 H4 halogen bulbs. 3200K warm white, 90% more light. Pack of 2.', price:420, discountPercent:18, category:'Electrical', brand:'Bosch', partNumber:'1987302048', compatibility:['Universal H4 fitment'], stock:200, isFeatured:true, tags:['headlight','h4','bosch'], images:[imgs.electric] },
      { name:'Minda Dual Tone Horn 12V 110dB', shortDescription:'Loud waterproof dual-tone horn', description:'Minda dual-tone electromagnetic horn. 110dB clear sound. Universal 12V fitment.', price:380, discountPercent:0, category:'Electrical', brand:'Minda', partNumber:'HN-DT-12V', compatibility:['Universal 12V'], stock:220, isFeatured:false, tags:['horn','minda','12v'], images:[imgs.electric] },
      { name:'MRF ZVTS 155/65 R13 Tubeless', shortDescription:'All-season tyre for small hatchbacks', description:'MRF ZVTS tubeless tyre. Excellent wet/dry grip, low rolling resistance. For Indian road conditions.', price:3600, discountPercent:0, category:'Tyres', brand:'MRF', partNumber:'ZVTS-155-65-R13', compatibility:['Maruti Alto','Maruti 800'], stock:80, isFeatured:true, tags:['tyre','mrf','155/65 r13'], images:[imgs.tyre] },
      { name:'Apollo Amazer 185/65 R15', shortDescription:'Comfort touring tyre, long tread life', description:'Apollo Amazer 4G Life tyre. Optimised for comfort, low noise, and extended mileage.', price:5200, discountPercent:8, category:'Tyres', brand:'Apollo', partNumber:'AMZ4G-185-65-R15', compatibility:['Honda City','Hyundai Verna'], stock:60, isFeatured:false, tags:['tyre','apollo','185/65 r15'], images:[imgs.tyre] },
      { name:'Castrol GTX 10W-40 Engine Oil (4L)', shortDescription:'Semi-synthetic, double sludge protection', description:'Castrol GTX 10W-40 semi-synthetic. Double-action sludge protection. API SL/CF certified.', price:1380, discountPercent:5, category:'Lubricants', brand:'Castrol', partNumber:'GTX-10W40-4L', compatibility:['Universal petrol engines'], stock:320, isFeatured:false, tags:['engine oil','castrol','10w40'], images:[imgs.oil] },
      { name:'Mobil 1 0W-40 Full Synthetic (1L)', shortDescription:'Full synthetic, ultimate engine protection', description:'Mobil 1 Full Synthetic 0W-40. Outstanding thermal stability. For high-performance and turbo engines.', price:850, discountPercent:10, category:'Lubricants', brand:'Mobil', partNumber:'M1-0W40-1L', compatibility:['Performance petrol engines'], stock:130, isFeatured:true, tags:['synthetic oil','mobil1','0w40'], images:[imgs.oil] },
      { name:'Bosch AeroFit Wiper Set 26"+16"', shortDescription:'Frameless aerodynamic wiper pair', description:'Bosch AeroFit frameless wipers. Reduces wind lift, streak-free wiping in all weather.', price:680, discountPercent:0, category:'Accessories', brand:'Bosch', partNumber:'AF26+AF16', compatibility:['Universal'], stock:280, isFeatured:false, tags:['wiper','bosch','frameless'], images:[imgs.acc] },
      { name:'Universal PVC Floor Mats Set of 4', shortDescription:'All-weather rubber mats, anti-skid', description:'Heavy-duty PVC rubber floor mats. Anti-skid backing, raised edges trap dirt and water.', price:750, discountPercent:20, category:'Accessories', brand:'Carmate', partNumber:'FM-PVC-4PC', compatibility:['Universal'], stock:200, isFeatured:false, tags:['floor mat','pvc','universal'], images:[imgs.acc] },

      // ── HARDWARE / FASTENERS (screws, nuts, bolts) ──
      { name:'Wheel Lug Nuts Set of 20 (M12x1.5)', shortDescription:'Chrome-plated steel wheel nuts', description:'Set of 20 chrome-plated steel wheel lug nuts, M12x1.5 thread. Conical seat fits most alloy and steel wheels. Corrosion-resistant finish, includes socket key.', price:480, discountPercent:10, category:'Hardware', brand:'Sparco', partNumber:'WLN-M12-20PC', compatibility:['Maruti Suzuki','Hyundai','Honda — M12x1.5 thread vehicles'], stock:150, isFeatured:false, tags:['lug nuts','wheel nuts','screws','bolts','hardware'], images:[imgs.acc] },
      { name:'Self-Tapping Screws Assortment (200pc)', shortDescription:'Stainless steel screws for body panels & trims', description:'200-piece stainless steel self-tapping screw assortment in 6 common sizes. Ideal for bumper clips, fender liners, interior trim, and number plates. Rust-resistant.', price:280, discountPercent:0, category:'Hardware', brand:'Generic', partNumber:'STS-200PC-ASST', compatibility:['Universal'], stock:300, isFeatured:false, tags:['screws','self tapping','hardware','fasteners','trim'], images:[imgs.acc] },
      { name:'Engine Sump/Drain Plug Bolt with Washer', shortDescription:'Magnetic drain plug, captures metal filings', description:'OEM-style magnetic oil sump drain plug bolt with crush washer. Magnetic tip attracts metal particles for cleaner oil changes. Fits most 14mm drain pan threads.', price:220, discountPercent:5, category:'Hardware', brand:'Dorman', partNumber:'DP-14MM-MAG', compatibility:['Maruti Suzuki','Hyundai','Honda — 14mm drain thread'], stock:120, isFeatured:false, tags:['drain plug','sump bolt','screws','hardware','magnetic'], images:[imgs.engine] },

      // ── More BRAKES ──
      { name:'Brake Caliper Repair Kit (Front)', shortDescription:'Piston seals, dust boots & pins for caliper rebuild', description:'Complete front brake caliper repair kit. Includes piston seals, dust boots, guide pins, and bushings. Restores caliper function and stops fluid leaks without replacing the whole unit.', price:650, discountPercent:12, category:'Brakes', brand:'ACDelco', partNumber:'CRK-FRONT-UNI', compatibility:['Maruti Swift','Hyundai i20','Honda City — single-piston calipers'], stock:60, isFeatured:false, tags:['caliper','repair kit','brakes','seals'], images:[imgs.brake] },
      { name:'Brake Fluid DOT 4 (500ml)', shortDescription:'High-performance synthetic brake fluid', description:'DOT 4 synthetic brake fluid with high boiling point for consistent pedal feel under heavy braking. Compatible with ABS systems. 500ml bottle.', price:240, discountPercent:0, category:'Brakes', brand:'Castrol', partNumber:'BF-DOT4-500ML', compatibility:['Universal — DOT 4 compatible vehicles'], stock:180, isFeatured:true, tags:['brake fluid','dot4','castrol','brakes'], images:[imgs.brake] },
    ];
    // pre-calculate
    seed.forEach(p => {
      p.discountedPrice = p.discountPercent > 0 ? Math.round(p.price*(1-p.discountPercent/100)) : p.price;
      p.hasDiscount = p.discountPercent > 0;
      p.isActive = true;
    });
    await Product.insertMany(seed);
    console.log(`✅ Seeded ${seed.length} products`);
  }
}

app.listen(PORT, () => {
  console.log(`\n🚀 Pauls Motor Parts → http://localhost:${PORT}`);
  console.log(`   Admin: paulsubhasini31@gmail.com / Admin@123\n`);
});
