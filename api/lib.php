<?php
/**
 * Nirvana 3D — هستهٔ مشترک API (PDO + احراز هویت + ابزارها)
 * PHP >= 7.4 (توصیه: 8.x). بدون هیچ وابستگی خارجی.
 */
declare(strict_types=1);

const APP_VERSION = '1.1.0';

/* ── config ─────────────────────────────────────── */
function cfg(?string $key = null, $default = null) {
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!file_exists($file)) fail('فایل api/config.php پیدا نشد. config.sample.php را کپی و تنظیم کنید.', 500, 'config_missing');
        $cfg = require $file;
    }
    if ($key === null) return $cfg;
    return $cfg[$key] ?? $default;
}

/* ── responses ──────────────────────────────────── */
function json_out(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function ok(array $data = []): void { json_out(['ok' => true] + $data); }
function fail(string $message, int $status = 400, string $code = 'error'): void {
    json_out(['ok' => false, 'error' => $message, 'code' => $code], $status);
}

/* ── database ───────────────────────────────────── */
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = cfg('db');
    try {
        $pdo = new PDO(
            "mysql:host={$c['host']};dbname={$c['name']};charset={$c['charset']}",
            $c['user'], $c['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
        );
        $pdo->exec("SET time_zone = '+00:00'");
    } catch (PDOException $e) {
        fail(cfg('debug') ? $e->getMessage() : 'اتصال به دیتابیس برقرار نشد', 500, 'db');
    }
    return $pdo;
}
function q(string $sql, array $params = []): PDOStatement {
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}
function row(string $sql, array $params = []): ?array { $r = q($sql, $params)->fetch(); return $r === false ? null : $r; }
function rows(string $sql, array $params = []): array { return q($sql, $params)->fetchAll(); }
function insert(string $table, array $data): int {
    $cols = array_keys($data);
    $sql = "INSERT INTO `$table` (`" . implode('`,`', $cols) . "`) VALUES (" . implode(',', array_fill(0, count($cols), '?')) . ")";
    q($sql, array_values($data));
    return (int) db()->lastInsertId();
}
function update(string $table, array $data, string $where, array $params): void {
    $set = implode(',', array_map(fn($c) => "`$c`=?", array_keys($data)));
    q("UPDATE `$table` SET $set WHERE $where", array_merge(array_values($data), $params));
}
function tx(callable $fn) {
    $pdo = db();
    $pdo->beginTransaction();
    try { $r = $fn(); $pdo->commit(); return $r; }
    catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
class StateConflict extends Exception { public string $code2; public function __construct(string $m, string $code = 'state_conflict') { parent::__construct($m); $this->code2 = $code; } }

/* ── request ────────────────────────────────────── */
function body(): array {
    static $b = null;
    if ($b === null) {
        $raw = file_get_contents('php://input');
        $b = $raw ? (json_decode($raw, true) ?: []) : [];
    }
    return $b;
}
function in(string $key, $default = null) { return body()[$key] ?? $default; }
function s(string $key, string $default = ''): string { $v = in($key, $default); return is_scalar($v) ? trim((string) $v) : $default; }
function i(string $key, int $default = 0): int { $v = in($key, $default); return is_numeric($v) ? (int) $v : $default; }
function arr(string $key): array { $v = in($key, []); return is_array($v) ? array_values(array_filter(array_map(fn($x) => is_scalar($x) ? trim((string) $x) : '', $v), fn($x) => $x !== '')) : []; }
function client_ip(): string { return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'; }
function ip_hash(): string { return hash_hmac('sha256', explode(',', client_ip())[0], cfg('auth_secret')); }
function require_same_origin(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') return;
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'nirvana') fail('درخواست نامعتبر', 403, 'csrf');
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== ($_SERVER['HTTP_HOST'] ?? '')) fail('درخواست از مبدأ نامعتبر', 403, 'csrf');
}
function rate_limit(string $bucket, int $max, int $windowSec): void {
    $key = hash('sha256', $bucket . '|' . ip_hash());
    $now = time();
    $windowEnd = $now + $windowSec;
    // Atomic increment: INSERT ... ON DUPLICATE KEY UPDATE with reset logic
    q("INSERT INTO rate_limits (k, hits, reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits = IF(reset_at < ?, 1, hits + 1), reset_at = IF(reset_at < ?, ?, reset_at)", [$key, $windowEnd, $now, $now, $windowEnd]);
    $r = row("SELECT hits, reset_at FROM rate_limits WHERE k = ?", [$key]);
    if (!$r) return;
    if ((int) $r['hits'] > $max) fail('تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید', 429, 'rate_limited');
    // Periodic cleanup of expired buckets (best-effort, not critical for correctness)
    if (random_int(1, 100) === 1) q("DELETE FROM rate_limits WHERE reset_at < ?", [$now]);
}

/* ── idempotency ────────────────────────────────── */
function idempotency_key_from_request(): ?string {
    $raw = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? $_SERVER['HTTP_X_IDEMPOTENCY_KEY'] ?? null;
    if ($raw === null) $raw = in('idempotencyKey', '');
    $raw = is_string($raw) ? trim($raw) : '';
    if ($raw === '') return null;
    if (strlen($raw) < 8 || strlen($raw) > 128) fail('Idempotency-Key نامعتبر است (8-128 کاراکتر)', 400, 'idempotency_invalid');
    if (!preg_match('/^[A-Za-z0-9\-_]+$/', $raw)) fail('Idempotency-Key فقط حروف، عدد، - و _ مجاز است', 400, 'idempotency_invalid');
    return $raw;
}
function idempotency_hash(string $raw): string {
    // Scope per user (or IP for guests) to avoid cross-user collisions
    $scope = $_SESSION['user_id'] ?? ip_hash();
    return hash('sha256', $raw . '|' . $scope);
}
function idempotency_check(string $hash): ?array {
    $r = row("SELECT response FROM idempotency_keys WHERE k = ? AND expires_at > NOW()", [$hash]);
    if (!$r || $r['response'] === null) return null;
    $data = json_decode($r['response'], true);
    return is_array($data) ? $data : null;
}
function idempotency_store(string $hash, string $route, array $response): void {
    $expires = date('Y-m-d H:i:s', time() + 86400); // 24h
    $uid = $_SESSION['user_id'] ?? null;
    try {
        q("INSERT INTO idempotency_keys (k, route, user_id, response, expires_at) VALUES (?, ?, ?, ?, ?)", [$hash, $route, $uid, json_encode($response, JSON_UNESCAPED_UNICODE), $expires]);
    } catch (PDOException $e) {
        // Duplicate key means concurrent request already stored — ignore
        if (strpos($e->getMessage(), 'Duplicate') === false && $e->getCode() !== '23000') throw $e;
    }
}

/* ── guest order token ──────────────────────────── */
function generate_guest_token(): array {
    $plain = bin2hex(random_bytes(32)); // 64 hex chars
    $hash = hash('sha256', $plain);
    return [$plain, $hash];
}
function verify_guest_token(?string $hash, string $provided): bool {
    if (!$hash || $provided === '') return false;
    $calc = hash('sha256', $provided);
    return hash_equals($hash, $calc);
}

/* ── sessions (customer & admin are separate cookies) ── */
function start_session(string $name): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    session_name($name);
    // Do not allow an existing session id to cross the customer/admin boundary.
    if (!headers_sent()) header('X-Content-Type-Options: nosniff');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'secure' => $secure, 'samesite' => 'Strict']);
    session_start();
    if (empty($_SESSION['created_at'])) $_SESSION['created_at'] = time();
    if (!empty($_SESSION['created_at']) && $_SESSION['created_at'] < time() - 8 * 3600) {
        session_unset();
        session_destroy();
        session_name($name);
        session_start();
        $_SESSION['created_at'] = time();
    }
    if (!empty($_SESSION['expires']) && $_SESSION['expires'] < time()) { session_unset(); session_destroy(); session_start(); }
}
function public_user(array $u): array {
    return ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'phone' => $u['phone'] ?? '', 'role' => $u['role'],
        'permissions' => json_decode($u['permissions'] ?: '[]', true), 'createdAt' => $u['created_at']];
}
function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $u = row("SELECT * FROM users WHERE id = ? AND active = 1", [$_SESSION['user_id']]);
    return $u ?: null;
}
function require_user(): array { $u = current_user(); if (!$u) fail('ابتدا وارد شوید', 401, 'unauthorized'); return $u; }
function require_admin(?string $perm = null): array {
    $u = current_user();
    if (!$u || $u['role'] === 'customer') fail('ابتدا وارد پنل شوید', 401, 'unauthorized');
    if ($perm && !can($u, $perm)) fail('به این بخش دسترسی ندارید', 403, 'forbidden');
    $_SESSION['expires'] = time() + 8 * 3600; // sliding 8h
    return $u;
}
function can(array $u, string $perm): bool {
    if ($u['role'] === 'admin') return true;
    $p = json_decode($u['permissions'] ?: '[]', true);
    return in_array('*', $p, true) || in_array($perm, $p, true);
}
function audit(?int $adminId, string $action, string $targetType, $targetId, array $meta = []): void {
    insert('admin_activity_logs', ['admin_id' => $adminId, 'action' => $action, 'target_type' => $targetType, 'target_id' => $targetId === null ? null : (string) $targetId, 'metadata' => json_encode($meta, JSON_UNESCAPED_UNICODE), 'ip_hash' => ip_hash()]);
}
function notify(string $type, string $title, string $body, string $url = ''): void {
    insert('notifications', ['type' => $type, 'title' => $title, 'body' => $body, 'target_url' => $url]);
}

/* ── settings ───────────────────────────────────── */
function settings(): array {
    $d = ['store.name' => 'نیروانا ۳دی', 'store.email' => '', 'store.phone' => '', 'store.currency' => 'تومان', 'inventory.defaultThreshold' => 5, 'orders.shippingFee' => 0,
        'seo.defaultTitle' => 'نیروانا ۳دی | Nirvana 3D — گالری هنر سه‌بعدی', 'seo.defaultDescription' => 'گالری و کارگاه چاپ سه‌بعدی نیروانا؛ هنر سه‌بعدی برای دنیای واقعی.', 'payment.mode' => cfg('payment_mode', 'demo')];
    foreach (rows("SELECT k, v FROM settings") as $r) {
        if (!array_key_exists($r['k'], $d)) continue;
        $d[$r['k']] = is_int($d[$r['k']]) ? (int) $r['v'] : $r['v'];
    }
    return $d;
}

/* ── product mapping ───────────────────────────── */
function map_product(array $r): array {
    return [
        'id' => (int) $r['id'], 'slug' => $r['slug'], 'sku' => $r['sku'], 'name' => $r['name'], 'nameEn' => $r['name_en'], 'price' => (int) $r['price'],
        'oldPrice' => $r['old_price'] === null ? null : (int) $r['old_price'], 'categoryId' => (int) $r['category_id'], 'categorySlug' => $r['category_slug'] ?? '',
        'categoryName' => $r['category_name'] ?? '', 'shortDesc' => $r['short_desc'], 'description' => $r['description'],
        'features' => json_decode($r['features'] ?: '[]', true), 'variants' => json_decode($r['variants'] ?: '[]', true), 'images' => json_decode($r['images'] ?: '[]', true),
        'stock' => (int) $r['stock'], 'minStock' => (int) $r['min_stock'], 'prepTime' => $r['prep_time'], 'material' => $r['material'], 'featured' => (bool) $r['featured'], 'status' => $r['status'],
    ];
}
const PRODUCT_SQL = "SELECT p.*, c.slug AS category_slug, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.deleted_at IS NULL";
function map_category(array $r): array {
    return ['id' => (int) $r['id'], 'slug' => $r['slug'], 'name' => $r['name'], 'icon' => $r['icon'], 'blurb' => $r['blurb'], 'sort' => (int) $r['sort_order']] + (isset($r['cnt']) ? ['count' => (int) $r['cnt']] : []);
}
function map_order(array $o, bool $withItems = true): array {
    $out = [
        'id' => (int) $o['id'], 'publicId' => $o['public_id'], 'userId' => $o['user_id'] === null ? null : (int) $o['user_id'], 'status' => $o['status'], 'paymentStatus' => $o['payment_status'],
        'shippingStatus' => $o['shipping_status'], 'total' => (int) $o['total_toman'], 'subtotal' => (int) $o['subtotal_toman'], 'discount' => (int) $o['discount_toman'], 'shipping' => (int) $o['shipping_toman'],
        'customerName' => $o['customer_name'], 'customerEmail' => $o['customer_email'], 'customerPhone' => $o['customer_phone'], 'province' => $o['province'], 'city' => $o['city'],
        'addressLine' => $o['address_line'], 'postalCode' => $o['postal_code'], 'note' => $o['note'], 'internalNote' => $o['internal_note'], 'createdAt' => $o['created_at'], 'paidAt' => $o['paid_at'], 'refId' => null,
    ];
    if ($withItems) {
        $out['items'] = array_map(fn($it) => ['productId' => $it['product_id'] === null ? null : (int) $it['product_id'], 'slug' => $it['slug'], 'name' => $it['name'], 'unitPrice' => (int) $it['unit_price'], 'qty' => (int) $it['qty'], 'image' => $it['image'], 'variant' => $it['variant']],
            rows("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [$o['id']]));
        $out['events'] = array_map(fn($e) => ['type' => $e['type'], 'from' => $e['from_value'], 'to' => $e['to_value'], 'note' => $e['note'], 'createdAt' => $e['created_at']],
            rows("SELECT * FROM order_events WHERE order_id = ? ORDER BY id", [$o['id']]));
        $p = row("SELECT ref_id FROM payments WHERE order_id = ? AND status = 'verified' ORDER BY id DESC LIMIT 1", [$o['id']]);
        $out['refId'] = $p['ref_id'] ?? null;
    }
    return $out;
}
function valid_email(string $e): bool { return (bool) filter_var($e, FILTER_VALIDATE_EMAIL); }
function public_id(): string { return 'NRV-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6)); }
function fa_num(int $n): string { return str_replace(['0','1','2','3','4','5','6','7','8','9'], ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'], number_format($n)); }
