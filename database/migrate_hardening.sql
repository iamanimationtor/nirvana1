-- Nirvana 3D — Hardening migration (legacy DB → production-ready)
-- Safe to run multiple times (uses IF NOT EXISTS / conditional)
SET NAMES utf8mb4;

-- 1) orders: guest access token hash (64 hex SHA-256)
-- MySQL 8 / MariaDB: check via INFORMATION_SCHEMA; for phpMyAdmin manual run, use ALTER IGNORE pattern
-- This script is designed for fresh import via schema.sql; for legacy, run each ALTER separately if column missing.

-- Add column if not exists (MariaDB 10+ supports IF NOT EXISTS, MySQL 8 does not — so guard with procedure)
DELIMITER $$
CREATE PROCEDURE nirvana_add_column_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN ', ddl);
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;
CALL nirvana_add_column_if_missing('orders', 'access_token_hash', '`access_token_hash` CHAR(64) NULL AFTER `user_id`');
DROP PROCEDURE IF EXISTS nirvana_add_column_if_missing;

-- Index for guest lookup and created_at filtering
CREATE INDEX IF NOT EXISTS idx_orders_access_token_hash ON orders (access_token_hash);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders (created_at, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);

-- 2) idempotency_keys (checkout idempotency, 24h TTL)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  k CHAR(64) PRIMARY KEY,
  route VARCHAR(40) NOT NULL,
  user_id INT UNSIGNED NULL,
  response LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  INDEX (expires_at), INDEX (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) rate_limits: ensure reset_at index for GC
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits (reset_at);

-- 4) order_items: ensure indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

-- 5) payments: authority unique already, ensure order_id index
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);

-- 6) inventory_transactions: ensure indexes for audit
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory_transactions (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ref ON inventory_transactions (reference_type, reference_id);

-- 7) products: ensure status/category indexes for catalog filtering
CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

-- 8) admin_activity_logs: pagination performance
CREATE INDEX IF NOT EXISTS idx_activity_created ON admin_activity_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_activity_admin ON admin_activity_logs (admin_id);

-- 9) notifications / messages: created_at index for ordering
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);

-- Cleanup old demo constraints if any (no-op if not exists)
-- e.g., if previous schema had guest publicId only 6 hex, no change needed — app code handles hash now.

SELECT 'migrate_hardening: done — verify with: SELECT COUNT(*) FROM idempotency_keys; SHOW INDEX FROM orders;' AS result;
