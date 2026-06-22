/**
 * delete-user.js  — Delete a user account from MongoDB by email
 * Usage:  node delete-user.js gkrpaul@gmail.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
const mongoose = require('mongoose');

async function run() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) { console.error('\n❌ Usage: node delete-user.js your@email.com\n'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000, family: 4 });
  const result = await mongoose.connection.db.collection('users').deleteOne({ email });
  await mongoose.connection.db.collection('carts').deleteOne({ /* best effort */ });

  if (result.deletedCount === 0) console.log(`⚠️  No user found with email: ${email}`);
  else console.log(`✅ Deleted user: ${email} — you can now register fresh with this email.`);

  await mongoose.disconnect();
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
