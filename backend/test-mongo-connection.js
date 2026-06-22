/**
 * MongoDB Connection Diagnostic Tool
 * ------------------------------------
 * Run this BEFORE starting the main server to check exactly why
 * your MongoDB connection is failing.
 *
 * Usage:
 *   node test-mongo-connection.js
 */
require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setDefaultResultOrder('ipv4first');

const MONGO_URI = process.env.MONGO_URI;

console.log('═══════════════════════════════════════════════════');
console.log('  MongoDB Connection Diagnostic — Pauls Motor Parts');
console.log('═══════════════════════════════════════════════════\n');

if (!MONGO_URI) {
  console.log('❌ MONGO_URI is not set in your .env file.');
  console.log('   Add this line to .env:');
  console.log('   MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname\n');
  process.exit(1);
}

// Mask password for safe logging
const masked = MONGO_URI.replace(/:([^:@]+)@/, ':****@');
console.log('1. Connection string found:');
console.log('   ' + masked + '\n');

// Step 1: Check if it's an SRV string and extract the host
const srvMatch = MONGO_URI.match(/mongodb\+srv:\/\/[^@]+@([^/]+)/);
if (srvMatch) {
  const host = srvMatch[1];
  console.log('2. Testing DNS SRV lookup for: _mongodb._tcp.' + host);

  dns.resolveSrv('_mongodb._tcp.' + host, (err, addresses) => {
    if (err) {
      console.log('   ❌ DNS SRV lookup FAILED: ' + err.code);
      console.log('\n   🔎 DIAGNOSIS: Your network/DNS resolver cannot reach MongoDB Atlas\'s');
      console.log('   SRV records. This is a network-level issue, NOT a code issue.\n');
      console.log('   ✅ FIXES (try in order):');
      console.log('   a) Try a different network — mobile hotspot, home wifi instead of office/VPN.');
      console.log('      Corporate firewalls and some VPNs block DNS SRV/TXT lookups.');
      console.log('   b) Try Google DNS (8.8.8.8) instead of your ISP\'s DNS:');
      console.log('      - Windows: Network Settings → change DNS to 8.8.8.8 / 8.8.4.4');
      console.log('      - Mac: System Settings → Network → DNS → add 8.8.8.8');
      console.log('   c) Get the NON-SRV connection string from Atlas instead:');
      console.log('      Atlas Dashboard → Connect → Drivers → "I don\'t have DNS resolution"');
      console.log('      This gives you a mongodb:// string with explicit server addresses');
      console.log('      that does NOT need SRV DNS lookups at all.');
      console.log('   d) If deploying (Vercel/Render/Railway), this is rarely an issue —');
      console.log('      but double check the cluster isn\'t paused in Atlas.\n');
      runFallbackTest();
    } else {
      console.log('   ✅ DNS SRV lookup SUCCEEDED. Found ' + addresses.length + ' server(s):');
      addresses.forEach(a => console.log('      - ' + a.name + ':' + a.port));
      console.log('');
      testActualConnection();
    }
  });
} else {
  console.log('2. Non-SRV connection string detected — skipping SRV DNS check.\n');
  testActualConnection();
}

function runFallbackTest() {
  console.log('3. Testing basic internet/DNS connectivity...');
  dns.resolve4('mongodb.com', (err) => {
    if (err) {
      console.log('   ❌ Cannot even resolve mongodb.com — your internet/DNS is down or heavily restricted.\n');
    } else {
      console.log('   ✅ General internet DNS works fine.');
      console.log('   → The issue is SPECIFIC to MongoDB Atlas SRV records, confirming a DNS/firewall block.\n');
    }
    process.exit(1);
  });
}

function testActualConnection() {
  console.log('3. Attempting actual MongoDB connection...');
  mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000, family: 4 })
    .then(() => {
      console.log('   ✅ SUCCESS! MongoDB connected correctly.\n');
      console.log('   Your .env MONGO_URI is working. If the main app still fails,');
      console.log('   make sure you restarted the server after editing .env.\n');
      mongoose.disconnect();
      process.exit(0);
    })
    .catch(err => {
      console.log('   ❌ Connection FAILED: ' + err.message + '\n');
      if (err.message.includes('Authentication failed') || err.message.includes('bad auth')) {
        console.log('   🔎 DIAGNOSIS: Wrong username or password.');
        console.log('   ✅ FIX: Go to Atlas → Database Access → check/reset your user\'s password.');
        console.log('      If your password has special characters (@ # % etc.), URL-encode them:');
        console.log('      @ → %40   # → %23   % → %25   / → %2F\n');
      } else if (err.message.includes('IP') || err.message.includes('whitelist') || err.message.includes('not authorized')) {
        console.log('   🔎 DIAGNOSIS: Your IP address is not whitelisted.');
        console.log('   ✅ FIX: Atlas → Network Access → Add IP Address → "Allow Access From Anywhere" (0.0.0.0/0)\n');
      } else if (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED')) {
        console.log('   🔎 DIAGNOSIS: DNS/network cannot reach Atlas SRV records.');
        console.log('   ✅ FIX: See the SRV lookup section above, or use the non-SRV connection string.\n');
      } else {
        console.log('   🔎 Unrecognized error — copy this message when asking for help.\n');
      }
      process.exit(1);
    });
}
