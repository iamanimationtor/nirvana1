import express from 'express';
import session from 'express-session';
import multer from 'multer';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fileTypeFromFile } from 'file-type';
import { imageSize } from 'image-size';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'staging.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

const app = express();
const PORT_HTTP = 8080;
const PORT_HTTPS = 8443;
let dbDown = false;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: 'nirvana-staging-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: false, // will be set to true for https via conditional
    maxAge: 8 * 3600 * 1000
  }
}));

// Trust proxy for secure cookies behind https
app.set('trust proxy', 1);

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, X-Order-Token, X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Security headers (CSP, HSTS, etc) - similar to public/.htaccess
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  // CSP for API vs public
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('Cache-Control', 'no-store');
  } else {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.zarinpal.com https://sandbox.zarinpal.com https://raw.githubusercontent.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests");
  }
  next();
});
// DB down simulation for failure tests
app.use((req,res,next) => {
  if (req.path.startsWith('/api/') && dbDown) {
    return res.status(500).json({ ok:false, error: 'DB down', code: 'db_down' });
  }
  next();
});

// Static for uploads (deny php)
app.use('/uploads', (req, res, next) => {
  if (req.path.match(/\.(php|phtml|phar|phps)$/)) {
    return res.status(403).send('Forbidden');
  }
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Also serve public images
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Helper functions
function ok(res, data = {}) {
  res.json({ ok: true, ...data });
}
function fail(res, msg, status = 400, code = 'error') {
  res.status(status).json({ ok: false, error: msg, code });
}

function rate_limit(key, max, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT hits, reset_at FROM rate_limits WHERE k = ?').get(key);
  if (!row) {
    db.prepare('INSERT INTO rate_limits (k, hits, reset_at) VALUES (?,?,?)').run(key, 1, now + windowSec);
    return;
  }
  if (now > row.reset_at) {
    db.prepare('UPDATE rate_limits SET hits = 1, reset_at = ? WHERE k = ?').run(now + windowSec, key);
    return;
  }
  if (row.hits >= max) {
    const err = new Error('Too many requests');
    err.status = 429;
    err.code = 'rate_limited';
    throw err;
  }
  db.prepare('UPDATE rate_limits SET hits = hits + 1 WHERE k = ?').run(key);
}
// Atomic version via INSERT OR REPLACE? We'll use above with transaction for atomicity
function rate_limit_atomic(key, max, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  // Use transaction for atomic increment
  const tx = db.transaction(() => {
    const row = db.prepare('SELECT hits, reset_at FROM rate_limits WHERE k = ?').get(key);
    if (!row) {
      db.prepare('INSERT INTO rate_limits (k, hits, reset_at) VALUES (?,?,?)').run(key, 1, now + windowSec);
      return;
    }
    if (now > row.reset_at) {
      db.prepare('UPDATE rate_limits SET hits = 1, reset_at = ? WHERE k = ?').run(now + windowSec, key);
      return;
    }
    if (row.hits >= max) {
      const err = new Error('درخواست‌ها بیش از حد مجاز است');
      err.status = 429;
      throw err;
    }
    db.prepare('UPDATE rate_limits SET hits = hits + 1 WHERE k = ?').run(key);
  });
  tx();
}

function idempotency_check(k) {
  const row = db.prepare("SELECT response FROM idempotency_keys WHERE k = ? AND expires_at > datetime('now')").get(k);
  return row ? JSON.parse(row.response) : null;
}
function idempotency_store(k, route, userId, response) {
  const expires = new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('INSERT OR REPLACE INTO idempotency_keys (k, route, user_id, response, expires_at) VALUES (?,?,?,?,?)').run(k, route, userId, JSON.stringify(response), expires);
}

function generate_guest_token() {
  return crypto.randomBytes(16).toString('hex') + Date.now().toString(36);
}
function hash_token(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
function verify_guest_token(provided, hash) {
  if (!provided || !hash) return false;
  return crypto.createHash('sha256').update(provided).digest('hex') === hash;
}

function public_user(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, permissions: JSON.parse(u.permissions || '[]'), createdAt: u.created_at };
}
function map_product(p) {
  return {
    id: p.id, slug: p.slug, sku: p.sku, name: p.name, nameEn: p.name_en, price: p.price, oldPrice: p.old_price, discountPercent: p.discount_percent,
    categoryId: p.category_id, categorySlug: db.prepare('SELECT slug FROM categories WHERE id = ?').get(p.category_id)?.slug, categoryName: db.prepare('SELECT name FROM categories WHERE id = ?').get(p.category_id)?.name,
    shortDesc: p.short_desc, description: p.description, features: JSON.parse(p.features || '[]'), variants: JSON.parse(p.variants || '[]'), images: JSON.parse(p.images || '[]'),
    stock: p.stock, minStock: p.min_stock, prepTime: p.prep_time, material: p.material, status: p.status, featured: !!p.featured, sku: p.sku
  };
}
function map_order(o) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  return {
    id: o.id, publicId: o.public_id, userId: o.user_id, status: o.status, paymentStatus: o.payment_status, shippingStatus: o.shipping_status,
    total: o.total_toman, subtotal: o.subtotal_toman, discount: o.discount_toman, shipping: o.shipping_toman,
    customerName: o.customer_name, customerEmail: o.customer_email, customerPhone: o.customer_phone,
    province: o.province, city: o.city, addressLine: o.address_line, postalCode: o.postal_code,
    note: o.note, internalNote: o.internal_note, createdAt: o.created_at, paidAt: o.paid_at,
    items: items.map(i => ({ productId: i.product_id, slug: i.slug, sku: i.sku, name: i.name, unitPrice: i.unit_price, qty: i.qty, image: i.image, variant: i.variant }))
  };
}
function audit(adminId, action, targetType, targetId, metadata = null) {
  db.prepare('INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, metadata) VALUES (?,?,?,?,?)').run(adminId, action, targetType, String(targetId), metadata ? JSON.stringify(metadata) : null);
}
function notify(type, title, body, targetUrl) {
  db.prepare('INSERT INTO notifications (type, title, body, target_url) VALUES (?,?,?,?)').run(type, title, body, targetUrl);
}

// Auth helpers
function current_user(req) {
  if (!req.session.user_id) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user_id);
}
function require_admin(req, res, perm = null) {
  const u = current_user(req);
  if (!u || u.role === 'customer' || !u.active) {
    fail(res, 'ابتدا وارد پنل شوید', 401, 'unauthorized');
    return null;
  }
  if (perm) {
    const perms = JSON.parse(u.permissions || '[]');
    if (!perms.includes('*') && !perms.includes(perm)) {
      fail(res, 'دسترسی ندارید', 403, 'forbidden');
      return null;
    }
  }
  return u;
}

// Routes

// Health
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    ok(res, { db: true, time: new Date().toISOString() });
  } catch (e) {
    fail(res, 'DB down', 500);
  }
});

// Sitemap
app.get('/api/sitemap', (req, res) => {
  const cats = db.prepare('SELECT slug FROM categories').all();
  const prods = db.prepare('SELECT slug FROM products WHERE deleted_at IS NULL AND status = ?').all('active');
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `  <url><loc>https://localhost:${PORT_HTTPS}/</loc></url>\n`;
  xml += `  <url><loc>https://localhost:${PORT_HTTPS}/shop</loc></url>\n`;
  xml += `  <url><loc>https://localhost:${PORT_HTTPS}/about</loc></url>\n`;
  xml += `  <url><loc>https://localhost:${PORT_HTTPS}/contact</loc></url>\n`;
  for (const c of cats) xml += `  <url><loc>https://localhost:${PORT_HTTPS}/shop?cat=${c.slug}</loc></url>\n`;
  for (const p of prods) xml += `  <url><loc>https://localhost:${PORT_HTTPS}/product/${p.slug}</loc></url>\n`;
  xml += '</urlset>';
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});
app.get('/sitemap.xml', (req, res) => {
  res.redirect('/api/sitemap');
});

// Catalog
app.get('/api/catalog', (req, res) => {
  const products = db.prepare(`SELECT p.*, c.slug as cat_slug, c.name as cat_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.deleted_at IS NULL AND p.status = 'active' ORDER BY p.id`).all();
  const mapped = products.map(p => ({
    id: p.id, slug: p.slug, sku: p.sku, name: p.name, nameEn: p.name_en, price: p.price, oldPrice: p.old_price,
    categoryId: p.category_id, categorySlug: p.cat_slug, categoryName: p.cat_name,
    shortDesc: p.short_desc, description: p.description, features: JSON.parse(p.features||'[]'), variants: JSON.parse(p.variants||'[]'), images: JSON.parse(p.images||'[]'),
    stock: p.stock, minStock: p.min_stock, prepTime: p.prep_time, material: p.material, status: p.status, featured: !!p.featured
  }));
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all().map(c=>({id:c.id, slug:c.slug, name:c.name, icon:c.icon, blurb:c.blurb, sortOrder:c.sort_order}));
  ok(res, { products: mapped, categories: cats });
});

// Contact
app.post('/api/contact', (req, res) => {
  const { name, contact, body } = req.body;
  if (!name || !body) return fail(res, 'نام و متن پیام الزامی است');
  const ip_hash = crypto.createHash('sha256').update(req.ip || '').digest('hex');
  db.prepare('INSERT INTO messages (name, contact, body, ip_hash) VALUES (?,?,?,?)').run(name, contact||'', body, ip_hash);
  notify('message', 'پیام جدید', body.slice(0,50), '/admin/messages');
  ok(res, { message: 'پیام شما ارسال شد' });
});

// Auth
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return fail(res, 'نام، ایمیل و رمز عبور الزامی است');
  if (password.length < 6) return fail(res, 'رمز عبور باید حداقل ۶ کاراکتر باشد');
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return fail(res, 'این ایمیل قبلاً ثبت شده است', 409);
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name,email,phone,password_hash,role) VALUES (?,?,?,?,?)').run(name, email.toLowerCase(), phone||'', hash, 'customer');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  req.session.user_id = user.id;
  // Set session cookie flags
  ok(res, { user: public_user(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email.toLowerCase(), 'customer');
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return fail(res, 'ایمیل یا رمز عبور نادرست است', 401);
  if (!u.active) return fail(res, 'حساب کاربری غیرفعال است', 403);
  req.session.user_id = u.id;
  req.session.save(() => {
    ok(res, { user: public_user(u) });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => ok(res));
});

app.get('/api/auth/me', (req, res) => {
  const u = current_user(req);
  ok(res, { user: u ? public_user(u) : null });
});

// Account
app.put('/api/account/profile', (req, res) => {
  const u = current_user(req);
  if (!u) return fail(res, 'ابتدا وارد شوید', 401);
  const { name, phone } = req.body;
  db.prepare("UPDATE users SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?").run(name||u.name, phone||u.phone, u.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  ok(res, { user: public_user(updated) });
});

app.get('/api/account/orders', (req, res) => {
  const u = current_user(req);
  if (!u) return fail(res, 'ابتدا وارد شوید', 401);
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(u.id);
  ok(res, { orders: orders.map(map_order) });
});

// Checkout with idempotency + guest token
app.post('/api/checkout', (req, res) => {
  try {
    rate_limit_atomic(`checkout:${req.ip}`, 100, 60);
  } catch(e) { return fail(res, e.message, 429); }

  const { items, customer, note, idempotencyKey } = req.body;
  const headerKey = req.headers['idempotency-key'];
  const keyRaw = headerKey || idempotencyKey || '';
  const user = current_user(req);
  const userId = user ? String(user.id) : 'guest';
  let k = null;
  if (keyRaw) {
    k = crypto.createHash('sha256').update(String(keyRaw) + '|' + userId + '|checkout').digest('hex');
  }

  // Atomic transaction including idempotency check, validation, and order creation
  const tx = db.transaction(() => {
    if (k) {
      const row = db.prepare("SELECT response FROM idempotency_keys WHERE k = ? AND expires_at > datetime('now')").get(k);
      if (row) {
        return { cached: true, payload: JSON.parse(row.response) };
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) throw Object.assign(new Error('سبد خرید خالی است'), {status:400});
    if (!customer || !customer.name || !customer.phone || !customer.province || !customer.city || !customer.line) throw Object.assign(new Error('اطلاعات مشتری ناقص است'), {status:400});
    if (!/^09\d{9}$/.test(customer.phone)) throw Object.assign(new Error('شماره موبایل معتبر نیست'), {status:400});

    // Validate items and calculate total
    let total = 0;
    let subtotal = 0;
    const orderItems = [];
    for (const it of items) {
      const p = db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(it.id);
      if (!p) throw Object.assign(new Error(`محصول یافت نشد: ${it.id}`), {status:404});
      if (p.status !== 'active') throw Object.assign(new Error(`محصول غیرفعال است: ${p.name}`), {status:400});
      if (p.stock < it.qty) throw Object.assign(new Error(`موجودی «${p.name}» کافی نیست`), {status:409});
      const unit = p.price;
      total += unit * it.qty;
      subtotal += unit * it.qty;
      orderItems.push({ p, qty: it.qty, variant: it.variant || '', unit });
    }

    const publicId = 'NRV-' + crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
    const authority = 'A' + crypto.randomBytes(8).toString('hex').toUpperCase();
    const guestToken = !user ? generate_guest_token() : null;
    const guestHash = guestToken ? hash_token(guestToken) : null;

    const info = db.prepare(`
      INSERT INTO orders (public_id, user_id, access_token_hash, status, payment_status, shipping_status, total_toman, subtotal_toman, customer_name, customer_email, customer_phone, province, city, address_line, note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(publicId, user ? user.id : null, guestHash, 'pending', 'unpaid', 'pending', total, subtotal, customer.name, customer.email||'', customer.phone, customer.province, customer.city, customer.line, note||'');

    const orderId = info.lastInsertRowid;

    for (const oi of orderItems) {
      db.prepare(`INSERT INTO order_items (order_id, product_id, slug, sku, name, unit_price, qty, image, variant) VALUES (?,?,?,?,?,?,?,?,?)`).run(
        orderId, oi.p.id, oi.p.slug, oi.p.sku, oi.p.name, oi.unit, oi.qty, JSON.parse(oi.p.images||'[]')[0]||'', oi.variant
      );
    }

    db.prepare(`INSERT INTO payments (order_id, authority, status, amount_toman, amount_rial) VALUES (?,?,?,?,?)`).run(orderId, authority, 'pending', total, total*10);

    db.prepare(`INSERT INTO order_events (order_id, type, to_value) VALUES (?,?,?)`).run(orderId, 'created', 'pending');
    notify('new_order', `سفارش جدید ${publicId}`, `${customer.name} — ${total.toLocaleString('fa-IR')} تومان`, `/admin/orders/${publicId}`);

    const payload = { publicId, authority, provider: 'demo', redirect: `/pay?authority=${authority}` };
    if (guestToken) payload.accessToken = guestToken;

    if (k) {
      const expires = new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace('T', ' ');
      db.prepare('INSERT OR REPLACE INTO idempotency_keys (k, route, user_id, response, expires_at) VALUES (?,?,?,?,?)').run(k, 'checkout', user ? user.id : null, JSON.stringify(payload), expires);
    }

    return { cached: false, payload };
  });

  let result;
  try {
    result = tx();
  } catch(e) {
    const status = e.status || 400;
    // If error is from validation, it will be 400/404/409, else 500
    if (status >=400 && status <500) return fail(res, e.message, status);
    // Log unexpected
    console.error('checkout tx error', e);
    return fail(res, e.message, 500);
  }

  if (result.cached) {
    return ok(res, result.payload);
  }
  ok(res, result.payload);
});

// Orders lookup
app.get('/api/orders/:publicId', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE public_id = ?').get(req.params.publicId);
  if (!o) return fail(res, 'سفارش پیدا نشد', 404);
  if (o.user_id) {
    const u = current_user(req);
    if (!u || u.id !== o.user_id) {
      // Check admin
      const admin = current_user(req);
      if (!admin || admin.role === 'customer') {
        return fail(res, 'برای مشاهدهٔ این سفارش وارد حساب خود شوید', 403);
      }
    }
  } else {
    // Guest: require token, unless admin
    const admin = current_user(req);
    const isAdmin = admin && admin.role !== 'customer';
    if (!isAdmin) {
      try { rate_limit_atomic(`guest-order-lookup:${req.ip}`, 60, 60); } catch(e){ return fail(res, e.message, 429); }
      const provided = req.query.token || req.headers['x-order-token'] || '';
      if (!verify_guest_token(String(provided), o.access_token_hash)) {
        return fail(res, 'توکن دسترسی سفارش نامعتبر است', 403);
      }
    }
  }
  ok(res, { order: map_order(o) });
});

// Pay demo
app.post('/api/pay/demo', (req, res) => {
  const { authority, action } = req.body;
  const pay = db.prepare('SELECT * FROM payments WHERE authority = ?').get(authority);
  if (!pay) return fail(res, 'تراکنش پیدا نشد', 404);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(pay.order_id);
  if (pay.status !== 'pending') {
    return ok(res, { publicId: order.public_id, status: pay.status, refId: pay.ref_id, alreadyProcessed: true });
  }
  if (action === 'cancel') {
    db.prepare(`UPDATE payments SET status = 'cancelled' WHERE authority = ?`).run(authority);
    db.prepare(`UPDATE orders SET status = 'cancelled', payment_status = 'failed' WHERE id = ?`).run(order.id);
    return ok(res, { publicId: order.public_id, status: 'cancelled' });
  }
  // Verify stock and deduct
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const tx = db.transaction(() => {
    for (const it of items) {
      const p = db.prepare('SELECT stock FROM products WHERE id = ?').get(it.product_id);
      if (p.stock < it.qty) throw new Error(`موجودی «${it.name}» کافی نیست`);
    }
    for (const it of items) {
      const p = db.prepare('SELECT stock FROM products WHERE id = ?').get(it.product_id);
      const before = p.stock;
      const after = before - it.qty;
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(after, it.product_id);
      const idem = `sale:${order.id}:${it.product_id}`;
      try {
        db.prepare(`INSERT INTO inventory_transactions (product_id, type, quantity, stock_before, stock_after, reason, reference_type, reference_id, idempotency_key) VALUES (?,?,?,?,?,?,?,?,?)`).run(it.product_id, 'sale', -it.qty, before, after, `فروش سفارش ${order.public_id}`, 'order', String(order.id), idem);
      } catch(e) { /* duplicate */ }
      if (after <= 5) {
        notify(after === 0 ? 'out_of_stock' : 'low_stock', after === 0 ? 'اتمام موجودی' : 'کاهش موجودی', `${it.name} به ${after} عدد رسید.`, `/admin/products/${it.product_id}`);
      }
    }
    const refId = String(Math.floor(100000000 + Math.random()*900000000));
    db.prepare(`UPDATE payments SET status = 'verified', ref_id = ?, verified_at = datetime('now') WHERE authority = ?`).run(refId, authority);
    db.prepare(`UPDATE orders SET status = 'confirmed', payment_status = 'paid', paid_at = datetime('now') WHERE id = ?`).run(order.id);
    db.prepare(`INSERT INTO order_events (order_id, type, from_value, to_value, note) VALUES (?,?,?,?,?)`).run(order.id, 'payment_verified', 'pending', 'paid', refId);
    notify('new_order', `سفارش جدید ${order.public_id}`, `${order.customer_name} — ${order.total_toman.toLocaleString('fa-IR')} تومان`, `/admin/orders/${order.public_id}`);
    audit(null, 'payment.verified', 'order', order.public_id);
    return refId;
  });
  try {
    const refId = tx();
    ok(res, { publicId: order.public_id, status: 'verified', refId });
  } catch(e) {
    fail(res, e.message, 409);
  }
});

app.get('/api/pay/status', (req, res) => {
  const pay = db.prepare('SELECT * FROM payments WHERE authority = ?').get(req.query.authority);
  if (!pay) return fail(res, 'تراکنش پیدا نشد', 404);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(pay.order_id);
  ok(res, { status: pay.status, amount: pay.amount_toman, publicId: order.public_id, refId: pay.ref_id });
});

// Pay verify (zarinpal callback simulation)
app.post('/api/pay/verify', (req, res) => {
  // For staging, just proxy to demo
  const { authority } = req.body;
  const pay = db.prepare('SELECT * FROM payments WHERE authority = ?').get(authority);
  if (!pay) return fail(res, 'تراکنش پیدا نشد', 404);
  if (pay.status === 'verified') return ok(res, { status: 'verified', refId: pay.ref_id });
  return fail(res, 'پرداخت تأیید نشد', 400);
});
app.get('/api/pay/callback', (req, res) => {
  const { Authority, Status } = req.query;
  if (!Authority) return fail(res, 'Authority الزامی است', 400);
  const pay = db.prepare('SELECT * FROM payments WHERE authority = ?').get(Authority);
  if (!pay) return fail(res, 'تراکنش پیدا نشد', 404);
  if (Status !== 'OK') {
    db.prepare(`UPDATE payments SET status = 'cancelled' WHERE authority = ?`).run(Authority);
    return res.redirect(`/orders/${db.prepare('SELECT public_id FROM orders WHERE id = ?').get(pay.order_id).public_id}?pay=cancelled`);
  }
  // Simulate verify
  if (pay.status === 'pending') {
    // Call demo verify
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(pay.order_id);
    // reuse demo logic
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(pay.order_id);
    const tx = db.transaction(() => {
      for (const it of items) {
        const p = db.prepare('SELECT stock FROM products WHERE id = ?').get(it.product_id);
        if (p.stock < it.qty) throw new Error('موجودی کافی نیست');
      }
      for (const it of items) {
        const p = db.prepare('SELECT stock FROM products WHERE id = ?').get(it.product_id);
        const before = p.stock; const after = before - it.qty;
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(after, it.product_id);
      }
      const refId = String(Math.floor(100000000 + Math.random()*900000000));
      db.prepare(`UPDATE payments SET status='verified', ref_id=?, verified_at=datetime('now') WHERE authority=?`).run(refId, Authority);
      db.prepare(`UPDATE orders SET status='confirmed', payment_status='paid', paid_at=datetime('now') WHERE id=?`).run(pay.order_id);
      return refId;
    });
    try { tx(); } catch(e) { return fail(res, e.message, 409); }
  }
  const order = db.prepare('SELECT public_id FROM orders WHERE id = ?').get(pay.order_id);
  res.redirect(`/orders/${order.public_id}?pay=verified`);
});

// Admin routes
const adminRouter = express.Router();

adminRouter.post('/login', (req, res) => {
  try { rate_limit_atomic('admin-login:'+req.ip, 10, 900); } catch(e){ return fail(res, e.message, 429); }
  const { email, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE email = ? AND role != ? AND active = 1').get(email.toLowerCase(), 'customer');
  if (!u || !bcrypt.compareSync(password, u.password_hash)) {
    audit(null, 'admin.login_failed', 'session', email);
    return fail(res, 'اطلاعات ورود نادرست است', 401);
  }
  req.session.user_id = u.id;
  req.session.save(() => {
    audit(u.id, 'admin.login', 'session', u.id);
    ok(res, { user: public_user(u) });
  });
});

adminRouter.post('/logout', (req,res) => {
  req.session.destroy(()=> ok(res));
});

adminRouter.get('/me', (req,res) => {
  const u = current_user(req);
  ok(res, { user: u && u.role !== 'customer' ? public_user(u) : null });
});

// Dashboard
adminRouter.get('/dashboard', (req,res) => {
  const admin = require_admin(req,res);
  if (!admin) return;
  const stats = {
    revenue: db.prepare(`SELECT COALESCE(SUM(total_toman),0) v FROM orders WHERE payment_status='paid'`).get().v,
    ordersToday: db.prepare(`SELECT COUNT(*) v FROM orders WHERE date(created_at) = date('now')`).get().v,
    orders: db.prepare(`SELECT COUNT(*) v FROM orders`).get().v,
    pendingOrders: db.prepare(`SELECT COUNT(*) v FROM orders WHERE status IN ('confirmed','processing','preparing')`).get().v,
    customers: db.prepare(`SELECT COUNT(*) v FROM users WHERE role='customer'`).get().v,
    lowStock: db.prepare(`SELECT COUNT(*) v FROM products WHERE deleted_at IS NULL AND stock <= min_stock`).get().v,
    products: db.prepare(`SELECT COUNT(*) v FROM products WHERE deleted_at IS NULL`).get().v,
    unread: db.prepare(`SELECT COUNT(*) v FROM notifications WHERE read_at IS NULL`).get().v,
  };
  const recentOrders = db.prepare(`SELECT * FROM orders ORDER BY id DESC LIMIT 6`).all().map(map_order);
  const lowStock = db.prepare(`SELECT * FROM products WHERE deleted_at IS NULL AND stock <= min_stock ORDER BY stock LIMIT 6`).all().map(map_product);
  ok(res, { stats, recentOrders, lowStock });
});

// Products
adminRouter.get('/products', (req,res) => {
  const admin = require_admin(req,res, 'products.manage');
  if (!admin) return;
  const products = db.prepare(`SELECT p.*, c.slug as cat_slug, c.name as cat_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.deleted_at IS NULL ORDER BY p.id DESC`).all().map(p=>map_product({...p, cat_slug:p.cat_slug, cat_name:p.cat_name}));
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  ok(res, { products, categories });
});

// Upload
const storage = multer.diskStorage({
  destination: (req,file,cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req,file,cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + crypto.randomBytes(6).toString('hex') + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req,file,cb) => {
    // Will check in handler via finfo
    cb(null, true);
  }
});

adminRouter.post('/upload', upload.single('file'), async (req,res) => {
  const admin = require_admin(req,res, 'products.manage');
  if (!admin) {
    if (req.file) fs.unlinkSync(req.file.path);
    return;
  }
  if (!req.file) return fail(res, 'فایلی ارسال نشد');
  const f = req.file;
  if (f.size < 100) { fs.unlinkSync(f.path); return fail(res, 'فایل نامعتبر است'); }
  // Check double ext
  const orig = f.originalname.toLowerCase();
  if (orig.match(/\.(php|phtml|phar|htaccess|sh|exe)(\.|$)/)) { fs.unlinkSync(f.path); return fail(res, 'نام فایل غیرمجاز است'); }
  // finfo
  try {
    const type = await fileTypeFromFile(f.path);
    const mime = type ? type.mime : null;
    const allowed = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!mime || !allowed[mime]) { fs.unlinkSync(f.path); return fail(res, 'فقط تصویر JPG/PNG/WebP مجاز است'); }
    const ext = allowed[mime];
    // Check image dimensions via image-size
    const dim = imageSize(fs.readFileSync(f.path));
    if (!dim || dim.width < 10 || dim.height < 10) { fs.unlinkSync(f.path); return fail(res, 'ابعاد تصویر خیلی کوچک است'); }
    if (dim.width > 5000 || dim.height > 5000) { fs.unlinkSync(f.path); return fail(res, 'ابعاد تصویر خیلی بزرگ است (حداکثر 5000x5000)'); }
    // Check php tag in file head
    const head = fs.readFileSync(f.path, { encoding: 'utf8', flag: 'r' }).slice(0, 1048576);
    if (head.match(/<\?(php|=)|<script/i)) { fs.unlinkSync(f.path); return fail(res, 'فایل حاوی محتوای غیرمجاز است'); }
    // Rename if ext mismatch
    const realExt = ext;
    const currentExt = path.extname(f.path).slice(1).toLowerCase();
    let finalPath = f.path;
    if (currentExt !== realExt) {
      const newPath = f.path.replace(/\.[^.]+$/, '.'+realExt);
      fs.renameSync(f.path, newPath);
      finalPath = newPath;
    }
    fs.chmodSync(finalPath, 0o644);
    // Post-move check
    const type2 = await fileTypeFromFile(finalPath);
    if (!type2 || !allowed[type2.mime]) { fs.unlinkSync(finalPath); return fail(res, 'فایل ذخیره‌شده نامعتبر است'); }
    const url = '/uploads/' + path.basename(finalPath);
    ok(res, { url });
  } catch(e) {
    try { fs.unlinkSync(f.path); } catch {}
    fail(res, e.message, 400);
  }
});

// Orders with pagination
adminRouter.get('/orders', (req,res) => {
  const admin = require_admin(req,res, 'orders.manage');
  if (!admin) return;
  const page = Math.max(1, parseInt(req.query.page||'1'));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit||'20')));
  const offset = (page-1)*limit;
  let where = '1=1';
  const params = [];
  if (req.query.status && ['pending','confirmed','processing','preparing','shipped','delivered','cancelled','returned','refunded'].includes(req.query.status)) {
    where += ' AND status = ?';
    params.push(req.query.status);
  }
  if (req.query.q) {
    where += ' AND (public_id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ?)';
    const like = `%${req.query.q}%`;
    params.push(like, like, like, like);
  }
  const total = db.prepare(`SELECT COUNT(*) c FROM orders WHERE ${where}`).get(...params).c;
  const rows = db.prepare(`SELECT * FROM orders WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  ok(res, { orders: rows.map(map_order), pagination: { page, limit, total, pages: Math.ceil(total/limit), offset } });
});

adminRouter.get('/orders/:id', (req,res) => {
  const admin = require_admin(req,res, 'orders.manage');
  if (!admin) return;
  const o = db.prepare('SELECT * FROM orders WHERE public_id = ?').get(req.params.id);
  if (!o) return fail(res, 'سفارش پیدا نشد', 404);
  ok(res, { order: map_order(o) });
});

adminRouter.put('/orders/:id', (req,res) => {
  const admin = require_admin(req,res, 'orders.manage');
  if (!admin) return;
  const pub = req.params.id;
  const o = db.prepare('SELECT * FROM orders WHERE public_id = ?').get(pub);
  if (!o) return fail(res, 'سفارش پیدا نشد', 404);
  const { status, shippingStatus, internalNote, refund } = req.body;
  const newStatus = status || o.status;
  const newShipping = shippingStatus || o.shipping_status;
  // Simple transition check (allow cancelled from pending/confirmed etc)
  if (newStatus === 'cancelled' && o.status !== 'cancelled') {
    if (['paid','partially_refunded'].includes(o.payment_status)) {
      if (refund !== true) {
        return fail(res, 'لغو سفارش پرداخت‌شده تا زمان اجرای فرایند بازپرداخت مجاز نیست', 409);
      }
      // Restore stock for each sale
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      for (const it of items) {
        const p = db.prepare('SELECT stock FROM products WHERE id = ?').get(it.product_id);
        if (p) {
          const before = p.stock;
          const after = before + it.qty;
          db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(after, it.product_id);
          const key = `cancel:${o.id}:sale:${it.id}`;
          try {
            db.prepare(`INSERT INTO inventory_transactions (product_id, type, quantity, stock_before, stock_after, reason, reference_type, reference_id, idempotency_key, admin_id) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(it.product_id, 'return', it.qty, before, after, `لغو سفارش ${o.public_id}`, 'order', String(o.id), key, admin.id);
          } catch {}
        }
      }
      db.prepare(`INSERT INTO refunds (order_id, amount_toman, reason, status, admin_id, processed_at) VALUES (?,?,?,?,?, datetime('now'))`).run(o.id, o.total_toman, 'لغو سفارش توسط مدیر', 'processed', admin.id);
      db.prepare(`UPDATE orders SET status = ?, payment_status = 'refunded', shipping_status = ?, internal_note = ? WHERE id = ?`).run(newStatus, newShipping, internalNote || o.internal_note, o.id);
    } else {
      db.prepare(`UPDATE payments SET status='cancelled' WHERE order_id=? AND status='pending'`).run(o.id);
      db.prepare(`UPDATE orders SET status=?, payment_status='failed', shipping_status=?, internal_note=? WHERE id=?`).run(newStatus, newShipping, internalNote||o.internal_note, o.id);
    }
  } else {
    db.prepare(`UPDATE orders SET status=?, shipping_status=?, internal_note=? WHERE id=?`).run(newStatus, newShipping, internalNote||o.internal_note, o.id);
  }
  const updated = db.prepare('SELECT * FROM orders WHERE public_id = ?').get(pub);
  audit(admin.id, 'order.updated', 'order', pub, { from: o.status, to: newStatus });
  ok(res, { order: map_order(updated) });
});

// Customers with pagination
adminRouter.get('/customers', (req,res) => {
  const admin = require_admin(req,res, 'customers.view');
  if (!admin) return;
  const page = Math.max(1, parseInt(req.query.page||'1'));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit||'20')));
  const offset = (page-1)*limit;
  const total = db.prepare(`SELECT COUNT(*) c FROM users WHERE role='customer'`).get().c;
  const rows = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) orders, (SELECT COALESCE(SUM(total_toman),0) FROM orders o WHERE o.user_id=u.id AND o.payment_status='paid') spent FROM users u WHERE role='customer' ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
  const list = rows.map(u=>({...public_user(u), active: !!u.active, orders: u.orders, spent: u.spent}));
  ok(res, { customers: list, pagination: { page, limit, total, pages: Math.ceil(total/limit), offset } });
});

// Messages with pagination
adminRouter.get('/messages', (req,res) => {
  const page = Math.max(1, parseInt(req.query.page||'1'));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit||'20')));
  const offset = (page-1)*limit;
  const total = db.prepare(`SELECT COUNT(*) c FROM messages`).get().c;
  const rows = db.prepare(`SELECT id, name, contact, body, created_at as createdAt FROM messages ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
  ok(res, { messages: rows, pagination: { page, limit, total, pages: Math.ceil(total/limit), offset } });
});

// Notifications with pagination
adminRouter.get('/notifications', (req,res) => {
  const page = Math.max(1, parseInt(req.query.page||'1'));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit||'20')));
  const offset = (page-1)*limit;
  const total = db.prepare(`SELECT COUNT(*) c FROM notifications`).get().c;
  const rows = db.prepare(`SELECT * FROM notifications ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
  ok(res, { notifications: rows, pagination: { page, limit, total, pages: Math.ceil(total/limit), offset } });
});

// Activity with pagination
adminRouter.get('/activity', (req,res) => {
  const admin = require_admin(req,res, 'users.manage');
  if (!admin) return;
  const page = Math.max(1, parseInt(req.query.page||'1'));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit||'20')));
  const offset = (page-1)*limit;
  const total = db.prepare(`SELECT COUNT(*) c FROM admin_activity_logs`).get().c;
  const rows = db.prepare(`SELECT l.*, u.name as aname FROM admin_activity_logs l LEFT JOIN users u ON u.id=l.admin_id ORDER BY l.id DESC LIMIT ? OFFSET ?`).all(limit, offset);
  ok(res, { logs: rows, pagination: { page, limit, total, pages: Math.ceil(total/limit), offset } });
});

// Inventory
adminRouter.get('/inventory', (req,res) => {
  const admin = require_admin(req,res, 'inventory.manage');
  if (!admin) return;
  const products = db.prepare(`SELECT id, name, sku, stock, min_stock FROM products WHERE deleted_at IS NULL ORDER BY stock`).all();
  const txs = db.prepare(`SELECT t.*, p.name as pname FROM inventory_transactions t JOIN products p ON p.id=t.product_id ORDER BY t.id DESC LIMIT 100`).all();
  ok(res, { products: products.map(p=>({id:p.id, name:p.name, sku:p.sku, stock:p.stock, minStock:p.min_stock})), transactions: txs });
});

app.use('/api/admin', adminRouter);

// Health check for DB down simulation


// Fallback for SPA
app.get('/health', (req,res) => res.json({ ok:true }));

// Start servers
const httpServer = http.createServer(app);
httpServer.listen(PORT_HTTP, '0.0.0.0', () => {
  console.log(`HTTP staging listening on http://0.0.0.0:${PORT_HTTP}`);
});

let httpsServer;
try {
  const key = fs.readFileSync(path.join(__dirname, 'key.pem'));
  const cert = fs.readFileSync(path.join(__dirname, 'cert.pem'));
  httpsServer = https.createServer({ key, cert }, app);
  httpsServer.listen(PORT_HTTPS, '0.0.0.0', () => {
    console.log(`HTTPS staging listening on https://0.0.0.0:${PORT_HTTPS}`);
  });
} catch(e) {
  console.log('HTTPS not started', e.message);
}

// Expose control for failure tests
app.post('/test/db-down', (req,res) => {
  dbDown = req.body.down;
  ok(res, { dbDown });
});
app.post('/test/reset', (req,res) => {
  dbDown = false;
  ok(res);
});

console.log('Staging server ready');
