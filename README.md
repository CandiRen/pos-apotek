
# Apotek POS - Sistem Point of Sale Apotek

Selamat datang di Apotek POS, sebuah aplikasi web Point of Sale (POS) lengkap yang dirancang khusus untuk kebutuhan apotek. Aplikasi ini dibangun dengan arsitektur modern yang memisahkan antara backend dan frontend, memberikan skalabilitas dan kemudahan pengembangan.

## Fitur Utama

- **Dashboard Informatif**: Menampilkan ringkasan penjualan harian, jumlah produk dengan stok menipis, dan jumlah resep baru yang masuk.
- **Grafik Analitik**: Visualisasi data penjualan selama 7 hari terakhir dan daftar produk terlaris untuk membantu pengambilan keputusan.
- **Manajemen Produk**: Operasi CRUD (Create, Read, Update, Delete) penuh untuk produk, termasuk informasi SKU, stok, harga, tanggal kedaluwarsa, dan pemasok.
- **Sistem Kasir (Cashier)**: Antarmuka yang cepat dan mudah digunakan untuk transaksi penjualan, dengan perhitungan total otomatis dan manajemen keranjang belanja.
- **Manajemen Resep**: Mengelola resep dari dokter, termasuk data pasien, dokter, dan item obat yang diresepkan. Resep dapat langsung "ditebus" melalui sistem kasir.
- **Riwayat Penjualan**: Mencatat semua transaksi yang terjadi, dengan kemampuan untuk melihat detail setiap transaksi dan mencetak ulang struk.
- **Cetak Struk & Resep**: Fungsionalitas untuk mencetak struk belanja dan salinan resep langsung dari browser.
- **Sistem Autentikasi & Otorisasi**: Keamanan berbasis peran (admin, pharmacist, cashier) menggunakan JSON Web Tokens (JWT) untuk melindungi endpoint API.

---

## Teknologi yang Digunakan

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Bahasa**: TypeScript
- **Database**: SQLite 3
- **Autentikasi**: JSON Web Token (JWT), bcryptjs
- **Lainnya**: `cors`, `ts-node`, `nodemon`

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Bahasa**: TypeScript (TSX)
- **Routing**: React Router DOM
- **Styling**: Bootstrap 5 & Bootstrap Icons
- **Grafik**: Chart.js & react-chartjs-2

---

## Prasyarat

Pastikan Anda telah menginstal perangkat lunak berikut di mesin Anda:
- [Node.js](https://nodejs.org/) (disarankan versi LTS)
- npm (biasanya terinstal bersama Node.js)

---

## Instalasi dan Menjalankan Proyek

Proyek ini terdiri dari dua bagian, `backend` dan `frontend`, yang harus dijalankan secara terpisah di terminal yang berbeda.

### 1. Backend Setup

Buka terminal pertama Anda:

```bash
# 1. Masuk ke direktori backend
cd backend

# 2. Instal semua dependensi yang dibutuhkan
npm install

# 3. (HANYA SEKALI) Jalankan seeder untuk membuat pengguna 'admin' awal
# Kredensial default: admin / admin123
npm run seed

# 4. Jalankan server backend dalam mode development
# Server akan berjalan di http://localhost:3001
npm run dev
```

Biarkan terminal ini tetap berjalan.

### 2. Frontend Setup

Buka terminal **kedua** Anda:

```bash
# 1. Masuk ke direktori frontend
cd frontend

# 2. Instal semua dependensi yang dibutuhkan
npm install

# 3. Jalankan server pengembangan frontend
# Aplikasi akan dapat diakses di http://localhost:5173 (atau port lain yang ditampilkan)
npm run dev
```

Biarkan terminal kedua ini juga tetap berjalan.

---

## Cara Menggunakan Aplikasi

1.  Buka browser Anda dan akses URL yang diberikan oleh server frontend (biasanya `http://localhost:5173`).
2.  Anda akan disambut oleh halaman login.
3.  Gunakan kredensial default untuk masuk:
    -   **Username**: `admin`
    -   **Password**: `admin123`
4.  Setelah berhasil login, Anda akan diarahkan ke Dashboard utama dan dapat mulai menjelajahi semua fitur aplikasi.

---

## Lisensi

Proyek ini dilisensikan di bawah [ISC License](LICENSE).
