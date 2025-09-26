
// Utility untuk mendapatkan token dari localStorage
const getToken = () => localStorage.getItem('authToken');

// Fungsi fetch wrapper
export const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = getToken();

    // Siapkan header default
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Jika token ada, tambahkan ke header Authorization
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // Jika response adalah 401 Unauthorized, logout pengguna
    if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        // Reload halaman dan arahkan ke login
        window.location.href = '/login'; 
        // Lemparkan error agar promise chain berhenti
        throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
    }

    // Coba parsing response sebagai JSON
    try {
        const data = await response.json();
        if (!response.ok) {
            // Lemparkan error dengan pesan dari server jika ada
            throw new Error(data.message || 'Terjadi kesalahan pada server');
        }
        return data;
    } catch (error) {
        // Jika parsing JSON gagal, mungkin response bukan JSON
        // Cek jika error bukan karena kita yang melemparnya
        if (error instanceof Error && error.message.includes('Sesi Anda')) {
            throw error; // Lemparkan kembali error sesi berakhir
        }
        // Jika response tidak OK dan bukan JSON, lemparkan error umum
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Jika response OK tapi parsing gagal (misal, body kosong)
        return {}; // Kembalikan objek kosong atau sesuai kebutuhan
    }
};

// Contoh penggunaan:
// apiFetch('/api/products').then(data => console.log(data));
// apiFetch('/api/products', { method: 'POST', body: JSON.stringify(productData) });
