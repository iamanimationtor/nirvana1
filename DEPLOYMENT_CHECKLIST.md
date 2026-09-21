# Nirvana 3D — Deployment Checklist (Production Ready)

> تاریخ: 2026-09-21 — نسخه hardening نهایی. این چک‌لیست برای استقرار واقعی PHP 8.3+/MariaDB/HTTPS تهیه شده و باید گام‌به‌گام با دستورات قابل اجرا تأیید شود. هر گام بدون Evidence واقعی PASS محسوب نمی‌شود.

## 0) Pre-flight (local)
```bash
npm ci && npm run build          # باید 841KB singlefile بدون خطا باشد
npx tsx scripts/smoke.ts         # همه PASS (catalog, admin, checkout, pay idempotent, guest token, idempotency, inventory, contact)
```

## 1) Server Requirements
- **PHP 8.3+** با extensions: pdo_mysql, mbstring, curl, fileinfo, gd (getimagesize), openssl, json
- **MariaDB 10.6+ / MySQL 8.0+** — utf8mb4, InnoDB
- **Webserver**: Apache 2.4+ با mod_rewrite, mod_headers, mod_mime یا Nginx 1.24+ با php-fpm 8.3
- **HTTPS**: Let's Encrypt (Certbot) — HSTS max-age=31536000
- Node فقط برای build (runtime فقط PHP + static)

```bash
php -v            # 8.3+
mysql --version   # 10.6+ / 8.0+
apache2 -v || nginx -v
```

## 2) Database — Fresh vs Legacy

### Fresh (توصیه)
```bash
mysql -u nirvana -p nirvana < database/schema.sql
# Verify
mysql -u nirvana -p -e "SHOW TABLES; SELECT COUNT(*) FROM products; SHOW INDEX FROM orders WHERE Key_name='idx_orders_access_token_hash';"
# Expect: 7 products, access_token_hash index exists, idempotency_keys table exists
```

### Legacy Migration
```bash
mysql -u nirvana -p nirvana < database/migrate_hardening.sql
# Verify counts/IDs/FK integrity
mysql -u nirvana -p -e "
  SELECT 'orders' AS tbl, COUNT(*) FROM orders
  UNION ALL SELECT 'users', COUNT(*) FROM users
  UNION ALL SELECT 'products', COUNT(*) FROM products;
  SHOW INDEX FROM orders;
  SELECT COUNT(*) FROM idempotency_keys;
  SELECT COUNT(*) FROM rate_limits;
"
# Compare با schema.sql fresh: counts/IDs/FK باید یکسان بماند (فقط ستون جدید اضافه شده)
```

**Decision Rule**: اگر legacy داده دارد → migrate_hardening.sql اجرا شود و مقایسه counts/IDs/FK انجام شود. اگر fresh → schema.sql. هر دو باید یک INDEX یکسان بدهند.

## 3) Config — `api/config.php` from sample
```bash
cp api/config.sample.php api/config.php
# Edit:
# - db.host/user/pass/name
# - app_url = https://nirvana.example.com
# - mail_from, zarinpal.merchant_id, upload_dir = /var/www/nirvana/public/uploads, upload_url = /uploads
# - bootstrap_admin.email/pass (حداقل 12 کاراکتر، CHANGE_ME ممنوع)
chmod 640 api/config.php
# Never commit config.php — only config.sample.php
```

## 4) Permissions & Uploads
```bash
chown -R www-data:www-data public/uploads api
chmod 755 public/uploads
chmod 644 public/uploads/.htaccess   # deny php execution (Apache) + README.txt
chmod 640 api/*.php
# Verify:
ls -l public/uploads/.htaccess
cat public/uploads/.htaccess  # must contain "php_flag engine off" + "Require all denied"

# Nginx guard (separate from .htaccess):
grep -q "location ~\* .*uploads.*php" nginx.conf.sample && echo "nginx guard present"
```

## 5) Apache Deployment
```bash
# DocumentRoot must be /var/www/nirvana/public (not repo root)
# Enable:
a2enmod rewrite headers mime expires
# Place public/.htaccess + api/.htaccess + public/uploads/.htaccess
apache2ctl configtest && systemctl reload apache2

# Verify headers:
curl -I https://nirvana.example.com/ | grep -i "content-security-policy"
curl -I https://nirvana.example.com/api/health | grep -i "content-security-policy" # API CSP = default-src 'none'
curl -I https://nirvana.example.com/uploads/ 2>&1 | head

# Verify upload PHP deny (both webs):
echo '<?php echo 1; ?>' > public/uploads/test.php
curl -I https://nirvana.example.com/uploads/test.php | grep 403
rm public/uploads/test.php
```

## 6) Nginx Deployment (alternative to Apache)
```bash
cp nginx.conf.sample /etc/nginx/sites-available/nirvana
ln -s /etc/nginx/sites-available/nirvana /etc/nginx/sites-enabled/nirvana
# Edit server_name, root, ssl_certificate paths, fastcgi_pass socket
nginx -t && systemctl reload nginx

# Verify same headers and deny:
curl -I https://nirvana.example.com/uploads/test.php | grep 403  # 403 even if file exists
nginx -T | grep "location ~\* .*uploads.*php"
```

## 7) Cron — GC & cleanup (every 15 min)
```bash
crontab -e
# Add:
# */15 * * * * /usr/bin/php /var/www/nirvana/api/cron.php >> /var/log/nirvana-cron.log 2>&1

# Verify cron runs:
php api/cron.php
mysql -u nirvana -p -e "SELECT COUNT(*) FROM rate_limits WHERE reset_at < UNIX_TIMESTAMP(); SELECT COUNT(*) FROM idempotency_keys WHERE expires_at < NOW();"
# After cron, both should be 0 or low

# Log rotate for cron:
cat > /etc/logrotate.d/nirvana <<LOG
/var/log/nirvana-cron.log {
  weekly rotate 4 compress missingok
}
LOG
```

## 8) Backup & Restore
```bash
# Backup (daily via cron)
mysqldump -u nirvana -p --single-transaction --routines --triggers nirvana | gzip > /backups/nirvana-$(date +%F).sql.gz
tar czf /backups/nirvana-uploads-$(date +%F).tar.gz -C /var/www/nirvana/public uploads

# Restore test (staging)
mysql -u nirvana_staging -p nirvana_staging < <(gunzip -c /backups/nirvana-2026-09-21.sql.gz)
tar xzf /backups/nirvana-uploads-2026-09-21.tar.gz -C /tmp/restore-test && ls -l /tmp/restore-test/uploads | head

# Verify restore:
mysql -u nirvana_staging -p -e "SELECT COUNT(*) FROM orders; SELECT COUNT(*) FROM products;"
```

## 9) Health & Logs
```bash
curl https://nirvana.example.com/api/health
# Expect: {"ok":true,"db":true,"time":"..."} or {"ok":true}

# Logs:
tail -f /var/log/nginx/nirvana_error.log
tail -f /var/log/nirvana-cron.log
# PHP errors:
tail -f /var/log/php8.3-fpm.log
```

## 10) Verification — 21 endpoints (must all PASS on HTTPS)
```bash
# Auth:
curl -s https://nirvana.example.com/api/auth/me
curl -s -X POST https://nirvana.example.com/api/auth/register -H 'Content-Type: application/json' -d '{"name":"تست","email":"t@example.com","password":"secret123","phone":"09120000000"}'
# Store:
curl -s https://nirvana.example.com/api/catalog | jq .
curl -s https://nirvana.example.com/api/products/wave-vase | jq .price
curl -s https://nirvana.example.com/api/sitemap | head
# Checkout (idempotency):
curl -s -X POST https://nirvana.example.com/api/checkout -H 'Content-Type: application/json' -H 'Idempotency-Key: test-123' -d '{"items":[{"id":5,"qty":1}],"customer":{"name":"علی","email":"ali@test.com","phone":"09120000000","province":"تهران","city":"تهران","line":"خیابان ۱"}}' | jq .publicId
# Duplicate with same key must return same publicId (not create new order):
curl -s -X POST https://nirvana.example.com/api/checkout -H 'Idempotency-Key: test-123' -H 'Content-Type: application/json' -d '...' | jq
# Guest order lookup (token required):
curl -s https://nirvana.example.com/api/orders/<publicId>  # 403 without token
curl -s "https://nirvana.example.com/api/orders/<publicId>?token=<accessToken>"  # 200
# Pay (Zarinpal or demo fallback if payment.mode=demo):
curl -s -X POST https://nirvana.example.com/api/pay/request -H 'Content-Type: application/json' -d '{"orderPublicId":"..."}'
curl -s "https://nirvana.example.com/api/pay/callback?Authority=...&Status=OK"
# Admin (requires login cookie / session):
curl -s -c cookies.txt -X POST https://nirvana.example.com/api/admin/login -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"..."}'
curl -s -b cookies.txt https://nirvana.example.com/api/admin/orders?page=1&limit=20 | jq .pagination
curl -s -b cookies.txt -F 'file=@test.jpg' https://nirvana.example.com/api/admin/upload  # must check finfo + getimagesize, size <5MB, no php
# Contact, etc.
curl -s -X POST https://nirvana.example.com/api/contact -H 'Content-Type: application/json' -d '{"name":"سارا","contact":"sara@test.com","body":"سلام"}'
```

## 11) Concurrency Tests (5 parallel, must PASS)
```bash
# Checkout idempotency — 10 concurrent same Idempotency-Key should create only 1 order
seq 1 10 | xargs -P10 -I{} curl -s -X POST https://nirvana.example.com/api/checkout -H 'Idempotency-Key: conc-123' -H 'Content-Type: application/json' -d '...' | jq .publicId | sort | uniq -c  # expect 10x same id

# Order lookup brute-force — 100 sequential wrong tokens should all 403 and not leak data
for i in $(seq 1 100); do curl -s -o /dev/null -w "%{http_code}\n" "https://nirvana.example.com/api/orders/<id>?token=wrong$i" | grep -q 403 || echo "fail $i"; done

# Image upload concurrent:
seq 1 5 | xargs -P5 -I{} curl -s -b cookies.txt -F 'file=@test.jpg' https://nirvana.example.com/api/admin/upload | jq

# Stock: two concurrent pay for last item — only one should succeed (FOR UPDATE)
# Rate limit: 60 rapid /api/auth/register should 429 after threshold
```

## 12) Failure / Recovery Tests
| Scenario | Steps | Expected |
|----------|-------|----------|
| DB down | `systemctl stop mariadb; curl /api/health` → 500 + log; `systemctl start mariadb` → recovery without stale state | No corrupt orders |
| Gateway timeout | `timeout 2 curl /api/pay/request` with mock delay | Tx rolled back, order stays unpaid |
| Invalid callback | `GET /api/pay/callback?Authority=invalid&Status=OK` | 400, no order changed |
| Duplicate callback | Call callback twice same Authority | Second is idempotent, no double stock deduction |
| Upload fail (PHP file) | `curl -F file=@evil.php` | 400 rejected, file not stored, no execution |
| Stock exhausted | Order qty > stock | 400 "موجودی" |
| Storage full | Fill disk, try upload | 500 but DB not corrupted |
| CSP break | `curl -I /` check CSP header present, manual click Shop/Product/Pay | No blocked images/API/Zarinpal |

## 13) SEO Checks
```bash
curl -s https://nirvana.example.com/sitemap.xml | grep -q "<urlset" && echo "sitemap ok"
curl -s https://nirvana.example.com/robots.txt | cat
curl -s https://nirvana.example.com/product/wave-vase | grep -q 'application/ld+json' && grep -q '"@type":"Product"' && echo "json-ld ok"
curl -s https://nirvana.example.com/nonexistent | grep -q "404" && echo "404 ok"
```

## 14) Performance (only measured, not premature)
- pagination: GET /admin/orders?page=1&limit=20 returns ~20 rows + total
- N+1: reports use JOIN, not loop queries (verify via slow log)
- indexes: `EXPLAIN SELECT * FROM orders WHERE status='paid' ORDER BY created_at DESC`
- images: lazy loading (ProductCard loading="lazy"), vite singlefile 841KB gzip 338KB
- cache: assets immutable 30d, index.html no-cache

---

## Final Sign-off
- [ ] All 21 endpoints PASS on HTTPS
- [ ] 5 concurrency tests PASS (evidence: curl logs, uniq counts, http codes)
- [ ] Failure/Recovery: all scenarios consistent (no stale state)
- [ ] Backup/restore verified (counts match)
- [ ] Logs and cron verified
- [ ] SEO: canonical/OG/Twitter/JSON-LD/sitemap/robots/404
- [ ] No Critical/High issues, audit FINAL says READY

Without real Evidence (curl logs, DB counts, concurrency output) verdict is NOT READY.
