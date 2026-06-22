/* ============================================================
   PAULS MOTOR PARTS — app.js  v2.0
   Auth · Cart · Chatbot (NLP+Camera) · Products · Checkout
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────
let currentUser = null;
let authToken   = null;
let cart        = [];
let capturedImageBase64 = null;
let cameraStream        = null;

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _loadSession();
  _checkURLParams();
  renderCartCount();

  // page-specific inits
  const page = window.location.pathname;
  if (page === '/' || page === '/index.html') {
    _animateHero();
    _loadHomeFeatured();
    _loadHomeCategories();
    _initChatbot();
  }
  if (page === '/products') {
    _initProductsPage();
    _initChatbot();
  }
  if (page === '/orders') {
    _initOrdersPage();
  }
  if (page === '/admin') {
    _initAdminPage();
  }
});

// ════════════════════════════════════════════════════════════
// SESSION
// ════════════════════════════════════════════════════════════
function _loadSession() {
  authToken   = localStorage.getItem('pmp_token');
  const u     = localStorage.getItem('pmp_user');
  cart        = JSON.parse(localStorage.getItem('pmp_cart') || '[]');
  if (authToken && u) {
    currentUser = JSON.parse(u);
    _updateAuthUI();
  }
}

function _saveCart() {
  localStorage.setItem('pmp_cart', JSON.stringify(cart));
  renderCartCount();
  if (authToken) {
    fetch('/api/orders/cart/sync', {
      method: 'POST', headers: _h(),
      body: JSON.stringify({ items: cart })
    }).catch(() => {});
  }
}

function _h() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken };
}

function _updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  if (!btn) return;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const adminLink       = document.getElementById('admin-panel-link');
  const adminLinkMobile = document.getElementById('admin-panel-link-mobile');
  if (adminLink)       adminLink.style.display       = isAdmin ? 'block' : 'none';
  if (adminLinkMobile) adminLinkMobile.style.display = isAdmin ? 'block' : 'none';
  if (currentUser) {
    btn.textContent = currentUser.firstName + ' ▾';
    btn.onclick = toggleUserMenu;
    _setEl('user-name-display',  currentUser.firstName + ' ' + (currentUser.lastName || ''));
    _setEl('user-email-display', currentUser.email || '');
  } else {
    btn.textContent = 'Login';
    btn.onclick = () => { window.location.href = '/login'; };
  }
}

function _setEl(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function _checkURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('verified')) showToast('✅ Email verified! You can now log in.', 'success');
  if (p.get('reset'))    { openAuthModal(); switchAuthTab('reset'); window._resetToken = p.get('reset'); }
}

// ════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════
function openAuthModal(tab) {
  const m = document.getElementById('auth-modal');
  if (m) m.style.display = 'flex';
  switchAuthTab(tab || 'login');
}
function closeAuthModal() {
  const m = document.getElementById('auth-modal');
  if (m) m.style.display = 'none';
}
function switchAuthTab(tab) {
  ['login','register','forgot','reset'].forEach(t => {
    const f = document.getElementById('form-' + t);
    const b = document.getElementById('tab-' + t);
    if (f) f.style.display = (t === tab) ? 'block' : 'none';
    if (b) b.classList.toggle('active', t === tab);
  });
}

async function doLogin() {
  const email = _val('login-email');
  const pass  = _val('login-password');
  const btn   = document.getElementById('login-btn');
  _hideMsg('login-err');
  if (!email || !pass) return _showMsg('login-err', 'Please fill all fields.');
  _setBtnLoad(btn, 'Signing in...');
  try {
    const d = await _post('/api/auth/login', { email, password: pass });
    if (d.success) {
      authToken = d.token; currentUser = d.user;
      localStorage.setItem('pmp_token', authToken);
      localStorage.setItem('pmp_user',  JSON.stringify(currentUser));
      if (d.cart?.length && !cart.length) { cart = d.cart; _saveCart(); }
      closeAuthModal();
      _updateAuthUI();
      showToast('Welcome back, ' + currentUser.firstName + '! 👋', 'success');
      if (currentUser.role === 'admin') {
        setTimeout(() => showToast('🛠️ Admin access: open the menu (top right) anytime', 'success'), 1200);
      }
    } else { _showMsg('login-err', d.message); }
  } catch { _showMsg('login-err', 'Network error. Please try again.'); }
  finally   { _resetBtn(btn, 'Sign In'); }
}

async function doRegister() {
  const fname = _val('reg-fname'), lname = _val('reg-lname');
  const email = _val('reg-email'), phone = _val('reg-phone'), pass = _val('reg-password');
  const btn   = document.getElementById('reg-btn');
  _hideMsg('reg-err'); _hideMsg('reg-ok');
  if (!fname) return _showMsg('reg-err', 'Please enter your first name.');
  if (!email) return _showMsg('reg-err', 'Please enter your email.');
  if (!phone) return _showMsg('reg-err', 'Please enter your phone number.');
  if (!pass)  return _showMsg('reg-err', 'Please enter a password.');
  if (pass.length < 6) return _showMsg('reg-err', 'Password must be at least 6 characters.');
  _setBtnLoad(btn, 'Creating account...');
  try {
    const d = await _post('/api/auth/register', { firstName:fname, lastName: lname || '-', email, phone, password:pass });
    if (d.success) {
      _showMsg('reg-ok', '✅ ' + d.message);
      if (d.token && d.user) {
        authToken = d.token; currentUser = d.user;
        localStorage.setItem('pmp_token', authToken);
        localStorage.setItem('pmp_user',  JSON.stringify(currentUser));
        _updateAuthUI();
        setTimeout(() => { closeAuthModal(); showToast('Welcome, ' + currentUser.firstName + '! 🎉', 'success'); }, 1200);
      }
    } else {
      _showMsg('reg-err', d.message);
    }
  } catch { _showMsg('reg-err', 'Network error. Please try again.'); }
  finally   { _resetBtn(btn, 'Create Account'); }
}

async function doForgot() {
  const email = _val('forgot-email');
  _hideMsg('forgot-err'); _hideMsg('forgot-msg');
  if (!email) return _showMsg('forgot-err', 'Please enter your email.');
  try {
    const d = await _post('/api/auth/forgot-password', { email });
    if (d.success) _showMsg('forgot-msg', '✅ ' + d.message);
    else           _showMsg('forgot-err', d.message);
  } catch { _showMsg('forgot-err', 'Network error.'); }
}

async function doReset() {
  const password = _val('reset-password'), confirm = _val('reset-confirm');
  _hideMsg('reset-err'); _hideMsg('reset-msg');
  if (!password || !confirm) return _showMsg('reset-err', 'Fill both fields.');
  if (password !== confirm)  return _showMsg('reset-err', 'Passwords do not match.');
  if (password.length < 6)   return _showMsg('reset-err', 'Minimum 6 characters.');
  try {
    const d = await _post('/api/auth/reset-password', { token: window._resetToken, password });
    if (d.success) { _showMsg('reset-msg', '✅ ' + d.message); setTimeout(() => switchAuthTab('login'), 2000); }
    else _showMsg('reset-err', d.message);
  } catch { _showMsg('reset-err', 'Network error.'); }
}

function doLogout() {
  authToken = null; currentUser = null;
  localStorage.removeItem('pmp_token');
  localStorage.removeItem('pmp_user');
  cart = []; _saveCart();
  toggleUserMenu(false);
  _updateAuthUI();
  showToast('Logged out successfully', 'success');
  if (window.location.pathname !== '/') setTimeout(() => location.href = '/', 800);
}

function toggleUserMenu(force) {
  const m = document.getElementById('user-menu');
  if (!m) return;
  const show = force === true ? true : force === false ? false : m.style.display !== 'block';
  m.style.display = show ? 'block' : 'none';
}
document.addEventListener('click', e => {
  const m = document.getElementById('user-menu');
  const b = document.getElementById('auth-btn');
  if (m && m.style.display === 'block' && !m.contains(e.target) && e.target !== b) {
    m.style.display = 'none';
  }
});

// ── Mobile Hamburger Nav ──────────────────────────────────
function toggleMobileNav(force) {
  const drawer  = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  if (!drawer || !overlay) return;
  const show = force === true ? true : force === false ? false : !drawer.classList.contains('open');
  drawer.classList.toggle('open', show);
  overlay.classList.toggle('open', show);
  document.body.style.overflow = show ? 'hidden' : '';
}

function doChangePassword() {
  toggleUserMenu(false);
  const m = document.getElementById('cpw-modal');
  if (m) m.style.display = 'flex';
}
async function submitChangePw() {
  const cur = _val('cpw-current'), nw = _val('cpw-new'), conf = _val('cpw-confirm');
  _hideMsg('cpw-err'); _hideMsg('cpw-msg');
  if (!cur || !nw || !conf)  return _showMsg('cpw-err', 'Fill all fields.');
  if (nw !== conf)           return _showMsg('cpw-err', 'New passwords do not match.');
  if (nw.length < 6)         return _showMsg('cpw-err', 'Minimum 6 characters.');
  try {
    const d = await _post('/api/auth/change-password', { currentPassword:cur, newPassword:nw }, true);
    if (d.success) {
      _showMsg('cpw-msg', '✅ ' + d.message);
      setTimeout(() => { const m=document.getElementById('cpw-modal'); if(m) m.style.display='none'; }, 2000);
    } else _showMsg('cpw-err', d.message);
  } catch { _showMsg('cpw-err', 'Network error.'); }
}

// ════════════════════════════════════════════════════════════
// CART
// ════════════════════════════════════════════════════════════
function renderCartCount() {
  const n = cart.reduce((s,i) => s + i.quantity, 0);
  document.querySelectorAll('#cart-badge').forEach(el => el.textContent = n);
}

function addToCart(id, name, image, price, discountedPrice) {
  const ex = cart.find(i => i.id === id);
  if (ex) ex.quantity++;
  else cart.push({ id, name, image, price, discountedPrice, quantity: 1 });
  _saveCart();
  showToast('✅ Added: ' + name.substring(0,35) + (name.length>35?'...':''), 'success');
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  _saveCart();
  _renderCartDrawer();
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) removeFromCart(id);
  else { _saveCart(); _renderCartDrawer(); }
}

function _renderCartDrawer() {
  const list   = document.getElementById('cart-items-list');
  const footer = document.getElementById('cart-footer');
  if (!list) return;
  if (!cart.length) {
    list.innerHTML = `<div style="text-align:center;padding:60px 20px;">
      <div style="font-size:3.5rem;margin-bottom:16px;">🛒</div>
      <p style="color:rgba(255,255,255,0.35);margin:0 0 20px;">Your cart is empty</p>
      <a href="/products" style="color:#4ade80;font-weight:600;text-decoration:none;">Browse Parts →</a>
    </div>`;
    if (footer) footer.style.display = 'none';
    return;
  }
  let subtotal = 0, savings = 0;
  list.innerHTML = cart.map(i => {
    const line = i.discountedPrice * i.quantity;
    subtotal += line;
    savings  += (i.price - i.discountedPrice) * i.quantity;
    return `<div style="display:flex;gap:14px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.06);align-items:center;">
      <img src="${i.image}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0;background:rgba(170,230,180,0.10);" onerror="this.src='https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=64'">
      <div style="flex:1;min-width:0;">
        <p style="color:#fff;font-size:0.875rem;font-weight:600;margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i.name}</p>
        <p style="color:#4ade80;font-weight:700;margin:0 0 8px;">₹${i.discountedPrice.toLocaleString('en-IN')}</p>
        <div style="display:flex;align-items:center;gap:8px;">
          <button onclick="updateQty('${i.id}',-1)" style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:1.1rem;line-height:1;">−</button>
          <span style="color:#fff;font-size:0.9rem;font-weight:600;min-width:22px;text-align:center;">${i.quantity}</span>
          <button onclick="updateQty('${i.id}',1)"  style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:1.1rem;line-height:1;">+</button>
        </div>
      </div>
      <button onclick="removeFromCart('${i.id}')" style="background:none;border:none;color:rgba(255,255,255,0.25);font-size:1.3rem;cursor:pointer;padding:4px;line-height:1;flex-shrink:0;">✕</button>
    </div>`;
  }).join('');
  if (footer) {
    footer.style.display = 'block';
    _setEl('cart-subtotal', '₹' + subtotal.toLocaleString('en-IN'));
    _setEl('cart-savings',  '₹' + savings.toLocaleString('en-IN'));
  }
}

function openCart() {
  _renderCartDrawer();
  _show('cart-overlay'); _show('cart-drawer');
}
function closeCart() {
  _hide('cart-overlay'); _hide('cart-drawer');
}

// ════════════════════════════════════════════════════════════
// CHECKOUT
// ════════════════════════════════════════════════════════════
function openCheckout() {
  closeCart();
  if (!currentUser) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return; }
  _setInput('co-name',  currentUser.firstName + ' ' + (currentUser.lastName||''));
  _setInput('co-email', currentUser.email || '');
  const finalTotal = cart.reduce((s,i) => s + i.discountedPrice * i.quantity, 0);
  _setEl('co-total', '₹' + finalTotal.toLocaleString('en-IN'));
  _show('checkout-modal');
}

async function placeOrderRazorpay() {
  if (!cart.length) return;
  const finalAmount = cart.reduce((s,i) => s + i.discountedPrice * i.quantity, 0);
  const name  = _val('co-name'), phone = _val('co-phone'), email = _val('co-email'), notes = _val('co-notes');
  if (!name || !phone) return _showMsg('checkout-err', 'Please fill your name and phone number.');
  _hideMsg('checkout-err'); _hideMsg('checkout-ok');
  try {
    const rzpData = await _post('/api/payment/create-order', { amount: finalAmount }, true);
    if (!rzpData.success || !window.Razorpay) {
      return placeOrderCOD(); // fallback
    }
    const options = {
      key: rzpData.key,
      amount: rzpData.order.amount,
      currency: 'INR',
      name: 'Pauls Motor Parts',
      description: 'Auto Parts Order',
      order_id: rzpData.order.id,
      prefill: { name, email, contact: phone },
      theme: { color: '#4ade80' },
      handler: async (response) => {
        try {
          const orderRes = await _post('/api/orders/place', {
            paymentMethod: 'razorpay', notes,
            customerInfo: { name, phone, email }, items: cart
          }, true);
          if (orderRes.success) {
            await _post('/api/payment/verify', {
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderId: orderRes.order._id
            }, true);
            cart = []; _saveCart();
            _hide('checkout-modal');
            showToast('🎉 Order ' + orderRes.order.orderId + ' placed & paid!', 'success');
          }
        } catch(e) { _showMsg('checkout-err', 'Payment captured but order save failed. Contact support.'); }
      }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch(e) { _showMsg('checkout-err', 'Payment init failed: ' + e.message); }
}

async function placeOrderCOD() {
  const name  = _val('co-name'), phone = _val('co-phone');
  const email = _val('co-email'), notes = _val('co-notes');
  _hideMsg('checkout-err'); _hideMsg('checkout-ok');
  if (!name || !phone) return _showMsg('checkout-err', 'Please fill your name and phone number.');
  try {
    const d = await _post('/api/orders/place', {
      paymentMethod: 'whatsapp', notes,
      customerInfo: { name, phone, email }, items: cart
    }, true);
    if (d.success) {
      const summary = cart.map(i => `${i.name} x${i.quantity}`).join(', ');
      const waMsg = encodeURIComponent(
        `Hello! I just placed an order on Pauls Motor Parts.\n\nOrder ID: ${d.order.orderId}\nItems: ${summary}\nTotal: ₹${d.order.finalAmount}\n\nPlease confirm my order. Thank you!`
      );
      cart = []; _saveCart();
      _hide('checkout-modal');
      showToast('✅ Order ' + d.order.orderId + ' placed!', 'success');
      setTimeout(() => window.open('https://wa.me/91XXXXXXXXXX?text=' + waMsg, '_blank'), 800);
    } else { _showMsg('checkout-err', d.message); }
  } catch(e) { _showMsg('checkout-err', 'Network error: ' + e.message); }
}

// ════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════
function productCard(p) {
  const img   = (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80';
  const final = p.discountedPrice || p.price;
  const hasDis = p.discountPercent > 0;
  return `<div class="product-card" onclick="viewProduct('${p._id}')">
    <div style="position:relative;overflow:hidden;">
      <img class="product-img" src="${img}" alt="${_esc(p.name)}" loading="lazy"
        onerror="this.src='https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&q=80'">
      ${hasDis ? `<span style="position:absolute;top:12px;left:12px;background:#22c55e;color:#000;padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:800;">${p.discountPercent}% OFF</span>` : ''}
      ${p.isFeatured ? `<span style="position:absolute;top:12px;right:12px;background:rgba(74,222,128,0.9);color:#000;padding:3px 10px;border-radius:6px;font-size:0.7rem;font-weight:800;">⭐ FEATURED</span>` : ''}
    </div>
    <div class="product-body">
      <p class="product-brand">${p.brand || p.category}</p>
      <p class="product-name">${p.name}</p>
      <p class="product-desc">${p.shortDescription || p.description}</p>
      <div class="price-row">
        <span class="price-final">₹${final.toLocaleString('en-IN')}</span>
        ${hasDis ? `<span class="price-original">₹${p.price.toLocaleString('en-IN')}</span>` : ''}
      </div>
      <button class="btn-add-cart" onclick="event.stopPropagation();addToCart('${p._id}','${_esc(p.name)}','${img}',${p.price},${final})">
        Add to Cart 🛒
      </button>
    </div>
  </div>`;
}

async function viewProduct(id) {
  const modal   = document.getElementById('product-modal');
  const content = document.getElementById('product-modal-content');
  if (!modal || !content) return;
  content.innerHTML = '<div style="text-align:center;padding:60px;color:rgba(255,255,255,0.3);">Loading...</div>';
  modal.style.display = 'flex';
  try {
    const d = await _get('/api/products/' + id);
    const p = d.product;
    if (!p) throw new Error('Not found');
    const img   = (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80';
    const final = p.discountedPrice || p.price;
    const save  = p.price - final;
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start;">
        <div>
          <img src="${img}" alt="${_esc(p.name)}"
            style="width:100%;border-radius:14px;object-fit:cover;max-height:320px;background:rgba(170,230,180,0.10);"
            onerror="this.src='https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&q=80'">
          ${p.images && p.images.length > 1 ? `<div style="display:flex;gap:8px;margin-top:10px;">
            ${p.images.slice(1,4).map(im=>`<img src="${im}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);" onclick="this.parentElement.previousElementSibling.src='${im}'">`).join('')}
          </div>` : ''}
        </div>
        <div>
          <p style="color:#4ade80;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">${p.brand||p.category}</p>
          <h2 style="color:#fff;font-size:1.4rem;font-weight:800;margin:0 0 8px;line-height:1.3;letter-spacing:-0.02em;">${p.name}</h2>
          ${p.partNumber ? `<p style="color:rgba(255,255,255,0.3);font-size:0.8rem;margin:0 0 16px;font-family:monospace;">Part No: ${p.partNumber}</p>` : ''}
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
            <span style="font-size:2rem;font-weight:800;color:#fff;">₹${final.toLocaleString('en-IN')}</span>
            ${p.discountPercent > 0 ? `
              <span style="color:rgba(255,255,255,0.3);font-size:1rem;text-decoration:line-through;">₹${p.price.toLocaleString('en-IN')}</span>
              <span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.25);padding:3px 10px;border-radius:6px;font-size:0.8rem;font-weight:800;">${p.discountPercent}% OFF — Save ₹${save.toLocaleString('en-IN')}</span>` : ''}
          </div>
          <p style="color:rgba(255,255,255,0.55);font-size:0.9rem;line-height:1.65;margin:0 0 16px;">${p.description}</p>
          ${p.compatibility?.length ? `<p style="color:rgba(255,255,255,0.3);font-size:0.8rem;margin:0 0 16px;">
            <span style="color:rgba(255,255,255,0.5);">Fits:</span> ${p.compatibility.join(' · ')}</p>` : ''}
          <p style="font-size:0.875rem;margin:0 0 20px;${p.stock > 0 ? 'color:#22c55e;' : 'color:#ef4444;'}">
            ${p.stock > 0 ? `✓ In Stock (${p.stock} units available)` : '✗ Currently Out of Stock'}
          </p>
          ${p.specifications?.length ? `<div style="border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;margin-bottom:20px;">
            ${p.specifications.map((s,i) => `<div style="display:flex;justify-content:space-between;padding:10px 14px;${i>0?'border-top:1px solid rgba(255,255,255,0.05);':''}">
              <span style="color:rgba(255,255,255,0.4);font-size:0.85rem;">${s.key}</span>
              <span style="color:#fff;font-size:0.85rem;font-weight:600;">${s.value}</span>
            </div>`).join('')}
          </div>` : ''}
          <button class="btn-add-cart" style="${p.stock === 0 ? 'opacity:0.4;cursor:not-allowed;' : ''}"
            ${p.stock === 0 ? 'disabled' : ''}
            onclick="addToCart('${p._id}','${_esc(p.name)}','${img}',${p.price},${final});closeProductModal();">
            Add to Cart 🛒
          </button>
        </div>
      </div>`;
  } catch(e) {
    content.innerHTML = '<p style="color:#f87171;text-align:center;padding:40px;">Failed to load product details.</p>';
  }
}

function closeProductModal() {
  const m = document.getElementById('product-modal');
  if (m) m.style.display = 'none';
}

// ════════════════════════════════════════════════════════════
// HOME PAGE
// ════════════════════════════════════════════════════════════
function _animateHero() {
  const heading = document.getElementById('hero-heading');
  if (!heading) return;
  const lines = ['Premium Auto Parts.', 'Built to Last.'];
  const DELAY = 30;
  let totalChars = 0;
  lines.forEach((line, li) => {
    const div = document.createElement('div');
    [...line].forEach((ch, ci) => {
      const span = document.createElement('span');
      span.style.cssText = 'display:inline-block;opacity:0;transform:translateX(-18px);transition:opacity 500ms ease,transform 500ms ease;white-space:pre;';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      const delay = 200 + (li * line.length * DELAY) + (ci * DELAY);
      setTimeout(() => { span.style.opacity='1'; span.style.transform='translateX(0)'; }, delay);
      div.appendChild(span);
      totalChars++;
    });
    heading.appendChild(div);
  });
  const maxDelay = 200 + lines.length * 30 * DELAY;
  setTimeout(() => {
    ['hero-sub','hero-btns','hero-tag'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.opacity = '1';
    });
  }, maxDelay + 200);
}

const CAT_META = {
  'Engine':     { icon:'⚙️',  color:'#4ade80' },
  'Brakes':     { icon:'🔴',  color:'#ef4444' },
  'Filters':    { icon:'🔵',  color:'#3b82f6' },
  'Electrical': { icon:'⚡',  color:'#eab308' },
  'Tyres':      { icon:'🔘',  color:'#8b5cf6' },
  'Lubricants': { icon:'🟢',  color:'#22c55e' },
  'Hardware':   { icon:'🔩',  color:'#94a3b8' },
  'Accessories':{ icon:'🔧',  color:'#f59e0b' },
};

async function _loadHomeCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;
  try {
    const d = await _get('/api/products/categories');
    grid.innerHTML = (d.categories||[]).map(c => {
      const m = CAT_META[c] || { icon:'🔩', color:'#4ade80' };
      return `<a href="/products?category=${encodeURIComponent(c)}" class="cat-card">
        <span class="cat-icon">${m.icon}</span>
        <p class="cat-name">${c}</p>
        <p class="cat-count" style="color:${m.color};">View Parts →</p>
      </a>`;
    }).join('');
  } catch { grid.innerHTML = '<p style="color:rgba(255,255,255,0.3);grid-column:1/-1;">Could not load categories.</p>'; }
}

async function _loadHomeFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  try {
    const d = await _get('/api/products?featured=true&limit=8');
    if (!d.products?.length) { grid.innerHTML = '<p style="color:rgba(255,255,255,0.3);">No featured products yet.</p>'; return; }
    grid.innerHTML = d.products.map(p => productCard(p)).join('');
  } catch { grid.innerHTML = '<p style="color:rgba(255,255,255,0.3);">Could not load products.</p>'; }
}

// ════════════════════════════════════════════════════════════
// PRODUCTS PAGE
// ════════════════════════════════════════════════════════════
let _pCat = 'All', _pSort = 'newest', _pSearch = '', _pPage = 1, _searchTimer;

function _initProductsPage() {
  const urlCat = new URLSearchParams(window.location.search).get('category');
  if (urlCat) { _pCat = urlCat; }
  _loadCatFilters();
  _loadProducts();
}

async function _loadCatFilters() {
  const row = document.getElementById('filter-row');
  if (!row) return;
  try {
    const d = await _get('/api/products/categories');
    row.innerHTML = `<button class="filter-btn ${_pCat==='All'?'active':''}" onclick="setCategory('All',this)">All</button>`;
    (d.categories||[]).forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (_pCat===c?' active':'');
      btn.textContent = c;
      btn.onclick = () => setCategory(c, btn);
      row.appendChild(btn);
    });
  } catch {}
}

function setCategory(cat, btn) {
  _pCat = cat; _pPage = 1;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _loadProducts();
}
function applySort(val) { _pSort = val; _pPage = 1; _loadProducts(); }
function debounceSearch(val) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => { _pSearch = val; _pPage = 1; _loadProducts(); }, 400);
}

async function _loadProducts() {
  const grid  = document.getElementById('products-grid');
  const count = document.getElementById('results-count');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:80px;">
    <div style="font-size:2.5rem;margin-bottom:12px;">⏳</div>
    <p style="color:rgba(255,255,255,0.3);">Loading parts catalog...</p>
  </div>`;
  try {
    const p = new URLSearchParams({ sort: _pSort, page: _pPage, limit: 24 });
    if (_pCat !== 'All') p.set('category', _pCat);
    if (_pSearch) p.set('search', _pSearch);
    const d = await _get('/api/products?' + p);
    if (!d.products?.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:80px;">
        <div style="font-size:3rem;margin-bottom:16px;">🔍</div>
        <p style="color:rgba(255,255,255,0.35);font-size:1.1rem;">No parts found for that search.</p>
        <p style="color:rgba(255,255,255,0.2);font-size:0.9rem;margin-top:8px;">Try a different keyword or category.</p>
      </div>`;
      if (count) count.textContent = '';
      renderPagination(1, 1);
      return;
    }
    if (count) count.textContent = `Showing ${((_pPage-1)*24)+1}–${Math.min(_pPage*24, d.total)} of ${d.total} parts`;
    grid.innerHTML = d.products.map(p => productCard(p)).join('');
    renderPagination(d.page, d.pages);
  } catch(e) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:#f87171;">Error loading products. Check your connection.</div>`;
  }
}

function renderPagination(page, pages) {
  const el = document.getElementById('pagination');
  if (!el) return;
  if (pages <= 1) { el.innerHTML=''; return; }
  let html = '';
  if (page > 1) html += `<button onclick="goPage(${page-1})" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:9px 18px;border-radius:8px;cursor:pointer;font-family:inherit;">← Prev</button>`;
  for (let i = Math.max(1,page-2); i <= Math.min(pages,page+2); i++) {
    html += `<button onclick="goPage(${i})" style="background:${i===page?'#4ade80':'rgba(255,255,255,0.08)'};color:${i===page?'#000':'#fff'};border:1px solid ${i===page?'#4ade80':'rgba(255,255,255,0.12)'};padding:9px 18px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:${i===page?700:400};">${i}</button>`;
  }
  if (page < pages) html += `<button onclick="goPage(${page+1})" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:9px 18px;border-radius:8px;cursor:pointer;font-family:inherit;">Next →</button>`;
  el.innerHTML = html;
}

function goPage(p) { _pPage = p; _loadProducts(); window.scrollTo({ top: 0, behavior:'smooth' }); }

// ════════════════════════════════════════════════════════════
// ORDERS PAGE
// ════════════════════════════════════════════════════════════
async function _initOrdersPage() {
  if (!authToken) { location.href = '/'; return; }
  const list = document.getElementById('orders-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:60px;color:rgba(255,255,255,0.3);">Loading your orders...</div>';
  try {
    const d = await _get('/api/orders/my', true);
    if (!d.orders?.length) {
      list.innerHTML = `<div style="text-align:center;padding:80px 20px;">
        <div style="font-size:4rem;margin-bottom:20px;">📦</div>
        <p style="color:rgba(255,255,255,0.4);font-size:1.1rem;margin:0 0 24px;">No orders yet</p>
        <a href="/products" style="background:#4ade80;color:#000;padding:14px 28px;border-radius:10px;font-weight:700;text-decoration:none;font-size:1rem;">Browse Parts →</a>
      </div>`;
      return;
    }
    const COLS = { placed:'#4ade80',confirmed:'#3b82f6',processing:'#eab308',ready:'#8b5cf6',delivered:'#22c55e',cancelled:'#ef4444' };
    list.innerHTML = d.orders.map(o => {
      const col = COLS[o.status] || '#666';
      return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:20px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap;">
          <div>
            <p style="color:#fff;font-weight:800;font-size:1.1rem;margin:0 0 4px;letter-spacing:-0.01em;">${o.orderId}</p>
            <p style="color:rgba(255,255,255,0.3);font-size:0.8rem;margin:0;">${new Date(o.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
          </div>
          <span style="background:${col}18;color:${col};border:1px solid ${col}30;padding:6px 14px;border-radius:20px;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">${o.status}</span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;margin-bottom:16px;">
          ${o.items.map(i=>`<div style="display:flex;gap:14px;padding:8px 0;align-items:center;">
            <img src="${i.image||''}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;flex-shrink:0;background:rgba(170,230,180,0.10);" onerror="this.style.background='rgba(170,230,180,0.14)'">
            <div style="flex:1;min-width:0;">
              <p style="color:#fff;font-size:0.875rem;font-weight:600;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i.name}</p>
              <p style="color:rgba(255,255,255,0.35);font-size:0.8rem;margin:0;">Qty: ${i.quantity} × ₹${(i.discountedPrice||i.price)?.toLocaleString('en-IN')}</p>
            </div>
            <p style="color:#fff;font-weight:700;margin:0;white-space:nowrap;">₹${((i.discountedPrice||i.price)*i.quantity).toLocaleString('en-IN')}</p>
          </div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;gap:8px;">
          <span style="color:rgba(255,255,255,0.35);font-size:0.8rem;background:rgba(255,255,255,0.04);padding:4px 12px;border-radius:6px;">${(o.payment?.method||'—').toUpperCase()} · ${o.payment?.status||'—'}</span>
          <div style="text-align:right;">
            ${o.discountAmount>0?`<p style="color:#22c55e;font-size:0.8rem;margin:0 0 2px;">Saved ₹${o.discountAmount.toLocaleString('en-IN')}</p>`:''}
            <p style="color:#fff;font-weight:800;font-size:1.2rem;margin:0;">₹${o.finalAmount?.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = '<p style="color:#f87171;text-align:center;padding:40px;">Error loading orders. Please refresh.</p>';
  }
}

// ════════════════════════════════════════════════════════════
// ADMIN PAGE — forward to admin.js logic
// ════════════════════════════════════════════════════════════
async function _initAdminPage() {
  if (!authToken || !currentUser) { location.href = '/'; return; }
  if (currentUser.role !== 'admin') { alert('Admin access only.'); location.href = '/'; return; }
  _setEl('admin-name-display', currentUser.firstName + ' (Admin)');
  if (typeof loadDashboard === 'function') loadDashboard();
}

// ════════════════════════════════════════════════════════════
// CHATBOT
// ════════════════════════════════════════════════════════════
function _initChatbot() {
  const panel = document.getElementById('chatbot-panel');
  if (!panel) return;
  if (!document.getElementById('chatbot-messages').children.length) {
    appendBotMsg("👋 Welcome to Pauls Motor Parts!\n\nI'm your AI parts assistant. Tell me what you need, your vehicle model, or tap **📸 Photo** to search by image.\n\nExamples: _\"brake pads for Swift\"_, _\"NGK spark plug\"_, _\"filter for i20 diesel\"_");
  }
}

function openChatbot() {
  const panel = document.getElementById('chatbot-panel');
  const ov    = document.getElementById('chatbot-overlay');
  if (panel) panel.style.display = 'flex';
  if (ov)    ov.style.display = 'block';
  const fab = document.getElementById('chatbot-fab');
  if (fab) fab.style.display = 'none';
  _initChatbot();
}
function closeChatbot() {
  const panel = document.getElementById('chatbot-panel');
  const ov    = document.getElementById('chatbot-overlay');
  if (panel) panel.style.display = 'none';
  if (ov)    ov.style.display = 'none';
  const fab = document.getElementById('chatbot-fab');
  if (fab) fab.style.display = 'flex';
  closeCamera();
}

function appendBotMsg(text) {
  const box = document.getElementById('chatbot-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.style.cssText = 'align-self:flex-start;background:rgba(255,255,255,0.07);color:#fff;padding:12px 16px;border-radius:18px 18px 18px 4px;font-size:0.9rem;max-width:88%;line-height:1.6;border:1px solid rgba(255,255,255,0.08);';
  div.innerHTML = text
    .replace(/\n/g,'<br>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/_(.*?)_/g,'<em style="color:#4ade80;">$1</em>');
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function appendUserMsg(text) {
  const box = document.getElementById('chatbot-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.style.cssText = 'align-self:flex-end;background:#4ade80;color:#000;padding:10px 16px;border-radius:18px 18px 4px 18px;font-size:0.9rem;max-width:80%;font-weight:600;';
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function _showTyping() {
  const box = document.getElementById('chatbot-messages');
  if (!box) return null;
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.style.cssText = 'align-self:flex-start;background:rgba(255,255,255,0.07);padding:14px 18px;border-radius:18px;border:1px solid rgba(255,255,255,0.08);';
  div.innerHTML = '<div style="display:flex;gap:6px;align-items:center;"><span style="width:8px;height:8px;background:rgba(255,255,255,0.4);border-radius:50%;animation:blink 1.2s infinite;"></span><span style="width:8px;height:8px;background:rgba(255,255,255,0.4);border-radius:50%;animation:blink 1.2s 0.2s infinite;"></span><span style="width:8px;height:8px;background:rgba(255,255,255,0.4);border-radius:50%;animation:blink 1.2s 0.4s infinite;"></span></div>';
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function _appendProducts(products) {
  if (!products?.length) return;
  const box = document.getElementById('chatbot-messages');
  if (!box) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%;';
  products.slice(0,5).forEach(p => {
    const img   = (p.images&&p.images[0])||'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80';
    const final = p.discountedPrice || p.price;
    const card  = document.createElement('div');
    card.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;cursor:pointer;transition:0.2s;display:flex;gap:12px;align-items:center;';
    card.onmouseenter = () => card.style.borderColor='rgba(74,222,128,0.4)';
    card.onmouseleave = () => card.style.borderColor='rgba(255,255,255,0.1)';
    card.onclick = () => viewProduct(p._id);
    card.innerHTML = `
      <img src="${img}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;flex-shrink:0;background:rgba(170,230,180,0.10);" onerror="this.src='https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=52'">
      <div style="flex:1;min-width:0;">
        <p style="color:#fff;font-size:0.82rem;font-weight:600;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</p>
        <p style="color:#4ade80;font-size:0.88rem;font-weight:700;margin:0;">₹${final.toLocaleString('en-IN')} ${p.discountPercent>0?`<span style="color:#22c55e;font-size:0.72rem;font-weight:700;">(${p.discountPercent}% OFF)</span>`:''}</p>
      </div>
      <button onclick="event.stopPropagation();addToCart('${p._id}','${_esc(p.name)}','${img}',${p.price},${final})"
        style="background:#4ade80;color:#000;border:none;border-radius:8px;padding:7px 12px;font-size:0.78rem;font-weight:800;cursor:pointer;white-space:nowrap;font-family:inherit;flex-shrink:0;">+Cart</button>`;
    wrap.appendChild(card);
  });
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg   = (input?.value||'').trim();
  if (!msg && !capturedImageBase64) return;
  if (msg) appendUserMsg(msg);
  else     appendUserMsg('📸 [Photo — searching by image]');
  if (input) input.value = '';
  const typing = _showTyping();
  try {
    const body = { message: msg };
    if (capturedImageBase64) { body.imageBase64 = capturedImageBase64; capturedImageBase64 = null; clearPhoto(); }
    const d = await _post('/api/chat/message', body);
    if (typing) typing.remove();
    appendBotMsg(d.message || "Sorry, I couldn't process that. Please try again.");
    if (d.products?.length) _appendProducts(d.products);
  } catch {
    if (typing) typing.remove();
    appendBotMsg("Connection error. Please check your internet and try again.");
  }
}

// ── Camera ────────────────────────────────────────────────
function openChatbotCamera() {
  openChatbot();
  const area  = document.getElementById('camera-area');
  const video = document.getElementById('cam-video');
  if (!area || !video) return;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      cameraStream = stream;
      video.srcObject = stream;
      area.style.display = 'block';
    })
    .catch(() => {
      showToast('Camera access denied — opening gallery instead', 'error');
      openChatbotGallery();
    });
}

// ── Gallery (choose existing photo) ──────────────────────
function openChatbotGallery() {
  openChatbot();
  const inp = document.getElementById('gallery-file-input');
  if (inp) inp.click();
}

function handleGalleryFile(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    capturedImageBase64 = ev.target.result.split(',')[1];
    _showPhotoPreview(ev.target.result);
  };
  reader.readAsDataURL(f);
  input.value = ''; // allow re-selecting the same file later
}

function capturePhoto() {
  const video  = document.getElementById('cam-video');
  const canvas = document.getElementById('cam-canvas');
  if (!video||!canvas) return;
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataURL = canvas.toDataURL('image/jpeg', 0.85);
  capturedImageBase64 = dataURL.split(',')[1];
  closeCamera();
  _showPhotoPreview(dataURL);
}

function _showPhotoPreview(src) {
  const area = document.getElementById('img-preview-area');
  const img  = document.getElementById('img-preview');
  if (area) area.style.display = 'block';
  if (img)  img.src = src;
  appendBotMsg("📸 Photo ready! Hit send or type a description to search for this part in our catalog.");
}

function closeCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  const area = document.getElementById('camera-area');
  if (area) area.style.display = 'none';
}

function clearPhoto() {
  capturedImageBase64 = null;
  const area = document.getElementById('img-preview-area');
  const img  = document.getElementById('img-preview');
  if (area) area.style.display = 'none';
  if (img)  img.src = '';
}

// ════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════
let _toastTimer;
function showToast(msg, type='') {
  let t = document.getElementById('pmp-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'pmp-toast';
    t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(20px);background:rgba(170,230,180,0.10);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:12px 24px;border-radius:12px;font-size:0.9rem;font-weight:500;z-index:9999;opacity:0;transition:all 0.35s ease;pointer-events:none;white-space:nowrap;font-family:Inter,sans-serif;max-width:90vw;text-align:center;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = type==='success'?'rgba(16,185,129,0.14)':type==='error'?'rgba(239,68,68,0.12)':'rgba(170,230,180,0.10)';
  t.style.borderColor = type==='success'?'rgba(16,185,129,0.35)':type==='error'?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.12)';
  t.style.color       = type==='success'?'#34d399':type==='error'?'#f87171':'#fff';
  clearTimeout(_toastTimer);
  setTimeout(() => { t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; }, 10);
  _toastTimer = setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; }, 3500);
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════
async function _get(url, auth=false) {
  const opts = auth ? { headers: _h() } : {};
  try {
    const r = await fetch(url, opts);
    const data = await r.json();
    if (data.success && data.products) _mockStore.products = data.products;
    return data;
  } catch(e) {
    return _mockFallback(url);
  }
}

// =====================================
// MOCK DATA — shown when MongoDB is not yet connected
// =====================================
const _mockStore = { products: null };

const MOCK_PRODUCTS = [
  { _id:'mock01', name:'NGK Iridium Spark Plug Set (4-Pack)', shortDescription:'Iridium spark plugs for 4-cyl petrol engines', price:1200, discountPercent:10, discountedPrice:1080, hasDiscount:true, category:'Ignition', brand:'NGK', partNumber:'NGK-BKR6EIX-4PK', stock:48, isActive:true, isFeatured:true, images:['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&q=80'], compatibility:['Maruti Swift','Hyundai i20','Honda City'], tags:['spark plug','ignition'], specifications:[], ratings:{average:4.5,count:32} },
  { _id:'mock02', name:'Mobil 1 Full Synthetic Engine Oil 5W-30 (4L)', shortDescription:'Full synthetic 5W-30 engine oil, 4 litres', price:2800, discountPercent:15, discountedPrice:2380, hasDiscount:true, category:'Engine Oil', brand:'MOBIL', partNumber:'MOB-5W30-4L', stock:60, isActive:true, isFeatured:true, images:['https://images.unsplash.com/photo-1615906656303-2f2dc91d56ee?w=500&q=80'], compatibility:['Universal'], tags:['engine oil','synthetic'], specifications:[], ratings:{average:4.8,count:87} },
  { _id:'mock03', name:'Gates PowerGrip Timing Belt Kit', shortDescription:'Complete timing belt kit with tensioner', price:3500, discountPercent:0, discountedPrice:3500, hasDiscount:false, category:'Belts & Hoses', brand:'GATES', partNumber:'GAT-TB-K025372XS', stock:22, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80'], compatibility:['Hyundai Creta','Kia Seltos'], tags:['timing belt'], specifications:[], ratings:{average:4.6,count:19} },
  { _id:'mock04', name:'Exide FFS0-EX35B20 Car Battery 35Ah', shortDescription:'35Ah maintenance-free battery, 30-month warranty', price:4200, discountPercent:8, discountedPrice:3864, hasDiscount:true, category:'Battery', brand:'EXIDE', partNumber:'EXD-FFS0-EX35B20', stock:14, isActive:true, isFeatured:true, images:['https://images.unsplash.com/photo-1558618047-f4e90e05f1f5?w=500&q=80'], compatibility:['Maruti Alto','Hyundai i10'], tags:['battery'], specifications:[], ratings:{average:4.4,count:56} },
  { _id:'mock05', name:'Hella H4 Headlight Bulb Set (Pair)', shortDescription:'H4 halogen headlight bulbs, 20% brighter (pair)', price:650, discountPercent:0, discountedPrice:650, hasDiscount:false, category:'Lighting', brand:'HELLA', partNumber:'HEL-H4-SET', stock:85, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1558979158-65a1eaa08691?w=500&q=80'], compatibility:['Universal H4 Fitment'], tags:['bulb','headlight'], specifications:[], ratings:{average:4.3,count:44} },
  { _id:'mock06', name:'Bosch Aerotwin Wiper Blade Set (Front Pair)', shortDescription:'Flat beam wipers, spoiler-free (front pair)', price:980, discountPercent:5, discountedPrice:931, hasDiscount:true, category:'Wipers', brand:'BOSCH', partNumber:'BSC-AM-SET-24-18', stock:40, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1614886137799-35f7f06e44f3?w=500&q=80'], compatibility:['Honda City','Hyundai Creta'], tags:['wiper'], specifications:[], ratings:{average:4.5,count:38} },
  { _id:'mock07', name:'Federal-Mogul Ferodo Ceramic Brake Pads (Front)', shortDescription:'Ceramic front brake pads, low dust, set of 4', price:1450, discountPercent:12, discountedPrice:1276, hasDiscount:true, category:'Brakes', brand:'FEDERAL-MOGUL', partNumber:'FM-FDB4453', stock:30, isActive:true, isFeatured:true, images:['https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=500&q=80'], compatibility:['Maruti Swift','Maruti Dzire'], tags:['brake pads'], specifications:[], ratings:{average:4.7,count:61} },
  { _id:'mock08', name:'Apollo Amazer 4G Evo Tyre 185/65 R15', shortDescription:'185/65 R15 all-season radial tyre', price:4800, discountPercent:0, discountedPrice:4800, hasDiscount:false, category:'Tyres', brand:'APOLLO', partNumber:'APL-AMZ4GEV-18565R15', stock:18, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&q=80'], compatibility:['Hyundai i20','Maruti Baleno'], tags:['tyre'], specifications:[], ratings:{average:4.4,count:27} },
  { _id:'mock09', name:'Denso OEM Replacement Air Filter', shortDescription:'OEM-grade air filter, high-flow media', price:420, discountPercent:0, discountedPrice:420, hasDiscount:false, category:'Filters', brand:'DENSO', partNumber:'DNS-AF-260', stock:55, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1615906656303-2f2dc91d56ee?w=500&q=80'], compatibility:['Toyota Fortuner','Toyota Innova'], tags:['air filter'], specifications:[], ratings:{average:4.6,count:33} },
  { _id:'mock10', name:'K&N High-Flow Washable Air Filter', shortDescription:'Washable high-flow cotton gauze air filter', price:2200, discountPercent:10, discountedPrice:1980, hasDiscount:true, category:'Filters', brand:'K&N', partNumber:'KN-33-2970', stock:25, isActive:true, isFeatured:true, images:['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80'], compatibility:['Maruti','Hyundai','Honda'], tags:['air filter','k&n'], specifications:[], ratings:{average:4.8,count:52} },
  { _id:'mock11', name:'Valeo 3-Piece Clutch Kit', shortDescription:'Complete 3-piece OEM clutch kit', price:6800, discountPercent:5, discountedPrice:6460, hasDiscount:true, category:'Drivetrain', brand:'VALEO', partNumber:'VAL-826564', stock:10, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1558618047-f4e90e05f1f5?w=500&q=80'], compatibility:['Maruti Swift','Maruti Dzire'], tags:['clutch'], specifications:[], ratings:{average:4.5,count:14} },
  { _id:'mock12', name:'Minda Disc Horn Pair (12V)', shortDescription:'Disc horn pair, 118 dB, weather-resistant', price:550, discountPercent:0, discountedPrice:550, hasDiscount:false, category:'Electricals', brand:'MINDA', partNumber:'MND-HRN-DISC-12V', stock:70, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1558979158-65a1eaa08691?w=500&q=80'], compatibility:['Universal 12V'], tags:['horn'], specifications:[], ratings:{average:4.2,count:29} },
  { _id:'mock13', name:'Bosch Premium Oil Filter', shortDescription:'Full-flow oil filter with anti-drain back valve', price:380, discountPercent:0, discountedPrice:380, hasDiscount:false, category:'Filters', brand:'BOSCH', partNumber:'BSC-0451103141', stock:90, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1614886137799-35f7f06e44f3?w=500&q=80'], compatibility:['Maruti','Hyundai','Honda','Tata'], tags:['oil filter'], specifications:[], ratings:{average:4.6,count:75} },
  { _id:'mock14', name:'Federal-Mogul Gas Front Shock Absorber', shortDescription:'Gas front shock absorber, nitrogen-charged', price:2100, discountPercent:0, discountedPrice:2100, hasDiscount:false, category:'Suspension', brand:'FEDERAL-MOGUL', partNumber:'FM-SA-F001', stock:20, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=500&q=80'], compatibility:['Maruti Swift','Maruti Baleno'], tags:['shock'], specifications:[], ratings:{average:4.4,count:18} },
  { _id:'mock15', name:'Denso Inline Fuel Filter', shortDescription:'Inline fuel filter, fine micron, corrosion-resistant', price:320, discountPercent:0, discountedPrice:320, hasDiscount:false, category:'Filters', brand:'DENSO', partNumber:'DNS-FF-101', stock:65, isActive:true, isFeatured:false, images:['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=500&q=80'], compatibility:['Maruti','Hyundai','Honda'], tags:['fuel filter'], specifications:[], ratings:{average:4.5,count:22} },
];

function _mockFallback(url) {
  const base = url.split('?')[0];
  const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
  let products = _mockStore.products || MOCK_PRODUCTS;

  if (base.endsWith('/categories')) {
    const cats = [...new Set(products.filter(p=>p.isActive).map(p=>p.category))];
    return { success:true, categories: cats };
  }
  if (base.match(/\/products\/[^/]+$/)) {
    const id = base.split('/').pop();
    const p = products.find(p=>p._id===id);
    return p ? { success:true, product:p } : { success:false, message:'Not found' };
  }
  if (base.includes('/products')) {
    let list = products.filter(p=>p.isActive);
    const cat = params.get('category');
    const featured = params.get('featured');
    const search = params.get('search');
    const sort = params.get('sort');
    const limit = parseInt(params.get('limit')||'20');
    if (cat && cat!=='All') list = list.filter(p=>p.category===cat);
    if (featured==='true') list = list.filter(p=>p.isFeatured);
    if (search) { const re=new RegExp(search,'i'); list=list.filter(p=>re.test(p.name)||re.test(p.brand)||re.test(p.description||'')); }
    if (sort==='price-asc') list.sort((a,b)=>a.discountedPrice-b.discountedPrice);
    else if (sort==='price-desc') list.sort((a,b)=>b.discountedPrice-a.discountedPrice);
    return { success:true, products: list.slice(0,limit), total: list.length, page:1, pages:1 };
  }
  return { success:false, message:'Not available offline' };
}
async function _post(url, body, auth=false) {
  const headers = auth ? _h() : { 'Content-Type':'application/json' };
  try {
    const r = await fetch(url, { method:'POST', headers, body: JSON.stringify(body) });
    return r.json();
  } catch(e) {
    return _mockPostFallback(url, body);
  }
}

// ── Mock POST fallback (used when backend/DB is offline) ─────
function _getMockUsers()       { return JSON.parse(localStorage.getItem('pmp_mock_users') || '[]'); }
function _saveMockUsers(users) { localStorage.setItem('pmp_mock_users', JSON.stringify(users)); }

// Always ensure the admin account exists in local store
(function _ensureAdmin() {
  const ADMIN = { id:'admin_paul_001', firstName:'Paul', lastName:'Subhasini', email:'paulsubhasini31@gmail.com', phone:'0000000000', password:'Admin@123', role:'admin' };
  const users = _getMockUsers();
  const idx = users.findIndex(u => u.email === ADMIN.email);
  if (idx === -1) { users.push(ADMIN); _saveMockUsers(users); }
  else if (users[idx].password !== ADMIN.password || users[idx].role !== 'admin') { users[idx] = { ...users[idx], ...ADMIN }; _saveMockUsers(users); }
})();

function _mockPostFallback(url, body) {
  // LOGIN
  if (url.endsWith('/auth/login')) {
    const users = _getMockUsers();
    const { email, password } = body;
    const user = users.find(u => u.email === (email||'').toLowerCase().trim());
    if (!user) return { success:false, message:'No account found. Please register first.' };
    if (user.password !== password) return { success:false, message:'Incorrect password.' };
    const token = 'mock_token_' + user.id;
    return { success:true, token, user:{ id:user.id, firstName:user.firstName, lastName:user.lastName, email:user.email, role:user.role }, cart:[] };
  }
  // REGISTER
  if (url.endsWith('/auth/register')) {
    const { firstName, lastName, email, phone, password } = body;
    if (!firstName || !email || !phone || !password) return { success:false, message:'All fields are required.' };
    if (password.length < 6) return { success:false, message:'Password must be at least 6 characters.' };
    const regUsers = _getMockUsers();
    if (regUsers.find(u => u.email === email.toLowerCase().trim())) return { success:false, message:'Email already registered. Please login instead.' };
    const newUser = { id:'usr_'+Date.now(), firstName, lastName:lastName||'', email:email.toLowerCase().trim(), phone, password, role:'user' };
    regUsers.push(newUser);
    _saveMockUsers(regUsers);
    const token = 'mock_token_' + newUser.id;
    return { success:true, token, user:{ id:newUser.id, firstName:newUser.firstName, lastName:newUser.lastName, email:newUser.email, role:newUser.role }, cart:[], message:'Account created!' };
  }
  // FORGOT PASSWORD
  if (url.endsWith('/auth/forgot-password')) {
    const allUsers = _getMockUsers();
    const user = allUsers.find(u => u.email === (body.email||'').toLowerCase().trim());
    if (!user) return { success:false, message:'No account found with that email.' };
    return { success:true, message:'(Offline mode) Reset not available without server. Your password: contact admin.' };
  }
  // CART SYNC (non-critical — just succeed silently)
  if (url.includes('/cart')) return { success:true };
  // CHAT
  if (url.includes('/chat')) return { success:false, message:'Chat requires server connection.' };
  // Default
  return { success:false, message:'This feature requires a server connection.' };
}
function _val(id)         { return (document.getElementById(id)?.value||'').trim(); }
function _setInput(id,v)  { const el=document.getElementById(id); if(el) el.value=v||''; }
function _show(id)        { const el=document.getElementById(id); if(el) el.style.display='block'; }
function _hide(id)        { const el=document.getElementById(id); if(el) el.style.display='none'; }
function _showMsg(id,msg) { const el=document.getElementById(id); if(el){el.textContent=msg;el.style.display='block';} }
function _hideMsg(id)     { const el=document.getElementById(id); if(el) el.style.display='none'; }
function _setBtnLoad(btn,txt) { if(btn){btn.disabled=true;btn.textContent=txt;} }
function _resetBtn(btn,txt)   { if(btn){btn.disabled=false;btn.textContent=txt;} }
function _esc(s)          { return (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

// ── Inject blink keyframe ─────────────────────────────────
const _ks = document.createElement('style');
_ks.textContent = '@keyframes blink{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-5px);opacity:1}}';
document.head.appendChild(_ks);
