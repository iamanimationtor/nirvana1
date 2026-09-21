# چک‌لیست پذیرش نهایی روی هاست

این موارد باید روی دامنهٔ واقعی، بعد از import دیتابیس و تنظیم `api/config.php` اجرا شوند. تست‌های مربوط به PHP، MySQL و زرین‌پال به محیط هاست نیاز دارند و در build استاتیک قابل شبیه‌سازی کامل نیستند.

## Smoke test

```bash
curl -i https://DOMAIN/api/health
curl -i https://DOMAIN/robots.txt
curl -i https://DOMAIN/sitemap.xml
```

پاسخ health باید HTTP 200 و شامل `"ready":true` و هر سه check زیر باشد:

```json
{"database":true,"schema":true,"uploads":true}
```

## فروشگاه

- خانه، فروشگاه، محصول، درباره و تماس با refresh مستقیم 200 می‌دهند.
- جستجو، فیلتر دسته و فیلتر موجودی کار می‌کنند.
- محصول draft در `/api/catalog` نمایش داده نمی‌شود.
- محصول ناموجود قابل اضافه‌شدن نیست.
- افزودن چند variant در یک محصول قیمت و تعداد را درست نگه می‌دارد.
- refresh صفحه، سبد خرید و علاقه‌مندی‌ها را از بین نمی‌برد.
- تست checkout با ایمیل/موبایل اشتباه reject می‌شود.
- checkout دوبار کلیک‌شده دو سفارش نمی‌سازد.

## پرداخت و موجودی

در حالت demo:

- پرداخت موفق یک‌بار موجودی را کم می‌کند.
- retry همان authority موجودی را دوباره کم نمی‌کند.
- انصراف، سفارش را cancelled می‌کند.

در حالت sandbox زرین‌پال:

- request به درگاه می‌رود.
- callback با `Status=OK` verify سمت سرور می‌شود.
- callback تکراری دوباره stock را کم نمی‌کند.
- callback ناموفق سفارش را به وضعیت شکست می‌برد.

## پنل مدیریت

- `/admin/login` با نشست جدا از مشتری کار می‌کند.
- نقش staff بدون permission مناسب به products، orders، settings و users دسترسی ندارد.
- ساخت محصول با وضعیت active در کاتالوگ می‌آید؛ draft نمی‌آید.
- upload فقط JPG/PNG/WebP و حجم مجاز را قبول می‌کند.
- فایل PHP داخل uploads قابل اجرا یا دانلود نیست.
- لغو سفارش paid بدون تأیید refund رد می‌شود.
- لغو با refund فقط یک‌بار موجودی را برمی‌گرداند.
- پیام تماس در `/admin/messages` ظاهر می‌شود.
- خروجی گزارش و CSV قابل دانلود است.

## امنیت و عملیات

- `api/config.php` و فایل‌های source با HTTP قابل خواندن نیستند.
- HTTPS redirect فعال و HSTS در پاسخ production دیده می‌شود.
- `config.php` در git یا public download وجود ندارد.
- `bootstrap_admin.password` بعد از اولین ورود حذف یا خالی شده است.
- Cron با PHP CLI خروجی JSON موفق می‌دهد.
- از دیتابیس و `uploads/` backup و restore آزمایشی گرفته شده است.

## ارتقا به میزبان دیگر

انتقال به VPS یا سرویس دیگر نیازمند تغییر معماری نیست:

1. export/import همان MySQL/MariaDB.
2. انتقال `api/config.php` با secret جدید در صورت نیاز.
3. انتقال `uploads/` و محتوای build.
4. تنظیم rewrite و PHP-FPM/Apache.
5. تغییر `app_url` و در صورت استفادهٔ CDN، `assetBase`.

هیچ process دائمی Node.js در production وجود ندارد.