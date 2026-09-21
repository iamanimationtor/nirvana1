# نیروانا ۳دی — فروشگاه + پنل مدیریت (نسخهٔ Shared Hosting)

بازسازی کامل فروشگاه [brainindezak/3d-site](https://github.com/brainindezak/3d-site) با همان ظاهر، داده‌ها و امکانات؛ اما با معماری‌ای که روی **هاست اشتراکی لینوکس معمولی (PHP + MySQL + Apache)** اجرا می‌شود — بدون Node.js server، Docker یا سرویس ابری.

## معماری

| بخش | تکنولوژی | توضیح |
|---|---|---|
| فرانت‌اند | React 19 + Vite + Tailwind 4 + Framer Motion | خروجی build **یک فایل** `index.html` است |
| بک‌اند | PHP خالص (PDO) — بدون فریم‌ورک و Composer | پوشهٔ `api/` — سازگار با PHP 7.4 تا 8.x |
| دیتابیس | MySQL 5.6+ / MariaDB | `database/schema.sql` (بدون نیاز به نوع JSON) |
| پرداخت | حالت آزمایشی یا زرین‌پال (REST v4) | فقط با تنظیم Merchant ID |
| احراز هویت | PHP Session (HttpOnly, SameSite=Strict) — نشست مشتری و مدیر جدا | رمزها با `password_hash` |
| آپلود تصویر | پوشهٔ `uploads/` روی هاست | اعتبارسنجی MIME + غیرفعال‌سازی خودکار PHP در پوشه |
| سئو | `robots.txt` + `sitemap.xml` پویا (از دیتابیس) | rewrite در `.htaccess` |

> **حالت نمایشی:** فقط در development با `import.meta.env.DEV` فعال است. در build production، `demoFallback: false` است تا اگر API قطع باشد، سایت به‌اشتباه سفارش را داخل localStorage ثبت نکند و خطای واضح نشان دهد. ورود مدیر نمایشی: `admin@nirvana.local` / `Admin123456!`

## ساختار پروژه

```
src/
  lib/core.ts            انواع داده، فرمت قیمت، کاتالوگ fallback (همان دادهٔ اصلی)
  lib/api.ts             کلاینت API (+ سوییچ خودکار به حالت نمایشی)
  lib/demo-backend.ts    بک‌اند نمایشی مرورگر
  store/store.tsx        سبد خرید، علاقه‌مندی، تم، توست، کاربر
  components/            Navbar, Footer, بخش‌های صفحهٔ اصلی, ProductCard, Drawer/Modal ها
  pages/StorePages.tsx   خانه، فروشگاه، محصول، درباره ما، تماس، 404
  pages/AccountPages.tsx ورود/ثبت‌نام/بازیابی رمز، حساب، تسویه، پرداخت، سفارش
  admin/AdminApp.tsx     پنل مدیریت کامل (داشبورد تا گزارش‌ها)
api/
  index.php              router
  lib.php                PDO + session + امنیت + ابزارها
  routes_store.php       کاتالوگ، auth، checkout، پرداخت، sitemap
  routes_admin.php       تمام مسیرهای پنل با RBAC سمت سرور
  cron.php               نگه‌داری دوره‌ای (اختیاری)
  config.sample.php      نمونهٔ تنظیمات — به config.php کپی کنید
database/schema.sql      اسکیما + دادهٔ اولیهٔ فروشگاه
public/.htaccess         مسیر‌دهی SPA + هدرهای امنیتی (به dist کپی می‌شود)
public/robots.txt
```

---

## راهنمای نصب روی cPanel / DirectAdmin (~۱۰ دقیقه)

### ۱) Build فرانت‌اند (روی کامپیوتر خودتان)
```bash
npm install
npm run build
```
خروجی: `dist/index.html` + `dist/.htaccess` + `dist/robots.txt`

### ۲) دیتابیس
1. cPanel → **MySQL® Databases**: یک دیتابیس و کاربر بسازید و با **ALL PRIVILEGES** وصل کنید.
2. **phpMyAdmin** → دیتابیس را انتخاب → **Import** → فایل `database/schema.sql`.

### ۳) آپلود فایل‌ها
```
public_html/
  index.html      ← از dist/
  .htaccess       ← از dist/   (Show Hidden Files را فعال کنید)
  robots.txt      ← از dist/
  api/            ← کل پوشهٔ api/ پروژه
  images/         ← تصاویر محلی public/images (بدون وابستگی به GitHub)
  uploads/        ← پوشهٔ خالی (755)
```

### ۴) دو تنظیم کوچک
**الف) `api/config.sample.php` را به `api/config.php` کپی کنید** و پر کنید:
- اطلاعات دیتابیس (مرحلهٔ ۲)
- `app_url` = آدرس سایت با https
- `auth_secret` = یک رشتهٔ تصادفی بلند (۳۲+ کاراکتر)
- `bootstrap_admin` = ایمیل و رمز مدیر اولیه (حداقل ۱۲ کاراکتر) — در اولین ورود به پنل خودکار ساخته می‌شود

**ب) در `index.html` آپلودشده،** تنظیم production باید به شکل زیر باقی بماند. تصاویر و API هر دو روی همان دامنه هستند:
```js
window.NIRVANA = { assetBase: "", apiBase: "/api", demoFallback: false };
```

### ۵) تست
| آدرس | انتظار |
|---|---|
| `/api/health` | `ready=true` و بررسی دیتابیس، schema و uploads |
| `/` | فروشگاه با محصولات از دیتابیس |
| `/admin/login` | ورود با ایمیل/رمز bootstrap |
| `/sitemap.xml` | نقشهٔ سایت XML |

بعد از اولین ورود، از «تغییر رمز عبور» رمز را عوض کنید و `bootstrap_admin` را از `config.php` حذف یا خالی کنید. اگر این مقدار بماند، چون ادمین موجود است دوباره ساخته نمی‌شود؛ اما حذف آن برای جلوگیری از سوءاستفاده الزامی است.

### ۶) پرداخت واقعی (زرین‌پال)
در `api/config.php`:
```php
'payment_mode' => 'zarinpal',
'zarinpal_merchant_id' => 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
```
و در پنل → تنظیمات → «درگاه پرداخت» را روی زرین‌پال بگذارید. آدرس بازگشت خودکار `https://your-domain.com/pay` است. Verify سمت سرور و کسر موجودی در تراکنش اتمیک انجام می‌شود. قبل از فعال‌کردن، یک پرداخت موفق، لغو درگاه و callback تکراری را با مبلغ کم در محیط sandbox تست کنید.

### ۷) Cron (اختیاری اما توصیه‌شده)
cPanel → Cron Jobs → روزی یک بار:
```
/usr/local/bin/php /home/USER/public_html/api/cron.php
```
کار آن: پاک‌سازی توکن‌های منقضی، rate limit ها، و **لغو خودکار سفارش‌های پرداخت‌نشدهٔ بالای ۲۴ ساعت**.

### چک‌لیست production
- [ ] PHP 7.4+ (ترجیحاً 8.x) با افزونه‌های `pdo_mysql`, `curl`, `fileinfo`, `mbstring`
- [ ] SSL فعال (Let's Encrypt) + از کامنت درآوردن ۲ خط ریدایرکت HTTPS در `.htaccess`
- [ ] `config.php` پر شده و `debug => false`
- [ ] `assetBase: ""` در index.html
- [ ] `apiBase: "/api"` و `demoFallback: false` در index.html
- [ ] رمز ادمین bootstrap عوض شده
- [ ] ایمیل فروشگاه در پنل → تنظیمات (برای دریافت پیام‌های تماس)
- [ ] `payment_mode = zarinpal` قبل از فروش واقعی
- [ ] Cron تنظیم شده
- [ ] بکاپ دوره‌ای: phpMyAdmin → Export + پوشهٔ `uploads/`
- [ ] `curl -i https://DOMAIN/api/health` با `ready:true` پاسخ می‌دهد
- [ ] با قطع موقت API، فرانت‌اند پیام خطا می‌دهد و به حالت demo نمی‌رود
- [ ] تمام تصاویر از `/images` و `/uploads` دامنهٔ خودتان باز می‌شوند؛ هیچ وابستگی runtime به GitHub وجود ندارد

> **DirectAdmin:** همان مراحل با *MySQL Management* و *File Manager*؛ ریشهٔ سایت `domains/your-domain.com/public_html` است. بعد از SSL، ریدایرکت HTTPS در `.htaccess` به‌صورت پیش‌فرض فعال است.

## امکانات کامل
**فروشگاه:** خانه (Hero پارالاکس، دسته‌ها، منتخب‌ها، بنر کالکشن، اینستاگرام)، فروشگاه با فیلتر/مرتب‌سازی/جستجو (Ctrl+K)، صفحهٔ محصول (گالری، variants، تب‌ها، مرتبط‌ها)، Quick View، سبد کشویی با انیمیشن پرواز، علاقه‌مندی‌ها، تم تاریک/روشن، ورود/ثبت‌نام/بازیابی رمز، حساب (سفارش‌ها/آدرس‌ها/پروفایل/رمز)، تسویه مهمان یا عضو، درگاه پرداخت، پیگیری سفارش با تاریخچه، تماس، درباره ما.

**پنل مدیریت (`/admin`):** داشبورد آماری، محصولات (CRUD کامل + آپلود تصویر + پیش‌نویس/انتشار)، دسته‌ها، سفارش‌ها (ماشین وضعیت مجاز، بازگشت موجودی و ثبت بازپرداخت هنگام لغو، یادداشت داخلی، تاریخچه)، مشتریان، انبار (شارژ/اصلاح + دفتر تراکنش)، کاربران/نقش‌ها/مجوزهای ریز، تنظیمات فروشگاه، گزارش فروش/تحلیل/پرفروش‌ها با بازهٔ تاریخ، اعلان‌ها (سفارش جدید/کمبود موجودی/پیام/مشتری جدید)، پیام‌های تماس، لاگ فعالیت مدیران، تغییر رمز، بازیابی رمز مدیر.

## امنیت
- Prepared statements همه‌جا؛ تراکنش + `FOR UPDATE` + idempotency برای پرداخت/موجودی (بدون double-spend)
- نشست مدیر جدا از مشتری، انقضای لغزان ۸ ساعته، `session_regenerate_id` هنگام ورود
- CSRF: هدر اختصاصی + بررسی Origin برای همهٔ درخواست‌های تغییردهنده
- Rate limit دیتابیسی برای ورود/ثبت‌نام/تماس/تسویه/بازیابی رمز
- RBAC سمت سرور در تک‌تک مسیرهای admin؛ حذف نرم محصولات (سوابق سفارش حفظ می‌شود)
- آپلود: بررسی MIME واقعی + `getimagesize` + خنثی‌سازی PHP در `uploads/`
- `.htaccess`: انکار دسترسی مستقیم به `config.php` و فایل‌های کتابخانه، هدرهای امنیتی، بدون listing
- لغو سفارش پرداخت‌شده فقط با تأیید صریح بازپرداخت؛ رویداد و لاگ کامل

## توسعهٔ محلی
```bash
npm install && npm run dev
```
بدون سرور PHP در حالت نمایشی (localStorage) کار می‌کند. با PHP محلی:
```bash
php -S localhost:8080 -t <پوشه‌ای که api/ در آن است>
```
و در `index.html`‌: `window.NIRVANA = { assetBase: "", apiBase: "http://localhost:8080/api" }`.

## نتیجهٔ ممیزی نهایی

- اتصال production به API صریح است: `apiBase: "/api"` و `demoFallback: false`.
- حالت demo فقط برای Vite development فعال است و در فروش واقعی نمی‌تواند سفارش جعلی localStorage بسازد.
- تصاویر پایه در `public/images` بسته‌بندی شده‌اند و uploadها در `public/uploads` از اجرای اسکریپت محافظت می‌شوند.
- پرداخت و callback از سمت سرور verify می‌شوند؛ کسر موجودی با transaction و قفل ردیف انجام می‌شود.
- شناسهٔ idempotency برای بازگشت موجودی مانع double-restock هنگام retry مدیر است.
- جابه‌جایی به VPS یا میزبان دیگر به تغییر وب‌سرور، دیتابیس و `api/config.php` محدود است؛ front-end process دائمی لازم ندارد.
