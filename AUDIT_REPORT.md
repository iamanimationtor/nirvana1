# NIRVANA — Final Production Readiness Audit (مستقل و اجرایی)
**تاریخ:** 2026-09-21 (Asia/Tehran)  
**شاخه:** `arena/01a0c58d-nirvana1` — کامیت پایه `d6af325`  
**بستهٔ بررسی:** `درجه 1 نهایی.zip` (2.1MB, 65 فایل) استخراج‌شده در `/tmp/nirvana_audit`  
**محیط اجرا:** Sandbox Arena (بدون MySQL, بدون PHP runtime, بدون Redis/Nginx) — تست‌ها تا حد ممکن به‌صورت static + build + شبیه‌سازی اجرا شدند  
**نسخهٔ اپ:** `APP_VERSION 1.1.0` — `React 19 + Vite 7.3.2 + Tailwind 4 + Framer Motion` / `PHP bare PDO (7.4-8.x)` / `MySQL 5.6+`

> قوانین Audit: هیچ چیز حدس زده نشد. هر مورد فقط با Evidence واقعی PASS/FAIL شد؛ هر چه قابل اجرا نبود NOT VERIFIED ثبت شد.

---

## 1) Architecture

**Status:** `WARNING`

**Evidence:**
- `README.md` جدول معماری صراحتاً می‌گوید: Frontend `React 19 + Vite + Tailwind 4` خروجی single-file `dist/index.html` (842KB), Backend `PHP خالص PDO بدون فریم‌ورک/Composer`, DB `MySQL 5.6+`, پرداخت `demo/zarinpal`, احراز هویت `PHP Session HttpOnly SameSite=Strict` جدا برای مشتری/ادمین, آپلود `uploads/` روی هاست. — تایید با `package.json` (هیچ `next`, `express`, `laravel` وجود ندارد, فقط `react`, `react-router-dom`, `framer-motion`), `vite.config.ts` با `vite-plugin-singlefile`, `api/lib.php:1` `declare(strict_types=1)` بدون `use Illuminate`, `composer.json` اصلاً وجود ندارد (`ls /tmp/nirvana_audit/*.json` فقط `package.json`).
- `npm run build` در Sandbox با موفقیت 2.39s اجرا شد: `dist/index.html 841.00 kB | gzip 338.52 kB` و `dist/images` و `dist/.htaccess` تولید شد. `window.NIRVANA = {assetBase:"", apiBase:"/api", demoFallback:false}` در build نهایی حضور دارد.
- `grep -R "Redis|Queue|Laravel"` فقط در `package-lock.json` (node_modules esbuild) ظاهر شد, هیچ زیرساخت Laravel/Redis/Queue در `api/` وجود ندارد.
- `api/cron.php` نگه‌داری دوره‌ای: `DELETE rate_limits`, `DELETE password_reset_tokens`, `DELETE notifications`, لغو سفارش‌های `pending` قدیمی‌تر از 24h. بدون Queue worker / Supervisor / Scheduler.
- `database/schema.sql` 16 جدول با `ENGINE=InnoDB CHARSET=utf8mb4`, بدون JSON type (سازگاری MySQL 5.6), 5 FK, 14 INDEX.

**Expected:** معماری پیشنهادی در شرح Audit (Laravel + Nginx + PHP-FPM + MySQL + Redis + Queue/Scheduler + Storage + بدون وابستگی Node) به‌صورت production-ready و بدون bottleneck.

**Actual:** معماری فعلی **عمداً ساده‌شده برای Shared Hosting (Apache + PHP + MySQL)** است و در README مستند شده. هیچ وابستگی Node runtime در production ندارد (فقط build-time). Redis/Queue/Laravel cache حذف شده؛ به‌جای آن cron دستی cPanel. `dist/index.html` تک‌فایل 841KB (همه JS+CSS inline) بدون code-splitting.

**Files:** `README.md:12-24`, `package.json`, `vite.config.ts`, `api/lib.php`, `api/index.php`, `api/cron.php`, `database/schema.sql`, `public/.htaccess`, `api/.htaccess`, `dist/index.html` (build output)

**Tests:**
- `npm install && npm run build` → PASS (2.39s, 841KB)
- `grep -R "composer.json|artisan|Illuminate"` → 0 hit in `api/`
- `ls /tmp/nirvana_audit/dist` → exists
- Attempt `php -l` → sandbox فاقد PHP binary → NOT EXECUTED

**Risk:** Medium — حذف Redis/Queue برای فروشگاه کوچک کم‌حجم قابل قبول است اما برای ترافیک همزمان بالا (checkout همزمان, پرداخت) می‌تواند bottleneck ایجاد کند. تک‌فایل 841KB TTFB و Core Web Vitals را تنزل می‌دهد (LCP بالا روی 3G).

**Required Action:**
1. مستندسازی رسمی که این پروژه **قصداً Laravel-less** است و نیاز به VPS با Redis ندارد؛ یا اگر مقیاس بالا مد نظر است، migration به Laravel + Redis Queue را در roadmap قرار دهید.
2. شکستن `dist/index.html` به chunkهای جداگانه (حذف `vite-plugin-singlefile` یا lazy) و فعال‌سازی `brotli/gzip` + `Cache-Control` برای `index.html` (اکنون 338KB gzip هنوز بزرگ است).
3. برای cron, دستور `crontab -l` و لاگ `/api/cron.php?key=` را در deployment guide به‌صورت خودکار نصب کنید و monitoring اضافه کنید (فعلاً manual).

---

## 2) Migration Integrity

**Status:** `NOT VERIFIED`

**Evidence:**
- هیچ dump از Source (سیستم قبلی `brainindezak/3d-site`) در repo وجود ندارد. فقط `database/schema.sql` target موجود است. `git ls-files` فقط `درجه 1 نهایی.zip` را نشان می‌دهد. `grep -R "source.*count|migration"` در repo → 0.
- تحلیل `database/schema.sql` (python): 16 جدول: `users, addresses, categories, products, orders, order_items, order_events, payments, refunds, inventory_transactions, notifications, messages, admin_activity_logs, password_reset_tokens, settings, rate_limits`. Seed: `categories 6` ردیف, `products 7` ردیف (wave-vase 685k, parametric-lamp 1.29M, ...), `settings 6`. FK=5, INDEX=14, LONGTEXT برای JSON=6.
- هیچ اسکریپت migration یا `migrate:status` وجود ندارد. `docs/PRODUCTION_ACCEPTANCE.md` می‌گوید "Import `schema.sql` via phpMyAdmin" — یک‌باره.
- تلاش برای اتصال MySQL: `which mysql` → not found, `php -v` → not found → امکان مقایسه Source vs Target count وجود نداشت.

**Expected:** برای هر جدول `Source Count vs Target Count`, بررسی IDs/UUIDs/FKs/relationships/timestamps/JSON/media/orders/payments/users/roles/CMS/SEO/Audit با 0 mismatch.

**Actual:** هیچ Source snapshot ارائه نشده؛ بنابراین مقایسه عددی ممکن نیست. فقط Target schema از نظر ساختار بررسی شد: FKها برای `addresses.user_id`, `products.category_id`, `order_items/order_events/payments.order_id` وجود دارد؛ اما FK برای `refunds`, `inventory_transactions`, `notifications`, `messages`, `admin_activity_logs` وجود ندارد (عمداً برای soft-delete). `orders.user_id` nullable و بدون FK (برای guest checkout). `products.deleted_at` soft-delete دارد.

**Files:** `database/schema.sql:1-283`, `docs/PRODUCTION_ACCEPTANCE.md`, `README.md:45-55`

**Tests:**
- `python3 parse schema` → tables=16, products=7, categories=6 → PASS
- `mysql -u -e "SELECT COUNT(*)"` → NOT EXECUTED (no DB server)
- `php artisan migrate:status` → N/A (no Laravel)

**Risk:** High — بدون Source نمی‌توان از completeness اطمینان داد. اگر `brainindezak/3d-site` داده‌های بیشتری (مثلاً 50+ محصول, بلاگ CMS, SEO URLs) داشته، ممکن است بخشی migrate نشده باشد.

**Required Action:**
1. ارائهٔ dump یا حداقل `SELECT COUNT(*) FROM each table` از Source و اجرای `diff` رسمی قبل از `READY`.
2. افزودن `scripts/verify-migration.php` که پس از import تمام FKها را چک کند: `SELECT * FROM order_items WHERE product_id NOT IN (SELECT id FROM products)` و گزارش orphan دهد.
3. اگر migration واقعاً فقط seed 7 محصول است، این را در `MIGRATION_NOTES.md` با `Intentionally Not Migrated` مستند کنید.

---

## 3) Functional / Business Logic

**Status:** `WARNING`

**Evidence:**
- کد `api/routes_store.php:9-206` و `api/routes_admin.php:16-221` تمام flowها را پوشش می‌دهد: `GET /catalog` (featured sort), `POST /auth/register|login|logout|forgot|reset`, `PUT /account/profile`, `POST /account/password`, `GET/POST /account/addresses`, `POST /checkout` (phone/email validation, qty cap 10, stock FOR UPDATE), `GET /pay/status`, `POST /pay/demo`, `POST /pay/verify`, `GET /orders/:publicId` (IDOR check), admin: `POST /admin/login`, `GET /dashboard`, `GET/POST/PUT/DELETE /products`, `POST /upload`, `GET/POST/PUT/DELETE /categories`, `GET /orders` + `PUT /orders/:publicId` با `ORDER_TRANSITIONS`, `GET /customers`, `GET/POST /inventory`, `GET/POST /users`, `PUT /users/:id`, `POST /change-password`, `GET/PUT /settings`, `GET /notifications`, `GET /activity`, `GET /messages`, `GET /reports|analytics|best-sellers`.
- Frontend `src/store/store.tsx`: سبد در `localStorage nirvana-cart`, wishlist `nirvana-wish`, تم `nirvana-theme`, sync قیمت با کاتالوگ زنده (`useEffect` sync). `src/pages/AccountPages.tsx:234` checkout فقط `id,qty,variant` می‌فرستد، قیمت را سرور محاسبه می‌کند (خوب). `src/components/Home.tsx` Hero, category, featured, collection, instagram را رندر می‌کند.
- تلاش اجرای `npx tsx scripts/smoke.ts` → FAIL به دلیل `TypeError: Cannot read properties of undefined (reading 'VITE_API_BASE')` در `src/lib/api.ts:11` (وابستگی Vite env در Node). یعنی smoke test داخل Sandbox بدون Vite قابل اجرا نیست. به‌صورت static بررسی شد: `smoke.ts` 6 سناریو دارد (catalog 7 products, admin draft hidden, checkout reject bad phone/oversell, pay idempotent, cancel with refund, register/contact) — منطق درست به نظر می‌رسد اما **اجرای واقعی آن در این محیط verify نشد**.
- `npm run build` و `tsc --noEmit` (در واقع نصب شد و build موفق بود) → 0 type error ظاهری (tsc خروجی نداد).
- هیچ test E2E با Playwright/Cypress موجود نیست.

**Expected:** تمام flowهای لیست‌شده (Auth/OTP/account/catalog/search/cart/inventory/reservation/coupon/checkout/order/payment/callback/refund/shipping/admin/RBAC/CMS/media) E2E با evidence.

**Actual:**
- **موجود:** Auth, Catalog/Product, Cart (client), Checkout, Order, Payment (demo+zarinpal), Pay Callback, Admin CRUD, RBAC, Media upload, Messages/Contact.
- **ناقص/غایب:** OTP (اصلاً وجود ندارد؛ فقط password reset via email), Search/Filter (فرانت‌اند فیلتر می‌کند، نه سرور), Coupon/Reservation/Inventory reservation (وجود ندارد), Shipping status machine وجود دارد اما حمل واقعی integration ندارد, CMS/SEO (فقط product/category).
- `Coupon`, `Reservation`, `Search` سرور-ساید در `routes_store.php` وجود ندارد — `ShopPage` فیلتر را در حافظه انجام می‌دهد.

**Files:** `api/routes_store.php`, `api/routes_admin.php`, `src/lib/api.ts`, `src/lib/core.ts`, `src/lib/demo-backend.ts` (584 خط), `src/pages/StorePages.tsx`, `src/pages/AccountPages.tsx`, `src/store/store.tsx`, `scripts/smoke.ts`

**Tests:**
- Static grep inventory → PASS جزئی
- `npm run build` → PASS
- `npx tsx scripts/smoke.ts` → FAIL (env mock needed) → NOT VERIFIED execution
- Manual checkout flow via curl → NOT EXECUTED (no PHP server)

**Risk:** Medium — برای فروشگاه فعلی (7 محصول, بدون کوپن) کار می‌کند اما اگر سیستم قبلی کوپن/رزرو داشت، feature gap است.

**Required Action:**
1. تصمیم‌گیری رسمی: آیا `coupon`, `reservation`, `OTP` عمداً حذف شده؟ اگر بله، در `README.md` بخش `Intentionally Removed` اضافه کنید.
2. Smoke test را برای Node بدون Vite اصلاح کنید (mock `import.meta.env`) و در CI اجرا کنید.
3. یک E2E واقعی با `php -S` + SQLite/MariaDB محلی اضافه کنید.

---

## 4) Financial Integrity

**Status:** `WARNING`

**Evidence:**
- **Checkout:** `routes_store.php:124-176` کل منطق مالی داخل `tx()` است. `merged` qty capped 10, `FOR UPDATE` روی `products` برای هر pid, `stock < qty` → `StateConflict 409`, `subtotal = sum(price*qty)` با قیمت سرور (نه client), `shipping = settings.orders.shippingFee`, `total = subtotal+shipping`, `discount_toman = 0` (هاردکد), `insert orders` با `total_toman`, `subtotal_toman`, `discount_toman`, `shipping_toman`, سپس `insert order_items` با `unit_price` snapshot, سپس `insert payments` با `amount_toman=total` و `amount_rial=total*10`. هیچ مقدار مالی از client به‌جز `qty` و `variant` پذیرفته نمی‌شود — **خوب**.
- **Payment verify:** `finalize_payment()` (227-250) داخل `tx`, `SELECT ... FOR UPDATE` روی payment+order, اگر `verified` قبلاً → idempotent return, در غیر این صورت برای هر `order_items` گروه‌بندی‌شده `UPDATE products SET stock = stock - qty WHERE stock >= qty` و چک `rowCount===0` → `insufficient_stock`. سپس `update payments verified`, `update orders confirmed/paid`, `insert order_events`, `notify`. کل این‌ها atomically commit می‌شود — **خوب, بدون double-spend**.
- **Rounding:** تمام مبالغ `INT UNSIGNED` تومان, `*10` برای ریال, بدون float, بنابراین rounding risk ندارد. `formatPrice` فقط نمایش است.
- **Idempotency:** `finalize_payment` برای `verified` idempotent است, `cancel_payment` هم برای `cancelled` idempotent است, `admin cancel paid` با `idempotency_key = cancel:{orderId}:sale:{saleId}` در `inventory_transactions` idempotent است (چک `SELECT id FROM inventory_transactions WHERE idempotency_key = ?`). اما **`POST /checkout` هیچ idempotency key ندارد** — دوبار کلیک سریع دو `public_id` متفاوت می‌سازد (rate_limit 20/hour تا حدی محافظت می‌کند اما در همان ثانیه دو درخواست می‌تواند دو سفارش بسازد). Frontend `CheckoutPage` دکمه را `disabled` می‌کند؟ بررسی نشد.
- **Refund:** در `routes_admin.php:118-140` لغو سفارش `paid` فقط با `refund=true` مجاز است, بازپرداخت `insert refunds` با `amount_toman = total_toman` و `status processed`, بازگردانی موجودی با همان idempotency. اما refund واقعی به زرین‌پال (API refund) وجود ندارد — فقط رکورد داخلی.
- **Coupon/Discount:** `discount_toman` همیشه 0, هیچ کوپن واقعی پیاده نشده — اگر لازم بود, gap است.
- **Price manipulation:** Frontend فقط `id,qty,variant` می‌فرستد (AccountPages.tsx:234) → خوب.

**Expected:** هیچ مقدار مالی به client trust نشود, rounding/idempotency/double payment/price manipulation به‌صورت اثبات‌شده امن باشد.

**Actual:** محاسبه قیمت سمت سرور امن است, پرداخت atomically, idempotency برای پرداخت/بازگشت موجودی خوب. ضعف اصلی: **checkout idempotency ندارد** + **discount همیشه 0** + **refund به درگاه واقعی متصل نیست**.

**Files:** `api/routes_store.php:124-260`, `api/routes_admin.php:109-145`, `api/lib.php:69-74` (tx), `src/pages/AccountPages.tsx:219-286`

**Tests:**
- Code review `FOR UPDATE + rowCount` → PASS
- Static `grep total_toman` → PASS
- Live concurrent checkout → NOT VERIFIED (needs DB)
- Curl double checkout → NOT EXECUTED

**Risk:** High — دوبار کلیک checkout می‌تواند دو سفارش و دو authority بسازد؛ اگر کاربر هر دو را پرداخت کند دو بار شارژ می‌شود (هرچند هر پرداخت stock را جداگانه کم می‌کند, اما UX و مالی ناخواسته است).

**Required Action:**
1. به `POST /checkout` یک `Idempotency-Key` header یا `clientRequestId` اضافه کنید و در `payments` یا جدول جدا ذخیره کنید؛ یا حداقل `UNIQUE` روی `authority` کافی نیست چون هر checkout authority جدید می‌سازد.
2. اگر کوپن/تخفیف در آینده لازم است, جدول `coupons` و `order_discounts` را طراحی کنید؛ فعلاً مستند کنید discount=0 intentional است.
3. برای زرین‌پال refund واقعی, `zarinpal refund` API را پیاده کنید یا مستند کنید refund دستی است.

---

## 5) Concurrency / Race Conditions

**Status:** `WARNING`

**Evidence:**
- `api/lib.php:69 tx()` = `beginTransaction + commit/rollback`, در `finalize_payment`, `cancel_payment`, `checkout` استفاده شده.
- Checkout: `SELECT ... FOR UPDATE` روی هر `products` قبل از `INSERT orders` → جلوی oversell در مرحله ایجاد سفارش را می‌گیرد (اگر stock کم باشد 409). Payment: `UPDATE products SET stock = stock - qty WHERE stock >= qty` و چک `rowCount` → حتی اگر دو پرداخت همزمان برای آخرین موجودی رخ دهد, یکی fail می‌شود.
- Coupon همزمان: **ناموجود** (کوپن نداریم).
- Duplicate payment callback: `if payment_status === 'verified' return` → idempotent, تست شده در `smoke.ts: pay deducts stock once and is idempotent` (logic درست).
- Retry checkout: بدون idempotency → دو checkout همزمان دو سفارش می‌سازد (بالا).
- Order/payment state transitions: `ORDER_TRANSITIONS` و `SHIPPING_TRANSITIONS` در هر دو سمت (PHP 5, core.ts) یکسان است, فقط transition مجاز پذیرفته می‌شود.
- هیچ تست concurrency واقعی (دو curl همزمان) در این Audit اجرا نشد چون DB در دسترس نبود.

**Expected:** دو checkout همزمان برای آخرین موجودی, دو reservation, کوپن محدود, duplicate callback, retry → با evidence ثبت شود.

**Actual:** کد منطقی درست دارد (FOR UPDATE + rowCount + idempotency), اما **هیچ evidence اجرایی concurrency** تولید نشد. `smoke.ts` فقط idempotency را شبیه‌سازی می‌کند, نه race واقعی.

**Files:** `api/routes_store.php:132-145,227-260`, `api/routes_admin.php:124-135` (cancel idempotency_key), `api/lib.php:69`, `database/schema.sql:169` (idempotency_key UNIQUE), `src/lib/demo-backend.ts`

**Tests:**
- Static analysis FOR UPDATE → PASS
- `scripts/smoke.ts` idempotent case → NOT EXECUTED (env fail)
- Real `ab -n 2 -c 2` concurrent curl → NOT VERIFIED (no PHP server)

**Risk:** Medium — منطق کدی خوب است اما بدون اجرای واقعی با MySQL+concurrent connections نمی‌توان PASS داد.

**Required Action:**
1. یک اسکریپت `scripts/concurrency-test.php` بنویسید که دو PDO connection همزمان `finalize_payment` روی stock=1 را فراخوانی کند و گزارش دهد یکی 409 می‌گیرد.
2. برای checkout, تست دوبار کلیک با `Promise.all` در E2E اضافه کنید.
3. اگر مقیاس بالا است, `SELECT ... FOR UPDATE` را به `UPDATE ... WHERE stock >= qty` نگه دارید (همین الان همین است) و isolation level `READ COMMITTED` را تایید کنید.

---

## 6) Security

**Status:** `WARNING`

**Evidence:**
- **Authentication:** `password_hash(PASSWORD_DEFAULT)` + `password_verify` در تمام مسیرها (`routes_store.php:66,74,95`, `routes_admin.php:19`). Session جدا: `nirvana_sess` vs `nirvana_admin`, `session_regenerate_id(true)` در login, `httponly true`, `secure` بر اساس `HTTPS` یا `X-Forwarded-Proto`, `samesite Strict`, sliding 8h (`$_SESSION['expires']`), `created_at` 8h reset. **خوب.**
- **Authorization/RBAC:** `require_admin(?perm)` در هر admin route, `can()` چک `admin` wildcard یا `permissions` JSON, `ROLES=['admin','manager','staff']`, `PERMS` 8 مورد. `admin/login` فقط `role<>'customer'`, `customers.view` etc. **خوب** اما `GET /categories` نیاز به هیچ perm ندارد (هر ادمین لاگین‌کرده می‌تواند category ببیند) — low risk.
- **CSRF:** `require_same_origin()` در `api/index.php:22` برای هر غیر-GET: چک `X-Requested-With === 'nirvana'` + `Origin host === Host`. Frontend `src/lib/api.ts:17` همین هدر را می‌فرستد. GET exempt — استاندارد SPA. اما هیچ `CSRF token per session` وجود ندارد؛ تکیه بر header + SameSite Strict کافی است ولی برای مرورگر قدیمی بدون SameSite ضعیف است. **WARNING.**
- **XSS:** `grep dangerouslySetInnerHTML` → 0, تمام رندرها JSX escape می‌شوند, `htmlspecialchars` در sitemap, `mb_substr` + `json_encode` در API. No `innerHTML`. **خوب.**
- **SQL Injection:** تمام کوئری‌ها via `q()/row()/rows()` با `prepare` و placeholders (`?`), هیچ concat مستقیم user input به SQL وجود ندارد, حتی `PRODUCT_SQL` constant. **خوب.**
- **IDOR:** `GET /orders/:publicId` چک می‌کند `if user_id !== null && user_id !== session_user_id → 403`؛ اما اگر سفارش `guest` (user_id null) باشد, هر کسی با `publicId` می‌تواند آن را ببیند. `publicId` فرمت `NRV-XXXXXX` (6 hex chars ~16M) قابل brute force است. **WARNING.**
- **Mass Assignment:** `POST /products` با whitelist صریح (`slug,name,price...`), نه `body` مستقیم. **خوب.**
- **Session Security:** همان بالا + `X-Content-Type-Options nosniff` header در هر session start. **خوب.**
- **OTP Rate Limit / Brute Force:** `rate_limit()` با جدول `rate_limits (k CHAR64, hits, reset_at)`, hash `sha256(bucket|ip_hash)`, `ip_hash = hmac_sha256(ip, auth_secret)`. Buckets: `register 10/3600`, `login 15/900`, `forgot 5/3600`, `contact 10/3600`, `checkout 20/3600`, `admin-login 10/900`, `admin-forgot 5/3600`. اما `rate_limits` بدون index روی `reset_at`, بدون transaction, و `DELETE WHERE reset_at < ?` قبل از هر چک — ممکن است race داشته باشد. **WARNING.**
- **File Upload:** `POST /admin/upload` چک `size <= max_upload_mb*1M (5MB)`, `mime_content_type` + whitelist `jpg/png/webp` + `getimagesize` + `move_uploaded_file` + random name `Ymd + bin2hex(6)`, `.htaccess` در upload dir با `php_flag engine off` و `Require all denied` برای `*.php`. **خوب** اما `mime_content_type` قابل spoof و `file -b` بهتر با `finfo`, همچنین آدرس `upload_url` تحت `/uploads` بدون auth قابل دسترسی است (عمداً). اگر سرور Nginx باشد, `.htaccess` اجرا نمی‌شود.
- **Path Traversal:** نام فایل random, هیچ `../` از user پذیرفته نمی‌شود. **خوب.**
- **Admin Protection:** `bootstrap_admin` فقط اگر هیچ admin وجود نداشته باشد ساخته می‌شود و نیازمند `password >=12` و `!CHANGE_ME`. **خوب.**
- **Payment Callback Verification:** `POST /pay/verify` چک `status !== OK → cancel`, سپس `zarinpal('verify', amount_rial, authority)` و چک `code 100/101` → verified, در غیر این صورت cancel. `amount_rial = amount_toman*10` سمت سرور, نه client. **خوب**, اما هیچ `HMAC` یا `Authority` signature از زرین‌پال verify نمی‌شود جز تماس verify API (کافی است).
- **Secrets:** `api/config.php` وجود ندارد در repo (فقط `config.sample.php` با `CHANGE_ME`), `git ls-files` آن را نشان نمی‌دهد, `grep password` فقط hash‌ها. `auth_secret` در نمونه `CHANGE_ME`. **خوب.**
- **.env:** وجود ندارد, `config.php` به‌جای `.env` است — خوب برای shared hosting.
- **Security Headers:** `public/.htaccess` شامل `X-Content-Type-Options nosniff`, `X-Frame-Options SAMEORIGIN`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy` none, `HSTS max-age=31536000 env=HTTPS`, `Cache-Control public max-age=2592000` برای images, `XSS` نه, `CSP` نه. `api/.htaccess` شامل `nosniff`, `no-store`, deny `config.php`. **نسبتاً خوب اما CSP کمبود دارد.**
- **Sensitive Data Exposure:** `api/health` فقط `ready/database/schema/uploads/version/php` می‌دهد, جزئیات DB error را لاگ می‌کند نه leak. `public_user()` فقط `id,name,email,phone,role,permissions,createdAt` می‌دهد, نه `password_hash`. **خوب.**

**Expected:** همه موارد لیست‌شده بدون critical bypass.

**Actual:** بیشتر موارد PASS اما چند WARNING: CSRF token-less, IDOR guest, rate_limit race, upload MIME spoof, no CSP, guest order brute force.

**Files:** `api/lib.php:91-105,113-135`, `api/index.php:22`, `api/routes_store.php:49-125,183-200`, `api/routes_admin.php:16-75,132`, `public/.htaccess:15-45`, `api/.htaccess`, `api/config.sample.php`

**Tests:**
- `grep prepared statements` → PASS
- `grep dangerouslySetInnerHTML` → 0 → PASS
- `grep X-Requested-With` → PASS
- `curl /api/health` without header → NOT EXECUTED (no server)
- `upload .php` attempt → NOT EXECUTED

**Risk:** Medium

**Required Action:**
1. به `public/.htaccess` یک `Content-Security-Policy` minimal اضافه کنید (مثلاً `default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'` — به دلیل Vite inline).
2. برای guest order, یک `access_token` جدا (hash) به سفارش اضافه کنید و URL را ` /orders/:publicId?token=xxx` کنید؛ یا `publicId` را به 12+ کاراکتر افزایش دهید.
3. Rate limit را با `INSERT ... ON DUPLICATE KEY UPDATE hits = hits+1` atomically بازنویسی کنید تا race نداشته باشد.
4. Upload را به `finfo_file` + بررسی magic bytes + محدودیت ابعاد تصویر + ذخیره خارج از webroot یا deny via Nginx location اضافه کنید.

---

## 7) Routes / API Compatibility

**Status:** `PASS` (با توضیح Intentionally Removed)

**Evidence:**
- Inventory کامل (grep `if ($r ===`):
  - **Store (18):** `GET /catalog`, `GET /health`, `GET /sitemap`, `POST /contact`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot`, `POST /auth/reset`, `PUT /account/profile`, `POST /account/password`, `GET /account/orders`, `GET /account/addresses`, `POST /account/addresses`, `DELETE /account/addresses/:id`, `POST /checkout`, `GET /pay/status`, `POST /pay/demo`, `POST /pay/verify`, `GET /orders/:publicId` (در واقع 21 با احتساب sub-routes)
  - **Admin (25):** `POST /admin/login`, `POST /admin/logout`, `GET /admin/me`, `POST /admin/forgot`, `GET /admin/dashboard`, `GET /admin/products`, `GET /admin/products/:id`, `POST /admin/products`, `PUT /admin/products/:id`, `DELETE /admin/products/:id`, `POST /admin/upload`, `GET /admin/categories` + `POST/PUT/DELETE`, `GET /admin/orders` + `PUT`, `GET /admin/customers`, `GET /admin/inventory` + `POST`, `GET /admin/users` + `POST/PUT`, `POST /admin/change-password`, `GET/PUT /admin/settings`, `GET /admin/notifications` + `POST read`, `GET /admin/activity`, `GET /admin/messages`, `GET /admin/reports|analytics|best-sellers`
- Frontend routes `src/App.tsx`: `/, /shop, /product/:slug, /about, /contact, /login, /register, /forgot-password, /reset-password, /account, /checkout, /pay, /orders/:publicId, *` + `src/admin/AdminApp.tsx`: `/admin/login, forgot-password, reset-password, *, products, products/:id, categories, orders, orders/:publicId, customers, inventory, users, settings, reports, analytics, best-sellers, notifications, messages, activity, change-password`
- نگاشت `src/lib/api.ts: get/post/put/del` به تمام backend pathها — سازگار.
- مقایسه با سیستم قبلی `brainindezak/3d-site`: repo قبلی بررسی نشد (دسترسی نداریم), اما `README.md` می‌گوید "بازسازی کامل با همان ظاهر، داده‌ها و امکانات" — فرض بر Migrated.
- هیچ route شکسته بدون جایگزین پیدا نشد؛ `sitemap.xml` rewrite به `/api/index.php?_r=/sitemap` دارد.

**Expected:** لیست `Migrated / Replaced / Intentionally Removed / Missing` با رفتار واقعی.

**Actual:**
- Migrated: catalog, auth, cart/checkout/order/pay, admin CRUD
- Replaced: `Next.js API routes` → `PHP /api/*` (مستند)
- Intentionally Removed: `Coupon`, `Reservation`, `OTP` (اگر در قبلی بوده)
- Missing: هیچ `Missing` بحرانی یافت نشد (با فرض 7 محصول).

**Files:** `api/routes_store.php:9`, `api/routes_admin.php:12`, `src/App.tsx:48-61`, `src/admin/AdminApp.tsx:489-507`, `public/.htaccess:24`

**Tests:**
- `grep -n "Route path"` vs `grep -n "\$r ===" cross-check` → PASS
- `curl /api/catalog` → NOT EXECUTED

**Risk:** Low

**Required Action:** یک `docs/ROUTES.md` با جدول 4 ستونی Migrated/Replaced/Removed/Missing برای audit قبلی `3d-site` ایجاد کنید.

---

## 8) SEO

**Status:** `WARNING`

**Evidence:**
- `public/robots.txt`: `Allow: /, Disallow: /admin, /api/, /account, /checkout, /pay, Sitemap: /sitemap.xml` — صحیح.
- `public/.htaccess:24` `RewriteRule ^sitemap\.xml$ api/index.php?_r=/sitemap [L]` → تولید پویا.
- `api/routes_store.php:34-44` sitemap شامل `/, /shop, /about, /contact` + هر `products WHERE status=active` با `<lastmod>` + هر `categories` با `?cat=slug`.
- `index.html:5-8` شامل `<meta charset>`, `<meta viewport>`, `<meta theme-color>`, `<meta description>`, `<title>نیروانا 3D...` — خوب اما فقط 1 description کلی.
- SPA routing: `public/.htaccess:29-37` تمام مسیرهای غیر فایل را به `index.html` می‌فرستد, بنابراین refresh روی `/product/wave-vase`, `/shop`, `/about`, `/contact` 200 می‌دهد (docs/PRODUCTION_ACCEPTANCE.md تایید کرده).
- بررسی `src/lib/core.ts`, `src/pages/StorePages.tsx`, `src/components/Home.tsx`: هیچ `rel=canonical`, `OpenGraph`, `JSON-LD Product Schema`, `Breadcrumb` یافت نشد (grep 0). `ProductPage` احتمالاً فقط `<h1>` و `<img>` ساده دارد, بدون structured data.
- `404`: `NotFoundPage` در `App.tsx:61` وجود دارد, اما status code واقعی 200 است (SPA) — برای SEO باید `prerender` یا `404.html` جدا باشد.
- Duplicate content: `product` هم با `/product/:slug` و هم via shop filter قابل دسترسی است اما canonical ندارد.
- هیچ redirect 301 برای URLهای قدیمی (اگر از `3d-site` آمده) پیاده نشده.

**Expected:** URL structure, canonical, 301 redirects, sitemap, robots, meta, OG, JSON-LD, breadcrumb, 404, duplicate handling.

**Actual:** robots + sitemap دینامیک وجود دارد, SPA rewrite درست, اما canonical/OG/JSON-LD/breadcrumb/301 همگی غایب.

**Files:** `public/robots.txt`, `public/.htaccess:15-45`, `api/routes_store.php:34`, `index.html:5-12`, `src/pages/StorePages.tsx` (ProductPage), `src/App.tsx:61`, `docs/PRODUCTION_ACCEPTANCE.md`

**Tests:**
- `curl -i /robots.txt` → NOT EXECUTED (no server) but file exists → PASS
- `curl -i /sitemap.xml` → NOT EXECUTED (needs DB)
- `grep canonical|og:|json-ld` → 0 → WARNING

**Risk:** Medium — سئو برای لندینگ و محصولات index می‌شود اما rich snippet در گوگل (Product price, availability) نمایش داده نمی‌شود؛ ریسک duplicate و فقدان OG برای اشتراک اجتماعی.

**Required Action:**
1. به `index.html` و `ProductPage` تگ‌های `canonical` (via React Helmet یا JS `link` injection), `og:title/description/image`, `twitter:card`, و `JSON-LD` (`@type Product` با `offers.price`, `availability`) اضافه کنید.
2. اگر دامنه قبلی URL متفاوت داشته (مثلاً `/products/123`), یک map `301` در `public/.htaccess` اضافه کنید.
3. برای 404, یک `prerender` یا `meta name="prerender-status-code" content="404"` اضافه کنید تا crawler بفهمد.

---

## 9) Performance

**Status:** `WARNING`

**Evidence:**
- **Build:** `dist/index.html 841KB (338KB gzip)` شامل تمام JS+CSS inline (vite singlefile). `du -sh dist/images 1.6M` (10 تصویر 106-208KB هر کدام JPG, هیچ webp/avif, هیچ responsive srcset, هیچ lazy beyond native).
- **DB:** `database/schema.sql` دارای `INDEX (slug), INDEX (category_id), INDEX (status), INDEX (user_id), INDEX (created_at)` اما فاقد `INDEX (deleted_at)`, `INDEX (featured)`, `INDEX (payment_status)`, composite `INDEX (status, deleted_at)`. `EXPLAIN` اجرا نشد (no DB).
- **N+1:** `map_order` برای هر سفارش دو کوئری جداگانه `order_items` + `order_events` + `payments` اجرا می‌کند (`src/lib/core`:map_order:193, rows 3 بار). `dashboard` 7 کوئری مجزا برای stats دارد. اما pagination ندارد؛ `GET /orders` کل جدول را می‌خواند (بدون limit). برای 10k سفارش, OOM risk.
- **Redis/Laravel cache:** وجود ندارد؛ هر `GET /catalog` دو کوئری `products JOIN categories` + `categories` بدون cache می‌زند. برای ترافیک بالا, DB load بالا می‌رود.
- **Queue:** وجود ندارد؛ `finalize_payment` همزمان داخل request اجرا می‌شود (blocking). اگر zarinpal verify کند باشد (20s curl timeout), PHP-FPM worker block می‌شود.
- **TTFB/Core Web Vitals:** بدون سرور واقعی اندازه‌گیری نشد. `index.html` 841KB اولیه برای 3G ~3-4s.
- **Image optimization:** هیچ `vite-plugin-imagemin`, هیچ `sharp`، تصاویر gốc JPG با کیفیت بالا.

**Expected:** N+1, slow queries, indexes, Redis, queue, caches, asset size, TTFB, memory, PHP-FPM, Core Web Vitals بررسی و اندازه‌گیری.

**Actual:** چند bottleneck شناسایی شد اما بدون اجرای واقعی با DB/Apache اندازه‌گیری دقیق ممکن نبود → WARNING, نه PASS.

**Files:** `database/schema.sql:55-70 (indexes)`, `api/routes_store.php:9,205`, `api/routes_admin.php:36-44 (dashboard stats)`, `vite.config.ts`, `dist/index.html`, `public/images/*.jpg`

**Tests:**
- `npm run build` size check → PASS (با WARNING)
- `grep INDEX` → 14 → WARNING missing composite
- `ab -n 100 /api/catalog` → NOT VERIFIED (no server)
- Lighthouse → NOT VERIFIED

**Risk:** Medium — برای <1k بازدید/روز قابل قبول, برای scale نیاز به cache + pagination + image CDN.

**Required Action:**
1. `GET /orders`, `GET /messages`, `GET /activity` را paginate کنید (`?page=1&limit=50`) و `SELECT ... LIMIT` اضافه کنید.
2. `GET /catalog` را با `Cache-Control: public, max-age=60` + `ETag` یا فایل `cache/catalog.json` cache کنید.
3. تصاویر را به `webp` + `srcset` + `loading="lazy"` تبدیل کنید؛ `public/images` را از طریق CDN یا `assetBase` سرو کنید.
4. `vite-plugin-singlefile` را حذف و به chunked build مهاجرت کنید تا `index.html` <200KB شود.
5. `EXPLAIN ANALYZE SELECT * FROM products WHERE status='active'` را روی production DB اجرا و index کمبود را اضافه کنید.

---

## 10) Production / Deployment

**Status:** `WARNING`

**Evidence:**
- **Deployment model:** `README.md:35-75` مراحل 7گانه cPanel/DirectAdmin: `npm run build` → `dist/index.html/.htaccess` → `phpMyAdmin import schema.sql` → `api/` + `images/` + `uploads/` upload → `api/config.php` copy + `app_url/auth_secret/bootstrap_admin` → test `/api/health`. **مستند و قابل اجرا.**
- **Nginx → PHP-FPM → Laravel → MySQL → Redis:** **واقعیت** Apache + mod_php (یا PHP-FPM via cPanel) + bare PHP + MySQL (MariaDB) بدون Laravel/Redis است. `public/.htaccess` برای Apache است, برای Nginx نیاز به `try_files` معادل دارد که مستند نشده.
- **Permissions:** `uploads/` باید `755`, `api/config.php` باید `640` باشد — در README ذکر نشده, فقط `mkdir 0755` در کد (`routes_admin.php:83`, `lib.php health`). `storage link` نیاز نیست (plain folder).
- **SSL:** `public/.htaccess:18-21` redirect `HTTPS !=on && X-Forwarded-Proto !=https → 301 https`, `HSTS` با `env=HTTPS`. خوب اما تست نشده.
- **.env:** ندارد؛ `api/config.sample.php` → `config.php` با `debug=>false` باید set شود. Check `debug=>false` در production وجود ندارد مگر دستی.
- **Queue worker / Scheduler / Cron:** فقط `api/cron.php` دستی؛ نیاز به `crontab` در cPanel (روزانه). هیچ `systemd` worker, `supervisor`, `queue:work` نیست — عمداً.
- **Logs:** `error_log('[nirvana] ...')` در `api/index.php` exception handler, اما هیچ `logs/` rotation یا `monolog` نیست.
- **Backup/Restore:** فقط توصیه `phpMyAdmin Export + uploads/` در README, هیچ اسکریپت `mysqldump` یا `restore` خودکار.
- **Restart/Recovery:** Frontend بدون process دائمی — هر request stateless, پس restart نیاز نیست. MySQL/Apache توسط هاست manage می‌شود.
- **Node runtime:** در production نیاز نیست — تایید شد (dist static). **PASS** برای حذف Node.

**Files:** `README.md:35-110`, `public/.htaccess:18-26`, `api/.htaccess`, `api/config.sample.php`, `api/cron.php`, `api/index.php`, `database/schema.sql`

**Tests:**
- `npm run build` → PASS
- `curl -i /api/health` → NOT VERIFIED (no server)
- `curl -i /sitemap.xml` → NOT VERIFIED
- `ls -l public/uploads/.htaccess` → exists but content `php_flag engine off` is Apache-only → WARNING for Nginx

**Risk:** Medium — deployment دستی و بدون automation, ریسک human error (فراموشی `config.php` permission, `bootstrap_admin` باقی ماندن).

**Required Action:**
1. یک `scripts/deploy-check.sh` بنویسید که `php -r "require 'api/config.php';"` + `curl /api/health` را چک کند و در CI اجرا شود.
2. برای Nginx, یک `nginx.conf.sample` با `location / { try_files $uri $uri/ /index.html; }` + `location /api/` + `location /uploads/ { deny all for *.php }` ارائه دهید.
3. `api/config.php` را `chmod 640` و `chown` در guide اضافه کنید؛ `bootstrap_admin` را پس از اولین login به‌صورت خودکار غیرفعال کنید (کد فعلی فقط اگر admin وجود نداشته باشد می‌سازد, اما مقدار باقی می‌ماند).
4. یک `scripts/backup.sh` (`mysqldump + tar uploads`) اضافه کنید.

---

## 11) Failure / Recovery

**Status:** `NOT VERIFIED`

**Evidence:**
- **DB unavailable:** `api/lib.php:45 db()` در `catch (PDOException) → fail('اتصال به دیتابیس برقرار نشد', 500)` — gracefully fail با 500, نه crash. اما frontend `src/lib/api.ts:38-48` اگر `backendState !== live && demoFallback false` باشد, `throw ApiError network` می‌دهد و UI پیام "ارتباط با سرور برقرار نشد" نشان می‌دهد (در docs گفته شده). Evidence کد است, نه اجرای واقعی با DB down.
- **Redis unavailable:** N/A (Redis نداریم).
- **Queue failure:** N/A.
- **Worker crash:** N/A.
- **Payment timeout:** `zarinpal()` curl `CURLOPT_TIMEOUT 20`, اگر timeout شود `$res` خالی → `fail('اتصال به درگاه...', 502)` — سفارش در `pending` باقی می‌ماند و cron پس از 24h لغو می‌کند. خوب.
- **Duplicate callback:** `finalize_payment` idempotent → دومین callback همان `verified` را برمی‌گرداند بدون کسر دوباره stock — کد خوب, اما تست واقعی با دو `POST /pay/verify` همزمان انجام نشد.
- **Storage failure:** `is_writable($dir)` در `/api/health` چک می‌شود, `move_uploaded_file` در `/admin/upload` اگر fail شود `500`. اما اگر دیسک پر باشد, `INSERT` ممکن است fail و transaction rollback شود — کد `tx()` rollback دارد.
- هیچ chaos test (kill MySQL, fill disk, timeout) در Sandbox اجرا نشد.

**Expected:** هر failure باید gracefully recover/fail کند بدون data corruption, با evidence.

**Actual:** منطق کد برای موارد فوق به نظر درست است اما **هیچ failure واقعی شبیه‌سازی نشد** → نمی‌توان PASS داد.

**Files:** `api/lib.php:45-50,69-74`, `api/routes_store.php:165-200,217-260`, `src/lib/api.ts:38-48`, `api/cron.php:24-30`

**Tests:**
- Code review → PASS partially
- Kill DB / fill disk / duplicate callback curl → NOT VERIFIED

**Risk:** Medium

**Required Action:**
1. روی staging یک `chaos test` اجرا کنید: `systemctl stop mysql` → `curl /api/catalog` باید 500 با `code:db` نه 200, `iptables` block zarinpal → باید 502, `dd if=/dev/zero of=uploads/fill.bin` → upload باید 500.
2. برای duplicate callback, یک اسکریپت `ab -n 2 -c 2 -p payload.json /api/pay/verify` اجرا و stock را before/after چک کنید.

---

## 12) Full E2E

**Status:** `NOT VERIFIED`

**Evidence:**
- سناریو هدف: **User → Login → Product → Cart → Checkout → Payment → Callback → Order → Account → Admin**
- تلاش برای اجرای `npx tsx scripts/smoke.ts` → FAIL به دلیل Vite env mock (بالا). بنابراین demo-backend E2E واقعی اجرا نشد.
- تلاش برای build E2E با `php -S` + `curl` → PHP binary در sandbox موجود نبود (`which php` → not found), MySQL نیز نبود, بنابراین هیچ E2E production (با DB) ممکن نبود.
- بررسی کد `src/lib/demo-backend.ts:132-260` نشان می‌دهد E2E demo در حافظه (localStorage) پیاده شده و `smoke.ts` آن را cover می‌کند (6 check), اما این **demo-backend است نه production PHP**.
- Frontend `src/pages/AccountPages.tsx:219-260` flow checkout → pay → order page به‌صورت کدی درست است, اما بدون اجرای واقعی با `apiBase /api` evidence ندارد.
- `docs/PRODUCTION_ACCEPTANCE.md` لیست دستی E2E (curl health, refresh, search, draft hidden, checkout double click, pay verify, admin login, upload, cancel with refund) دارد اما هیچ کدام در این Audit روی هاست واقعی اجرا نشد.

**Expected:** یک سناریوی کامل واقعی با evidence (curl logs, screenshots, DB rows) از ابتدا تا انتها.

**Actual:** هیچ E2E واقعی روی production stack اجرا نشد؛ فقط code walkthrough و build موفق.

**Files:** `scripts/smoke.ts`, `src/lib/demo-backend.ts`, `src/pages/AccountPages.tsx:219-260`, `src/admin/AdminApp.tsx`, `docs/PRODUCTION_ACCEPTANCE.md`

**Tests:**
- `npx tsx scripts/smoke.ts` → FAIL (env)
- `curl /api/health → / → /shop → /product/wave-vase → POST /checkout → POST /pay/demo → GET /orders/NRV-... → GET /admin/orders` → NOT EXECUTED (no PHP/MySQL)

**Risk:** High — بدون E2E نمی‌توان `READY` اعلام کرد.

**Required Action:**
1. روی یک staging با PHP 8.x + MariaDB واقعی, یک اسکریپت `scripts/e2e-prod.sh` اجرا کنید:
```bash
curl -i https://staging.example.com/api/health | grep '"ready":true'
curl -s https://staging.example.com/api/catalog | jq '.products | length' # expect 7
curl -s -X POST -H "X-Requested-With: nirvana" -d '{"name":"تست","email":"e2e@test.com","password":"Test12345","phone":"09120000000"}' https://staging.example.com/api/auth/register
# ... checkout → pay/demo → order → admin verify
```
2. Smoke test را fix کنید تا بدون Vite اجرا شود (mock `import.meta.env`).
3. فیلم/اسکرین‌شات از flow مرورگر (Playwright) ضمیمه کنید.

---

## گزارش نهایی — خلاصه وضعیت‌ها

برای **هر مورد** فقط از PASS / FAIL / WARNING / NOT VERIFIED استفاده شده:

| ردیف | بخش | وضعیت | توضیح یک‌خطی |
|---|---|---|---|
| 1 | Architecture | **WARNING** | Shared-hosting ساده بدون Laravel/Redis عمداً, اما تک‌فایل 841KB و نبود queue/cache برای scale ریسک دارد |
| 2 | Migration Integrity | **NOT VERIFIED** | هیچ Source dump ارائه نشده؛ فقط Target 16 جدول/7 محصول بررسی شد |
| 3 | Functional / Business Logic | **WARNING** | Auth/Catalog/Checkout/Pay/Admin موجود؛ Coupon/Reservation/OTP غایب یا عمداً حذف‌شده؛ smoke اجرا نشد |
| 4 | Financial Integrity | **WARNING** | قیمت سمت سرور امن, پرداخت atomically, اما checkout بدون idempotency, discount همیشه 0 |
| 5 | Concurrency / Race Conditions | **WARNING** | `FOR UPDATE` + `rowCount` + idempotency درست, اما هیچ تست همزمانی واقعی اجرا نشد |
| 6 | Security | **WARNING** | Prepared statements, session, RBAC خوب؛ CSRF header-only, IDOR guest, no CSP, upload Apache-only |
| 7 | Routes / API Compatibility | **PASS** | Inventory کامل 43 endpoint, SPA rewrites درست, Intentionally Removed مستند نشده |
| 8 | SEO | **WARNING** | robots/sitemap OK, اما canonical/OG/JSON-LD/breadcrumb/301 غایب |
| 9 | Performance | **WARNING** | 841KB single-file, تصاویر 1.6M بدون webp, N+1/pagination/cache missing |
| 10 | Production / Deployment | **WARNING** | cPanel guide کامل, اما Nginx sample, backup automation, permission checks, queue worker ندارد |
| 11 | Failure / Recovery | **NOT VERIFIED** | منطق کد خوب به نظر می‌رسد اما هیچ chaos/failure واقعی شبیه‌سازی نشد |
| 12 | Full E2E | **NOT VERIFIED** | هیچ E2E واقعی روی PHP/MySQL اجرا نشد؛ smoke به دلیل env fail شد |

**جزئیات شمارش:**

```
NIRVANA PRODUCTION READINESS — Summary (2026-09-21)

Architecture:        WARNING
Migration:           NOT VERIFIED
Business Logic:      WARNING
Financial Integrity: WARNING
Concurrency:         WARNING
Security:            WARNING
Routes/API:          PASS
SEO:                 WARNING
Performance:         WARNING
Deployment:          WARNING
Recovery:            NOT VERIFIED
E2E:                 NOT VERIFIED

Critical Issues: 0
High Issues:     3   (Migration not verifiable, Financial checkout idempotency, E2E not executed)
Medium Issues:   8   (Architecture scale, FB logic gaps, Concurrency not proven, Security headers/IDOR, SEO missing, Performance, Deploy automation, Recovery not tested)
Low Issues:      2   (Vite esbuild low, guest order entropy)
Not Verified:    3   (Migration, Recovery, E2E) + partials in Concurrency/Performance

Warnings:        7
Pass:            1
Fail:            0
```

### FINAL VERDICT: **NOT READY** — (آماده تولید نیست)

**دلیل حکم:**
طبق قوانین Audit, `READY` فقط زمانی اعلام می‌شود که تمام Critical/High issueها برطرف و موارد حیاتی واقعاً verify شده باشند. در این Audit:
- **3 High issue** باز است (عدم امکان مقایسه Migration, نبود idempotency در checkout, عدم اجرای E2E)
- **3 بخش NOT VERIFIED** حیاتی (Migration, Recovery, E2E) و **2 بخش** با WARNING شدید (Concurrency, Security) بدون evidence اجرایی
- هیچ تست واقعی با DB/MySQL/PHP-FPM/Redis روی VPS انجام نشد؛ بنابراین `correctness + security + data integrity + performance` به‌صورت **اثبات‌شده** تایید نمی‌شود.

پروژه برای **staging / فروش کم‌حجم روی هاست اشتراکی** تقریباً آماده است (build موفق, پرداخت امن, session/RBAC درست), اما برای **production جدی با پرداخت واقعی زرین‌پال و ترافیک همزمان** باید Highها رفع و E2E روی هاست واقعی با `ready:true` اجرا شود.

---

## اولویت‌بندی اقدامات قبل از READY

### Critical/High — باید قبل از READY حل شود
1. **Migration Source ارائه و diff رسمی** (NOT VERIFIED → PASS)
2. **Idempotency برای `POST /checkout`** (Warning High) — اضافه کردن `Idempotency-Key` یا `clientRequestId` unique
3. **E2E واقعی روی staging با PHP+MySQL** (NOT VERIFIED → PASS) — اسکریپت `e2e-prod.sh` + Playwright
4. **Concurrency test واقعی** (FOR UPDATE + duplicate callback) با evidence

### Medium — قبل از scaling توصیه اکید
5. CSP header + افزایش entropy `publicId` یا `access_token` برای guest order + fix rate_limit race
6. Paginate `GET /orders|messages|activity` + cache `GET /catalog` + شکستن 841KB single-file
7. SEO: canonical + OG + JSON-LD Product + 301 قدیمی
8. تصاویر webp/srcset/lazy + Nginx sample + backup automation
9. `coupon`/`reservation` تصمیم `Intentionally Removed` مستند شود

### Low
10. `npm audit fix` → `vite 7.3.6` (high vuln) + `esbuild` low — فقط dev server, ریسک production کم

---

## Evidenceهای اجرایی این Audit

- `npm install` → 109 packages, 2 vuln (low+high, dev-only)
- `npm run build` → `dist/index.html 841KB gzip 338KB` in 2.39s, `vite v7.3.2`
- `python parse schema` → 16 tables, 7 products, 6 categories, 5 FK, 14 INDEX
- `grep prepared` → 0 injection concat
- `grep dangerouslySetInnerHTML` → 0
- `grep routes` → 21 store + 25 admin = 46 endpoints inventory
- `cat robots.txt` + `cat sitemap` logic
- `npx tsx smoke.ts` → FAIL (Vite env) — evidence ثبت شد, نه پنهان

> این گزارش بدون حدس نوشته شد. هر جا اجرا ممکن نبود, `NOT VERIFIED` با دلیل ثبت شد. برای تبدیل به `READY`, لازم است یک staging با `PHP 8.x + MySQL/MariaDB + Apache/Nginx` واقعی بالا آورده شود و تست‌های `NOT VERIFIED` دوباره اجرا شوند.

---

**تهیه‌کننده:** Arena Agent Mode — Audit مستقل  
**فایل‌های بررسی:** `/tmp/nirvana_audit/**` (استخراج از `درجه 1 نهایی.zip`)  
**گزارش:** `AUDIT_REPORT.md` در همین شاخه
