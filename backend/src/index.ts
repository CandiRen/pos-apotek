import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import db from './database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Ganti dengan kunci rahasia yang kuat

app.use(cors());
app.use(express.json());

app.get('/api', (req: Request, res: Response) => res.json({ message: 'Hello from backend!' }));

// Middleware untuk verifikasi JWT
interface AuthRequest extends Request {
    userId?: number;
    userRole?: string;
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.userId = user.id;
        req.userRole = user.role;
        next();
    });
};

const authorizeRoles = (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
        return res.status(403).json({ message: 'Anda tidak memiliki izin untuk mengakses ini.' });
    }
    next();
};

// === API AUTENTIKASI ===
app.post('/api/auth/register', authenticateToken, authorizeRoles(['admin']), async (req: AuthRequest, res: Response) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Username, password, dan role harus diisi.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Username sudah terdaftar.' });
                }
                return res.status(500).json({ message: 'Gagal mendaftarkan pengguna.', error: err.message });
            }
            res.status(201).json({ message: 'Pengguna berhasil didaftarkan.', userId: this.lastID });
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Terjadi kesalahan server.', error: error.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username dan password harus diisi.' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user: any) => {
        if (err) return res.status(500).json({ message: 'Terjadi kesalahan server.', error: err.message });
        if (!user) return res.status(401).json({ message: 'Username atau password salah.' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Username atau password salah.' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login berhasil.', token, user: { id: user.id, username: user.username, role: user.role } });
    });
});

app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res: Response) => {
    res.json({ user: { id: req.userId, role: req.userRole } });
});

// === API PRODUK ===
app.get('/api/products', authenticateToken, (req: AuthRequest, res: Response) => {
  const search = req.query.search || '';
  db.all(`SELECT * FROM products WHERE name LIKE ? OR sku LIKE ? ORDER BY name`, [`%${search}%`, `%${search}%`], (err, rows) => {
    if (err) return res.status(400).json({ "error": err.message });
    res.json({ data: rows });
  });
});
app.get('/api/products/sku/:sku', authenticateToken, (req: AuthRequest, res: Response) => {
    const sku = req.params.sku;
    db.get(`SELECT * FROM products WHERE sku = ?`, [sku], (err, row) => {
        if (err) return res.status(400).json({ "error": err.message });
        if (!row) return res.status(404).json({ "error": "Produk dengan SKU tersebut tidak ditemukan." });
        res.json({ data: row });
    });
});
app.post('/api/products', authenticateToken, authorizeRoles(['admin', 'pharmacist']), (req: AuthRequest, res: Response) => {
  const { name, sku, category, stock_quantity, price, expiry_date, supplier } = req.body;
  db.run(`INSERT INTO products (name, sku, category, stock_quantity, price, expiry_date, supplier) VALUES (?,?,?,?,?,?,?)`, [name, sku, category, stock_quantity, price, expiry_date, supplier], function (err) {
    if (err) return res.status(400).json({ "error": err.message });
    res.json({ "message": "success", "data": { id: this.lastID, ...req.body } });
  });
});
app.put("/api/products/:id", authenticateToken, authorizeRoles(['admin', 'pharmacist']), (req: AuthRequest, res: Response) => {
  const { name, sku, category, stock_quantity, price, expiry_date, supplier } = req.body;
  db.run(`UPDATE products set name = ?, sku = ?, category = ?, stock_quantity = ?, price = ?, expiry_date = ?, supplier = ? WHERE id = ?`, [name, sku, category, stock_quantity, price, expiry_date, supplier, req.params.id], function (err) {
    if (err) return res.status(400).json({"error": err.message});
    res.json({ message: "success", changes: this.changes });
  });
});
app.delete("/api/products/:id", authenticateToken, authorizeRoles(['admin']), (req: AuthRequest, res: Response) => {
  db.run('DELETE FROM products WHERE id = ?', req.params.id, function (err) {
    if (err) return res.status(400).json({"error": err.message});
    res.json({message: "deleted", changes: this.changes});
  });
});

// === API PENJUALAN ===
app.get('/api/sales', authenticateToken, authorizeRoles(['admin', 'cashier', 'pharmacist']), (req: AuthRequest, res: Response) => {
    const sql = `SELECT id, total_amount, payment_method, created_at FROM sales ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});
app.get('/api/sales/:id', authenticateToken, authorizeRoles(['admin', 'cashier', 'pharmacist']), (req: AuthRequest, res: Response) => {
    const id = req.params.id;
    const sql_sale = `SELECT id, total_amount, payment_method, created_at FROM sales WHERE id = ?`;
    db.get(sql_sale, [id], (err, sale) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!sale) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });

        const sql_items = `SELECT si.quantity, si.price_per_item, p.name FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`;
        db.all(sql_items, [id], (err, items) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ data: { ...sale, items: items } });
        });
    });
});
app.post('/api/sales', authenticateToken, authorizeRoles(['admin', 'cashier', 'pharmacist']), (req: AuthRequest, res: Response) => {
  const { total_amount, payment_method, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Transaksi harus memiliki setidaknya satu item.' });
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('INSERT INTO sales (total_amount, payment_method) VALUES (?, ?)', [total_amount, payment_method], function(err) {
      if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Gagal mencatat penjualan.', details: err.message }); }
      const saleId = this.lastID;
      const itemPromises = items.map((item: any) => new Promise<void>((resolve, reject) => {
        db.run('INSERT INTO sale_items (sale_id, product_id, quantity, price_per_item) VALUES (?, ?, ?, ?)', [saleId, item.product_id, item.quantity, item.price_per_item], (err) => {
          if (err) return reject(new Error('Gagal mencatat item penjualan.'));
          db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?', [item.quantity, item.product_id, item.quantity], function(err) {
            if (err) return reject(new Error('Gagal memperbarui stok produk.'));
            if (this.changes === 0) return reject(new Error(`Stok tidak mencukupi untuk produk ID: ${item.product_id}`));
            resolve();
          });
        });
      }));
      Promise.all(itemPromises).then(() => { db.run('COMMIT'); res.status(201).json({ message: 'Transaksi berhasil', sale_id: saleId }); })
      .catch(error => { db.run('ROLLBACK'); res.status(400).json({ error: error.message }); });
    });
  });
});
app.get('/api/sales/today', authenticateToken, authorizeRoles(['admin', 'cashier', 'pharmacist']), (req: AuthRequest, res: Response) => {
    const today = new Date().toISOString().split('T')[0];
    const sql = `SELECT id, total_amount, payment_method, created_at FROM sales WHERE date(created_at) = ? ORDER BY created_at DESC`;
    db.all(sql, [today], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

// === API PASIEN ===
app.get('/api/patients', authenticateToken, (req: AuthRequest, res: Response) => {
    const search = req.query.search || '';
    db.all('SELECT * FROM patients WHERE name LIKE ? OR phone_number LIKE ?', [`%${search}%`, `%${search}%`], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});
app.post('/api/patients', authenticateToken, authorizeRoles(['admin', 'pharmacist']), (req: AuthRequest, res: Response) => {
    const { name, date_of_birth, address, phone_number } = req.body;
    db.run('INSERT INTO patients (name, date_of_birth, address, phone_number) VALUES (?,?,?,?)', [name, date_of_birth, address, phone_number], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
});

// === API DOKTER ===
app.get('/api/doctors', authenticateToken, (req: AuthRequest, res: Response) => {
    const search = req.query.search || '';
    db.all('SELECT * FROM doctors WHERE name LIKE ? OR license_number LIKE ?', [`%${search}%`, `%${search}%`], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});
app.post('/api/doctors', authenticateToken, authorizeRoles(['admin', 'pharmacist']), (req: AuthRequest, res: Response) => {
    const { name, license_number, specialty } = req.body;
    db.run('INSERT INTO doctors (name, license_number, specialty) VALUES (?,?,?)', [name, license_number, specialty], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
});

// === API RESEP ===
app.get('/api/prescriptions', authenticateToken, authorizeRoles(['admin', 'pharmacist']), (req: AuthRequest, res: Response) => {
    const sql = `SELECT p.id, p.prescription_date, p.status, pa.name as patient_name, d.name as doctor_name FROM prescriptions p JOIN patients pa ON p.patient_id = pa.id JOIN doctors d ON p.doctor_id = d.id ORDER BY p.created_at DESC`;
    db.all(sql, [], (err, rows) => { if (err) return res.status(400).json({ error: err.message }); res.json({ data: rows }); });
});
app.get('/api/prescriptions/:id', authenticateToken, authorizeRoles(['admin', 'pharmacist']), (req: AuthRequest, res: Response) => {
    const id = req.params.id;
    const sql_presc = `SELECT p.id, p.prescription_date, p.status, pa.name as patient_name, d.name as doctor_name FROM prescriptions p JOIN patients pa ON p.patient_id = pa.id JOIN doctors d ON p.doctor_id = d.id WHERE p.id = ?`;
    db.get(sql_presc, [id], (err, prescription) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!prescription) return res.status(404).json({ error: 'Resep tidak ditemukan' });
        const sql_items = `SELECT pi.quantity, pi.dosage_instruction, prod.id as product_id, prod.name, prod.price as price_per_item FROM prescription_items pi JOIN products prod ON pi.product_id = prod.id WHERE pi.prescription_id = ?`;
        db.all(sql_items, [id], (err, items) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ data: { ...prescription, items: items } });
        });
    });
});

// Helper function to find or create an entity
const getOrCreateId = (table: string, entity: { id?: number, name: string }, extra_cols: any = {}) => {
    return new Promise<number>((resolve, reject) => {
        if (entity.id) return resolve(entity.id);
        if (!entity.name || entity.name.trim() === '') return reject(new Error(`Nama entitas untuk tabel ${table} tidak boleh kosong.`));

        db.get(`SELECT id FROM ${table} WHERE name = ?`, [entity.name], (err, row: any) => {
            if (err) return reject(err);
            if (row) return resolve(row.id);

            const cols = ['name', ...Object.keys(extra_cols)];
            const values = [entity.name, ...Object.values(extra_cols)];
            const placeholders = cols.map(() => '?').join(',');

            db.run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, values, function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    });
};

app.post('/api/prescriptions', authenticateToken, authorizeRoles(['admin', 'pharmacist']), async (req: AuthRequest, res: Response) => {
    const { patient, doctor, prescription_date, items } = req.body;

    if (!patient || !doctor || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Data pasien, dokter, dan item resep harus lengkap.' });
    }

    try {
        const patientId = await getOrCreateId('patients', patient);
        const doctorId = await getOrCreateId('doctors', doctor);

        const itemPromises = items.map(async (item: any) => {
            const defaultProductData = {
                price: 0,
                stock_quantity: 0,
                sku: item.product.name.replace(/\s+/g, '-').toUpperCase() + '-AUTO'
            };
            const productId = await getOrCreateId('products', item.product, defaultProductData);
            return {
                product_id: productId,
                quantity: item.quantity,
                dosage_instruction: item.dosage_instruction
            };
        });

        const processedItems = await Promise.all(itemPromises);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run(`INSERT INTO prescriptions (patient_id, doctor_id, prescription_date) VALUES (?,?,?)`, [patientId, doctorId, prescription_date], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Gagal menyimpan resep.', details: err.message });
                }
                const prescriptionId = this.lastID;
                const presItemPromises = processedItems.map(item => {
                    return new Promise<void>((resolve, reject) => {
                        db.run(`INSERT INTO prescription_items (prescription_id, product_id, quantity, dosage_instruction) VALUES (?,?,?,?)`, 
                            [prescriptionId, item.product_id, item.quantity, item.dosage_instruction], 
                            (err) => { if (err) return reject(err); resolve(); });
                    });
                });

                Promise.all(presItemPromises)
                    .then(() => { 
                        db.run('COMMIT'); 
                        res.status(201).json({ message: 'Resep berhasil disimpan', prescription_id: prescriptionId }); 
                    })
                    .catch(error => { 
                        db.run('ROLLBACK'); 
                        res.status(400).json({ error: 'Gagal menyimpan item resep.', details: error.message }); 
                    });
            });
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Terjadi kesalahan saat memproses resep.', details: error.message });
    }
});


// === API LAPORAN ===
app.get('/api/reports/summary', authenticateToken, authorizeRoles(['admin', 'pharmacist', 'cashier']), (req: AuthRequest, res: Response) => {
    const today = new Date().toISOString().split('T')[0];
    interface SummaryRow { total?: number; count?: number; }
    const p1 = new Promise<number>((resolve) => db.get("SELECT SUM(total_amount) as total FROM sales WHERE date(created_at) = ?", [today], (err, row: SummaryRow) => resolve(row?.total || 0)));
    const p2 = new Promise<number>((resolve) => db.get("SELECT COUNT(*) as count FROM products WHERE stock_quantity < 10", (err, row: SummaryRow) => resolve(row?.count || 0)));
    const p3 = new Promise<number>((resolve) => db.get("SELECT COUNT(*) as count FROM prescriptions WHERE status = 'Baru'", (err, row: SummaryRow) => resolve(row?.count || 0)));
    Promise.all([p1, p2, p3]).then(([today_sales, low_stock_count, new_prescriptions]) => {
        res.json({ data: { today_sales, low_stock_count, new_prescriptions } });
    });
});
app.get('/api/reports/top-products', authenticateToken, authorizeRoles(['admin', 'pharmacist', 'cashier']), (req: AuthRequest, res: Response) => {
    const sql = `SELECT p.name, SUM(si.quantity) as total_sold FROM sale_items si JOIN products p ON si.product_id = p.id GROUP BY p.name ORDER BY total_sold DESC LIMIT 5`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});
app.get('/api/reports/sales-over-time', authenticateToken, authorizeRoles(['admin', 'pharmacist', 'cashier']), (req: AuthRequest, res: Response) => {
    const sql = `
        SELECT 
            strftime('%Y-%m-%d', created_at) as sale_date,
            SUM(total_amount) as daily_sales
        FROM sales
        WHERE created_at >= strftime('%Y-%m-%d %H:%M:%S', date('now', '-7 day'))
        GROUP BY sale_date
        ORDER BY sale_date ASC;
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});