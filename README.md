# 🔧 Pauls Motor Parts — v2.1

A complete full-stack auto parts e-commerce platform, organized into clean `backend/` and `frontend/` folders.

---

## 📁 Project Structure

```
pauls-motor-parts/
├── backend/
│   ├── index.js               ← Server entry point (run this)
│   ├── .env                   ← Your config (edit this!)
│   ├── .env.example
│   ├── test-mongo-connection.js
│   ├── models/                ← User, Product, Order, Cart
│   ├── routes/                ← auth, products, orders, payment, chat, admin, upload
│   ├── middleware/auth.js     ← JWT auth + adminAuth
│   ├── utils/email.js
│   └── uploads/                ← Admin-uploaded product images (auto-created)
├── frontend/
│   ├── index.html              ← Home (video hero, categories, featured)
│   ├── pages/
│   │   ├── products.html       ← Full catalog, filters, search
│   │   ├── admin.html          ← Admin dashboard + product form + camera
│   │   └── orders.html         ← Customer order history
│   └── assets/{css,js}/
├── package.json                ← Root — run npm commands from here
└── README.md
```

---

## 🚀 Quick Start

```bash
npm install
cd backend && cp .env.example .env && cd ..    # then edit backend/.env with real values
npm start
```

Open → **http://localhost:3000**

---

## ⚠️ FIRST: Fix "MongoDB connection failed" / "querySrv ECONNREFUSED"

This error means your network/computer **cannot resolve MongoDB Atlas's DNS SRV record** — a network issue, not a code bug. Run the built-in diagnostic before anything else:

```bash
npm run test-db
```

This tells you exactly what's wrong. Most common causes, in order of likelihood:

| Cause | Fix |
|---|---|
| **IP not whitelisted** | Atlas → **Network Access** → **Add IP Address** → **"Allow Access from Anywhere"** (0.0.0.0/0) |
| **Wrong password / special characters** | URL-encode special chars in your password: `@`→`%40`, `#`→`%23`, `%`→`%25` |
| **Cluster paused** | Atlas free clusters auto-pause after inactivity — click **Resume** in the dashboard |
| **Corporate network/VPN/firewall blocks DNS SRV lookups** | Try a mobile hotspot to confirm. If confirmed, get the **non-SRV** string: Atlas → **Connect** → **Drivers** → **"..."** → **"I don't have DNS resolution"** |
| **Stale connection string** | Copy a fresh one from Atlas → Connect (hostnames can change after pause/resume) |

After fixing, restart with `npm start`. You should see:
```
✅ MongoDB Connected
✅ Admin OK: paulsubhasini31@gmail.com
✅ Seeded 18 products
🚀 Pauls Motor Parts → http://localhost:3000
```

---

## 🔑 Login

**Admin:**
| Field | Value |
|---|---|
| Email | `paulsubhasini31@gmail.com` |
| Password | `Admin@123` |

**Customers:** Click **Login → Register**. Registration auto-logs you in immediately — no email verification required to start using the site.

Admin panel → **http://localhost:3000/admin**

---

## 🛠 Admin: Adding Products

**Admin → Products → + Add Part**:
- Name, category, brand, part number, subcategory
- **Price** and **Discount %** (discounted price auto-calculates live)
- Stock quantity, descriptions, vehicle compatibility, search tags
- Custom specifications (key/value pairs)
- **Product photos** — three ways:
  1. **📁 Upload File** — pick from device
  2. **📸 Camera** — live capture (falls back to file picker if camera access denied)
  3. **Paste URL** — any image link
- ⭐ Featured toggle (homepage) and Active toggle (customer visibility)

Uploaded images are saved to `backend/uploads/` and served at `/uploads/filename.jpg`.

---

## 📦 Services You Need

| Service | What For | Required? |
|---|---|---|
| [MongoDB Atlas](https://cloud.mongodb.com) | Database | ✅ Yes |
| [Brevo](https://brevo.com) | Welcome/reset emails | Optional |
| [Razorpay](https://razorpay.com) | Card/UPI payments | Optional (falls back to WhatsApp orders) |
| [Anthropic](https://console.anthropic.com) | Smarter AI chatbot | Optional (falls back to rule-based replies) |

The site works fully with **only MongoDB configured** — everything else gracefully degrades.

---

## 💬 Update Your WhatsApp Number

Replace `91XXXXXXXXXX` with your real number in:
- `frontend/index.html`
- `frontend/pages/products.html`
- `frontend/assets/js/app.js`

---

## 🔧 Tech Stack

Node.js · Express.js · MongoDB/Mongoose · JWT auth · bcryptjs · Multer (uploads) · Razorpay · Nodemailer · Vanilla JS frontend · Inter font · Liquid-glass dark UI
