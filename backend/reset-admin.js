/**
 * reset-admin.js
 * ─────────────────────────────────────────────────────────────
 * Run this ONCE to fix the admin account password in MongoDB.
 * Use when you see "Incorrect password" for the admin login.
 *
 * Usage (from the backend/ folder):
 *   node reset-admin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const ADMIN_EMAIL = 'paulsubhasini31@gmail.com';
const ADMIN_PASS  = 'Admin@123';

async function resetAdmin() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI || MONGO_URI.includes('YOUR_USERNAME')) {
    console.error('\n❌ Please set your real MONGO_URI in backend/.env first!\n');
    process.exit(1);
  }

  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000, family: 4 });
    console.log('✅ Connected\n');

    // Hash password directly — bypass mongoose pre-save to guarantee correct hash
    const hash = await bcrypt.hash(ADMIN_PASS, 12);

    const result = await mongoose.connection.db.collection('users').findOneAndUpdate(
      { email: ADMIN_EMAIL },
      {
        $set: {
          password:   hash,
          role:       'admin',
          isVerified: true,
          firstName:  'Paul',
          lastName:   'Admin',
        }
      },
      { upsert: false, returnDocument: 'after' }
    );

    if (!result) {
      // Admin didn't exist — create fresh
      console.log('⚠️  Admin account not found — creating fresh...');
      await mongoose.connection.db.collection('users').insertOne({
        firstName:  'Paul',
        lastName:   'Admin',
        email:      ADMIN_EMAIL,
        phone:      '9000000000',
        password:   hash,
        role:       'admin',
        isVerified: true,
        createdAt:  new Date(),
        updatedAt:  new Date(),
      });
      console.log('✅ Admin created fresh!');
    } else {
      console.log('✅ Admin password reset successfully!');
    }

    console.log(`\n   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASS}`);
    console.log('\n🎉 Done! Restart your server and try logging in.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetAdmin();
