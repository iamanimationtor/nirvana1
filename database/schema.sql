-- ============================================================
--  Nirvana 3D — MySQL / MariaDB schema + seed data
--  Import once via phpMyAdmin (cPanel / DirectAdmin)
-- ============================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','admin','manager','staff') NOT NULL DEFAULT 'customer',
  permissions LONGTEXT NULL, -- JSON (LONGTEXT برای سازگاری با MySQL 5.6 / MariaDB قدیمی)
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS addresses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  province VARCHAR(60) NOT NULL,
  city VARCHAR(60) NOT NULL,
  line VARCHAR(500) NOT NULL,
  postal_code VARCHAR(20) NOT NULL DEFAULT '',
  is_default TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(30) NOT NULL DEFAULT 'spark',
  blurb VARCHAR(200) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL,
  sku VARCHAR(60) NOT NULL DEFAULT '',
  name VARCHAR(200) NOT NULL,
  name_en VARCHAR(200) NOT NULL DEFAULT '',
  price INT UNSIGNED NOT NULL,
  old_price INT UNSIGNED NULL,
  discount_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  category_id INT UNSIGNED NOT NULL,
  short_desc VARCHAR(500) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  features LONGTEXT NULL, -- JSON
  variants LONGTEXT NULL, -- JSON
  images LONGTEXT NULL,   -- JSON
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  min_stock INT UNSIGNED NOT NULL DEFAULT 5,
  prep_time VARCHAR(80) NOT NULL DEFAULT '',
  material VARCHAR(60) NOT NULL DEFAULT '',
  status ENUM('active','draft') NOT NULL DEFAULT 'active',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (slug), INDEX (category_id), INDEX (status),
  FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  user_id INT UNSIGNED NULL,
  access_token_hash CHAR(64) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  shipping_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_toman INT UNSIGNED NOT NULL,
  subtotal_toman INT UNSIGNED NOT NULL DEFAULT 0,
  discount_toman INT UNSIGNED NOT NULL DEFAULT 0,
  shipping_toman INT UNSIGNED NOT NULL DEFAULT 0,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(190) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  province VARCHAR(60) NOT NULL,
  city VARCHAR(60) NOT NULL,
  address_line VARCHAR(500) NOT NULL,
  postal_code VARCHAR(20) NOT NULL DEFAULT '',
  note VARCHAR(1000) NOT NULL DEFAULT '',
  internal_note VARCHAR(2000) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  INDEX (user_id), INDEX (status), INDEX (created_at), INDEX (access_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  slug VARCHAR(120) NOT NULL,
  sku VARCHAR(60) NOT NULL DEFAULT '',
  name VARCHAR(200) NOT NULL,
  unit_price INT UNSIGNED NOT NULL,
  qty INT UNSIGNED NOT NULL,
  image VARCHAR(500) NOT NULL DEFAULT '',
  variant VARCHAR(80) NOT NULL DEFAULT '',
  INDEX (order_id), INDEX (product_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  admin_id INT UNSIGNED NULL,
  type VARCHAR(30) NOT NULL,
  from_value VARCHAR(40) NULL,
  to_value VARCHAR(40) NULL,
  note VARCHAR(2000) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'zarinpal',
  authority VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  amount_toman INT UNSIGNED NOT NULL,
  amount_rial BIGINT UNSIGNED NOT NULL,
  ref_id VARCHAR(64) NULL,
  card_pan VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP NULL,
  INDEX (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refunds (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  payment_id INT UNSIGNED NULL,
  amount_toman INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  type VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  stock_before INT NOT NULL,
  stock_after INT NOT NULL,
  reason VARCHAR(200) NOT NULL DEFAULT '',
  reference_type VARCHAR(20) NULL,
  reference_id VARCHAR(40) NULL,
  idempotency_key VARCHAR(80) NULL UNIQUE,
  admin_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (product_id), INDEX (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body VARCHAR(500) NOT NULL DEFAULT '',
  target_url VARCHAR(300) NULL,
  user_id INT UNSIGNED NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  contact VARCHAR(160) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  ip_hash CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id VARCHAR(60) NULL,
  metadata LONGTEXT NULL, -- JSON
  ip_hash CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(60) PRIMARY KEY,
  v VARCHAR(1000) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  k CHAR(64) PRIMARY KEY,
  hits INT UNSIGNED NOT NULL DEFAULT 1,
  reset_at INT UNSIGNED NOT NULL,
  INDEX (reset_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  k CHAR(64) PRIMARY KEY,
  route VARCHAR(40) NOT NULL,
  user_id INT UNSIGNED NULL,
  response LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  INDEX (expires_at), INDEX (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────
--  Seed: categories
-- ────────────────────────────────────────────────────────────
INSERT INTO categories (id, slug, name, icon, blurb, sort_order) VALUES
(1,'figures','فیگورها','figure','آثار قابلی نمایش برای دنیای گیم و فانتزی',1),
(2,'decor','دکور منزل','vase','جزئیاتی که فضا را زنده می‌کند',2),
(3,'lighting','چراغ و نورپردازی','lamp','نور، با فرم',3),
(4,'accessories','اکسسوری','stand','لوازم روزمره، با سبک',4),
(5,'gaming','گیم و تکنولوژی','gamepad','تجهیزات رگال، از دل سه‌بعدی',5),
(6,'special','محصولات خاص','spark','قطعاتی که دیگران ندیده‌اند',6)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ────────────────────────────────────────────────────────────
--  Seed: products (همان کاتالوگ اصلی نیروانا)
-- ────────────────────────────────────────────────────────────
INSERT INTO products (id, slug, sku, name, name_en, price, old_price, discount_percent, category_id, short_desc, description, features, variants, images, stock, min_stock, prep_time, material, status, featured) VALUES
(1,'wave-vase','NRV-001','گلدان ارگانیک «موج»','WAVE VASE',685000,820000,16,2,
 'گلدان ارگانیک با خطوط نرم و پیوسته که مثل موج‌های آرام، فضا را زنده می‌کند.',
 '«موج» یکی از محبوب‌ترین آثار نیروانا است؛ فرم ارگانیک آن در صدها لایه چاپ می‌شود و با دقت بالا روی هم می‌نشیند. این گلدان بدون آستر هم مقاوم است و هم سبک؛ انتخابی که هم با گل طبیعی و هم با سبزه و گیاهان کوچک، جلوهٔ کاملی دارد.',
 '["چاپ سه‌بعدی لایه‌به‌لایه با دقت ۰٫۱۲ میلی‌متر","بدون نیاز به آستر؛ مقاوم و سبک","متریال PLA سازگار با محیط‌زیست","ابعاد تقریبی: ۲۲ × ۲ سانتی‌متر"]',
 '["سبز زیتونی","مشکی","کرم"]','["/images/product-vase.jpg","/images/lifestyle.jpg","/images/hero.jpg"]',8,5,'۲ تا ۴ روز کاری','PLA','active',1),
(2,'parametric-lamp','NRV-002','چراغ میزی پارامتریک «نور»','PARAMETRIC LAMP',1290000,NULL,0,3,
 'نوری که از دل شبکه‌ای از فرم‌های ریاضی بیرون می‌زند؛ یک چراغ، یک اثر.',
 '«نور» یک ساختار پارامتریک است که ساعت‌ها زمان چاپ می‌خواهد تا به این ظرافت برسد. در شب، نور گرم LED از بین لایه‌های شبکه بیرون می‌زند و سایه‌ای زنده روی دیوار می‌نشیند. یک قطعه برای میز کار، هال یا گوشهٔ مطالعه.',
 '["ساختار شبکه‌ای پارامتریک","LED ۲۷۰۰K با درایور داخلی","کابل پارچه‌ای ۱٫۵ متری با کلید کشویی","ضخامت لایه ۰٫۲۴ میلی‌متر"]',
 '["مشکی با نور گرم","کرم با نور سرد"]','["/images/product-lamp.jpg","/images/collection.jpg","/images/lifestyle.jpg"]',4,5,'۴ تا ۶ روز کاری','PETG','active',1),
(3,'geo-planter','NRV-003','گلدان ژئومتریک «کوهستان»','GEO PLANTER',540000,NULL,0,2,
 'خطوط تیز و زاویه‌دار مثل قله‌های دوردست؛ گلدانی برای گوشه‌های خالی خانه.',
 '«کوهستان» با الگوریتم تزیلاسیون ساخته شده؛ هر وجه مثل یک قلهٔ جداست و با نور عصر، سایه‌های جذابی می‌اندازد. گلدان دارای زهکشی و سینی پایه است و برای گیاهان کوچک و سبزه مناسب است.',
 '["طراحی تزیلاسیون سه‌بعدی","زهکشی و سینی پایه","مناسب گیاهان کوچک و سبزه","ابعاد تقریبی: ۱۴ × ۱۴ سانتی‌متر"]',
 '["زغالی","سبز جنگلی"]','["/images/product-planter.jpg","/images/lifestyle.jpg","/images/product-vase.jpg"]',12,5,'۱ تا ۳ روز کاری','PLA','active',0),
(4,'turbulence-sculpture','NRV-004','مجسمهٔ انتزاعی «تلاطم»','TURBULENCE',1850000,2100000,12,6,
 'یک فرم در حال حرکت، که چاپ سه‌بعدی آن را برای همیشه متوقف کرده است.',
 '«تلاطم» از جریان سیال الهام گرفته؛ خطوطی که انگار همیشه در حال چرخند. این اثر به‌صورت دست‌ساز در چند لایه چاپ شده و روی ساقهٔ تراورتن قرار می‌گیرد. نسخهٔ محدود، با گواهی اصالت.',
 '["نسخهٔ محدود: ۱۲ نسخه در سال","چاپ چندلایه با مونتاژ دستی","ساقه از سنگ تراورتن","گواهی اصالت اثر"]',
 '["زغالی با طلایی","تمام مشکی"]','["/images/product-sculpture.jpg","/images/collection.jpg","/images/lifestyle.jpg"]',0,5,'پیش‌ثبت سفارش','ABS','active',1),
(5,'fluid-stand','NRV-005','استند ارگانیک تبلت و موبایل «لغز»','FLUID STAND',385000,NULL,0,4,
 'پشتیبن ارگانیک برای تبلت و موبایل؛ نرم، مینیمال، کاربردی.',
 '«لغز» برای میز کار و اتاق خواب طراحی شده؛ فرم موجی آن از هر دو طرف قابل استفاده است و پایهٔ ضدریس آن روی هر سطحی ثابت می‌ماند. انتخابی که میز کار را از شلوغی نجات می‌دهد.',
 '["پشتیبن تبلت تا ۱۲٫۹ اینچ و موبایل","پایهٔ ضدریس","فرم دوطرفه","رنگ کرم استودیویی"]',
 '["کرم","سبز زیتونی"]','["/images/product-holder.jpg","/images/lifestyle.jpg","/images/product-vase.jpg"]',15,5,'۱ تا ۳ روز کاری','PLA','active',1),
(6,'tessellate-wallart','NRV-006','پنل دیواری ریاضی «شبکه»','TESSELLATE WALL',980000,NULL,0,2,
 'پنل سه‌بعدی با فرم‌های تکرارشونده که دیوار را به یک اثر تبدیل می‌کند.',
 '«شبکه» یک پنل ۳۰ در ۳۰ سانتی‌متری با عمق‌های متغیر است؛ نور روز روی آن می‌رقصد و سایه‌هایش ساعت‌به‌ساعت عوض می‌شوند. قابل ترکیب با پنل‌های دیگر برای ساخت دیوار کامل.',
 '["سایز ۳۰ × ۰ سانتی‌متر","عمق متغیر ۱ تا ۴ سانتی‌متر","قابلیت ترکیب چند پنلی","نصب آسان با پین مخفی"]',
 '["سبز جنگلی","کرم"]','["/images/product-wallart.jpg","/images/lifestyle.jpg","/images/collection.jpg"]',6,5,'۳ تا ۵ روز کاری','PLA','active',1),
(7,'sentinel-figure','NRV-007','فیگور هلمت «نگهبان»','SENTINEL',720000,NULL,0,5,
 'هلمت مهندسی آینده با جزئیاتی که زیر نور سبز نئون برق می‌زند.',
 '«نگهبان» برای گیمرها و علاقه‌مندان به سبک سایبرپانک طراحی شده؛ روی پایهٔ نمایشگاهی با نورپردازی سبز قرار می‌گیرد و جزئیات زره در هر زاویه، داستان خودش را دارد. مناسب ویترین، رگال گیمینگ یا میز کار.',
 '["ارتفاع تقریبی ۱۸ سانتی‌متر","پایهٔ نمایشگاهی با نور LED سبز","دروازهٔ هلمت باز می‌شود","مناسب ویترین و رگال گیمینگ"]',
 '["سبز و زغالی","تمام زغالی"]','["/images/product-figure.jpg","/images/collection.jpg","/images/lifestyle.jpg"]',3,5,'۵ تا ۷ روز کاری','Resin','active',1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO settings (k, v) VALUES
('store.name','نیروانا ۳دی'),('store.currency','تومان'),('orders.shippingFee','0'),('inventory.defaultThreshold','5'),
('seo.defaultTitle','نیروانا ۳دی | Nirvana 3D — گالری هنر سه‌بعدی'),('seo.defaultDescription','گالری و کارگاه چاپ سه‌بعدی نیروانا؛ هنر سه‌بعدی برای دنیای واقعی.'),('payment.mode','demo')
ON DUPLICATE KEY UPDATE v = v;
