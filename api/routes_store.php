<?php
/** مسیرهای عمومی فروشگاه: کاتالوگ، حساب مشتری، سفارش، پرداخت */
declare(strict_types=1);

function store_routes(string $m, array $seg): void {
    $r = $m . ' /' . implode('/', array_map(fn($s, $i) => $i > 0 && ctype_digit($s) ? ':id' : $s, $seg, array_keys($seg)));

    /* ── catalog ── */
    if ($r === 'GET /catalog') {
        $products = array_map('map_product', rows(PRODUCT_SQL . " AND p.status = 'active' ORDER BY p.featured DESC, p.id"));
        $cats = array_map('map_category', rows("SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, id"));
        ok(['products' => $products, 'categories' => $cats, 'settings' => settings()]);
    }
    if ($r === 'GET /health') {
        $checks = ['database' => false, 'schema' => false, 'uploads' => false];
        try {
            db()->query('SELECT 1');
            $checks['database'] = true;
            $required = ['users', 'products', 'categories', 'orders', 'payments', 'settings'];
            $placeholders = implode(',', array_fill(0, count($required), '?'));
            $schemaCount = (int) row("SELECT COUNT(*) v FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ($placeholders)", $required)['v'];
            $checks['schema'] = $schemaCount === count($required);
        } catch (Throwable $e) {
            // Do not expose connection details from the readiness endpoint.
            error_log('[nirvana:health] ' . $e->getMessage());
        }
        $dir = rtrim((string) cfg('upload_dir', __DIR__ . '/../uploads'), '/');
        $checks['uploads'] = is_dir($dir) ? is_writable($dir) : @mkdir($dir, 0755, true);
        $ready = !in_array(false, $checks, true);
        json_out(['ok' => $ready, 'ready' => $ready, 'version' => APP_VERSION, 'php' => PHP_VERSION, 'checks' => $checks], $ready ? 200 : 503);
    }

    /* ── sitemap.xml (بازنویسی‌شده از public/.htaccess) ── */
    if ($r === 'GET /sitemap') {
        $base = rtrim(cfg('app_url'), '/');
        header('Content-Type: application/xml; charset=utf-8');
        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach (['', '/shop', '/about', '/contact'] as $p) echo "  <url><loc>$base$p</loc></url>\n";
        foreach (rows("SELECT slug, updated_at FROM products WHERE deleted_at IS NULL AND status = 'active'") as $p)
            echo "  <url><loc>$base/product/" . htmlspecialchars($p['slug']) . "</loc><lastmod>" . substr($p['updated_at'], 0, 10) . "</lastmod></url>\n";
        foreach (rows("SELECT slug FROM categories WHERE active = 1") as $c)
            echo "  <url><loc>$base/shop?cat=" . htmlspecialchars($c['slug']) . "</loc></url>\n";
        echo '</urlset>';
        exit;
    }

    /* ── contact ── */
    if ($r === 'POST /contact') {
        rate_limit('contact', 10, 3600);
        $name = s('name'); $bodyTxt = s('body');
        if ($name === '' || $bodyTxt === '') fail('نام و پیام الزامی است');
        insert('messages', ['name' => mb_substr($name, 0, 120), 'contact' => mb_substr(s('contact'), 0, 160), 'body' => mb_substr($bodyTxt, 0, 4000), 'ip_hash' => ip_hash()]);
        notify('message', 'پیام جدید', $name . ': ' . mb_substr($bodyTxt, 0, 60), '/admin/messages');
        $to = settings()['store.email'];
        if ($to) @mail($to, '=?UTF-8?B?' . base64_encode('پیام جدید از سایت نیروانا') . '?=', "$name\n" . s('contact') . "\n\n$bodyTxt", "From: " . cfg('mail_from') . "\r\nContent-Type: text/plain; charset=UTF-8");
        ok();
    }

    /* ── auth ── */
    if ($r === 'POST /auth/register') {
        rate_limit('register', 10, 3600);
        $name = s('name'); $email = mb_strtolower(s('email')); $pass = (string) in('password', '');
        if ($name === '' || !valid_email($email)) fail('نام و ایمیل معتبر الزامی است');
        if (mb_strlen($pass) < 8) fail('رمز عبور باید حداقل ۸ کاراکتر باشد');
        if (row("SELECT id FROM users WHERE email = ?", [$email])) fail('این ایمیل قبلاً ثبت شده است');
        $id = insert('users', ['name' => mb_substr($name, 0, 120), 'email' => $email, 'phone' => mb_substr(s('phone'), 0, 20), 'password_hash' => password_hash($pass, PASSWORD_DEFAULT), 'role' => 'customer', 'permissions' => '[]']);
        session_regenerate_id(true); $_SESSION['user_id'] = $id;
        notify('new_customer', 'مشتری جدید', "$name ثبت‌نام کرد", '/admin/customers');
        ok(['user' => public_user(row("SELECT * FROM users WHERE id = ?", [$id]))]);
    }
    if ($r === 'POST /auth/login') {
        rate_limit('login', 15, 900);
        $u = row("SELECT * FROM users WHERE email = ? AND active = 1", [mb_strtolower(s('email'))]);
        if (!$u || !password_verify((string) in('password', ''), $u['password_hash'])) fail('ایمیل یا رمز عبور اشتباه است', 401);
        session_regenerate_id(true); $_SESSION['user_id'] = (int) $u['id'];
        ok(['user' => public_user($u)]);
    }
    if ($r === 'POST /auth/logout') { session_unset(); session_destroy(); ok(); }
    if ($r === 'GET /auth/me') { $u = current_user(); ok(['user' => $u ? public_user($u) : null]); }
    if ($r === 'POST /auth/forgot') {
        rate_limit('forgot', 5, 3600);
        $u = row("SELECT * FROM users WHERE email = ?", [mb_strtolower(s('email'))]);
        if ($u) {
            $token = bin2hex(random_bytes(24));
            insert('password_reset_tokens', ['user_id' => $u['id'], 'token_hash' => hash('sha256', $token), 'expires_at' => date('Y-m-d H:i:s', time() + 3600)]);
            $link = rtrim(cfg('app_url'), '/') . '/reset-password?token=' . $token;
            @mail($u['email'], '=?UTF-8?B?' . base64_encode('بازیابی رمز عبور نیروانا') . '?=', "برای تعیین رمز جدید روی لینک زیر بزنید (اعتبار: ۱ ساعت):\n$link", "From: " . cfg('mail_from') . "\r\nContent-Type: text/plain; charset=UTF-8");
        }
        ok(['message' => 'اگر ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود.']);
    }
    if ($r === 'POST /auth/reset') {
        $t = row("SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()", [hash('sha256', s('token'))]);
        if (!$t) fail('لینک نامعتبر یا منقضی است');
        if (mb_strlen((string) in('password', '')) < 8) fail('رمز عبور باید حداقل ۸ کاراکتر باشد');
        update('users', ['password_hash' => password_hash((string) in('password'), PASSWORD_DEFAULT)], 'id = ?', [$t['user_id']]);
        update('password_reset_tokens', ['used_at' => date('Y-m-d H:i:s')], 'id = ?', [$t['id']]);
        ok();
    }

    /* ── account ── */
    if (($seg[0] ?? '') === 'account') {
        $u = require_user(); $uid = (int) $u['id'];
        if ($r === 'PUT /account/profile') {
            update('users', ['name' => mb_substr(s('name', $u['name']), 0, 120) ?: $u['name'], 'phone' => mb_substr(s('phone', $u['phone']), 0, 20)], 'id = ?', [$uid]);
            ok(['user' => public_user(row("SELECT * FROM users WHERE id = ?", [$uid]))]);
        }
        if ($r === 'POST /account/password') {
            if (!password_verify((string) in('current', ''), $u['password_hash'])) fail('رمز فعلی اشتباه است');
            if (mb_strlen((string) in('next', '')) < 8) fail('رمز جدید کوتاه است');
            update('users', ['password_hash' => password_hash((string) in('next'), PASSWORD_DEFAULT)], 'id = ?', [$uid]); ok();
        }
        if ($r === 'GET /account/orders') ok(['orders' => array_map('map_order', rows("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [$uid]))]);
        if ($r === 'GET /account/addresses') ok(['addresses' => array_map('map_address', rows("SELECT * FROM addresses WHERE user_id = ? ORDER BY id", [$uid]))]);
        if ($r === 'POST /account/addresses') {
            foreach (['fullName', 'phone', 'province', 'city', 'line'] as $f) if (s($f) === '') fail('اطلاعات آدرس کامل نیست');
            q("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [$uid]);
            $id = insert('addresses', ['user_id' => $uid, 'full_name' => s('fullName'), 'phone' => s('phone'), 'province' => s('province'), 'city' => s('city'), 'line' => s('line'), 'postal_code' => s('postalCode'), 'is_default' => 1]);
            ok(['address' => map_address(row("SELECT * FROM addresses WHERE id = ?", [$id]))]);
        }
        if ($r === 'DELETE /account/addresses/:id') { q("DELETE FROM addresses WHERE id = ? AND user_id = ?", [$seg[2], $uid]); ok(); }
    }

    /* ── checkout ── */
    if ($r === 'POST /checkout') {
        rate_limit('checkout', 20, 3600);
        // Idempotency: check before creating order
        $idemRaw = idempotency_key_from_request();
        $idemHash = $idemRaw ? idempotency_hash($idemRaw) : null;
        if ($idemHash) {
            $cached = idempotency_check($idemHash);
            if ($cached) ok($cached);
        }
        $items = in('items', []); $c = in('customer', []);
        if (!is_array($items) || !$items) fail('سبد خرید خالی است');
        foreach (['name', 'email', 'phone', 'province', 'city', 'line'] as $f) if (empty($c[$f]) || !is_string($c[$f])) fail('اطلاعات گیرنده کامل نیست');
        if (!valid_email($c['email'])) fail('ایمیل معتبر نیست');
        if (strlen((string) preg_replace('/\D/', '', (string) $c['phone'])) < 10) fail('شماره تماس معتبر نیست');
        $st = settings(); $shipping = (int) $st['orders.shippingFee'];
        // Guest token will be generated inside tx if needed
        $guestPlain = null; $guestHash = null;
        $result = tx(function () use ($items, $c, $shipping, &$guestPlain, &$guestHash) {
            $merged = [];
            foreach ($items as $it) {
                if (!is_array($it)) continue;
                $pid = (int) ($it['id'] ?? 0);
                $qty = max(1, min(10, (int) ($it['qty'] ?? 1)));
                if (!isset($merged[$pid])) $merged[$pid] = ['qty' => 0, 'variant' => ''];
                $merged[$pid]['qty'] += $qty;
                if (!empty($it['variant'])) $merged[$pid]['variant'] = (string) $it['variant'];
            }
            $lines = []; $subtotal = 0;
            foreach ($merged as $pid => $info) {
                if ($info['qty'] > 10) throw new StateConflict('حداکثر ۱۰ عدد از هر محصول');
                $p = row(PRODUCT_SQL . " AND p.status = 'active' AND p.id = ? FOR UPDATE", [$pid]);
                if (!$p) throw new StateConflict('محصول یافت نشد', 'not_found');
                if ((int) $p['stock'] < $info['qty']) throw new StateConflict("موجودی «{$p['name']}» کافی نیست", 'insufficient_stock');
                $img = json_decode($p['images'] ?: '[]', true)[0] ?? '';
                $lines[] = ['product_id' => $pid, 'slug' => $p['slug'], 'sku' => $p['sku'], 'name' => $p['name'], 'unit_price' => (int) $p['price'], 'qty' => $info['qty'], 'image' => $img, 'variant' => mb_substr($info['variant'], 0, 80)];
                $subtotal += (int) $p['price'] * $info['qty'];
            }
            $pub = public_id();
            $isGuest = empty($_SESSION['user_id']);
            if ($isGuest) {
                [$guestPlain, $guestHash] = generate_guest_token();
            } else {
                $guestPlain = null; $guestHash = null;
            }
            $oid = insert('orders', ['public_id' => $pub, 'user_id' => $_SESSION['user_id'] ?? null, 'access_token_hash' => $guestHash, 'status' => 'pending', 'payment_status' => 'pending', 'shipping_status' => 'pending',
                'total_toman' => $subtotal + $shipping, 'subtotal_toman' => $subtotal, 'discount_toman' => 0, 'shipping_toman' => $shipping,
                'customer_name' => mb_substr(trim($c['name']), 0, 120), 'customer_email' => mb_strtolower(trim($c['email'])), 'customer_phone' => mb_substr(trim($c['phone']), 0, 20),
                'province' => mb_substr($c['province'], 0, 60), 'city' => mb_substr($c['city'], 0, 60), 'address_line' => mb_substr($c['line'], 0, 500), 'postal_code' => mb_substr((string) ($c['postalCode'] ?? ''), 0, 20), 'note' => mb_substr((string) in('note', ''), 0, 1000)]);
            foreach ($lines as $l) insert('order_items', ['order_id' => $oid] + $l);
            insert('order_events', ['order_id' => $oid, 'type' => 'created', 'to_value' => 'pending']);
            return ['id' => $oid, 'publicId' => $pub, 'total' => $subtotal + $shipping, 'guestToken' => $guestPlain];
        });
        $mode = $st['payment.mode'] === 'zarinpal' && cfg('zarinpal_merchant_id') ? 'zarinpal' : 'demo';
        $authority = null; $redirect = null;
        if ($mode === 'zarinpal') {
            $callback = rtrim(cfg('app_url'), '/') . '/pay';
            $res = zarinpal('request', ['amount' => $result['total'] * 10, 'callback_url' => $callback, 'description' => "سفارش {$result['publicId']} — " . $st['store.name'], 'metadata' => ['email' => $c['email'], 'mobile' => $c['phone']]]);
            if (empty($res['data']['authority'])) fail('اتصال به درگاه پرداخت ممکن نشد: ' . ($res['errors']['message'] ?? ''), 502, 'gateway');
            $authority = $res['data']['authority'];
            $redirect = (cfg('zarinpal_sandbox') ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://www.zarinpal.com/pg/StartPay/') . $authority;
        } else {
            $authority = 'A' . strtoupper(bin2hex(random_bytes(8)));
            $redirect = '/pay?authority=' . $authority;
        }
        insert('payments', ['order_id' => $result['id'], 'provider' => $mode, 'authority' => $authority, 'status' => 'pending', 'amount_toman' => $result['total'], 'amount_rial' => $result['total'] * 10]);
        $payload = ['publicId' => $result['publicId'], 'authority' => $authority, 'provider' => $mode, 'redirect' => $redirect];
        if (!empty($result['guestToken'])) $payload['accessToken'] = $result['guestToken'];
        if ($idemHash) idempotency_store($idemHash, 'checkout', $payload);
        // Rate-limit checkout is already atomic; no extra handling
        ok($payload);
    }

    /* ── payment ── */
    if ($r === 'GET /pay/status') {
        $p = row("SELECT p.*, o.public_id FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.authority = ?", [$_GET['authority'] ?? '']);
        if (!$p) fail('تراکنش پیدا نشد', 404);
        ok(['status' => $p['status'], 'amount' => (int) $p['amount_toman'], 'publicId' => $p['public_id'], 'refId' => $p['ref_id']]);
    }
    if ($r === 'POST /pay/demo') {
        $authority = s('authority');
        $pay = row("SELECT * FROM payments WHERE authority = ? AND provider = 'demo'", [$authority]);
        if (!$pay) fail('تراکنش پیدا نشد', 404);
        if (s('action') === 'cancel') { $res = cancel_payment($authority); ok(['publicId' => $res['publicId'], 'status' => 'cancelled']); }
        $res = finalize_payment($authority, (string) random_int(100000000, 999999999), null);
        ok(['publicId' => $res['publicId'], 'status' => 'verified', 'refId' => $res['refId']]);
    }
    if ($r === 'POST /pay/verify') { // zarinpal callback
        $authority = s('authority');
        $pay = row("SELECT * FROM payments WHERE authority = ? AND provider = 'zarinpal'", [$authority]);
        if (!$pay) fail('تراکنش پیدا نشد', 404);
        if (s('status') !== 'OK') { $res = cancel_payment($authority); ok(['publicId' => $res['publicId'], 'status' => 'cancelled']); }
        if ($pay['status'] === 'verified') { $o = row("SELECT public_id FROM orders WHERE id = ?", [$pay['order_id']]); ok(['publicId' => $o['public_id'], 'status' => 'verified', 'refId' => $pay['ref_id']]); }
        $v = zarinpal('verify', ['amount' => (int) $pay['amount_rial'], 'authority' => $authority]);
        $code = $v['data']['code'] ?? 0;
        if ($code !== 100 && $code !== 101) { $res = cancel_payment($authority); ok(['publicId' => $res['publicId'], 'status' => 'failed']); }
        $res = finalize_payment($authority, (string) ($v['data']['ref_id'] ?? ''), $v['data']['card_pan'] ?? null);
        ok(['publicId' => $res['publicId'], 'status' => 'verified', 'refId' => $res['refId']]);
    }

    /* ── order lookup (owner or guest via public id + token) ── */
    if (count($seg) === 2 && $seg[0] === 'orders' && $m === 'GET') {
        $o = row("SELECT * FROM orders WHERE public_id = ?", [$seg[1]]);
        if (!$o) fail('سفارش پیدا نشد', 404);
        if ($o['user_id'] !== null) {
            if ((int) $o['user_id'] !== (int) ($_SESSION['user_id'] ?? 0)) fail('برای مشاهدهٔ این سفارش وارد حساب خود شوید', 403);
        } else {
            // Guest order: require access token (hash-verified)
            $provided = $_GET['token'] ?? $_SERVER['HTTP_X_ORDER_TOKEN'] ?? s('token') ?? '';
            $provided = is_string($provided) ? trim($provided) : '';
            // Allow admin to bypass token
            $cur = current_user();
            $isAdmin = $cur && $cur['role'] !== 'customer';
            if (!$isAdmin) {
                if ($provided === '' || $o['access_token_hash'] === null || !verify_guest_token($o['access_token_hash'], $provided)) {
                    // Brute-force mitigation: rate limit guest order lookup
                    rate_limit('guest-order-lookup', 30, 3600);
                    fail('توکن دسترسی سفارش نامعتبر است', 403, 'forbidden');
                }
            }
        }
        ok(['order' => map_order($o)]);
    }
}

function map_address(array $a): array {
    return ['id' => (int) $a['id'], 'fullName' => $a['full_name'], 'phone' => $a['phone'], 'province' => $a['province'], 'city' => $a['city'], 'line' => $a['line'], 'postalCode' => $a['postal_code'], 'isDefault' => (bool) $a['is_default']];
}

function zarinpal(string $action, array $data): array {
    $base = cfg('zarinpal_sandbox') ? 'https://sandbox.zarinpal.com/pg/v4/payment/' : 'https://payment.zarinpal.com/pg/v4/payment/';
    $data['merchant_id'] = cfg('zarinpal_merchant_id');
    $ch = curl_init($base . ($action === 'request' ? 'request.json' : 'verify.json'));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($data, JSON_UNESCAPED_UNICODE), CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'], CURLOPT_TIMEOUT => 20]);
    $res = curl_exec($ch); curl_close($ch);
    return $res ? (json_decode($res, true) ?: []) : [];
}

/** تأیید نهایی پرداخت: کسر موجودی، تغییر وضعیت سفارش، اعلان — همه در یک تراکنش */
function finalize_payment(string $authority, string $refId, ?string $cardPan): array {
    return tx(function () use ($authority, $refId, $cardPan) {
        $row = row("SELECT p.id payment_id, p.status payment_status, p.ref_id, o.* FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.authority = ? FOR UPDATE", [$authority]);
        if (!$row) throw new StateConflict('تراکنش پیدا نشد', 'not_found');
        if ($row['payment_status'] === 'verified') return ['publicId' => $row['public_id'], 'refId' => $row['ref_id'] ?: $refId];
        if ($row['payment_status'] !== 'pending' || $row['status'] !== 'pending') throw new StateConflict('وضعیت تراکنش اجازهٔ تأیید پرداخت را نمی‌دهد');
        $items = rows("SELECT product_id, SUM(qty) qty, MIN(name) name FROM order_items WHERE order_id = ? GROUP BY product_id", [$row['id']]);
        if (!$items) throw new StateConflict('سفارش بدون کالا قابل پرداخت نیست');
        foreach ($items as $it) {
            if ($it['product_id'] === null) throw new StateConflict("محصول «{$it['name']}» دیگر قابل فروش نیست");
            $qty = (int) $it['qty'];
            $st = q("UPDATE products SET stock = stock - ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL AND stock >= ?", [$qty, $it['product_id'], $qty]);
            if ($st->rowCount() === 0) throw new StateConflict("موجودی «{$it['name']}» کافی نیست", 'insufficient_stock');
            $p = row("SELECT id, name, stock, min_stock FROM products WHERE id = ?", [$it['product_id']]);
            insert('inventory_transactions', ['product_id' => $p['id'], 'type' => 'sale', 'quantity' => -$qty, 'stock_before' => (int) $p['stock'] + $qty, 'stock_after' => (int) $p['stock'], 'reason' => "فروش سفارش {$row['public_id']}", 'reference_type' => 'order', 'reference_id' => (string) $row['id']]);
            if ((int) $p['stock'] <= (int) $p['min_stock']) notify((int) $p['stock'] === 0 ? 'out_of_stock' : 'low_stock', (int) $p['stock'] === 0 ? 'اتمام موجودی' : 'کاهش موجودی', "{$p['name']} به {$p['stock']} عدد رسید.", "/admin/products/{$p['id']}");
        }
        update('payments', ['status' => 'verified', 'ref_id' => $refId, 'card_pan' => $cardPan, 'verified_at' => date('Y-m-d H:i:s')], 'id = ?', [$row['payment_id']]);
        update('orders', ['status' => 'confirmed', 'payment_status' => 'paid', 'paid_at' => date('Y-m-d H:i:s')], 'id = ?', [$row['id']]);
        insert('order_events', ['order_id' => $row['id'], 'type' => 'payment_verified', 'from_value' => 'pending', 'to_value' => 'paid', 'note' => $refId]);
        notify('new_order', "سفارش جدید {$row['public_id']}", "{$row['customer_name']} — " . fa_num((int) $row['total_toman']) . ' تومان', "/admin/orders/{$row['public_id']}");
        audit(null, 'payment.verified', 'order', $row['public_id'], ['paymentId' => $row['payment_id']]);
        return ['publicId' => $row['public_id'], 'refId' => $refId];
    });
}
function cancel_payment(string $authority): array {
    return tx(function () use ($authority) {
        $row = row("SELECT p.id payment_id, p.status payment_status, o.id, o.public_id, o.status FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.authority = ? FOR UPDATE", [$authority]);
        if (!$row) throw new StateConflict('تراکنش پیدا نشد', 'not_found');
        if ($row['payment_status'] === 'cancelled') return ['publicId' => $row['public_id']];
        if ($row['payment_status'] !== 'pending' || $row['status'] !== 'pending') throw new StateConflict('این تراکنش دیگر قابل لغو نیست');
        update('payments', ['status' => 'cancelled'], 'id = ?', [$row['payment_id']]);
        update('orders', ['status' => 'cancelled', 'payment_status' => 'failed'], 'id = ?', [$row['id']]);
        insert('order_events', ['order_id' => $row['id'], 'type' => 'status', 'from_value' => 'pending', 'to_value' => 'cancelled']);
        return ['publicId' => $row['public_id']];
    });
}
