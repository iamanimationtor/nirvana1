import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('staging/staging.db');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

db.exec(`
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_events;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS admin_activity_logs;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;
PRAGMA foreign_keys = ON;
`);

db.exec(`
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  permissions TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  line TEXT NOT NULL,
  postal_code TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'spark',
  blurb TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  old_price INTEGER,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER NOT NULL,
  short_desc TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  features TEXT,
  variants TEXT,
  images TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  prep_time TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  featured INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER,
  access_token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  shipping_status TEXT NOT NULL DEFAULT 'pending',
  total_toman INTEGER NOT NULL,
  subtotal_toman INTEGER NOT NULL DEFAULT 0,
  discount_toman INTEGER NOT NULL DEFAULT 0,
  shipping_toman INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  address_line TEXT NOT NULL,
  postal_code TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  internal_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_access_token_hash ON orders(access_token_hash);
CREATE INDEX idx_orders_created_status ON orders(created_at, status);
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  slug TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  admin_id INTEGER,
  type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'zarinpal',
  authority TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_toman INTEGER NOT NULL,
  amount_rial INTEGER NOT NULL,
  ref_id TEXT,
  card_pan TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE TABLE refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  payment_id INTEGER,
  amount_toman INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE TABLE inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_inventory_product_id ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_ref ON inventory_transactions(reference_type, reference_id);
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  target_url TEXT,
  user_id INTEGER,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE TABLE admin_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_created ON admin_activity_logs(created_at);
CREATE INDEX idx_activity_admin ON admin_activity_logs(admin_id);
CREATE TABLE password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reset_token_hash ON password_reset_tokens(token_hash);
CREATE TABLE settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE rate_limits (
  k TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  reset_at INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits_reset_at ON rate_limits(reset_at);
CREATE TABLE idempotency_keys (
  k TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  user_id INTEGER,
  response TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
`);

const cats = [
  [1,'figures','فیگورها','figure','آثار قابلی نمایش برای دنیای گیم و فانتزی',1],
  [2,'decor','دکور منزل','vase','جزئیاتی که فضا را زنده می‌کند',2],
  [3,'lighting','چراغ و نورپردازی','lamp','نور، با فرم',3],
  [4,'accessories','اکسسوری','stand','لوازم روزمره، با سبک',4],
  [5,'gaming','گیم و تکنولوژی','gamepad','تجهیزات رگال، از دل سه‌بعدی',5],
  [6,'special','محصولات خاص','spark','قطعاتی که دیگران ندیده‌اند',6],
];
const icat = db.prepare(`INSERT INTO categories (id, slug, name, icon, blurb, sort_order) VALUES (?,?,?,?,?,?)`);
for(const c of cats) icat.run(...c);

const products = [
  [1,'wave-vase','NRV-001','گلدان ارگانیک «موج»','WAVE VASE',685000,820000,16,2,'گلدان ارگانیک با خطوط نرم و پیوسته که مثل موج‌های آرام، فضا را زنده می‌کند.','«موج» یکی از محبوب‌ترین آثار نیروانا است؛ فرم ارگانیک آن در صدها لایه چاپ می‌شود.', '["چاپ سه‌بعدی لایه‌به‌لایه با دقت ۰٫۱۲ میلی‌متر","بدون نیاز به آستر؛ مقاوم و سبک","متریال PLA سازگار با محیط‌زیست","ابعاد تقریبی: ۲۲ × ۲ سانتی‌متر"]', '["سبز زیتونی","مشکی","کرم"]','["/images/product-vase.jpg","/images/lifestyle.jpg","/images/hero.jpg"]',8,5,'۲ تا ۴ روز کاری','PLA','active',1],
  [2,'parametric-lamp','NRV-002','چراغ میزی پارامتریک «نور»','PARAMETRIC LAMP',1290000,null,0,3,'نوری که از دل شبکه‌ای از فرم‌های ریاضی بیرون می‌زند؛ یک چراغ، یک اثر.','«نور» یک ساختار پارامتریک است.', '["ساختار شبکه‌ای پارامتریک","LED ۲۷۰۰K با درایور داخلی","کابل پارچه‌ای ۱٫۵ متری با کلید کشویی","ضخامت لایه ۰٫۲۴ میلی‌متر"]', '["مشکی با نور گرم","کرم با نور سرد"]','["/images/product-lamp.jpg","/images/collection.jpg","/images/lifestyle.jpg"]',4,5,'۴ تا ۶ روز کاری','PETG','active',1],
  [3,'geo-planter','NRV-003','گلدان ژئومتریک «کوهستان»','GEO PLANTER',540000,null,0,2,'خطوط تیز و زاویه‌دار مثل قله‌های دوردست؛ گلدانی برای گوشه‌های خالی خانه.','«کوهستان» با الگوریتم تزیلاسیون ساخته شده.', '["طراحی تزیلاسیون سه‌بعدی","زهکشی و سینی پایه","مناسب گیاهان کوچک و سبزه","ابعاد تقریبی: ۱۴ × ۱۴ سانتی‌متر"]', '["زغالی","سبز جنگلی"]','["/images/product-planter.jpg","/images/lifestyle.jpg","/images/product-vase.jpg"]',12,5,'۱ تا ۳ روز کاری','PLA','active',0],
  [4,'turbulence-sculpture','NRV-004','مجسمهٔ انتزاعی «تلاطم»','TURBULENCE',1850000,2100000,12,6,'یک فرم در حال حرکت، که چاپ سه‌بعدی آن را برای همیشه متوقف کرده است.','«تلاطم» از جریان سیال الهام گرفته.', '["نسخهٔ محدود: ۱۲ نسخه در سال","چاپ چندلایه با مونتاژ دستی","ساقه از سنگ تراورتن","گواهی اصالت اثر"]', '["زغالی با طلایی","تمام مشکی"]','["/images/product-sculpture.jpg","/images/collection.jpg","/images/lifestyle.jpg"]',0,5,'پیش‌ثبت سفارش','ABS','active',1],
  [5,'fluid-stand','NRV-005','استند ارگانیک تبلت و موبایل «لغز»','FLUID STAND',385000,null,0,4,'پشتیبن ارگانیک برای تبلت و موبایل؛ نرم، مینیمال، کاربردی.','«لغز» برای میز کار و اتاق خواب طراحی شده.', '["پشتیبن تبلت تا ۱۲٫۹ اینچ و موبایل","پایهٔ ضدریس","فرم دوطرفه","رنگ کرم استودیویی"]', '["کرم","سبز زیتونی"]','["/images/product-holder.jpg","/images/lifestyle.jpg","/images/product-vase.jpg"]',15,5,'۱ تا ۳ روز کاری','PLA','active',1],
  [6,'tessellate-wallart','NRV-006','پنل دیواری ریاضی «شبکه»','TESSELLATE WALL',980000,null,0,2,'پنل سه‌بعدی با فرم‌های تکرارشونده که دیوار را به یک اثر تبدیل می‌کند.','«شبکه» یک پنل ۳۰ در ۳۰ سانتی‌متری.', '["سایز ۳۰ × ۰ سانتی‌متر","عمق متغیر ۱ تا ۴ سانتی‌متر","قابلیت ترکیب چند پنلی","نصب آسان با پین مخفی"]', '["سبز جنگلی","کرم"]','["/images/product-wallart.jpg","/images/lifestyle.jpg","/images/collection.jpg"]',6,5,'۳ تا ۵ روز کاری','PLA','active',1],
  [7,'sentinel-figure','NRV-007','فیگور هلمت «نگهبان»','SENTINEL',720000,null,0,5,'هلمت مهندسی آینده با جزئیاتی که زیر نور سبز نئون برق می‌زند.','«نگهبان» برای گیمرها طراحی شده.', '["ارتفاع تقریبی ۱۸ سانتی‌متر","پایهٔ نمایشگاهی با نور LED سبز","دروازهٔ هلمت باز می‌شود","مناسب ویترین و رگال گیمینگ"]', '["سبز و زغالی","تمام زغالی"]','["/images/product-figure.jpg","/images/collection.jpg","/images/lifestyle.jpg"]',3,5,'۵ تا ۷ روز کاری','Resin','active',1],
];
const iprod = db.prepare(`INSERT INTO products (id, slug, sku, name, name_en, price, old_price, discount_percent, category_id, short_desc, description, features, variants, images, stock, min_stock, prep_time, material, status, featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
for(const p of products) iprod.run(...p);

const settings = [
  ['store.name','نیروانا ۳دی'],['store.currency','تومان'],['orders.shippingFee','0'],['inventory.defaultThreshold','5'],
  ['seo.defaultTitle','نیروانا ۳دی | Nirvana 3D — گالری هنر سه‌بعدی'],['seo.defaultDescription','گالری و کارگاه چاپ سه‌بعدی نیروانا؛ هنر سه‌بعدی برای دنیای واقعی.'],['payment.mode','demo']
];
const iset = db.prepare(`INSERT INTO settings (k,v) VALUES (?,?)`);
for(const s of settings) iset.run(...s);

const adminPass = 'Admin123456!';
const hash = bcrypt.hashSync(adminPass, 10);
db.prepare(`INSERT INTO users (name,email,phone,password_hash,role,permissions,active) VALUES (?,?,?,?,?,?,?)`).run('مدیر نیروانا','admin@nirvana.local','',hash,'admin','["*"]',1);
db.prepare(`INSERT INTO users (name,email,phone,password_hash,role,permissions,active) VALUES (?,?,?,?,?,?,?)`).run('مدیر تست','admin@test.local','',hash,'admin','["*"]',1);

console.log("DB initialized: categories 6, products 7, admin admin@nirvana.local / Admin123456!");
