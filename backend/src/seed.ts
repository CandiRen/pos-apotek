import bcrypt from 'bcryptjs';
import db from './database';

const seedDatabase = async () => {
    const hashedPassword = await bcrypt.hash('admin123', 10); // Password default: admin123

    db.serialize(() => {
        // Hapus user lama jika ada
        db.run(`DELETE FROM users WHERE username = 'admin'`);

        // Tambahkan user admin baru
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, 
            ['admin', hashedPassword, 'admin'], 
            function(err) {
                if (err) {
                    console.error("Error seeding admin user:", err.message);
                } else {
                    console.log(`Admin user 'admin' created with ID: ${this.lastID}`);
                }
            }
        );
    });
};

seedDatabase();