/**
 * seed.js — Run once to populate Paul's Motor Parts with 15 sample products
 * Usage: node seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Product = require('./models/Product');

const PRODUCTS = [
  {
    name: 'Bosch NGK Spark Plug Set (4-Pack)',
    description: 'High-performance iridium spark plugs for better fuel efficiency and smoother ignition. Compatible with most 4-cylinder petrol engines. Long service life of 60,000 km.',
    shortDescription: 'Iridium spark plugs for 4-cyl petrol engines',
    price: 1200,
    discountPercent: 10,
    category: 'Ignition',
    brand: 'NGK',
    partNumber: 'NGK-BKR6EIX-4PK',
    compatibility: ['Maruti Swift', 'Hyundai i20', 'Honda City', 'Toyota Innova'],
    stock: 48,
    isActive: true,
    isFeatured: true,
    tags: ['spark plug', 'ignition', 'iridium'],
    images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400'],
  },
  {
    name: 'Mobil 1 Full Synthetic Engine Oil 5W-30 (4L)',
    description: 'Premium full synthetic engine oil providing outstanding engine protection and performance. Meets API SN Plus standards. Ideal for modern turbo and naturally aspirated engines.',
    shortDescription: 'Full synthetic 5W-30 engine oil, 4 litres',
    price: 2800,
    discountPercent: 15,
    category: 'Engine Oil',
    brand: 'MOBIL',
    partNumber: 'MOB-5W30-4L',
    compatibility: ['Universal'],
    stock: 60,
    isActive: true,
    isFeatured: true,
    tags: ['engine oil', 'synthetic', '5W-30', 'mobil1'],
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'],
  },
  {
    name: 'Gates PowerGrip Timing Belt Kit',
    description: 'Complete timing belt kit including belt, tensioner, and idler pulley. Made from HNBR rubber for heat and oil resistance. Recommended replacement interval: 80,000 km.',
    shortDescription: 'Complete timing belt kit with tensioner',
    price: 3500,
    discountPercent: 0,
    category: 'Belts & Hoses',
    brand: 'GATES',
    partNumber: 'GAT-TB-K025372XS',
    compatibility: ['Hyundai Creta', 'Kia Seltos', 'Hyundai Verna'],
    stock: 22,
    isActive: true,
    isFeatured: false,
    tags: ['timing belt', 'belt kit', 'gates'],
    images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400'],
  },
  {
    name: 'Exide FFS0-EX35B20 Car Battery 35Ah',
    description: '35Ah maintenance-free car battery with Silver Alloy Technology for longer life and better cranking power. 30-month manufacturer warranty. Ready-to-install.',
    shortDescription: '35Ah maintenance-free battery, 30-month warranty',
    price: 4200,
    discountPercent: 8,
    category: 'Battery',
    brand: 'EXIDE',
    partNumber: 'EXD-FFS0-EX35B20',
    compatibility: ['Maruti Alto', 'Maruti Wagon R', 'Hyundai i10', 'Tata Tiago'],
    stock: 14,
    isActive: true,
    isFeatured: true,
    tags: ['battery', 'exide', '35ah', 'maintenance-free'],
    images: ['https://images.unsplash.com/photo-1558618047-f4e90e05f1f5?w=400'],
  },
  {
    name: 'Hella H4 Headlight Bulb Set (Pair)',
    description: 'OEM-quality H4 halogen headlight bulbs with 20% brighter output than standard. 3200K warm white light. Easy plug-and-play fitment. Pack of 2 bulbs.',
    shortDescription: 'H4 halogen headlight bulbs, 20% brighter (pair)',
    price: 650,
    discountPercent: 0,
    category: 'Lighting',
    brand: 'HELLA',
    partNumber: 'HEL-H4-SET',
    compatibility: ['Universal H4 Fitment'],
    stock: 85,
    isActive: true,
    isFeatured: false,
    tags: ['bulb', 'headlight', 'H4', 'halogen'],
    images: ['https://images.unsplash.com/photo-1558979158-65a1eaa08691?w=400'],
  },
  {
    name: 'Bosch Aerotwin Wiper Blade Set (Front Pair)',
    description: 'Flat beam wiper blades with aerodynamic design for streak-free wiping at all speeds. Spoiler-free design for modern cars. Fits most common arm connections via multi-adapter.',
    shortDescription: 'Flat beam wipers, spoiler-free (front pair)',
    price: 980,
    discountPercent: 5,
    category: 'Wipers',
    brand: 'BOSCH',
    partNumber: 'BSC-AM-SET-24-18',
    compatibility: ['Honda City', 'Hyundai Creta', 'Maruti Brezza', 'Tata Nexon'],
    stock: 40,
    isActive: true,
    isFeatured: false,
    tags: ['wiper', 'aerotwin', 'bosch', 'flat blade'],
    images: ['https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?w=400'],
  },
  {
    name: 'Federal-Mogul Ferodo Brake Pads (Front Axle)',
    description: 'Premium ceramic brake pads with low dust formula and excellent stopping power. Includes shims to reduce brake noise. Suitable for city and highway driving. Set of 4 pads.',
    shortDescription: 'Ceramic front brake pads, low dust, set of 4',
    price: 1450,
    discountPercent: 12,
    category: 'Brakes',
    brand: 'FEDERAL-MOGUL',
    partNumber: 'FM-FDB4453',
    compatibility: ['Maruti Swift', 'Maruti Dzire', 'Maruti Baleno'],
    stock: 30,
    isActive: true,
    isFeatured: true,
    tags: ['brake pads', 'ferodo', 'ceramic', 'front brakes'],
    images: ['https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=400'],
  },
  {
    name: 'Apollo Amazer 4G Evo Tyre 185/65 R15',
    description: 'All-season radial tyre with optimised tread pattern for enhanced wet and dry grip. Low rolling resistance for better fuel economy. Speed rating H (210 km/h).',
    shortDescription: '185/65 R15 all-season radial tyre',
    price: 4800,
    discountPercent: 0,
    category: 'Tyres',
    brand: 'APOLLO',
    partNumber: 'APL-AMZ4GEV-18565R15',
    compatibility: ['Hyundai i20', 'Maruti Baleno', 'Honda Jazz', 'VW Polo'],
    stock: 18,
    isActive: true,
    isFeatured: false,
    tags: ['tyre', 'apollo', '185/65 R15', 'radial'],
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'],
  },
  {
    name: 'Denso Air Filter — OEM Replacement',
    description: 'High-flow OEM-equivalent air filter made from premium filter media. Captures 99.5% of harmful particles. Direct drop-in replacement with no modification required.',
    shortDescription: 'OEM-grade air filter, high-flow media',
    price: 420,
    discountPercent: 0,
    category: 'Filters',
    brand: 'DENSO',
    partNumber: 'DNS-AF-260',
    compatibility: ['Toyota Fortuner', 'Toyota Innova Crysta', 'Toyota Camry'],
    stock: 55,
    isActive: true,
    isFeatured: false,
    tags: ['air filter', 'denso', 'OEM', 'toyota'],
    images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400'],
  },
  {
    name: 'K&N High-Flow Drop-In Air Filter',
    description: 'Washable and reusable high-flow cotton gauze air filter. Increases airflow by up to 50% for improved throttle response. Lasts the lifetime of your vehicle with proper maintenance.',
    shortDescription: 'Washable high-flow cotton gauze air filter',
    price: 2200,
    discountPercent: 10,
    category: 'Filters',
    brand: 'K&N',
    partNumber: 'KN-33-2970',
    compatibility: ['Maruti Suzuki', 'Hyundai', 'Honda', 'Tata'],
    stock: 25,
    isActive: true,
    isFeatured: true,
    tags: ['air filter', 'k&n', 'performance', 'washable'],
    images: ['https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400'],
  },
  {
    name: 'Valeo Clutch Kit (3-Piece)',
    description: 'Complete OEM-quality clutch kit including pressure plate, clutch disc, and release bearing. Precision balanced for smooth engagement. Suitable for urban and highway use.',
    shortDescription: 'Complete 3-piece OEM clutch kit',
    price: 6800,
    discountPercent: 5,
    category: 'Drivetrain',
    brand: 'VALEO',
    partNumber: 'VAL-826564',
    compatibility: ['Maruti Suzuki Swift', 'Maruti Dzire', 'Maruti Ertiga'],
    stock: 10,
    isActive: true,
    isFeatured: false,
    tags: ['clutch', 'valeo', 'clutch kit', 'manual'],
    images: ['https://images.unsplash.com/photo-1630626983536-5b88e877bbbc?w=400'],
  },
  {
    name: 'Minda Horn — Compact Disc Type (Pair)',
    description: 'Loud and clear disc-type horn pair with high and low tone. Weather-resistant construction. Direct OEM fitment with no wiring changes required. 118 dB output.',
    shortDescription: 'Disc horn pair, 118 dB, weather-resistant',
    price: 550,
    discountPercent: 0,
    category: 'Electricals',
    brand: 'MINDA',
    partNumber: 'MND-HRN-DISC-12V',
    compatibility: ['Universal 12V fitment'],
    stock: 70,
    isActive: true,
    isFeatured: false,
    tags: ['horn', 'minda', 'disc horn', 'electricals'],
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'],
  },
  {
    name: 'Bosch Oil Filter — Premium',
    description: 'Premium OEM-quality oil filter with anti-drain back valve to prevent dry starts. Full-flow filtration efficiency of 99.9%. Fits standard M20x1.5 thread.',
    shortDescription: 'Full-flow oil filter with anti-drain back valve',
    price: 380,
    discountPercent: 0,
    category: 'Filters',
    brand: 'BOSCH',
    partNumber: 'BSC-0451103141',
    compatibility: ['Maruti', 'Hyundai', 'Honda', 'Tata', 'Ford'],
    stock: 90,
    isActive: true,
    isFeatured: false,
    tags: ['oil filter', 'bosch', 'filter', 'engine'],
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'],
  },
  {
    name: 'Federal-Mogul Shock Absorber — Front (Each)',
    description: 'Gas-pressurised front shock absorber for improved handling and ride comfort. Nitrogen-charged twin-tube design. Comes with all installation hardware. Sold individually.',
    shortDescription: 'Gas front shock absorber, nitrogen-charged',
    price: 2100,
    discountPercent: 0,
    category: 'Suspension',
    brand: 'FEDERAL-MOGUL',
    partNumber: 'FM-SA-F001',
    compatibility: ['Maruti Swift', 'Maruti Baleno', 'Maruti Ciaz'],
    stock: 20,
    isActive: true,
    isFeatured: false,
    tags: ['shock absorber', 'suspension', 'front', 'gas'],
    images: ['https://images.unsplash.com/photo-1630626983536-5b88e877bbbc?w=400'],
  },
  {
    name: 'Denso Fuel Filter — Inline',
    description: 'High-flow inline fuel filter with fine micron filtration to protect fuel injectors from contamination. Corrosion-resistant steel housing. Recommended change every 40,000 km.',
    shortDescription: 'Inline fuel filter, fine micron, corrosion-resistant',
    price: 320,
    discountPercent: 0,
    category: 'Filters',
    brand: 'DENSO',
    partNumber: 'DNS-FF-101',
    compatibility: ['Maruti', 'Hyundai', 'Honda', 'Kia'],
    stock: 65,
    isActive: true,
    isFeatured: false,
    tags: ['fuel filter', 'denso', 'inline', 'injector protection'],
    images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400'],
  },
];

async function seed() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI || MONGO_URI.includes('YOUR_USERNAME')) {
    console.error('\n❌ Please update MONGO_URI in backend/.env with your real MongoDB connection string first!\n');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ Connected to MongoDB');

    const existing = await Product.countDocuments();
    if (existing > 0) {
      console.log(`⚠️  ${existing} products already exist. Clearing and re-seeding...`);
      await Product.deleteMany({});
    }

    const created = await Product.insertMany(PRODUCTS);
    console.log(`\n✅ Successfully seeded ${created.length} products:\n`);
    created.forEach(p => console.log(`   • ${p.name} — ₹${p.price}`));
    console.log('\n🎉 Done! Refresh your browser to see the products.\n');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
