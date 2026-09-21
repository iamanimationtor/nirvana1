<?php
/** مسیرهای پنل مدیریت — همهٔ آن‌ها با بررسی نشست و مجوز سمت سرور */
declare(strict_types=1);

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];
const ORDER_TRANSITIONS = ['pending' => ['cancelled'], 'confirmed' => ['processing', 'cancelled'], 'processing' => ['preparing', 'cancelled'], 'preparing' => ['shipped', 'cancelled'], 'shipped' => ['delivered', 'returned'], 'delivered' => ['returned'], 'returned' => [], 'cancelled' => [], 'refunded' => []];
const SHIPPING_TRANSITIONS = ['pending' => ['preparing'], 'preparing' => ['shipped'], 'shipped' => ['delivered', 'returned'], 'delivered' => ['returned'], 'returned' => []];
const ROLES = ['admin', 'manager', 'staff'];
const PERMS = ['products.manage', 'categories.manage', 'orders.manage', 'inventory.manage', 'customers.view', 'reports.view', 'settings.manage', 'users.manage'];

function paginate_params(): array { $page = max(1, (int) ($_GET['page'] ?? 1)); $limit = min(100, max(1, (int) ($_GET['limit'] ?? 20))); $offset = ($page - 1) * $limit; return [$page,$limit,$offset]; }
function paginate_response(array $items, int $total, int $page, int $limit): void { ok(['items' => $items, 'pagination' => ['page' => $page, 'limit' => $limit, 'total' => $total, 'pages' => (int) ceil($total / max(1,$limit)), 'offset' => ($page-1)*$limit]]); }


function admin_routes(string $m, array $seg): void {
    $r = $m . ' /' . implode('/', array_map(fn($s, $i) => $i > 0 && ctype_digit($s) ? ':id' : $s, $seg, array_keys($seg)));
    bootstrap_admin();

    /* ── auth ── */
    if ($r === 'POST /login') {
        rate_limit('admin-login', 10, 900);
        $u = row("SELECT * FROM users WHERE email = ? AND role <> 'customer' AND active = 1", [mb_strtolower(s('email'))]);
        if (!$u || !password_verify((string) in('password', ''), $u['password_hash'])) { audit(null, 'admin.login_failed', 'session', s('email')); fail('اطلاعات ورود نادرست است', 401); }
        session_regenerate_id(true); $_SESSION['user_id'] = (int) $u['id']; $_SESSION['expires'] = time() + 8 * 3600;
        audit((int) $u['id'], 'admin.login', 'session', $u['id']);
        ok(['user' => public_user($u)]);
    }
    if ($r === 'POST /logout') { session_unset(); session_destroy(); ok(); }
    if ($r === 'GET /me') { $u = current_user(); ok(['user' => $u && $u['role'] !== 'customer' ? public_user($u) : null]); }
    if ($r === 'POST /forgot') {
        rate_limit('admin-forgot', 5, 3600);
        $u = row("SELECT * FROM users WHERE email = ? AND role <> 'customer'", [mb_strtolower(s('email'))]);
        if ($u) { $token = bin2hex(random_bytes(24)); insert('password_reset_tokens', ['user_id' => $u['id'], 'token_hash' => hash('sha256', $token), 'expires_at' => date('Y-m-d H:i:s', time() + 1800)]);
            @mail($u['email'], '=?UTF-8?B?' . base64_encode('بازیابی رمز مدیر نیروانا') . '?=', rtrim(cfg('app_url'), '/') . "/admin/reset-password?token=$token", "From: " . cfg('mail_from') . "\r\nContent-Type: text/plain; charset=UTF-8"); }
        ok(['message' => 'اگر ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود.']);
    }
    $admin = require_admin(); $aid = (int) $admin['id'];

    /* ── dashboard ── */
    if ($r === 'GET /dashboard') {
        $low = rows(PRODUCT_SQL . " AND p.stock <= p.min_stock ORDER BY p.stock LIMIT 6");
        ok(['stats' => [
            'revenue' => (int) row("SELECT COALESCE(SUM(total_toman),0) v FROM orders WHERE payment_status = 'paid'")['v'],
            'ordersToday' => (int) row("SELECT COUNT(*) v FROM orders WHERE DATE(created_at) = CURDATE()")['v'],
            'orders' => (int) row("SELECT COUNT(*) v FROM orders")['v'],
            'pendingOrders' => (int) row("SELECT COUNT(*) v FROM orders WHERE status IN ('confirmed','processing','preparing')")['v'],
            'customers' => (int) row("SELECT COUNT(*) v FROM users WHERE role = 'customer'")['v'],
            'lowStock' => (int) row("SELECT COUNT(*) v FROM products WHERE deleted_at IS NULL AND stock <= min_stock")['v'],
            'products' => (int) row("SELECT COUNT(*) v FROM products WHERE deleted_at IS NULL")['v'],
            'unread' => (int) row("SELECT COUNT(*) v FROM notifications WHERE read_at IS NULL")['v'],
        ], 'recentOrders' => array_map('map_order', rows("SELECT * FROM orders ORDER BY id DESC LIMIT 6")), 'lowStock' => array_map('map_product', $low)]);
    }

    /* ── products ── */
    if ($r === 'GET /products') { require_admin('products.manage'); ok(['products' => array_map('map_product', rows(PRODUCT_SQL . " ORDER BY p.id DESC")), 'categories' => array_map('map_category', rows("SELECT * FROM categories ORDER BY sort_order"))]); }
    if ($r === 'GET /products/:id') { require_admin('products.manage'); $p = row(PRODUCT_SQL . " AND p.id = ?", [$seg[1]]); if (!$p) fail('محصول یافت نشد', 404); ok(['product' => map_product($p), 'categories' => array_map('map_category', rows("SELECT * FROM categories ORDER BY sort_order"))]); }
    if ($r === 'POST /products' || $r === 'PUT /products/:id') {
        require_admin('products.manage');
        $id = $m === 'PUT' ? (int) $seg[1] : 0;
        $slug = strtolower(preg_replace('/[^a-z0-9-]+/', '-', strtolower(s('slug'))));
        if (s('name') === '' || $slug === '') fail('نام و اسلاگ الزامی است');
        if (!row("SELECT id FROM categories WHERE id = ?", [i('categoryId')])) fail('دسته‌بندی نامعتبر است');
        if (row("SELECT id FROM products WHERE slug = ? AND id <> ? AND deleted_at IS NULL", [$slug, $id])) fail('اسلاگ تکراری است');
        $price = i('price'); $old = in('oldPrice'); $stock = i('stock');
        if ($price < 0 || $stock < 0) fail('قیمت و موجودی نمی‌تواند منفی باشد');
        $data = ['slug' => $slug, 'sku' => mb_substr(s('sku'), 0, 60), 'name' => mb_substr(s('name'), 0, 200), 'name_en' => mb_substr(s('nameEn'), 0, 200), 'price' => $price, 'old_price' => is_numeric($old) && (int) $old > 0 ? (int) $old : null,
            'discount_percent' => is_numeric($old) && (int) $old > $price ? (int) round((1 - $price / (int) $old) * 100) : 0, 'category_id' => i('categoryId'), 'short_desc' => mb_substr(s('shortDesc'), 0, 500), 'description' => s('description'),
            'features' => json_encode(arr('features'), JSON_UNESCAPED_UNICODE), 'variants' => json_encode(arr('variants'), JSON_UNESCAPED_UNICODE), 'images' => json_encode(arr('images'), JSON_UNESCAPED_UNICODE),
            'stock' => $stock, 'min_stock' => max(0, i('minStock', 5)), 'prep_time' => mb_substr(s('prepTime'), 0, 80), 'material' => mb_substr(s('material'), 0, 60), 'status' => s('status') === 'draft' ? 'draft' : 'active', 'featured' => in('featured') ? 1 : 0];
        if ($id) {
            $old = row("SELECT stock FROM products WHERE id = ? AND deleted_at IS NULL", [$id]); if (!$old) fail('محصول یافت نشد', 404);
            update('products', $data, 'id = ?', [$id]);
            if ((int) $old['stock'] !== $stock) insert('inventory_transactions', ['product_id' => $id, 'type' => 'adjustment', 'quantity' => $stock - (int) $old['stock'], 'stock_before' => (int) $old['stock'], 'stock_after' => $stock, 'reason' => 'ویرایش محصول', 'admin_id' => $aid]);
            audit($aid, 'product.updated', 'product', $id);
        } else { $id = insert('products', $data); if ($stock > 0) insert('inventory_transactions', ['product_id' => $id, 'type' => 'restock', 'quantity' => $stock, 'stock_before' => 0, 'stock_after' => $stock, 'reason' => 'ایجاد محصول', 'admin_id' => $aid]); audit($aid, 'product.created', 'product', $id); }
        ok(['product' => map_product(row(PRODUCT_SQL . " AND p.id = ?", [$id]))]);
    }
    if ($r === 'DELETE /products/:id') { require_admin('products.manage'); update('products', ['deleted_at' => date('Y-m-d H:i:s'), 'status' => 'draft'], 'id = ?', [$seg[1]]); audit($aid, 'product.deleted', 'product', $seg[1]); ok(); }
    if ($r === 'POST /upload') {
        require_admin('products.manage');
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) fail('فایلی ارسال نشد');
        $f = $_FILES['file'];
        $maxBytes = cfg('max_upload_mb', 5) * 1024 * 1024;
        if ($f['size'] > $maxBytes) fail('حجم فایل بیش از حد مجاز است');
        if ($f['size'] < 100) fail('فایل نامعتبر است');
        // Use finfo for real MIME (more reliable than mime_content_type)
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $finfo ? finfo_file($finfo, $f['tmp_name']) : mime_content_type($f['tmp_name']);
        if ($finfo) finfo_close($finfo);
        $mimeMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $ext = $mimeMap[$mime] ?? null;
        if (!$ext) fail('فقط تصویر JPG/PNG/WebP مجاز است');
        // Deep image validation: getimagesize + type + dimensions
        $info = @getimagesize($f['tmp_name']);
        if (!$info) fail('فایل تصویر معتبر نیست');
        $typeOk = in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true);
        if (!$typeOk) fail('نوع تصویر مجاز نیست');
        // Map extension from actual image type (ignore claimed MIME if mismatched)
        $realExt = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]] ?? $ext;
        if ($realExt !== $ext) $ext = $realExt; // use real type
        $width = $info[0]; $height = $info[1];
        if ($width < 10 || $height < 10) fail('ابعاد تصویر خیلی کوچک است');
        if ($width > 5000 || $height > 5000) fail('ابعاد تصویر خیلی بزرگ است (حداکثر 5000x5000)');
        // Check for embedded PHP / script tags in the first 1MB
        $head = file_get_contents($f['tmp_name'], false, null, 0, 1048576);
        if ($head !== false && preg_match('/<\?(php|=)|<script/i', $head)) fail('فایل حاوی محتوای غیرمجاز است');
        // Reject double extensions or php in original name (defense in depth)
        $orig = strtolower($f['name'] ?? '');
        if (preg_match('/\.(php|phtml|phar|htaccess|sh|exe)(\.|$)/', $orig)) fail('نام فایل غیرمجاز است');
        $dir = rtrim(cfg('upload_dir'), '/'); if (!is_dir($dir)) mkdir($dir, 0755, true);
        // Harden uploads dir for Apache
        if (!file_exists("$dir/.htaccess")) @file_put_contents("$dir/.htaccess", "php_flag engine off\nRemoveHandler .php .phtml .phar\nOptions -ExecCGI -Indexes\n<FilesMatch \"\\.(php|phtml|phar|htaccess)$\">\nRequire all denied\n</FilesMatch>\n# Deny direct access to .htaccess itself\n<Files .htaccess>\nRequire all denied\n</Files>\n");
        // Also create nginx guard file (documentation) - nginx must be configured separately
        if (!file_exists("$dir/README.txt")) @file_put_contents("$dir/README.txt", "Uploads dir: deny execution of .php via webserver (see nginx.conf.sample)");
        $name = date('Ymd') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) fail('ذخیرهٔ فایل ممکن نشد', 500);
        @chmod("$dir/$name", 0644);
        // Verify stored file is still a valid image (post-move check)
        $finalInfo = @getimagesize("$dir/$name");
        if (!$finalInfo || !in_array($finalInfo[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            @unlink("$dir/$name"); fail('فایل ذخیره‌شده نامعتبر است');
        }
        ok(['url' => rtrim(cfg('upload_url'), '/') . '/' . $name]);
    }

    /* ── categories ── */
    if ($r === 'GET /categories') ok(['categories' => array_map('map_category', rows("SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) cnt FROM categories c ORDER BY sort_order, id"))]);
    if ($r === 'POST /categories') {
        require_admin('categories.manage');
        $slug = strtolower(preg_replace('/[^a-z0-9-]+/', '-', strtolower(s('slug'))));
        if (s('name') === '' || $slug === '') fail('نام و اسلاگ الزامی است');
        if (row("SELECT id FROM categories WHERE slug = ?", [$slug])) fail('اسلاگ تکراری است');
        $sort = (int) row("SELECT COALESCE(MAX(sort_order),0)+1 v FROM categories")['v'];
        $id = insert('categories', ['slug' => $slug, 'name' => mb_substr(s('name'), 0, 100), 'icon' => mb_substr(s('icon', 'spark'), 0, 30), 'blurb' => mb_substr(s('blurb'), 0, 200), 'sort_order' => $sort]);
        audit($aid, 'category.created', 'category', $id); ok(['category' => map_category(row("SELECT * FROM categories WHERE id = ?", [$id]))]);
    }
    if ($r === 'PUT /categories/:id') {
        require_admin('categories.manage'); $c = row("SELECT * FROM categories WHERE id = ?", [$seg[1]]); if (!$c) fail('یافت نشد', 404);
        update('categories', ['name' => mb_substr(s('name', $c['name']), 0, 100), 'icon' => mb_substr(s('icon', $c['icon']), 0, 30), 'blurb' => mb_substr(s('blurb', $c['blurb']), 0, 200), 'sort_order' => i('sort', (int) $c['sort_order'])], 'id = ?', [$seg[1]]);
        audit($aid, 'category.updated', 'category', $seg[1]); ok(['category' => map_category(row("SELECT * FROM categories WHERE id = ?", [$seg[1]]))]);
    }
    if ($r === 'DELETE /categories/:id') { require_admin('categories.manage'); if (row("SELECT id FROM products WHERE category_id = ? AND deleted_at IS NULL", [$seg[1]])) fail('این دسته دارای محصول است'); q("DELETE FROM categories WHERE id = ?", [$seg[1]]); audit($aid, 'category.deleted', 'category', $seg[1]); ok(); }

    /* ── orders ── */
    if ($r === 'GET /orders') {
        require_admin('orders.manage');
        [$page,$limit,$offset] = paginate_params();
        $w = ['1=1']; $p = [];
        if (!empty($_GET['status']) && in_array($_GET['status'], ORDER_STATUSES, true)) { $w[] = 'status = ?'; $p[] = $_GET['status']; }
        if (!empty($_GET['q'])) { $w[] = '(public_id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ?)'; $like = '%' . $_GET['q'] . '%'; array_push($p, $like, $like, $like, $like); }
        $where = implode(' AND ', $w);
        $total = (int) row("SELECT COUNT(*) c FROM orders WHERE $where", $p)['c'];
        $list = array_map('map_order', rows("SELECT * FROM orders WHERE $where ORDER BY id DESC LIMIT $limit OFFSET $offset", $p));
        // Backward compat: keep 'orders' key, also add pagination
        ok(['orders' => $list, 'pagination' => ['page'=>$page,'limit'=>$limit,'total'=>$total,'pages'=>(int) ceil($total/max(1,$limit)),'offset'=>$offset]]);
    }
    if (($seg[0] ?? '') === 'orders' && isset($seg[1])) {
        require_admin('orders.manage');
        if ($m === 'GET') { $o = row("SELECT * FROM orders WHERE public_id = ?", [$seg[1]]); if (!$o) fail('سفارش پیدا نشد', 404); ok(['order' => map_order($o)]); }
        if ($m === 'PUT') {
            $pub = $seg[1];
            tx(function () use ($pub, $aid) {
                $o = row("SELECT * FROM orders WHERE public_id = ? FOR UPDATE", [$pub]); if (!$o) throw new StateConflict('سفارش پیدا نشد', 'not_found');
                $status = s('status', $o['status']); $shipping = s('shippingStatus', $o['shipping_status']); $note = in('internalNote'); $payment = $o['payment_status'];
                if (!in_array($status, ORDER_STATUSES, true) || !array_key_exists($shipping, SHIPPING_TRANSITIONS)) throw new StateConflict('وضعیت نامعتبر است');
                if ($status !== $o['status'] && !in_array($status, ORDER_TRANSITIONS[$o['status']] ?? [], true)) throw new StateConflict("تغییر وضعیت {$o['status']} به $status مجاز نیست");
                if ($shipping !== $o['shipping_status'] && !in_array($shipping, SHIPPING_TRANSITIONS[$o['shipping_status']] ?? [], true)) throw new StateConflict('تغییر وضعیت ارسال مجاز نیست');
                if ($status === 'cancelled' && $o['status'] !== 'cancelled') {
                    if (in_array($o['payment_status'], ['paid', 'partially_refunded'], true)) {
                        if (!in('refund')) throw new StateConflict('لغو سفارش پرداخت‌شده تا زمان اجرای فرایند بازپرداخت مجاز نیست', 'refund_required');
                        foreach (rows("SELECT * FROM inventory_transactions WHERE reference_type = 'order' AND reference_id = ? AND type = 'sale'", [(string) $o['id']]) as $sale) {
                            $key = "cancel:{$o['id']}:sale:{$sale['id']}";
                            if (row("SELECT id FROM inventory_transactions WHERE idempotency_key = ?", [$key])) continue;
                            $qty = abs((int) $sale['quantity']); $p = row("SELECT stock FROM products WHERE id = ? FOR UPDATE", [$sale['product_id']]); if (!$p) continue;
                            q("UPDATE products SET stock = stock + ? WHERE id = ?", [$qty, $sale['product_id']]);
                            insert('inventory_transactions', ['product_id' => $sale['product_id'], 'type' => 'return', 'quantity' => $qty, 'stock_before' => (int) $p['stock'], 'stock_after' => (int) $p['stock'] + $qty, 'reason' => "لغو سفارش {$o['public_id']}", 'reference_type' => 'order', 'reference_id' => (string) $o['id'], 'idempotency_key' => $key, 'admin_id' => $aid]);
                        }
                        $pay = row("SELECT id FROM payments WHERE order_id = ? AND status = 'verified'", [$o['id']]);
                        insert('refunds', ['order_id' => $o['id'], 'payment_id' => $pay['id'] ?? null, 'amount_toman' => (int) $o['total_toman'], 'reason' => 'لغو سفارش توسط مدیر', 'status' => 'processed', 'admin_id' => $aid, 'processed_at' => date('Y-m-d H:i:s')]);
                        $payment = 'refunded';
                    } else { $payment = 'failed'; q("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'", [$o['id']]); }
                }
                update('orders', ['status' => $status, 'payment_status' => $payment, 'shipping_status' => $shipping, 'internal_note' => $note === null ? $o['internal_note'] : mb_substr((string) $note, 0, 2000)], 'id = ?', [$o['id']]);
                foreach ([['status', $o['status'], $status], ['payment_status', $o['payment_status'], $payment], ['shipping_status', $o['shipping_status'], $shipping]] as [$t, $f, $to]) if ($f !== $to) insert('order_events', ['order_id' => $o['id'], 'admin_id' => $aid, 'type' => $t, 'from_value' => $f, 'to_value' => $to]);
                if ($note !== null && $note !== $o['internal_note']) insert('order_events', ['order_id' => $o['id'], 'admin_id' => $aid, 'type' => 'note', 'note' => mb_substr((string) $note, 0, 2000)]);
                audit($aid, 'order.updated', 'order', $pub, ['from' => $o['status'], 'to' => $status]);
            });
            ok(['order' => map_order(row("SELECT * FROM orders WHERE public_id = ?", [$pub]))]);
        }
    }

    /* ── customers ── */
    if ($r === 'GET /customers') { require_admin('customers.view');
        ok(['customers' => array_map(fn($u) => public_user($u) + ['active' => (bool) $u['active'], 'orders' => (int) $u['orders'], 'spent' => (int) $u['spent']],
            rows("SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) orders, (SELECT COALESCE(SUM(total_toman),0) FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'paid') spent FROM users u WHERE role = 'customer' ORDER BY id DESC"))]); }

    /* ── inventory ── */
    if ($r === 'GET /inventory') { require_admin('inventory.manage');
        ok(['products' => array_map(fn($p) => ['id' => (int) $p['id'], 'name' => $p['name'], 'sku' => $p['sku'], 'stock' => (int) $p['stock'], 'minStock' => (int) $p['min_stock']], rows("SELECT id, name, sku, stock, min_stock FROM products WHERE deleted_at IS NULL ORDER BY stock")),
            'transactions' => array_map(fn($t) => ['id' => (int) $t['id'], 'productId' => (int) $t['product_id'], 'productName' => $t['pname'], 'type' => $t['type'], 'quantity' => (int) $t['quantity'], 'before' => (int) $t['stock_before'], 'after' => (int) $t['stock_after'], 'reason' => $t['reason'], 'createdAt' => $t['created_at']],
                rows("SELECT t.*, p.name pname FROM inventory_transactions t JOIN products p ON p.id = t.product_id ORDER BY t.id DESC LIMIT 100"))]); }
    if ($r === 'POST /inventory') { require_admin('inventory.manage');
        $qty = i('quantity'); if ($qty === 0) fail('مقدار نامعتبر است');
        tx(function () use ($qty, $aid) {
            $p = row("SELECT * FROM products WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [i('productId')]); if (!$p) throw new StateConflict('محصول یافت نشد', 'not_found');
            $after = (int) $p['stock'] + $qty; if ($after < 0) throw new StateConflict('موجودی نمی‌تواند منفی شود');
            update('products', ['stock' => $after], 'id = ?', [$p['id']]);
            insert('inventory_transactions', ['product_id' => $p['id'], 'type' => $qty > 0 ? 'restock' : 'adjustment', 'quantity' => $qty, 'stock_before' => (int) $p['stock'], 'stock_after' => $after, 'reason' => mb_substr(s('reason'), 0, 200), 'admin_id' => $aid]);
            audit($aid, 'inventory.adjusted', 'product', $p['id'], ['qty' => $qty]);
        });
        ok(); }

    /* ── users & roles ── */
    if ($r === 'GET /users') { require_admin('users.manage'); ok(['users' => array_map(fn($u) => public_user($u) + ['active' => (bool) $u['active']], rows("SELECT * FROM users WHERE role <> 'customer' ORDER BY id"))]); }
    if ($r === 'POST /users') { require_admin('users.manage'); if ($admin['role'] !== 'admin') fail('فقط مدیر کل می‌تواند کاربر بسازد', 403);
        $email = mb_strtolower(s('email')); $pass = (string) in('password', '');
        if (s('name') === '' || !valid_email($email)) fail('نام و ایمیل معتبر الزامی است'); if (mb_strlen($pass) < 12) fail('رمز عبور باید حداقل ۱۲ کاراکتر باشد');
        if (row("SELECT id FROM users WHERE email = ?", [$email])) fail('ایمیل تکراری است');
        $id = insert('users', ['name' => mb_substr(s('name'), 0, 120), 'email' => $email, 'phone' => '', 'password_hash' => password_hash($pass, PASSWORD_DEFAULT), 'role' => in_array(s('role'), ROLES, true) ? s('role') : 'staff', 'permissions' => json_encode(array_values(array_intersect(arr('permissions'), PERMS)))]);
        audit($aid, 'user.created', 'user', $id); ok(['user' => public_user(row("SELECT * FROM users WHERE id = ?", [$id]))]); }
    if ($r === 'PUT /users/:id') { require_admin('users.manage'); if ($admin['role'] !== 'admin') fail('دسترسی ندارید', 403);
        $u = row("SELECT * FROM users WHERE id = ? AND role <> 'customer'", [$seg[1]]); if (!$u) fail('یافت نشد', 404);
        if ((int) $u['id'] === $aid && (in('active') === false || (in('role') && in('role') !== 'admin'))) fail('نمی‌توانید دسترسی خودتان را کم کنید');
        $d = []; if (in('role') && in_array(in('role'), ROLES, true)) $d['role'] = in('role'); if (is_array(in('permissions'))) $d['permissions'] = json_encode(array_values(array_intersect(arr('permissions'), PERMS))); if (in('active') !== null) $d['active'] = in('active') ? 1 : 0;
        if ($d) update('users', $d, 'id = ?', [$seg[1]]); audit($aid, 'user.updated', 'user', $seg[1], $d); ok(['user' => public_user(row("SELECT * FROM users WHERE id = ?", [$seg[1]]))]); }
    if ($r === 'POST /change-password') {
        if (!password_verify((string) in('current', ''), $admin['password_hash'])) fail('رمز فعلی اشتباه است'); if (mb_strlen((string) in('next', '')) < 12) fail('رمز جدید باید حداقل ۱۲ کاراکتر باشد');
        update('users', ['password_hash' => password_hash((string) in('next'), PASSWORD_DEFAULT)], 'id = ?', [$aid]); audit($aid, 'admin.password_changed', 'user', $aid); ok(); }

    /* ── settings ── */
    if ($r === 'GET /settings') { require_admin('settings.manage'); ok(['settings' => settings()]); }
    if ($r === 'PUT /settings') { require_admin('settings.manage');
        foreach (settings() as $k => $default) { if (!array_key_exists($k, body())) continue; $v = in($k); if (!is_scalar($v)) continue; if (is_int($default)) $v = max(0, min(100000000, (int) $v)); if ($k === 'payment.mode' && !in_array($v, ['demo', 'zarinpal'], true)) continue;
            q("INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [$k, (string) $v]); }
        audit($aid, 'settings.updated', 'settings', 'store'); ok(['settings' => settings()]); }

    /* ── notifications / activity / messages ── */
    if ($r === 'GET /notifications') {
        [$page,$limit,$offset] = paginate_params();
        $total = (int) row("SELECT COUNT(*) c FROM notifications")['c'];
        $rows = rows("SELECT * FROM notifications ORDER BY id DESC LIMIT $limit OFFSET $offset");
        $list = array_map(fn($n) => ['id' => (int) $n['id'], 'type' => $n['type'], 'title' => $n['title'], 'body' => $n['body'], 'targetUrl' => $n['target_url'] ?? '', 'readAt' => $n['read_at'], 'createdAt' => $n['created_at']], $rows);
        ok(['notifications' => $list, 'pagination' => ['page'=>$page,'limit'=>$limit,'total'=>$total,'pages'=>(int) ceil($total/max(1,$limit)),'offset'=>$offset]]);
    }
    if ($r === 'POST /notifications/read') { $id = i('id'); if ($id) q("UPDATE notifications SET read_at = NOW() WHERE id = ? AND read_at IS NULL", [$id]); else q("UPDATE notifications SET read_at = NOW() WHERE read_at IS NULL"); ok(); }
    if ($r === 'GET /activity') {
        require_admin('users.manage');
        [$page,$limit,$offset] = paginate_params();
        $total = (int) row("SELECT COUNT(*) c FROM admin_activity_logs")['c'];
        $rows = rows("SELECT l.*, u.name aname FROM admin_activity_logs l LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.id DESC LIMIT $limit OFFSET $offset");
        $list = array_map(fn($l) => ['id' => (int) $l['id'], 'adminId' => $l['admin_id'], 'adminName' => $l['aname'] ?? 'سیستم', 'action' => $l['action'], 'targetType' => $l['target_type'], 'targetId' => $l['target_id'], 'createdAt' => $l['created_at']], $rows);
        ok(['logs' => $list, 'pagination' => ['page'=>$page,'limit'=>$limit,'total'=>$total,'pages'=>(int) ceil($total/max(1,$limit)),'offset'=>$offset]]);
    }
    if ($r === 'GET /messages') {
        [$page,$limit,$offset] = paginate_params();
        $total = (int) row("SELECT COUNT(*) c FROM messages")['c'];
        $rows = rows("SELECT id, name, contact, body, created_at createdAt FROM messages ORDER BY id DESC LIMIT $limit OFFSET $offset");
        ok(['messages' => $rows, 'pagination' => ['page'=>$page,'limit'=>$limit,'total'=>$total,'pages'=>(int) ceil($total/max(1,$limit)),'offset'=>$offset]]);
    }

    /* ── reports ── */
    if (in_array($r, ['GET /reports', 'GET /analytics', 'GET /best-sellers'], true)) {
        require_admin('reports.view');
        $from = date('Y-m-d H:i:s', strtotime($_GET['from'] ?? '-30 days') ?: time() - 30 * 86400); $to = date('Y-m-d H:i:s', strtotime($_GET['to'] ?? 'now') ?: time());
        $sum = row("SELECT COALESCE(SUM(total_toman),0) revenue, COUNT(*) orders FROM orders WHERE payment_status = 'paid' AND created_at BETWEEN ? AND ?", [$from, $to]);
        $items = (int) row("SELECT COALESCE(SUM(oi.qty),0) v FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.payment_status = 'paid' AND o.created_at BETWEEN ? AND ?", [$from, $to])['v'];
        $daily = array_map(fn($d) => ['date' => $d['d'], 'revenue' => (int) $d['revenue'], 'orders' => (int) $d['orders']], rows("SELECT DATE(created_at) d, SUM(total_toman) revenue, COUNT(*) orders FROM orders WHERE payment_status = 'paid' AND created_at BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY d", [$from, $to]));
        $best = array_map(fn($b) => ['productId' => (int) $b['product_id'], 'name' => $b['name'], 'qty' => (int) $b['qty'], 'revenue' => (int) $b['revenue']], rows("SELECT oi.product_id, MIN(oi.name) name, SUM(oi.qty) qty, SUM(oi.qty*oi.unit_price) revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.payment_status = 'paid' AND o.created_at BETWEEN ? AND ? GROUP BY oi.product_id ORDER BY qty DESC LIMIT 50", [$from, $to]));
        $statusCounts = []; foreach (rows("SELECT status, COUNT(*) c FROM orders GROUP BY status") as $s) $statusCounts[$s['status']] = (int) $s['c'];
        $cats = array_map(fn($c) => ['name' => $c['name'], 'count' => (int) $c['c']], rows("SELECT c.name, COUNT(p.id) c FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL GROUP BY c.id ORDER BY c.sort_order"));
        ok(['summary' => ['revenue' => (int) $sum['revenue'], 'orders' => (int) $sum['orders'], 'avg' => (int) $sum['orders'] ? (int) round($sum['revenue'] / $sum['orders']) : 0, 'items' => $items], 'daily' => $daily, 'bestSellers' => $best, 'statusCounts' => $statusCounts, 'categories' => $cats]);
    }
}

/** ساخت خودکار ادمین اولیه از config (فقط وقتی هیچ ادمینی وجود ندارد) */
function bootstrap_admin(): void {
    if (row("SELECT id FROM users WHERE role = 'admin' LIMIT 1")) return;
    $b = cfg('bootstrap_admin', []);
    if (empty($b['email']) || empty($b['password']) || strlen($b['password']) < 12 || strpos($b['password'], 'CHANGE_ME') !== false) return;
    insert('users', ['name' => $b['name'] ?? 'Admin', 'email' => mb_strtolower($b['email']), 'phone' => '', 'password_hash' => password_hash($b['password'], PASSWORD_DEFAULT), 'role' => 'admin', 'permissions' => '["*"]']);
}
