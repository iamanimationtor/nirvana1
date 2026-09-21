<?php
/**
 * تنظیمات سرور — این فایل را به config.php کپی کنید و مقادیر را پر کنید.
 * هرگز config.php را در گیت commit نکنید.
 */
return [
    // اتصال دیتابیس (از cPanel → MySQL Databases)
    'db' => [
        'host' => 'localhost',
        'name' => 'cpuser_nirvana',
        'user' => 'cpuser_nirvana',
        'pass' => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],

    // آدرس کامل سایت (بدون اسلش انتهایی) — برای بازگشت از درگاه
    'app_url' => 'https://example.com',

    // یک رشتهٔ تصادفی حداقل ۳۲ کاراکتری
    'auth_secret' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING_32+',

    // حالت پرداخت: demo (آزمایشی) یا zarinpal
    'payment_mode' => 'demo',
    'zarinpal_merchant_id' => '',
    'zarinpal_sandbox' => false,

    // مسیر آپلود تصاویر (نسبت به public_html)
    'upload_dir' => __DIR__ . '/../uploads',
    'upload_url' => '/uploads',
    'max_upload_mb' => 5,

    // ادمین اولیه — فقط برای اولین اجرا (بعد از ورود، رمز را عوض کنید)
    'bootstrap_admin' => [
        'name' => 'مدیر نیروانا',
        'email' => 'admin@example.com',
        'password' => 'CHANGE_ME_12_CHARS_MIN',
    ],

    // ایمیل مقصد پیام‌های فرم تماس و بازیابی رمز (اختیاری؛ از mail() هاست استفاده می‌شود)
    'mail_from' => 'no-reply@example.com',
    'debug' => false,
];
