<?php
/**
 * نگه‌داری دوره‌ای (اختیاری) — پاک‌سازی توکن‌ها و rate limit های منقضی.
 *
 * اجرا از cPanel → Cron Jobs (مثلاً روزی یک بار):
 *   /usr/local/bin/php /home/USER/public_html/api/cron.php
 * یا از طریق وب با کلید:
 *   https://example.com/api/cron.php?key=<sha256(auth_secret)>
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    $key = $_GET['key'] ?? '';
    if (!hash_equals(hash('sha256', cfg('auth_secret')), (string) $key)) {
        http_response_code(403);
        exit('forbidden');
    }
}

$done = [];
$done['rate_limits'] = q("DELETE FROM rate_limits WHERE reset_at < ?", [time()])->rowCount();
$done['reset_tokens'] = q("DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL")->rowCount();
$done['old_notifications'] = q("DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)")->rowCount();
$done['old_logs'] = q("DELETE FROM admin_activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)")->rowCount();
$done['idempotency_keys'] = q("DELETE FROM idempotency_keys WHERE expires_at < NOW()")->rowCount();
$done['guest_tokens_cleanup'] = 0; // placeholder: guest tokens are per-order and not cleaned separately

// سفارش‌های pending پرداخت‌نشده که بیش از ۲۴ ساعت رها شده‌اند → لغو
$stale = rows("SELECT id, public_id FROM orders WHERE status = 'pending' AND payment_status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
foreach ($stale as $o) {
    q("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'", [$o['id']]);
    update('orders', ['status' => 'cancelled', 'payment_status' => 'failed'], 'id = ?', [$o['id']]);
    insert('order_events', ['order_id' => $o['id'], 'type' => 'status', 'from_value' => 'pending', 'to_value' => 'cancelled', 'note' => 'لغو خودکار (عدم پرداخت)']);
}
$done['stale_orders_cancelled'] = count($stale);

if ($isCli) { echo json_encode($done, JSON_UNESCAPED_UNICODE) . "\n"; exit; }
json_out(['ok' => true, 'cleaned' => $done]);
