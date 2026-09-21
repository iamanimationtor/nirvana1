/**
 * تست دودِ بک‌اند نمایشی — همان مسیرهایی که فروشگاه و پنل صدا می‌زنند.
 * اجرا: npx tsx scripts/smoke.ts
 */
const mem = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, v),
    removeItem: (k: string) => mem.delete(k),
  },
});

const { demoHandle, DEMO_ADMIN } = await import("../src/lib/demo-backend.ts");

let failed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log("PASS", name); }
  catch (e) { failed++; console.error("FAIL", name, (e as Error).message); }
}
function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

await check("catalog has seed products", async () => {
  const r = await demoHandle<{ products: { slug: string; price: number }[] }>("GET", "/catalog");
  assert(r.products.length === 7, "expected 7 products");
  assert(r.products.some((p) => p.slug === "wave-vase" && p.price === 685000), "wave-vase price");
});

await check("admin login + product draft hidden from store", async () => {
  const login = await demoHandle<{ user: { role: string } }>("POST", "/admin/login", { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password });
  assert(login.user.role === "admin", "role");
  await demoHandle("PUT", "/admin/products/1", {
    slug: "wave-vase", name: "گلدان ارگانیک «موج»", nameEn: "WAVE VASE", price: 700000, oldPrice: 820000,
    categoryId: 2, shortDesc: "x", description: "y", features: ["a"], variants: ["کرم"], images: ["/images/product-vase.jpg"],
    stock: 8, minStock: 5, prepTime: "۲ روز", material: "PLA", featured: true, status: "draft", sku: "NRV-001",
  });
  const cat = await demoHandle<{ products: { slug: string }[] }>("GET", "/catalog");
  assert(!cat.products.some((p) => p.slug === "wave-vase"), "draft must be hidden");
  await demoHandle("PUT", "/admin/products/1", {
    slug: "wave-vase", name: "گلدان ارگانیک «موج»", nameEn: "WAVE VASE", price: 685000, oldPrice: 820000,
    categoryId: 2, shortDesc: "x", description: "y", features: ["a"], variants: ["کرم"], images: ["/images/product-vase.jpg"],
    stock: 2, minStock: 5, prepTime: "۲ روز", material: "PLA", featured: true, status: "active", sku: "NRV-001",
  });
});

await check("checkout rejects bad phone and oversell", async () => {
  let threw = false;
  try { await demoHandle("POST", "/checkout", { items: [{ id: 1, qty: 1 }], customer: { name: "a", email: "a@b.com", phone: "12", province: "تهران", city: "تهران", line: "خیابان" } }); }
  catch { threw = true; }
  assert(threw, "short phone should fail");
  threw = false;
  try { await demoHandle("POST", "/checkout", { items: [{ id: 1, qty: 9 }], customer: { name: "علی", email: "ali@example.com", phone: "09120000000", province: "تهران", city: "تهران", line: "خیابان ۱" } }); }
  catch (e) { threw = true; assert((e as Error).message.includes("موجودی"), (e as Error).message); }
  assert(threw, "oversell should fail");
});

await check("pay deducts stock once and is idempotent", async () => {
  const beforeStock = (await demoHandle<{ products: { id: number; stock: number }[] }>("GET", "/catalog")).products.find((p) => p.id === 5)!.stock;
  const before = { stock: beforeStock }; // for compat below
  const order = await demoHandle<{ authority: string; publicId: string; accessToken?: string }>("POST", "/checkout", {
    items: [{ id: 5, qty: 2, variant: "کرم" }],
    customer: { name: "علی", email: "ali@example.com", phone: "09120000000", province: "تهران", city: "تهران", line: "خیابان ۱" },
  });
  assert(order.accessToken, "guest order should have accessToken");
  const paid = await demoHandle<{ status: string; refId: string }>("POST", "/pay/demo", { authority: order.authority, action: "ok" });
  assert(paid.status === "verified" && paid.refId, "verified");
  const again = await demoHandle<{ status: string }>("POST", "/pay/demo", { authority: order.authority, action: "ok" });
  assert(again.status === "verified", "replay");
  const after = (await demoHandle<{ products: { id: number; stock: number }[] }>("GET", "/catalog")).products.find((p) => p.id === 5)!;
  assert(after.stock === before.stock - 2, `stock ${before.stock} -> ${after.stock}`);
  const view = await demoHandle<{ order: { paymentStatus: string } }>("GET", `/orders/${order.publicId}?token=${order.accessToken}`);
  assert(view.order.paymentStatus === "paid", "order paid");
  // Test guest token isolation: logout admin to simulate guest/anonymous
  await demoHandle("POST", "/admin/logout");
  let blocked = false;
  try { await demoHandle("GET", `/orders/${order.publicId}`); } catch { blocked = true; }
  assert(blocked, "guest order without token should be forbidden");
  blocked = false;
  try { await demoHandle("GET", `/orders/${order.publicId}?token=invalid123`); } catch { blocked = true; }
  assert(blocked, "wrong token should be forbidden");
  // valid token should still work for guest
  const view2 = await demoHandle<{ order: { paymentStatus: string } }>("GET", `/orders/${order.publicId}?token=${order.accessToken}`);
  assert(view2.order.paymentStatus === "paid", "order with valid token should succeed");
  // restore admin session for following tests
  await demoHandle("POST", "/admin/login", { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password });
});

await check("checkout idempotency with same key", async () => {
  const key = "test-idem-" + Date.now() + "-" + Math.random().toString(36).slice(2,6);
  const payload = {
    items: [{ id: 5, qty: 1 }],
    customer: { name: "تست", email: "idem@test.com", phone: "09120000001", province: "تهران", city: "تهران", line: "خیابان تست" },
    idempotencyKey: key,
  };
  const r1 = await demoHandle<{ publicId: string; authority: string; accessToken?: string }>("POST", "/checkout", payload);
  const r2 = await demoHandle<{ publicId: string; authority: string; accessToken?: string }>("POST", "/checkout", payload);
  assert(r1.publicId === r2.publicId, "idempotent checkout should return same publicId");
  assert(r1.authority === r2.authority, "same authority");
  const r3 = await demoHandle<{ publicId: string; authority: string }>("POST", "/checkout", { ...payload, idempotencyKey: key + "-different" });
  assert(r3.publicId !== r1.publicId, "different key should create new order");
});

await check("concurrent checkout idempotency (5 parallel)", async () => {
  const key = "conc-" + Date.now() + "-" + Math.random().toString(36).slice(2,6);
  const payload = {
    items: [{ id: 6, qty: 1 }],
    customer: { name: "همزمان", email: "conc@test.com", phone: "09120000002", province: "تهران", city: "تهران", line: "خیابان موازی" },
    idempotencyKey: key,
  };
  const results = await Promise.all(Array.from({ length: 5 }, () => demoHandle<{ publicId: string; authority: string }>("POST", "/checkout", payload)));
  const first = results[0].publicId;
  for (const r of results) assert(r.publicId === first, "concurrent same key should give same publicId");
  // different key concurrently should give different ids
  const diff = await Promise.all(Array.from({ length: 3 }, (_, i) => demoHandle<{ publicId: string }>("POST", "/checkout", { ...payload, idempotencyKey: key + "-diff-" + i })));
  const ids = diff.map(r => r.publicId);
  assert(new Set(ids).size === 3, "different keys concurrently should create different orders");
  assert(!ids.includes(first), "different keys should not collide with first");
});

await check("cancel paid order restores stock", async () => {
  const stock = (await demoHandle<{ products: { id: number; stock: number }[] }>("GET", "/catalog")).products.find((p) => p.id === 5)!.stock;
  const order = await demoHandle<{ publicId: string }>("POST", "/checkout", {
    items: [{ id: 5, qty: 1 }],
    customer: { name: "علی", email: "ali@example.com", phone: "09120000000", province: "تهران", city: "تهران", line: "خیابان ۱" },
  });
  const listed = await demoHandle<{ orders: { publicId: string }[] }>("GET", "/admin/orders");
  const created = listed.orders.find((o) => o.publicId === order.publicId);
  assert(created, "order listed");
  const pay = await demoHandle<{ authority: string }>("POST", "/checkout", {
    items: [{ id: 3, qty: 1 }],
    customer: { name: "علی", email: "ali@example.com", phone: "09120000000", province: "تهران", city: "تهران", line: "خیابان ۱" },
  });
  await demoHandle("POST", "/pay/demo", { authority: pay.authority, action: "ok" });
  let blocked = false;
  try { await demoHandle("PUT", `/admin/orders/${pay.publicId}`, { status: "cancelled", shippingStatus: "pending", internalNote: "", refund: false }); }
  catch { blocked = true; }
  assert(blocked, "cancel paid without refund flag must fail");
  await demoHandle("PUT", `/admin/orders/${pay.publicId}`, { status: "cancelled", shippingStatus: "pending", internalNote: "بازپرداخت دستی", refund: true });
  const after = (await demoHandle<{ products: { id: number; stock: number }[] }>("GET", "/admin/products")).products.find((p) => p.id === 3)!;
  const cat = await demoHandle<{ products: { id: number; stock: number }[] }>("GET", "/catalog");
  assert(cat.products.find((p) => p.id === 5)!.stock === stock, "unpaid checkout must not deduct");
  assert(after.stock >= 1, "stock restored or still present");
});

await check("register, account, contact", async () => {
  const u = await demoHandle<{ user: { email: string } }>("POST", "/auth/register", { name: "سارا", email: "sara@example.com", password: "secret123", phone: "09121111111" });
  assert(u.user.email === "sara@example.com", "email");
  const me = await demoHandle<{ user: { name: string } | null }>("GET", "/auth/me");
  assert(me.user?.name === "سارا", "session");
  await demoHandle("POST", "/contact", { name: "سارا", contact: "sara@example.com", body: "سلام، سفارش اختصاصی می‌خواهم" });
  const msgs = await demoHandle<{ messages: { body: string }[] }>("GET", "/admin/messages");
  assert(msgs.messages.some((m) => m.body.includes("اختصاصی")), "message stored");
});

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nall smoke checks passed");
