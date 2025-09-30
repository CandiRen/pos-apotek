import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
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

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

      <div className="card h-100 d-flex flex-column">
        <div className="card-header">
          <h3>Manajemen Produk</h3>
        </div>
        <div className="card-body d-flex flex-column flex-grow-1">
          <div className="row mb-3 flex-shrink-0">
            <div className="col-12 col-md-6 mb-2 mb-md-0">
                <button className="btn btn-success w-100" onClick={handleAddNew}>Tambah Produk</button>
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
