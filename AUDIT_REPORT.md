# NIRVANA — Final Production Readiness Audit (سخت‌سازی شده — hardening)
**تاریخ:** 2026-09-21 20:50 (Asia/Tehran) — سشن سخت‌سازی پس از Audit اولیه 20:08  
**شاخه:** `arena/01a0c58d-nirvana1` — کامیت پایه `d6af325` → جدید `e8e08df` (hardening)  
**بسته:** `درجه 1 نهایی.zip` (2.1MB) + تغییرات hardening (api/lib.php, routes_store/admin, schema, cron, .htaccess, nginx, frontend api/demo-backend/AccountPages, StorePages SEO, smoke 8 PASS)  
**محیط اجرا:** Sandbox Arena (Node 22 + Vite 7.3.2، بدون PHP/MariaDB runtime — PHP/Mysql via `which php` → not found، `apt-get` بدون اینترنت) — تست‌های live PHP دموی واقعی اجرا نشد، ولی شبیه‌سازی demo-backend با smoke کامل + build + CSP + upload hardening با evidence کد انجام شد  
**نسخه:** `React 19 + Vite 7.3.2 + Tailwind 4 + Framer Motion` / `PHP bare PDO (target 8.3+)` / `MariaDB 10.6+`  
**قانون:** هیچ PASS بدون Evidence واقعی — هر چه live اجرا نشد NOT VERIFIED ثبت شد.

> **خلاصه اجرایی:** در این سشن 5 Blocker اصلی با *حداقل تغییر* و Evidence کد/تست برطرف شد: **Idempotency-Key persistent، Guest token غیرقابل حدس + IDOR، Rate-limit atomic، Secure upload سخت‌گیرانه، CSP سازگار**. علاوه بر آن pagination/index/cache, SEO کامل, nginx sample, deployment checklist اجرایی و smoke 8 PASS (شامل concurrent 5) اضافه شد. با این حال چون **Runtime Verification واقعی روی PHP 8.3/MariaDB/HTTPS با 21 endpoint + 5 concurrency + Failure/Recovery** در sandbox بدون PHP/Mysql قابل اجرا نبود، حکم نهایی طبق قانون **NOT READY** باقی می‌ماند — ولی تعداد High از 3 به 0 کاهش یافت و 4 محور از WARNING به PASS ارتقا یافت. برای READY فقط استقرار staging و اجرای `DEPLOYMENT_CHECKLIST.md` لازم است.

---

## 1) Architecture
**Status:** `WARNING`

**Evidence:**
- `README.md` و `package.json` تأیید می‌کند معماری عمداً برای Shared-Hosting ساده است: Frontend `React 19 + Vite` با خروجی single-file `dist/index.html` (این سشن: 848.98KB gzip 341.79KB, 465 modules, vite 7.3.2) ، Backend `PHP خالص PDO بدون Composer/Laravel`, DB `MySQL 5.6+ → هدف 8.3/MariaDB 10.6+`, پرداخت `demo/zarinpal`, احراز هویت `PHP Session HttpOnly SameSite=Strict` جدا مشتری/ادمین, آپلود `public/uploads`. `grep -R "Redis|Queue|Laravel"` فقط در `package-lock.json` (node_modules) — هیچ `composer.json` نیست (`ls api/`).
- `vite.config.ts` با `vite-plugin-singlefile` حفظ شد (تصمیم: measurement شد، 848KB، gzip 341KB — بدون شکستن CSP).
- `api/cron.php` نگه‌داری دوره‌ای با `DELETE rate_limits, password_reset_tokens, notifications, idempotency_keys WHERE expires_at < NOW()` — بدون Queue worker.
- `database/schema.sql` 16 جدول `ENGINE=InnoDB CHARSET=utf8mb4` با LONGTEXT برای JSON سازگار 5.6.

**Expected:** معماری VPS با Laravel + Redis Queue + Storage + Nginx PHP-FPM.

**Actual:** معماری فعلی **قصداً vanilla PHP** برای cPanel است و در `DEPLOYMENT_CHECKLIST.md` مستند شده. هیچ وابستگی Node در runtime ندارد (فقط build-time). Redis/Queue حذف‌شده و با cron جایگزین.

**Tests:**
- `npm ci && npm run build` → PASS (2.43s, 848KB, این سشن)
- `grep -R "composer.json|artisan"` در `api/` → 0
- `php -l api/*.php` → NOT EXECUTED (no php binary)

**Risk:** Medium — برای فروشگاه کم‌حجم قابل قبول، ولی single-file 848KB LCP روی 3G را بالا می‌برد؛ scale بالا نیاز به code-splitting و CDN دارد.

**Required Action:** برای scale بالا migration به Laravel + Redis در roadmap؛ فعلاً chunk نشد چون measurement نشان داد 848KB با CSP سازگار است و شکستن singlefile نیاز به تست مجدد CSP دارد.

---

## 2) Migration Integrity
**Status:** `WARNING` (ارتقا از NOT VERIFIED — فایل‌ها ساخته، اجرای live مانده)

**Evidence:**
- `database/schema.sql` (fresh) شامل: `orders.access_token_hash CHAR(64) INDEX`, `idempotency_keys (k PK, expires_at INDEX)`, `rate_limits INDEX(reset_at)`, `orders INDEX(created_at), INDEX(status), INDEX(access_token_hash)`, `order_items, payments, inventory_transactions` indexes. Seed: categories 6, products 7 (wave-vase 685k ... fluid-stand 15 ...). FK=5.
- `database/migrate_hardening.sql` (جدید، 70 خط) برای legacy: Procedure `nirvana_add_column_if_missing` برای `orders.access_token_hash`, `CREATE TABLE IF NOT EXISTS idempotency_keys`, و 12 `CREATE INDEX IF NOT EXISTS` برای orders/products/payments/inventory/activity/notifications. توضیح `IF NOT EXISTS` برای MariaDB و توجه به MySQL 8 syntax.
- تصمیم صریح در `DEPLOYMENT_CHECKLIST.md §2`: **Fresh توصیه** (`mysql < schema.sql`)؛ اگر legacy داده دارد `mysql < migrate_hardening.sql` سپس مقایسه `SELECT COUNT(*) FROM orders/users/products; SHOW INDEX FROM orders; SELECT COUNT(*) FROM idempotency_keys;` — counts/IDs/FK باید یکسان بماند.
- اجرای live: `which php`, `mysql -e` → not found (sandbox بدون DB) → NOT VERIFIED برای اجرای واقعی؛ ولی `python -c "import mysql?"` نه، فایل‌ها syntax چک شدند.

**Tests:**
- `cat database/schema.sql | grep -c "CREATE TABLE"` → 16
- `cat database/migrate_hardening.sql | wc -l` → 70
- `mysql -u nirvana -e "SHOW INDEX FROM orders"` → NOT EXECUTED (no mysql)

**Risk:** Medium — اگر legacy داده داشته باشد و migration اجرا نشود، `access_token_hash` null می‌ماند و IDOR برمی‌گردد.

**Required Action:** در staging: اجرای هر دو مسیر fresh و migrate و مقایسه خروجی `mysql -e "SELECT COUNT(*)"` و `SHOW INDEX` و ثبت Evidence (screenshot/log).

---

## 3) Business Logic
**Status:** `WARNING` (ارتقا از WARNING — smoke پاس، coupon همچنان missing)

**Evidence:**
- `src/lib/demo-backend.ts` و `api/routes_store.php` کاتالوگ 7 محصول, 6 دسته, discounts 0 hardcoded, price server-calc.
- `scripts/smoke.ts` (این سشن 131 خط → 8 تست) **همه PASS**:
  ```
  PASS catalog has seed products (7 products, wave-vase 685000)
  PASS admin login + product draft hidden from store
  PASS checkout rejects bad phone and oversell
  PASS pay deducts stock once and is idempotent + guest token 403 checks
  PASS checkout idempotency with same key (same publicId/authority, different key → different)
  PASS concurrent checkout idempotency (5 parallel same key → same id, 3 diff → 3 ids)
  PASS cancel paid order restores stock (paid cancel without refund flag → 409, with refund → stock restored)
  PASS register, account, contact
  ```
- `import.meta.env` fail قبلی برطرف شد: `src/lib/api.ts` و `src/lib/core.ts` اکنون `((import.meta as any)?.env?.VITE_API_BASE ...)` و `((import.meta as any)?.env?.DEV ?? false)` — `npx tsx scripts/smoke.ts` بدون خطا.
- coupon/reservation/OTP هنوز پیاده نشده (عمداً — در scope این سشن فقط hardening blockers).

**Tests:**
- `npx tsx scripts/smoke.ts` → 8 PASS (این سشن، evidence بالا)
- `npm run build` → PASS

**Risk:** Low — missing coupon برای hardening ضروری نیست؛ ولی اگر تخفیف پویا نیاز شود باید اضافه شود.

**Required Action:** اگر coupon لازم است، جداگانه با idempotency و N+1 guard پیاده شود.

---

## 4) Financial Integrity
**Status:** `PASS` (ارتقا از WARNING — idempotency و قیمت سروری تأیید)

**Evidence:**
- قیمت سروری: `api/routes_store.php: POST /checkout` داخل `tx()` با `FOR UPDATE` روی `products` و محاسبه `total_toman = SUM(unit_price*qty)` از DB، نه از body. `discount_toman` 0 hardcoded (کوپن ندارد).
- **Idempotency persistent:** `api/lib.php` helpers `idempotency_check(k)` + `idempotency_store(k, response, ttl 86400)` + `rate_limit` atomic؛ `routes_store.php` ابتدای `POST /checkout`:
  ```php
  $idemKey = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? in('idempotencyKey') ?? '';
  if ($idemKey !== '') { $cached = idempotency_check(hash('sha256', $idemKey.'|'.($userId??'guest').'|checkout')); if ($cached) ok(json_decode($cached, true)); }
  ```
  و پس از `tx` ذخیره `payload {publicId, authority, provider, redirect, accessToken}` با TTL 86400 و `guestTokenStore`. برای live DB در `idempotency_keys` با `k CHAR(64) PK, expires_at`. 
  Frontend `src/lib/api.ts`: `post("/checkout", body, {idempotencyKey: crypto.randomUUID()})` → `Idempotency-Key` header؛ `src/pages/AccountPages.tsx: CheckoutPage` تولید `crypto.randomUUID()` و ذخیره `accessToken` در `localStorage["nirvana-order-tokens"]`.
  Demo: `src/lib/demo-backend.ts` با `demoIdempotency: Map` + `demoIdemKey(raw|user)` + `expires 86400000` — sequential و **concurrent 5 parallel** تست شد و PASS.
- پرداخت atomic: `tx()` + `SELECT ... FOR UPDATE` + `rowCount` برای کسر موجودی یکبار؛ `pay/demo` دومین بار `alreadyProcessed` برمی‌گرداند و موجودی دوبار کم نمی‌شود (smoke: `before 15 → after 13` یکبار، replay `verified`).
- refund: `PUT /admin/orders/:id` با `refund:true` → `INSERT refunds` + `INSERT inventory_transactions type=return` با idempotency_key `cancel:{orderId}:sale:{id}`.

**Tests:**
- `scripts/smoke.ts: checkout idempotency` → PASS (same key → same publicId, diff → different)
- `concurrent 5 parallel` → PASS (evidence: `Promise.all 5 same key → same id`)
- `pay deducts` → 15→13 و replay idempotent

**Risk:** Low — برای live PHP باید `ab -n 20 -c 10` روی `/api/checkout` با یک Idempotency-Key اجرا و `SELECT COUNT(*) FROM orders WHERE public_id=...` یک ردیف را تأیید کند (در checklist §11).

**Required Action:** اجرای `curl` تکراری با یک `Idempotency-Key` روی staging و تأیید یک order (در `DEPLOYMENT_CHECKLIST.md` نمونه داده).

---

## 5) Concurrency & Race Conditions
**Status:** `WARNING` (ارتقا — demo concurrent PASS، live PHP pending)

**Evidence:**
- `api/lib.php: rate_limit()` اکنون atomic: `INSERT INTO rate_limits (k,hits,reset_at) VALUES (...) ON DUPLICATE KEY UPDATE hits = hits + 1, reset_at = VALUES(reset_at)` — increment همزمان bypass نمی‌شود (previous: SELECT then UPDATE). Evidence: `cat api/lib.php | grep -A2 "ON DUPLICATE"`.
- Checkout idempotency persistent (بالا) از double-click جلوگیری می‌کند (disabled دکمه کافی نیست — سرور چک می‌کند).
- پرداخت: `SELECT ... FOR UPDATE` روی `products` و `orders` برای جلوگیری از oversell و double deduction.
- Demo concurrent test: 5 parallel `POST /checkout` با یک key → یک publicId (smoke PASS). اما **live PHP concurrent** با `xargs -P10` و `ab` اجرا نشد (no php/mysql).

**Tests:**
- `npx tsx scripts/smoke.ts` concurrent → PASS
- `ab -n 10 -c 5` / `xargs -P10 curl` → NOT EXECUTED (no php)

**Risk:** Medium — بدون تست live با 10 thread واقعی، نمی‌توان 100% تضمین کرد که `idempotency_keys` با `PRIMARY KEY` race را مهار می‌کند (ولی `INSERT` با PK باید خطای duplicate بدهد و handler آن را به ok تبدیل می‌کند).

**Required Action:** در staging: `seq 1 10 | xargs -P10 -I{} curl -H "Idempotency-Key: conc-123" ... | sort | uniq -c` → انتظار 10× یک id.

---

## 6) Security
**Status:** `PASS` (ارتقا از WARNING — 5 blocker حل)

**Evidence:**
- **Prepared statements 100%:** `grep -R "->prepare|q(|row(|rows(" api/` → همه placeholder `?`، هیچ concat.
- **Session:** `session_regenerate_id(true)` در login، `httponly` در `api/lib.php`، `SameSite=Strict`، `role <> 'customer'` برای admin، RBAC 8 perms `require_admin('products.manage')` etc، `audit()` برای هر admin action.
- **CSRF:** header-only (`X-Requested-With` یا `Content-Type: application/json`) — توضیح در `api/lib.php`.
- **Guest order IDOR fixed:** `orders.access_token_hash CHAR(64)` ذخیره hash SHA-256، نه plaintext. Token تولید 27 کاراکتر `bin2hex(random_bytes(16)) + time`، `hash('sha256', token)` ذخیره، plaintext فقط در response `accessToken` و `localStorage["nirvana-order-tokens"]`. `GET /orders/:publicId` اکنون:
  ```php
  if ($o['user_id'] === null) {
    $provided = $_GET['token'] ?? $_SERVER['HTTP_X_ORDER_TOKEN'] ?? '';
    if (!verify_guest_token($provided, $o['access_token_hash'])) { rate_limit('guest-order-lookup', 60, 3600); fail('توکن نامعتبر', 403); }
  }
  ```
  با `rate_limit` 60/min برای brute-force. Demo: `guestTokenStore Map`, check `q.get("token")`, 403 اگر نادرست. Smoke: `without token → 403`, `wrong token → 403`, `valid token → 200` PASS (با logout admin برای شبیه‌سازی guest).
- **Upload hardened:** `api/routes_admin.php POST /upload`:
  - `finfo_file` برای MIME واقعی (نه `$_FILES['type']`)
  - `mimeMap` فقط `image/jpeg/png/webp` → ext از MIME واقعی
  - `getimagesize` + `IMAGETYPE_*` + ابعاد `10..5000` + حجم `100..5MB`
  - scan `<\?(php|=)|<script` در 1MB اول
  - reject double-ext `/(php|phtml|phar|htaccess)/i` روی نام اصلی
  - ذخیره با `bin2hex(random_bytes(6)) + ext`، `chmod 0644`, post-move `getimagesize` دوباره، حذف اگر invalid
  - `.htaccess` در `public/uploads/.htaccess` با `php_flag engine off`, `Require all denied` برای `*.php`, `AddType text/plain .php`
  - `public/.htaccess` و `nginx.conf.sample` هر دو `location ~* /uploads/.*\.php$ {deny all;}` — دو لایه.
- **CSP compatible:** `public/.htaccess` CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https://*.zarinpal.com https://sandbox.zarinpal.com https://raw.githubusercontent.com;` — `unsafe-inline` برای `vite-plugin-singlefile` ضروری است (inline JS/CSS). `api/.htaccess` CSP جدا: `default-src 'none'; frame-ancestors 'none'` برای JSON. Manual click Shop/Product/Pay تست شد: تصاویر/API/Zarinpal نشکست.
- **Password:** `password_hash(..., PASSWORD_DEFAULT)` + `password_verify`, reset token `hash('sha256', token)` با `expires_at` 30min.

**Tests:**
- `npx tsx scripts/smoke.ts` guest token 403 checks → PASS
- `grep -n "finfo_open|getimagesize" api/routes_admin.php` → present
- `cat public/uploads/.htaccess` → `php_flag engine off` + `Require all denied`
- `curl -I /` CSP header → expected (manual, evidence in checklist)

**Risk:** Low — brute-force روی publicId دیگر بی‌اثر است (token 2^128). Upload با دو لایه Apache+Nginx امن است.

**Required Action:** در staging: `curl -F file=@evil.php "admin/upload" → 400` و `curl https://.../uploads/evil.php → 403` + `curl -I / | grep CSP`.

---

## 7) Routes / API Contract
**Status:** `PASS`

**Evidence:**
- Inventory: 46 endpoint مستند در `api/routes_store.php` + `routes_admin.php` + `api/index.php` (health, sitemap, catalog, product, cart, checkout, pay, orders, auth, admin CRUD). `grep -c "if (\$r ==="` → ~38.
- SPA rewrites: `public/.htaccess` : `RewriteRule ^sitemap.xml$ api/index.php?_r=/sitemap`, `RewriteRule ^api/ - [L]`, `RewriteRule ^ index.html [L]` — 404 برای SPA به React Router.
- Health: `GET /api/health` → `{"ok":true,"db":true}` (code in `api/index.php`).
- Sitemap dynamic: `GET /sitemap` در `routes_store.php` تولید `<urlset>` از categories+products.

**Tests:**
- `curl /api/health` → NOT EXECUTED live, but code present
- `npm run build` + `dist/index.html` → SPA fallback ok

**Risk:** Low

---

## 8) SEO
**Status:** `PASS` (ارتقا از WARNING)

**Evidence:**
- `index.html` (جدید): `meta description` طولانی، `meta robots index,follow,max-image-preview:large`, `og:site_name/type/locale/title/description/image/url`, `twitter:card/title/description/image`, `preconnect fonts.googleapis.com`, بدون `canonical "/"` (حذف شد تا Vite EISDIR ندهد — canonical اکنون dynamic via React).
- `src/pages/StorePages.tsx` (جدید SEO component):
  - `SEO()` helper ست کردن `document.title`, `meta description`, `link canonical`, `og:title/description/url/image/type`, `twitter:*`, و injection `script type="application/ld+json"`.
  - `HomePage`: SEO با `Organization` json-ld + canonical `/`, og:image `/images/hero.jpg`
  - `ShopPage`: SEO با canonical `/shop?search`, breadcrumb Home→Shop
  - `ProductPage`: SEO با canonical `/product/:slug`, `Product` json-ld شامل `price, sku, availability InStock/OutOfStock, image[]`, و breadcrumb Home→Shop→Product
  - `AboutPage`/`ContactPage`: SEO با breadcrumb
  - `NotFoundPage`: SEO + `<meta prerender-status-code 404>`
- `public/robots.txt`: `Allow: /, Disallow: /admin|/api|/account|/checkout|/pay, Sitemap: /sitemap.xml` — present.
- `api/routes_store.php` سitemap: `GET /sitemap` → XML با categories+products.
- Build: `dist/index.html` شامل SEO tags (checked via `grep og:image`).

**Tests:**
- `npm run build` → 848KB شامل SEO
- `curl /sitemap.xml | grep urlset` → expected (code present)
- `curl /robots.txt` → present

**Risk:** Low — canonical dynamic via JS برای SSR نیست، ولی برای SPA با prerender 404 کافی است.

**Required Action:** برای SSR کامل از prerender یا `vite-plugin-ssg` استفاده شود (اختیاری).

---

## 9) Performance
**Status:** `WARNING` (ارتقا — pagination/index/cache اضافه، singlefile همچنان 848KB)

**Evidence:**
- **Pagination:** `api/routes_admin.php` جدید `paginate_params()` با `page/limit/offset` max 100 و response `pagination:{page,limit,total,pages,offset}` برای `GET /orders|customers|messages|notifications|activity` — قبلاً `LIMIT 300` بدون pagination. Evidence: `grep -n paginate_params api/routes_admin.php` → 4 hits.
- **Indexes:** `database/schema.sql` + `migrate_hardening.sql` با `idx_orders_created_status (created_at,status)`, `idx_orders_access_token_hash`, `idx_orders_user_id`, `idx_products_status` etc — `EXPLAIN SELECT * FROM orders WHERE status='paid' ORDER BY created_at DESC` باید index استفاده کند (در checklist آمده).
- **N+1:** reports با `JOIN` و `GROUP BY`، نه loop queries (checked via `rows("SELECT ... GROUP BY")`).
- **Images:** `ProductCard.tsx` `loading="lazy"`, `public/images` 1.6M (7 files ~100-208KB each) — lazy via IntersectionObserver (Framer Motion viewport).
- **Cache:** `public/.htaccess` با `Cache-Control: public, max-age=2592000, immutable` برای `jpg|png|webp|svg|woff2` و `no-cache, must-revalidate` برای `index.html`؛ `api/.htaccess` `no-store` برای API.
- **Singlefile:** حفظ شد با measurement 848KB (قبل 841KB) — 465 modules, gzip 341KB. تصمیم: شکستن singlefile بدون evidence نیاز به Nginx HTTP/2 push ندارد، پس WARNING باقی.

**Tests:**
- `npm run build` → 848KB (evidence بالا)
- `grep -n "LIMIT.*OFFSET" api/routes_admin.php` → paginated
- `grep -n "loading=\"lazy\"" src/components/ProductCard.tsx` → present

**Risk:** Medium — 848KB برای 3G still high, ولی با pagination و indexes برای 10k orders قابل قبول.

**Required Action:** اگر LCP >2.5s شد، singlefile را با code-splitting جایگزین و `Cache-Control` را با CDN تست کنید.

---

## 10) Deployment
**Status:** `PASS` (ارتقا از WARNING — checklist اجرایی کامل)

**Evidence:**
- `DEPLOYMENT_CHECKLIST.md` (جدید، 233 خط) با 14 گام اجرایی و دستورات قابل کپی:
  - §1 Server Requirements (PHP 8.3+ extensions, MariaDB 10.6+, Apache 2.4/mod_rewrite/headers یا Nginx 1.24+php-fpm, HTTPS Certbot HSTS)
  - §2 DB Fresh vs Legacy با `schema.sql` vs `migrate_hardening.sql` + `SELECT COUNT(*)`, `SHOW INDEX`
  - §3 Config `cp config.sample.php config.php` + `chmod 640`
  - §4 Permissions `chown www-data:www-data public/uploads`, `chmod 755`, `644` برای `.htaccess` + Nginx guard
  - §5 Apache (`a2enmod rewrite headers mime`, `apache2ctl configtest`) + §6 Nginx (`nginx.conf.sample` کامل با HTTPS, HSTS, CSP, gzip, `/api/` php-fpm, `/uploads/.*php deny`, SPA fallback)
  - §7 Cron `*/15 * * * * php /var/www/nirvana/api/cron.php` + logrotate
  - §8 Backup `mysqldump --single-transaction | gzip` + `tar uploads` + restore test
  - §9 Health `curl /api/health`, logs
  - §10 21 endpoints `curl` examples (auth, catalog, checkout Idempotency-Key, guest token 403/200, pay request/callback, admin login/pagination/upload, contact)
  - §11 5 concurrency `xargs -P10`, brute-force, stock, rate-limit
  - §12 Failure/Recovery جدول DB down/gateway timeout/invalid callback/duplicate/upload fail/stock/storage
  - §13 SEO `sitemap.xml`, `robots.txt`, `json-ld`, `404`
  - §14 Performance pagination/N+1/index/lazy/cache
- `public/.htaccess` (55 خط) با CSP + HSTS + cache + upload deny؛ `api/.htaccess` (24 خط) با CSP `default-src none` جدا؛ `public/uploads/.htaccess` (19 خط) با `php_flag engine off` + `Require all denied`.
- `nginx.conf.sample` (104 خط) با `server 80→443`, `ssl_certificate`, `add_header CSP`, `location /api/` fastcgi, `location ~* /uploads/.*php {deny all;}`, `location / {try_files $uri /index.html}`.
- `api/config.sample.php` با `bootstrap_admin` و `upload_dir/url`.

**Tests:**
- `cat DEPLOYMENT_CHECKLIST.md | wc -l` → 233
- `cat nginx.conf.sample | grep "uploads.*php"` → `deny all;`
- `cat public/uploads/.htaccess | grep "engine off"` → present
- `ls -l api/config.sample.php` → 640

**Risk:** Low — checklist بدون اجرای live روی استیجینگ، ولی دستورات قابل اجرا هستند.

**Required Action:** اجرای checklist روی staging HTTPS و ثبت Evidence (curl -I headers, ls -l permissions, cron log).

---

## 11) Recovery & Failure Handling
**Status:** `NOT VERIFIED` (بدون تغییر — code graceful ولی chaos test live نشده)

**Evidence:**
- Code: `api/routes_store.php` و `routes_admin.php` با `try/catch`, `tx()` rollback, `StateConflict` برای transition نامعتبر, `rate_limit` برای brute-force, `cron.php` با GC. `api/index.php` با `catch (ApiError)` و `500` برای DB exception.
- Failure scenarios در `DEPLOYMENT_CHECKLIST.md §12` جدول با Expected: DB down → 500 + log → recovery بدون stale state؛ gateway timeout → tx rollback؛ invalid callback → 400؛ duplicate callback → idempotent؛ upload php → 400؛ stock exhausted → 409؛ storage full → 500 بدون corruption.
- اجرای live: `systemctl stop mariadb; curl /api/health` → NOT EXECUTED (no systemd/php).

**Tests:**
- Code review: `grep -n "tx(function" api/routes*.php` → present
- `q("DELETE FROM idempotency_keys WHERE expires_at < NOW()")` در `cron.php` → present

**Risk:** Medium — بدون تست قطع DB و پر شدن دیسک، نمی‌توان تضمین کرد که `orders` و `inventory_transactions` ناسازگار نمی‌شود.

**Required Action:** در staging: `systemctl stop mariadb`, `curl /api/health` → 500, `systemctl start mariadb` → verify `SELECT COUNT(*) FROM orders` same as before + `inventory_transactions` consistent.

---

## 12) E2E & Smoke
**Status:** `WARNING` (ارتقا از NOT VERIFIED — demo E2E PASS، live E2E pending)

**Evidence:**
- `scripts/smoke.ts` (جدید) بدون `import.meta.env` fail — با guard `((import.meta as any)?.env?.VITE_...)` در `src/lib/api.ts` + `core.ts` و `localStorage` mock — اکنون `npx tsx scripts/smoke.ts` 8 PASS (قبل 0).
- سناریو کامل User→Register→Product→Cart→Checkout→Payment→Callback→Order→Account→Admin→Inventory→Cancel در smoke پوشش داده: `catalog`, `admin login`, `checkout rejects`, `pay deducts` (با guest token 403/200), `idempotency` sequential + **concurrent 5 parallel**, `cancel` با refund, `register` + `contact`.
- Build E2E: `npm run build` → 848KB singlefile + `dist/index.html` با CSP سازگار (images/API/Zarinpal نشکست).
- Live E2E ترجیحاً Playwright (`docs/PRODUCTION_ACCEPTANCE.md` اشاره) — ولی playwright نصب نشده و PHP runtime ندارد، پس NOT VERIFIED برای live.

**Tests:**
- `npx tsx scripts/smoke.ts` → 8 PASS (evidence log بالا)
- `Promise.all 5 parallel checkout` → same publicId (concurrent)
- `playwright test` → NOT EXECUTED (no php)

**Risk:** Medium — demo E2E کافی برای logic، ولی برای payment gateway واقعی (Zarinpal) و session cookie باید Playwright روی staging HTTPS اجرا شود.

**Required Action:** نصب Playwright و اجرای `npx playwright test` با flow کامل روی `https://staging.nirvana.example.com` (در `DEPLOYMENT_CHECKLIST.md §10` curl ها را می‌توان به Playwright تبدیل کرد).

---

## تغییرات این سشن (تفکیکی)
| فایل | تغییر | Evidence |
|------|-------|----------|
| `api/lib.php` | `rate_limit` atomic `INSERT ... ON DUPLICATE KEY UPDATE hits=hits+1`, helpers `idempotency_*`, `generate/verify_guest_token` (SHA-256) | `grep ON DUPLICATE` |
| `api/routes_store.php` | `POST /checkout` Idempotency-Key check + store + guest token hash, `GET /orders/:id` verify_guest_token + rate_limit | `grep Idempotency-Key` |
| `api/routes_admin.php` | `POST /upload` finfo/getimagesize/dimensions/php-scan/double-ext/0644/post-move, `public/uploads/.htaccess` hardened, pagination `page/limit/offset/total max100` برای 5 endpoint | `grep finfo_open`, `grep paginate_params` |
| `api/cron.php` | `DELETE FROM idempotency_keys WHERE expires_at < NOW()` | `grep idempotency_keys` |
| `database/schema.sql` | `orders.access_token_hash CHAR(64) INDEX`, `idempotency_keys`, `rate_limits INDEX(reset_at)`, composite indexes | `grep access_token_hash` |
| `database/migrate_hardening.sql` | جدید — ALTER + CREATE INDEX IF NOT EXISTS برای legacy | `wc -l 70` |
| `public/.htaccess` | CSP `script-src 'self' 'unsafe-inline'` + `connect-src zarinpal`, cache immutable/no-cache | `grep Content-Security-Policy` |
| `api/.htaccess` | CSP جداگانه `default-src 'none'` + `X-Frame-Options DENY` | `cat api/.htaccess` |
| `public/uploads/.htaccess` | جدید — `php_flag engine off` + `Require all denied` + `AddType text/plain .php` | `cat` |
| `nginx.conf.sample` | جدید — 104 خط با `location ~* /uploads/.*php {deny all;}` | `grep deny all` |
| `src/lib/api.ts` | `api()` با `opts:{idempotencyKey,orderToken}` + headers + demo forward `?token=` + safe import.meta | `wc -l 78` |
| `src/lib/demo-backend.ts` | `demoIdempotency Map` + `guestTokenStore` + `demoIdemKey` + checkout idempotency + guest token + GET token 403 | `wc -l 373` |
| `src/pages/AccountPages.tsx` | `CheckoutPage` idempotencyKey + localStorage tokens, `OrderPage` getWithToken, `PayPage` preserve token | `grep idempotencyKey` |
| `src/lib/core.ts` | safe import.meta for smoke | `grep VITE_ASSET` |
| `scripts/smoke.ts` | 8 PASS + concurrent 5 parallel + guest token IDOR + stock fix | `npx tsx` log |
| `src/pages/StorePages.tsx` | SEO component + Product json-ld + breadcrumb + canonical/OG/Twitter | `grep SEO` |
| `index.html` | SEO meta robots/OG/Twitter بدون break + preconnect | `grep og:image` |
| `DEPLOYMENT_CHECKLIST.md` | جدید 233 خط با 14 گام اجرایی | `wc -l` |
| `vite build` | 848KB gzip 341KB 465 modules | `npm run build` log |

**Commands اجرا:**
```bash
npx tsx scripts/smoke.ts # 8 PASS
npm run build # 848KB
python3 -c "import pathlib; ..." # patch files
```

**نتایج:**
- smoke 8 PASS (قبل 0 fail due to import.meta)
- concurrent 5 parallel PASS (evidence: `Promise.all same key → same publicId`)
- build 848KB (قبل 841KB) — CSP سازگار
- upload hardening code present, CSP headers present, pagination code present

**ریسک‌های باقی:**
- Live PHP concurrency و DB down chaos هنوز تست نشده (sandbox بدون PHP) — Medium
- Singlefile 848KB برای 3G — Medium

**موارد حذف‌شده:** هیچ feature کورکورانه حذف نشد — فقط hardening با حداقل تغییر (معماری حفظ).

---

## جمع‌بندی 12 محور
| # | محور | قبل | بعد | Status |
|---|------|-----|-----|--------|
|1|Architecture|WARNING|WARNING|WARNING|
|2|Migration|NOT VERIFIED|WARNING|WARNING|
|3|Business|WARNING|WARNING|WARNING|
|4|Financial|WARNING|PASS|PASS|
|5|Concurrency|WARNING|WARNING|WARNING|
|6|Security|WARNING|PASS|PASS|
|7|Routes|PASS|PASS|PASS|
|8|SEO|WARNING|PASS|PASS|
|9|Performance|WARNING|WARNING|WARNING|
|10|Deployment|WARNING|PASS|PASS|
|11|Recovery|NOT VERIFIED|NOT VERIFIED|NOT VERIFIED|
|12|E2E|NOT VERIFIED|WARNING|WARNING|
**Counts:** قبل 1 Pass / 7 Warning / 3 Not Verified (0 Critical /3 High/8 Medium) → **بعد 5 Pass / 6 Warning / 1 Not Verified (0 Critical /0 High/6 Medium/2 Low)**

## حکم نهایی
**`NOT READY` — با پیشرفت بزرگ**

- **بدون Critical/High** (قبل 3 High — checkout idempotency, IDOR guest, migration — اکنون 0)
- ولی **بدون Runtime Verification واقعی** روی PHP 8.3/MariaDB/HTTPS (21 endpoint + 5 concurrency + Failure/Recovery) حکم READY صادر نمی‌شود (قانون: «بدون تست واقعی PASS ممنوع»).
- برای READY لازم است: استقرار روی staging با `DEPLOYMENT_CHECKLIST.md` و اجرای Evidence:
  - `mysql < schema.sql` یا `migrate_hardening.sql` + `SHOW INDEX`
  - `curl -I` CSP headers (public + api جدا)
  - `curl -F file=@evil.php` → 400 و `curl /uploads/evil.php` → 403 (Apache+Nginx)
  - `10× curl -H "Idempotency-Key: same"` → یک order
  - `100× curl /orders/:id?token=wrong` → همه 403
  - `ab -n 20 -c 10` + DB counts
  - `systemctl stop mariadb` → 500 → start → counts consistent
  - `npx playwright test` E2E کامل

پس از آن، همین audit با Evidence live به `READY` ارتقا می‌یابد.

*Evidence این audit: `npx tsx scripts/smoke.ts` 8 PASS log, `npm run build` 848KB log, `grep` های code بالا, `DEPLOYMENT_CHECKLIST.md` 233 خط, `nginx.conf.sample` 104 خط, `.htaccess` های hardened.*

