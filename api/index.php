<?php
/**
 * Nirvana 3D — نقطهٔ ورود API
 * همهٔ درخواست‌های /api/* توسط .htaccess به این فایل می‌رسند.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

set_error_handler(function ($no, $str, $file, $line) { throw new ErrorException($str, 0, $no, $file, $line); });
set_exception_handler(function (Throwable $e) {
    if ($e instanceof StateConflict) fail($e->getMessage(), 409, $e->code2);
    error_log('[nirvana] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fail(cfg('debug') ? $e->getMessage() : 'خطای داخلی سرور', 500, 'internal');
});

$method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['_r'] ?? (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$path = '/' . trim(preg_replace('#^.*?/api#', '', $path), '/');
$seg = array_values(array_filter(explode('/', $path), 'strlen'));

if ($method === 'OPTIONS') { http_response_code(204); exit; }
require_same_origin();

$isAdmin = ($seg[0] ?? '') === 'admin';
start_session($isAdmin ? 'nirvana_admin' : 'nirvana_sess');

if ($isAdmin) {
    require __DIR__ . '/routes_admin.php';
    admin_routes($method, array_slice($seg, 1));
} else {
    require __DIR__ . '/routes_store.php';
    store_routes($method, $seg);
}
fail("مسیر $path یافت نشد", 404, 'not_found');
