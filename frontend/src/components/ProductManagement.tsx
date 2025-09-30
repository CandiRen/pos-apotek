import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { apiFetch } from '../api'; // Ganti import fetch standar

const API_URL = 'http://localhost:3001/api';

// ... (interface dan konstanta tetap sama)
interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  stock_quantity: number;
  price: number;
  expiry_date: string;
  supplier: string;
}

type EditableProduct = Partial<Product>;

const BLANK_PRODUCT: EditableProduct = {
  name: '',
  sku: '',
  category: 'Obat Bebas',
  stock_quantity: 0,
  price: 0,
  expiry_date: '',
  supplier: ''
};

const REQUIRED_HEADERS = ['name', 'sku', 'stock_quantity', 'price'];
const OPTIONAL_HEADERS = ['category', 'expiry_date', 'supplier'];

const parseCsvLine = (line: string) => {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseCsvText = (text: string) => {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return { rows: [] as EditableProduct[], errors: ['File CSV harus memiliki header dan minimal satu data.'] };
  }

  const headerCells = parseCsvLine(lines[0]).map(header => header.toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter(header => !headerCells.includes(header));
  if (missingHeaders.length > 0) {
    return { rows: [] as EditableProduct[], errors: [`Kolom wajib berikut tidak ditemukan: ${missingHeaders.join(', ')}`] };
  }

  const validHeaders = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
  const invalidHeaders = headerCells.filter(header => !validHeaders.includes(header));
  if (invalidHeaders.length > 0) {
    return { rows: [] as EditableProduct[], errors: [`Kolom tidak dikenal: ${invalidHeaders.join(', ')}`] };
  }

  const rows: EditableProduct[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, index) => {
    const cells = parseCsvLine(line);
    if (cells.length === 0) return;

    const row: Record<string, string> = {};
    headerCells.forEach((header, cellIndex) => {
      row[header] = cells[cellIndex]?.trim() ?? '';
    });

    const rowNumber = index + 2; // +2 karena header adalah baris pertama
    const stockQuantity = Number(row.stock_quantity);
    const price = Number(row.price);

    if (!row.name) errors.push(`Baris ${rowNumber}: kolom name wajib diisi.`);
    if (!row.sku) errors.push(`Baris ${rowNumber}: kolom sku wajib diisi.`);
    if (!Number.isFinite(stockQuantity)) errors.push(`Baris ${rowNumber}: kolom stock_quantity harus angka.`);
    if (!Number.isFinite(price)) errors.push(`Baris ${rowNumber}: kolom price harus angka.`);

    rows.push({
      name: row.name,
      sku: row.sku,
      category: row.category || 'Obat Bebas',
      stock_quantity: Number.isFinite(stockQuantity) ? Math.max(0, Math.round(stockQuantity)) : 0,
      price: Number.isFinite(price) ? Math.max(0, price) : 0,
      expiry_date: row.expiry_date || '',
      supplier: row.supplier || ''
    });
  });

  return { rows, errors };
};

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<EditableProduct[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<{ total: number; inserted: number; updated: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState<EditableProduct>(BLANK_PRODUCT);

  const fetchProducts = (searchQuery = '') => {
    setIsLoading(true);
    const url = `${API_URL}/products?search=${searchQuery}`;
    apiFetch(url) // Gunakan apiFetch
      .then(data => {
        setProducts(data.data || []);
      })
      .catch(err => {
        console.error(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts(searchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddNew = () => {
    setIsEditing(false);
    setFormData(BLANK_PRODUCT);
    setShowModal(true);
  };

  const handleEdit = (product: Product) => {
    setIsEditing(true);
    setFormData(product);
    setShowModal(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const url = isEditing ? `${API_URL}/products/${formData.id}` : `${API_URL}/products`;
    const method = isEditing ? 'PUT' : 'POST';

    apiFetch(url, { // Gunakan apiFetch
      method: method,
      body: JSON.stringify(formData)
    })
    .then(() => {
      setShowModal(false);
      fetchProducts(searchTerm);
    })
    .catch(err => console.error('Error saving product:', err));
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
      apiFetch(`${API_URL}/products/${id}`, { method: 'DELETE' }) // Gunakan apiFetch
        .then(() => fetchProducts(searchTerm))
        .catch(err => console.error('Error deleting product:', err));
    }
  };

  const handleOpenImport = () => {
    setShowImportModal(true);
    setImportRows([]);
    setImportErrors([]);
    setImportSummary(null);
  };

  const handleCloseImport = () => {
    if (isUploading) return;
    setShowImportModal(false);
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImportRows([]);
      setImportErrors([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const { rows, errors } = parseCsvText(text);
      setImportRows(rows);
      setImportErrors(errors);
      setImportSummary(null);
    };
    reader.onerror = () => {
      setImportRows([]);
      setImportErrors(['Gagal membaca file.']);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleUploadImport = () => {
    if (importErrors.length > 0 || importRows.length === 0) return;
    setIsUploading(true);
    apiFetch(`${API_URL}/products/bulk`, {
      method: 'POST',
      body: JSON.stringify({ products: importRows })
    })
      .then(response => {
        const summary = response.summary || { total: importRows.length, inserted: 0, updated: 0 };
        setImportSummary(summary);
        fetchProducts(searchTerm);
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        setImportErrors([message]);
      })
      .finally(() => {
        setIsUploading(false);
      });
  };

  const previewRows = importRows.slice(0, 10);
  
  // ... (return JSX tetap sama)
  return (
    <div className="container-fluid h-100">
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{isEditing ? 'Edit Produk' : 'Tambah Produk Baru'}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                 <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-12 col-md-6 mb-3">
                      <label className="form-label">Nama Produk</label>
                      <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="form-control" required />
                    </div>
                    <div className="col-12 col-md-6 mb-3">
                      <label className="form-label">SKU (Barcode)</label>
                      <input type="text" name="sku" value={formData.sku} onChange={handleInputChange} className="form-control" required />
                    </div>
                  </div>
                  <div className="row">
                     <div className="col-12 col-md-6 mb-3">
                      <label className="form-label">Kategori</label>
                      <select name="category" value={formData.category} onChange={handleInputChange} className="form-select">
                        <option>Obat Bebas</option>
                        <option>Obat Keras</option>
                        <option>Obat Bebas Terbatas</option>
                        <option>Alat Kesehatan</option>
                        <option>Lainnya</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-6 mb-3">
                      <label className="form-label">Pemasok (Supplier)</label>
                      <input type="text" name="supplier" value={formData.supplier} onChange={handleInputChange} className="form-control" />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-12 col-md-4 mb-3">
                      <label className="form-label">Jumlah Stok</label>
                      <input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleInputChange} className="form-control" required />
                    </div>
                    <div className="col-12 col-md-4 mb-3">
                      <label className="form-label">Harga Jual (Rp)</label>
                      <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="form-control" required />
                    </div>
                    <div className="col-12 col-md-4 mb-3">
                      <label className="form-label">Tgl Kedaluwarsa</label>
                      <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleInputChange} className="form-control" />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                    <button type="submit" className="btn btn-primary">Simpan</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Import Produk dari CSV</h5>
                <button type="button" className="btn-close" onClick={handleCloseImport} disabled={isUploading}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted">Gunakan file CSV dengan header: <code>name, sku, category, stock_quantity, price, expiry_date, supplier</code>.</p>
                <div className="mb-3">
                  <label className="form-label">Pilih File CSV</label>
                  <input type="file" className="form-control" accept=".csv" onChange={handleFileSelected} disabled={isUploading} />
                </div>

                {importErrors.length > 0 && (
                  <div className="alert alert-danger" role="alert">
                    <strong>Terjadi kesalahan:</strong>
                    <ul className="mb-0">
                      {importErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importSummary && (
                  <div className="alert alert-success" role="alert">
                    <p className="mb-0">Import selesai. Total {importSummary.total} baris diproses.</p>
                    <p className="mb-0">Produk baru: {importSummary.inserted}, diperbarui: {importSummary.updated}.</p>
                  </div>
                )}

                {previewRows.length > 0 && (
                  <div className="table-responsive" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    <table className="table table-sm table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>Nama</th>
                          <th>SKU</th>
                          <th>Kategori</th>
                          <th>Stok</th>
                          <th>Harga</th>
                          <th>Kedaluwarsa</th>
                          <th>Supplier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, index) => (
                          <tr key={`${row.sku}-${index}`}>
                            <td>{row.name}</td>
                            <td>{row.sku}</td>
                            <td>{row.category}</td>
                            <td>{row.stock_quantity}</td>
                            <td>Rp {Number(row.price || 0).toLocaleString('id-ID')}</td>
                            <td>{row.expiry_date}</td>
                            <td>{row.supplier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRows.length > previewRows.length && (
                      <small className="text-muted">Menampilkan 10 baris pertama dari {importRows.length}.</small>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseImport} disabled={isUploading}>Tutup</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUploadImport}
                  disabled={isUploading || importRows.length === 0 || importErrors.length > 0}
                >
                  {isUploading ? 'Mengunggah...' : 'Unggah Produk'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card h-100 d-flex flex-column">
        <div className="card-header">
          <h3>Manajemen Produk</h3>
        </div>
        <div className="card-body d-flex flex-column flex-grow-1">
          <div className="row mb-3 flex-shrink-0 g-2">
            <div className="col-12 col-md-3">
                <button className="btn btn-success w-100" onClick={handleAddNew}>Tambah Produk</button>
            </div>
            <div className="col-12 col-md-3">
                <button className="btn btn-outline-primary w-100" onClick={handleOpenImport}>Import Produk (CSV)</button>
            </div>
            <div className="col-12 col-md-6">
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Cari produk berdasarkan nama atau SKU..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          <div className="table-responsive flex-grow-1" style={{overflowY: 'auto'}}>
            <table className="table table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  <th>Nama</th>
                  <th>SKU</th>
                  <th>Kategori</th>
                  <th>Stok</th>
                  <th>Harga</th>
                  <th>Tgl Kedaluwarsa</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center">Loading...</td></tr>
                ) : products.length > 0 ? (
                  products.map(product => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.sku}</td>
                      <td>{product.category}</td>
                      <td>{product.stock_quantity}</td>
                      <td>Rp {product.price.toLocaleString('id-ID')}</td>
                      <td>{product.expiry_date}</td>
                      <td>
                        <button className="btn btn-sm btn-primary me-2" onClick={() => handleEdit(product)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(product.id)}>Hapus</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="text-center">Produk tidak ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
