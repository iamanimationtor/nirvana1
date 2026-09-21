/* ─────────────────────────────────────────────────────────────
 *  In-browser demo backend (localStorage).
 *  Mirrors the PHP API routes so the store & admin panel work
 *  even without the server (previews / local static builds).
 * ───────────────────────────────────────────────────────────── */
import { ApiError } from "./api";
import {
  DEFAULT_SETTINGS, ORDER_TRANSITIONS, SEED_CATEGORIES, SEED_PRODUCTS, SHIPPING_TRANSITIONS,
  type Address, type Category, type Order, type Product, type StoreSettings, type User,
} from "./core";

interface DbUser extends User { password: string; active: boolean; }
interface Db {
  products: Product[];
  categories: Category[];
  users: DbUser[];
  addresses: (Address & { userId: number })[];
  orders: Order[];
  payments: { authority: string; orderId: number; status: string; refId: string | null; amount: number; provider: string }[];
  messages: { id: number; name: string; contact: string; body: string; createdAt: string }[];
  notifications: { id: number; type: string; title: string; body: string; targetUrl: string; readAt: string | null; createdAt: string }[];
  activity: { id: number; adminId: number | null; adminName: string; action: string; targetType: string; targetId: string; createdAt: string }[];
  inventory: { id: number; productId: number; productName: string; type: string; quantity: number; before: number; after: number; reason: string; createdAt: string }[];
  settings: StoreSettings;
  session: number | null;
  adminSession: number | null;
  seq: number;
}

const KEY = "nirvana-demo-db";
export const DEMO_ADMIN = { email: "admin@nirvana.local", password: "Admin123456!" };

function fresh(): Db {
  return {
    products: SEED_PRODUCTS.map((p) => ({ ...p })),
    categories: SEED_CATEGORIES.map((c) => ({ ...c })),
    users: [{ id: 1, name: "مدیر نیروانا", email: DEMO_ADMIN.email, phone: "", role: "admin", permissions: ["*"], password: DEMO_ADMIN.password, active: true, createdAt: new Date().toISOString() }],
    addresses: [], orders: [], payments: [], messages: [], notifications: [], activity: [], inventory: [],
    settings: { ...DEFAULT_SETTINGS },
    session: null, adminSession: null, seq: 100,
  };
}
let cache: Db | null = null;
function db(): Db {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...fresh(), ...(JSON.parse(raw) as Db) } : fresh();
  } catch { cache = fresh(); }
  return cache;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignore */ } }
const nextId = () => ++db().seq;
const now = () => new Date().toISOString();
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const pub = (u: DbUser): User => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, permissions: u.permissions, createdAt: u.createdAt });
const bad = (m: string, s = 400, c = "error") => { throw new ApiError(m, s, c); };

function currentUser(): DbUser | null { const d = db(); return d.users.find((u) => u.id === d.session) ?? null; }
function currentAdmin(): DbUser { const d = db(); const u = d.users.find((x) => x.id === d.adminSession && x.role !== "customer" && x.active); if (!u) bad("ابتدا وارد پنل شوید", 401, "unauthorized"); return u!; }
function audit(admin: DbUser | null, action: string, targetType: string, targetId: string | number) {
  db().activity.unshift({ id: nextId(), adminId: admin?.id ?? null, adminName: admin?.name ?? "سیستم", action, targetType, targetId: String(targetId), createdAt: now() });
}
function notify(type: string, title: string, body: string, targetUrl: string) {
  db().notifications.unshift({ id: nextId(), type, title, body, targetUrl, readAt: null, createdAt: now() });
}
const publicId = () => "NRV-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const activeProducts = () => db().products.filter((p) => p.status !== "draft");
// Demo idempotency and guest token stores (in-memory, for testing without DB)
const demoIdempotency = new Map<string, { response: any; expires: number }>();
const guestTokenStore = new Map<string, string>(); // publicId -> token
function demoIdemKey(raw: string): string {
  const u = currentUser();
  const scope = u ? String(u.id) : "guest";
  return raw + "|" + scope;
}
function simpleHash(s: string): string {
  // simple non-crypto hash for demo (not used for security, just key)
  let h = 0;
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))|0;
  return String(h);
}

export async function demoHandle<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
  await wait();
  const d = db();
  const b = (body ?? {}) as Record<string, any>;
  const [p, qs] = path.split("?");
  const q = new URLSearchParams(qs || "");
  const seg = p.split("/").filter(Boolean);
  const r = `${method} /${seg.map((s, i) => (i > 0 && /^\d+$/.test(s) ? ":id" : s)).join("/")}`;
  const ok = (data: object = {}) => { save(); return { ok: true, ...data } as T; };

  /* ── public ── */
  if (r === "GET /catalog") return ok({ products: activeProducts(), categories: d.categories, settings: d.settings });
  if (r === "POST /contact") {
    if (!b.name || !b.body) bad("نام و پیام الزامی است");
    d.messages.unshift({ id: nextId(), name: b.name, contact: b.contact || "", body: b.body, createdAt: now() });
    notify("message", "پیام جدید", `${b.name}: ${String(b.body).slice(0, 60)}`, "/admin/messages");
    return ok();
  }
  if (r === "POST /auth/register") {
    if (!b.name || !b.email || !b.password) bad("همهٔ فیلدها الزامی است");
    if (String(b.password).length < 8) bad("رمز عبور باید حداقل ۸ کاراکتر باشد");
    if (d.users.some((u) => u.email.toLowerCase() === String(b.email).toLowerCase())) bad("این ایمیل قبلاً ثبت شده است");
    const u: DbUser = { id: nextId(), name: b.name, email: b.email, phone: b.phone || "", role: "customer", password: b.password, active: true, createdAt: now() };
    d.users.push(u); d.session = u.id;
    notify("new_customer", "مشتری جدید", `${u.name} ثبت‌نام کرد`, "/admin/customers");
    return ok({ user: pub(u) });
  }
  if (r === "POST /auth/login") {
    const u = d.users.find((x) => x.email.toLowerCase() === String(b.email || "").toLowerCase() && x.password === b.password && x.active);
    if (!u) bad("ایمیل یا رمز عبور اشتباه است", 401);
    d.session = u!.id; return ok({ user: pub(u!) });
  }
  if (r === "POST /auth/logout") { d.session = null; return ok(); }
  if (r === "GET /auth/me") { const u = currentUser(); return ok({ user: u ? pub(u) : null }); }
  if (r === "POST /auth/forgot") return ok({ message: "اگر ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود." });
  if (r === "POST /auth/reset") {
    // در حالت نمایشی، ایمیل واقعی ارسال نمی‌شود؛ این مسیر فقط اعتبارسنجی را شبیه‌سازی می‌کند.
    if (!b.token) bad("لینک نامعتبر یا منقضی است");
    if (String(b.password || "").length < 8) bad("رمز عبور باید حداقل ۸ کاراکتر باشد");
    return ok();
  }

  if (seg[0] === "account") {
    const u = currentUser(); if (!u) bad("ابتدا وارد شوید", 401, "unauthorized");
    if (r === "PUT /account/profile") { u!.name = b.name || u!.name; u!.phone = b.phone ?? u!.phone; return ok({ user: pub(u!) }); }
    if (r === "POST /account/password") { if (u!.password !== b.current) bad("رمز فعلی اشتباه است"); if (String(b.next).length < 8) bad("رمز جدید کوتاه است"); u!.password = b.next; return ok(); }
    if (r === "GET /account/orders") return ok({ orders: d.orders.filter((o) => o.userId === u!.id) });
    if (r === "GET /account/addresses") return ok({ addresses: d.addresses.filter((a) => a.userId === u!.id) });
    if (r === "POST /account/addresses") {
      const a = { id: nextId(), userId: u!.id, fullName: b.fullName, phone: b.phone, province: b.province, city: b.city, line: b.line, postalCode: b.postalCode || "", isDefault: true };
      d.addresses.forEach((x) => { if (x.userId === u!.id) x.isDefault = false; }); d.addresses.push(a);
      return ok({ address: a });
    }
    if (r === "DELETE /account/addresses/:id") { d.addresses = d.addresses.filter((a) => !(a.id === Number(seg[2]) && a.userId === u!.id)); return ok(); }
  }

  if (r === "POST /checkout") {
    // Rate limit simulation (demo): 20 per hour per IP/user
    // Simple in-memory check (not persistent across reload)
    // Idempotency check first (before validation to mirror PHP behaviour where idempotency is checked after rate_limit but before order creation)
    if (b.idempotencyKey) {
      const k = demoIdemKey(String(b.idempotencyKey));
      const existing = demoIdempotency.get(k);
      if (existing && existing.expires > Date.now()) {
        // Return cached response without creating new order
        return ok(existing.response);
      }
    }
    const items = (b.items as { id: number; qty: number; variant?: string }[]) || [];
    if (!items.length) bad("سبد خرید خالی است");
    const c = b.customer || {};
    for (const f of ["name", "email", "phone", "province", "city", "line"]) if (!c[f]) bad("اطلاعات گیرنده کامل نیست");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email))) bad("ایمیل معتبر نیست");
    if (String(c.phone).replace(/\D/g, "").length < 10) bad("شماره تماس معتبر نیست");
    const merged = new Map<number, { qty: number; variant?: string }>();
    for (const it of items) {
      const qty = Math.max(1, Math.min(10, Math.floor(Number(it.qty) || 1)));
      const prev = merged.get(it.id) ?? { qty: 0, variant: it.variant };
      prev.qty += qty;
      if (it.variant) prev.variant = it.variant;
      merged.set(it.id, prev);
    }
    const lines = [...merged.entries()].map(([id, info]) => {
      if (info.qty > 10) bad("حداکثر ۱۰ عدد از هر محصول");
      const pr = activeProducts().find((x) => x.id === id); if (!pr) bad("محصول یافت نشد");
      if (pr!.stock < info.qty) bad(`موجودی «${pr!.name}» کافی نیست`, 409, "insufficient_stock");
      return { productId: pr!.id, slug: pr!.slug, name: pr!.name, unitPrice: pr!.price, qty: info.qty, image: pr!.images[0] || "", variant: info.variant };
    });
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const shipping = Number(d.settings["orders.shippingFee"]) || 0;
    const o: Order = {
      id: nextId(), publicId: publicId(), userId: currentUser()?.id ?? null, status: "pending", paymentStatus: "pending", shippingStatus: "pending",
      subtotal, discount: 0, shipping, total: subtotal + shipping, customerName: c.name, customerEmail: c.email, customerPhone: c.phone,
      province: c.province, city: c.city, addressLine: c.line, postalCode: c.postalCode || "", note: b.note || "", internalNote: "",
      createdAt: now(), paidAt: null, items: lines, events: [{ type: "created", from: null, to: "pending", note: "", createdAt: now() }],
    };
    // Guest token for orders without user
    let token: string | null = null;
    if (o.userId === null) {
      token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      // Store token plain for demo verification (PHP stores hash, but demo stores plain for simplicity)
      guestTokenStore.set(o.publicId, token);
      (o as any).accessToken = token;
      (o as any).accessTokenHash = simpleHash(token); // mimic hash presence
    }
    d.orders.unshift(o);
    const authority = "A" + Math.random().toString(36).slice(2, 14).toUpperCase();
    d.payments.push({ authority, orderId: o.id, status: "pending", refId: null, amount: o.total, provider: "demo" });
    const payload: any = { publicId: o.publicId, authority, provider: "demo", redirect: `/pay?authority=${authority}` };
    if (token) payload.accessToken = token;
    if (b.idempotencyKey) {
      const k = demoIdemKey(String(b.idempotencyKey));
      demoIdempotency.set(k, { response: payload, expires: Date.now() + 86400000 });
    }
    return ok(payload);
  }
  if (r === "GET /pay/status") {
    const pay = d.payments.find((x) => x.authority === q.get("authority")); if (!pay) bad("تراکنش پیدا نشد", 404);
    const o = d.orders.find((x) => x.id === pay!.orderId)!;
    return ok({ status: pay!.status, amount: pay!.amount, publicId: o.publicId, refId: pay!.refId });
  }
  if (r === "POST /pay/demo") {
    const pay = d.payments.find((x) => x.authority === b.authority); if (!pay) bad("تراکنش پیدا نشد", 404);
    const o = d.orders.find((x) => x.id === pay!.orderId)!;
    if (pay!.status !== "pending") return ok({ publicId: o.publicId, status: pay!.status, refId: pay!.refId, alreadyProcessed: true });
    if (b.action === "cancel") { pay!.status = "cancelled"; o.status = "cancelled"; o.paymentStatus = "failed"; o.events!.push({ type: "status", from: "pending", to: "cancelled", note: "", createdAt: now() }); return ok({ publicId: o.publicId, status: "cancelled" }); }
    for (const l of o.items) {
      const pr = d.products.find((x) => x.id === l.productId)!;
      if (pr.stock < l.qty) bad(`موجودی «${pr.name}» کافی نیست`, 409, "insufficient_stock");
      const before = pr.stock; pr.stock -= l.qty;
      d.inventory.unshift({ id: nextId(), productId: pr.id, productName: pr.name, type: "sale", quantity: -l.qty, before, after: pr.stock, reason: `فروش سفارش ${o.publicId}`, createdAt: now() });
      if (pr.stock <= (pr.minStock ?? 5)) notify(pr.stock === 0 ? "out_of_stock" : "low_stock", pr.stock === 0 ? "اتمام موجودی" : "کاهش موجودی", `${pr.name} به ${pr.stock} عدد رسید.`, `/admin/products/${pr.id}`);
    }
    pay!.status = "verified"; pay!.refId = String(Math.floor(100000000 + Math.random() * 900000000));
    o.status = "confirmed"; o.paymentStatus = "paid"; o.paidAt = now(); o.refId = pay!.refId;
    o.events!.push({ type: "payment_verified", from: "pending", to: "paid", note: pay!.refId, createdAt: now() });
    notify("new_order", `سفارش جدید ${o.publicId}`, `${o.customerName} — ${o.total.toLocaleString("fa-IR")} تومان`, `/admin/orders/${o.publicId}`);
    audit(null, "payment.verified", "order", o.publicId);
    return ok({ publicId: o.publicId, status: "verified", refId: pay!.refId });
  }
  if (r === "GET /orders/:id" || (seg[0] === "orders" && seg.length === 2 && method === "GET")) {
    const o = d.orders.find((x) => x.publicId === seg[1]);
    if (!o) bad("سفارش پیدا نشد", 404);
    if (o!.userId) {
      if (o!.userId !== currentUser()?.id) bad("برای مشاهدهٔ این سفارش وارد حساب خود شوید", 403);
    } else {
      // Guest: require token via query ?token= or stored map. Admin bypass.
      const cur = currentUser();
      const isAdmin = cur && (cur as any).role !== "customer" && d.users.find(u=>u.id===d.adminSession)?.role !== "customer";
      // For demo, check adminSession directly
      const isAdminSession = !!d.adminSession && d.users.find(u=>u.id===d.adminSession)?.role !== "customer";
      if (!isAdminSession) {
        const provided = q.get("token") || (b.token) || "";
        const expected = guestTokenStore.get(o!.publicId) || (o as any).accessToken || "";
        if (!provided || provided !== expected) {
          // Simulate rate limit for brute force
          // Not implemented fully, but throw 403
          bad("توکن دسترسی سفارش نامعتبر است", 403, "forbidden");
        }
      }
    }
    return ok({ order: o! });
  }

  /* ── admin ── */
  if (seg[0] === "admin") {
    if (r === "POST /admin/login") {
      const u = d.users.find((x) => x.email.toLowerCase() === String(b.email || "").toLowerCase() && x.password === b.password && x.role !== "customer" && x.active);
      if (!u) bad("اطلاعات ورود نادرست است", 401);
      d.adminSession = u!.id; audit(u!, "admin.login", "session", u!.id); return ok({ user: pub(u!) });
    }
    if (r === "POST /admin/logout") { d.adminSession = null; return ok(); }
    if (r === "GET /admin/me") { const u = d.users.find((x) => x.id === d.adminSession && x.role !== "customer"); return ok({ user: u ? pub(u) : null }); }
    if (r === "POST /admin/forgot") return ok({ message: "اگر ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود." });
    const admin = currentAdmin();

    if (r === "GET /admin/dashboard") {
      const paid = d.orders.filter((o) => o.paymentStatus === "paid");
      const today = new Date().toDateString();
      return ok({
        stats: {
          revenue: paid.reduce((s, o) => s + o.total, 0),
          ordersToday: d.orders.filter((o) => new Date(o.createdAt).toDateString() === today).length,
          orders: d.orders.length, pendingOrders: d.orders.filter((o) => ["confirmed", "processing", "preparing"].includes(o.status)).length,
          customers: d.users.filter((u) => u.role === "customer").length,
          lowStock: d.products.filter((p) => p.stock <= (p.minStock ?? 5)).length,
          products: d.products.length, unread: d.notifications.filter((n) => !n.readAt).length,
        },
        recentOrders: d.orders.slice(0, 6), lowStock: d.products.filter((p) => p.stock <= (p.minStock ?? 5)).slice(0, 6),
      });
    }
    if (r === "GET /admin/products") return ok({ products: d.products, categories: d.categories });
    if (r === "GET /admin/products/:id") return ok({ product: d.products.find((x) => x.id === Number(seg[2])) ?? bad("محصول یافت نشد", 404), categories: d.categories });
    if (r === "POST /admin/products" || r === "PUT /admin/products/:id") {
      const cat = d.categories.find((c) => c.id === Number(b.categoryId)); if (!cat) bad("دسته‌بندی نامعتبر است");
      if (!b.name || !b.slug) bad("نام و اسلاگ الزامی است");
      if (d.products.some((x) => x.slug === b.slug && x.id !== Number(seg[2]))) bad("اسلاگ تکراری است");
      const base: Product = {
        id: method === "POST" ? nextId() : Number(seg[2]), slug: b.slug, name: b.name, nameEn: b.nameEn || "", price: Number(b.price) || 0,
        oldPrice: b.oldPrice ? Number(b.oldPrice) : null, categoryId: cat!.id, categorySlug: cat!.slug, categoryName: cat!.name, shortDesc: b.shortDesc || "",
        description: b.description || "", features: b.features || [], variants: b.variants || [], images: b.images || [], stock: Number(b.stock) || 0,
        prepTime: b.prepTime || "", material: b.material || "", featured: !!b.featured, status: b.status || "active", minStock: Number(b.minStock ?? 5), sku: b.sku || "",
      };
      if (method === "POST") { d.products.push(base); audit(admin, "product.created", "product", base.id); }
      else { const i = d.products.findIndex((x) => x.id === base.id); if (i < 0) bad("محصول یافت نشد", 404); d.products[i] = base; audit(admin, "product.updated", "product", base.id); }
      return ok({ product: base });
    }
    if (r === "DELETE /admin/products/:id") { d.products = d.products.filter((x) => x.id !== Number(seg[2])); audit(admin, "product.deleted", "product", seg[2]); return ok(); }
    if (r === "POST /admin/upload") {
      const f = form?.get("file") as File | null; if (!f) bad("فایلی ارسال نشد");
      const url: string = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(f!); });
      return ok({ url });
    }
    if (r === "GET /admin/categories") return ok({ categories: d.categories.map((c) => ({ ...c, count: d.products.filter((p) => p.categoryId === c.id).length })) });
    if (r === "POST /admin/categories") {
      if (!b.name || !b.slug) bad("نام و اسلاگ الزامی است"); if (d.categories.some((c) => c.slug === b.slug)) bad("اسلاگ تکراری است");
      const c: Category = { id: nextId(), slug: b.slug, name: b.name, icon: b.icon || "spark", blurb: b.blurb || "", sort: d.categories.length + 1 };
      d.categories.push(c); audit(admin, "category.created", "category", c.id); return ok({ category: c });
    }
    if (r === "PUT /admin/categories/:id") { const c = d.categories.find((x) => x.id === Number(seg[2])); if (!c) bad("یافت نشد", 404); Object.assign(c!, { name: b.name ?? c!.name, blurb: b.blurb ?? c!.blurb, icon: b.icon ?? c!.icon, sort: b.sort ?? c!.sort }); d.products.forEach((p) => { if (p.categoryId === c!.id) p.categoryName = c!.name; }); return ok({ category: c }); }
    if (r === "DELETE /admin/categories/:id") { if (d.products.some((p) => p.categoryId === Number(seg[2]))) bad("این دسته دارای محصول است"); d.categories = d.categories.filter((c) => c.id !== Number(seg[2])); return ok(); }
    if (r === "GET /admin/orders") {
      let list = d.orders; const st = q.get("status"); const s = (q.get("q") || "").toLowerCase();
      if (st) list = list.filter((o) => o.status === st);
      if (s) list = list.filter((o) => o.publicId.toLowerCase().includes(s) || o.customerName.includes(s) || o.customerPhone.includes(s));
      return ok({ orders: list });
    }
    if (seg[1] === "orders" && seg[2] && seg.length === 3) {
      const o = d.orders.find((x) => x.publicId === seg[2]); if (!o) bad("سفارش پیدا نشد", 404);
      if (method === "GET") return ok({ order: o });
      if (method === "PUT") {
        const status = b.status ?? o!.status; const shipping = b.shippingStatus ?? o!.shippingStatus;
        if (status === "cancelled" && ["paid", "partially_refunded"].includes(o!.paymentStatus) && b.refund !== true) bad("لغو سفارش پرداخت‌شده تا زمان اجرای فرایند بازپرداخت مجاز نیست", 409, "refund_required");
        if (status !== o!.status && !ORDER_TRANSITIONS[o!.status]?.includes(status)) bad(`تغییر وضعیت ${o!.status} به ${status} مجاز نیست`, 409);
        if (shipping !== o!.shippingStatus && !SHIPPING_TRANSITIONS[o!.shippingStatus]?.includes(shipping)) bad(`تغییر وضعیت ارسال مجاز نیست`, 409);
        if (status === "cancelled" && o!.status !== "cancelled") {
          for (const l of o!.items) { const pr = d.products.find((x) => x.id === l.productId); if (pr && o!.paymentStatus === "paid") { const before = pr.stock; pr.stock += l.qty; d.inventory.unshift({ id: nextId(), productId: pr.id, productName: pr.name, type: "return", quantity: l.qty, before, after: pr.stock, reason: `لغو سفارش ${o!.publicId}`, createdAt: now() }); } }
          if (o!.paymentStatus === "paid") o!.paymentStatus = "refunded"; else o!.paymentStatus = "failed";
        }
        for (const [type, from, to] of [["status", o!.status, status], ["shipping_status", o!.shippingStatus, shipping]]) if (from !== to) o!.events!.push({ type, from, to, note: "", createdAt: now() });
        if (b.internalNote !== undefined && b.internalNote !== o!.internalNote) o!.events!.push({ type: "note", from: null, to: null, note: b.internalNote, createdAt: now() });
        o!.status = status; o!.shippingStatus = shipping; o!.internalNote = b.internalNote ?? o!.internalNote;
        audit(admin, "order.updated", "order", o!.publicId); return ok({ order: o });
      }
    }
    if (r === "GET /admin/customers") return ok({ customers: d.users.filter((u) => u.role === "customer").map((u) => ({ ...pub(u), active: u.active, orders: d.orders.filter((o) => o.userId === u.id).length, spent: d.orders.filter((o) => o.userId === u.id && o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0) })) });
    if (r === "GET /admin/inventory") return ok({ products: d.products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, minStock: p.minStock ?? 5 })), transactions: d.inventory.slice(0, 100) });
    if (r === "POST /admin/inventory") {
      const pr = d.products.find((x) => x.id === Number(b.productId)); if (!pr) bad("محصول یافت نشد", 404);
      const qty = Number(b.quantity); if (!Number.isInteger(qty) || qty === 0) bad("مقدار نامعتبر است");
      const before = pr!.stock; const after = before + qty; if (after < 0) bad("موجودی نمی‌تواند منفی شود");
      pr!.stock = after; d.inventory.unshift({ id: nextId(), productId: pr!.id, productName: pr!.name, type: qty > 0 ? "restock" : "adjustment", quantity: qty, before, after, reason: b.reason || "", createdAt: now() });
      audit(admin, "inventory.adjusted", "product", pr!.id); return ok({ stock: after });
    }
    if (r === "GET /admin/users") return ok({ users: d.users.filter((u) => u.role !== "customer").map((u) => ({ ...pub(u), active: u.active })) });
    if (r === "POST /admin/users") {
      if (admin.role !== "admin") bad("فقط مدیر کل می‌تواند کاربر بسازد", 403);
      if (!b.name || !b.email || String(b.password || "").length < 12) bad("رمز عبور باید حداقل ۱۲ کاراکتر باشد");
      if (d.users.some((u) => u.email === b.email)) bad("ایمیل تکراری است");
      const u: DbUser = { id: nextId(), name: b.name, email: b.email, phone: "", role: b.role || "staff", permissions: b.permissions || [], password: b.password, active: true, createdAt: now() };
      d.users.push(u); audit(admin, "user.created", "user", u.id); return ok({ user: pub(u) });
    }
    if (r === "PUT /admin/users/:id") { if (admin.role !== "admin") bad("دسترسی ندارید", 403); const u = d.users.find((x) => x.id === Number(seg[2])); if (!u) bad("یافت نشد", 404); if (b.role) u!.role = b.role; if (b.permissions) u!.permissions = b.permissions; if (b.active !== undefined) u!.active = !!b.active; audit(admin, "user.updated", "user", u!.id); return ok({ user: pub(u!) }); }
    if (r === "GET /admin/settings") return ok({ settings: d.settings });
    if (r === "PUT /admin/settings") { d.settings = { ...d.settings, ...b }; audit(admin, "settings.updated", "settings", "store"); return ok({ settings: d.settings }); }
    if (r === "POST /admin/change-password") { if (admin.password !== b.current) bad("رمز فعلی اشتباه است"); if (String(b.next).length < 12) bad("رمز جدید باید حداقل ۱۲ کاراکتر باشد"); admin.password = b.next; audit(admin, "admin.password_changed", "user", admin.id); return ok(); }
    if (r === "GET /admin/notifications") return ok({ notifications: d.notifications });
    if (r === "POST /admin/notifications/read") { d.notifications.forEach((n) => { if (!b.id || n.id === b.id) n.readAt = n.readAt ?? now(); }); return ok(); }
    if (r === "GET /admin/activity") return ok({ logs: d.activity });
    if (r === "GET /admin/messages") return ok({ messages: d.messages });
    if (r === "GET /admin/reports" || r === "GET /admin/analytics" || r === "GET /admin/best-sellers") {
      const from = q.get("from") ? new Date(q.get("from")!) : new Date(Date.now() - 30 * 864e5);
      const to = q.get("to") ? new Date(q.get("to")!) : new Date();
      const paid = d.orders.filter((o) => o.paymentStatus === "paid" && new Date(o.createdAt) >= from && new Date(o.createdAt) <= to);
      const byDay: Record<string, { revenue: number; orders: number }> = {};
      for (const o of paid) { const k = o.createdAt.slice(0, 10); byDay[k] = byDay[k] || { revenue: 0, orders: 0 }; byDay[k].revenue += o.total; byDay[k].orders++; }
      const sellers: Record<number, { productId: number; name: string; qty: number; revenue: number }> = {};
      for (const o of paid) for (const l of o.items) { const k = l.productId ?? 0; sellers[k] = sellers[k] || { productId: k, name: l.name, qty: 0, revenue: 0 }; sellers[k].qty += l.qty; sellers[k].revenue += l.qty * l.unitPrice; }
      const statusCounts: Record<string, number> = {}; for (const o of d.orders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      return ok({
        summary: { revenue: paid.reduce((s, o) => s + o.total, 0), orders: paid.length, avg: paid.length ? Math.round(paid.reduce((s, o) => s + o.total, 0) / paid.length) : 0, items: paid.reduce((s, o) => s + o.items.reduce((a, l) => a + l.qty, 0), 0) },
        daily: Object.entries(byDay).sort().map(([date, v]) => ({ date, ...v })),
        bestSellers: Object.values(sellers).sort((a, b2) => b2.qty - a.qty),
        statusCounts, categories: d.categories.map((c) => ({ name: c.name, count: d.products.filter((p) => p.categoryId === c.id).length })),
      });
    }
  }
  bad(`مسیر ${path} یافت نشد`, 404, "not_found");
  return undefined as T;
}
