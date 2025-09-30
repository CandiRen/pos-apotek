import sqlite3 from 'sqlite3';

const DBSOURCE = 'apotek.db';

const verbose_db = sqlite3.verbose();

const db = new verbose_db.Database(DBSOURCE, (err) => {
  if (err) {
    console.error(err.message);
    throw err;
  } else {
    console.log('Connected to the SQLite database.');
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON;');

      // Modul Produk
      db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT UNIQUE,
        category TEXT,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        price REAL NOT NULL,
        expiry_date TEXT,
        supplier TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      // Modul Penjualan
      db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_amount REAL NOT NULL,
        discount_amount REAL NOT NULL DEFAULT 0,
        payment_method TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
      db.run(`ALTER TABLE sales ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Failed to ensure discount_amount column exists on sales table:', err.message);
        }
      });
      db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price_per_item REAL NOT NULL,
        discount_amount REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
      )`);
      db.run(`ALTER TABLE sale_items ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Failed to ensure discount_amount column exists on sale_items table:', err.message);
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        buy_quantity INTEGER DEFAULT 0,
        get_quantity INTEGER DEFAULT 0,
        discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        gift_product_id INTEGER,
        gift_quantity INTEGER DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gift_product_id) REFERENCES products (id) ON DELETE SET NULL
      )`);

      db.run(`ALTER TABLE promotions ADD COLUMN gift_product_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Failed to ensure gift_product_id column exists on promotions table:', err.message);
        }
      });
      db.run(`ALTER TABLE promotions ADD COLUMN gift_quantity INTEGER DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Failed to ensure gift_quantity column exists on promotions table:', err.message);
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS promotion_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promotion_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        FOREIGN KEY (promotion_id) REFERENCES promotions (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
        UNIQUE(promotion_id, product_id)
      )`);

      // Modul Pasien
      db.run(`CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date_of_birth TEXT,
        address TEXT,
        phone_number TEXT UNIQUE
      )`);

      // Modul Dokter
      db.run(`CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        license_number TEXT UNIQUE,
        specialty TEXT
      )`);

      // Modul Resep
      db.run(`CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        prescription_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Baru', -- Baru, Diproses, Selesai, Dibatalkan
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
        FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE RESTRICT
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS prescription_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        dosage_instruction TEXT,
        FOREIGN KEY (prescription_id) REFERENCES prescriptions (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
      )`);

      // === Tabel Pengguna (Users) untuk Autentikasi ===
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'cashier', -- admin, pharmacist, cashier
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
    });
  }
});

export default db;
