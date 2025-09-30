
import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api'; // Ganti import

const API_URL = 'http://localhost:3001/api';

// ... (interfaces tetap sama)
interface Product {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
  price: number;
}

interface CartItem {
  product_id: number;
  name: string;
  quantity: number;
  price_per_item: number;
}

interface SaleDetailItem {
    name: string;
    quantity: number;
    price_per_item: number;
}

interface SaleDetail {
    id: number;
    total_amount: number;
    discount_amount: number;
    subtotal_amount?: number;
    payment_method: string;
    created_at: string;
    items: SaleDetailItem[];
}

export default function Cashier() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state && location.state.cartItems) {
      setCart(location.state.cartItems);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.price_per_item, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (subtotal <= 0) return 0;
    if (discountType === 'percent') {
      const boundedPercent = Math.min(Math.max(discountValue, 0), 100);
      return parseFloat(((subtotal * boundedPercent) / 100).toFixed(2));
    }
    const boundedAmount = Math.max(0, discountValue);
    return Math.min(subtotal, boundedAmount);
  }, [discountType, discountValue, subtotal]);

  const total = useMemo(() => {
    if (subtotal <= 0) return 0;
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  useEffect(() => {
    setIsLoadingProducts(true);
    const handler = setTimeout(() => {
      apiFetch(`${API_URL}/products?search=${searchTerm}`) // Gunakan apiFetch
        .then(data => { setProducts(data.data || []); })
        .catch(err => console.error(err))
        .finally(() => setIsLoadingProducts(false));
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === product.id);
      if (existingItem) {
        return prevCart.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prevCart, { product_id: product.id, name: product.name, quantity: 1, price_per_item: product.price }];
      }
    });
  };

  const handleDiscountTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as 'amount' | 'percent';
    if (nextType === discountType) return;

    const currentDiscountAmount = discountAmount;

    if (nextType === 'amount') {
      setDiscountValue(parseFloat(currentDiscountAmount.toFixed(2)));
    } else {
      const percentage = subtotal === 0 ? 0 : (currentDiscountAmount / subtotal) * 100;
      setDiscountValue(parseFloat(percentage.toFixed(2)));
    }

    setDiscountType(nextType);
  };

  const handleDiscountValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);

    if (Number.isNaN(rawValue)) {
      setDiscountValue(0);
      return;
    }

    if (discountType === 'percent') {
      const bounded = Math.min(Math.max(rawValue, 0), 100);
      setDiscountValue(bounded);
    } else {
      setDiscountValue(Math.max(0, rawValue));
    }
  };

  const completeTransaction = () => {
    if (cart.length === 0) { alert('Keranjang masih kosong!'); return; }
    setShowConfirmModal(true);
  };

  const handleConfirmAndComplete = () => {
    const transactionData = { total_amount: total, discount_amount: discountAmount, payment_method: 'Tunai', items: cart };
    apiFetch(`${API_URL}/sales`, { method: 'POST', body: JSON.stringify(transactionData) }) // Gunakan apiFetch
    .then(data => {
      setLastSaleId(data.sale_id);
      setShowConfirmModal(false);
      setShowSuccessModal(true);
      setCart([]);
      setDiscountValue(0);
    })
    .catch(err => { alert(`Terjadi kesalahan: ${err.message}`); setShowConfirmModal(false); });
  };

  const handlePrintReceipt = async () => {
    if (!lastSaleId) return;

    try {
        const data = await apiFetch(`${API_URL}/sales/${lastSaleId}`); // Gunakan apiFetch
        const sale: SaleDetail = data.data;
        const subtotalAmount = sale.subtotal_amount ?? sale.items.reduce((sum, item) => sum + item.quantity * item.price_per_item, 0);
        const discountValue = sale.discount_amount || 0;
        const discountDisplay = discountValue > 0
            ? `- Rp ${discountValue.toLocaleString('id-ID')}`
            : `Rp ${discountValue.toLocaleString('id-ID')}`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert('Pop-up diblokir. Izinkan pop-up untuk mencetak struk.'); return; }

        // ... (Konten struk tetap sama)
        let receiptContent = `
            <html>
            <head>
                <title>Struk Pembelian #${sale.id}</title>
                <style>
                    body { font-family: 'monospace'; font-size: 12px; margin: 0; padding: 10px; }
                    .header { text-align: center; margin-bottom: 10px; }
                    .item-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    .item-table th, .item-table td { border-bottom: 1px dashed #ccc; padding: 5px 0; text-align: left; }
                    .item-table th:nth-child(2), .item-table td:nth-child(2) { text-align: center; }
                    .item-table th:nth-child(3), .item-table td:nth-child(3) { text-align: right; }
                    .item-table th:nth-child(4), .item-table td:nth-child(4) { text-align: right; }
                    .total { text-align: right; margin-top: 10px; font-size: 14px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h3>APOTEK GEMINI</h3>
                    <p>Jl. Contoh No. 123, Kota Contoh</p>
                    <p>Telp: (021) 1234567</p>
                    <p>------------------------------------</p>
                    <p>STRUK PEMBELIAN</p>
                    <p>------------------------------------</p>
                </div>
                <p>ID Transaksi: #${sale.id}</p>
                <p>Tanggal: ${new Date(sale.created_at).toLocaleString('id-ID')}</p>
                <p>Pembayaran: ${sale.payment_method}</p>
                <table class="item-table">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th>Qty</th>
                            <th>Harga</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sale.items.forEach(item => {
            receiptContent += `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>${item.price_per_item.toLocaleString('id-ID')}</td>
                            <td>${(item.quantity * item.price_per_item).toLocaleString('id-ID')}</td>
                        </tr>
            `;
        });

        receiptContent += `
                    </tbody>
                </table>
                <p style="text-align:right; margin-top:10px;">Subtotal: Rp ${subtotalAmount.toLocaleString('id-ID')}</p>
                <p style="text-align:right; margin:0;">Diskon: ${discountDisplay}</p>
                <div class="total">
                    Total: Rp ${sale.total_amount.toLocaleString('id-ID')}
                </div>
                <div class="footer">
                    <p>------------------------------------</p>
                    <p>Terima Kasih Atas Kunjungan Anda!</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(receiptContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();

    } catch (error) {
        console.error("Error printing receipt:", error);
        alert("Gagal mencetak struk.");
    }
  };

  // ... (return JSX tetap sama)
  return (
    <div className="container-fluid h-100">
      <div className="row h-100">
        <div className="col-12 col-md-7 h-100 mb-3 mb-md-0">
          <div className="card h-100 d-flex flex-column">
            <div className="card-header"><h4>Pilih Produk</h4></div>
            <div className="card-body d-flex flex-column flex-grow-1">
              <input type="text" className="form-control mb-3" placeholder="Cari berdasarkan nama atau SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <div className="list-group flex-grow-1" style={{overflowY: 'auto'}}>
                {isLoadingProducts ? (
                    <div className="spinner-container"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>
                ) : products.length > 0 ? (
                    products.map(product => (
                        <button key={product.id} type="button" className="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onClick={() => addToCart(product)} disabled={product.stock_quantity <= 0}>
                            <div><h6 className="mb-1">{product.name}</h6><small>Stok: {product.stock_quantity}</small></div>
                            <span className="fw-bold">Rp {product.price.toLocaleString('id-ID')}</span>
                        </button>
                    ))
                ) : (
                    <div className="text-center text-muted">Tidak ada produk ditemukan.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-5 h-100">
          <div className="card h-100 d-flex flex-column">
            <div className="card-header"><h4>Keranjang</h4></div>
            <div className="card-body d-flex flex-column flex-grow-1">
              <div className="flex-grow-1" style={{overflowY: 'auto'}}>
                <ul className="list-group mb-3">
                  {cart.map(item => (
                    <li key={item.product_id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div><h6 className="my-0">{item.name}</h6><small className="text-muted">Rp {item.price_per_item.toLocaleString('id-ID')} x {item.quantity}</small></div>
                      <span className="text-muted">Rp {(item.quantity * item.price_per_item).toLocaleString('id-ID')}</span>
                    </li>
                  ))}
                  {cart.length === 0 && <li className="list-group-item">Keranjang kosong</li>}
                </ul>
              </div>
              <div className="flex-shrink-0">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Subtotal</span>
                  <strong>Rp {subtotal.toLocaleString('id-ID')}</strong>
                </div>
                <div className="mb-3">
                  <label className="form-label">Diskon</label>
                  <div className="input-group">
                    <select className="form-select flex-shrink-0" style={{ maxWidth: '140px' }} value={discountType} onChange={handleDiscountTypeChange}>
                      <option value="amount">Nominal</option>
                      <option value="percent">Persen</option>
                    </select>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step={discountType === 'percent' ? '0.1' : '1'}
                      value={discountValue}
                      onChange={handleDiscountValueChange}
                    />
                    <span className="input-group-text">{discountType === 'percent' ? '%' : 'Rp'}</span>
                  </div>
                  <small className="text-muted">Diskon terhitung: Rp {discountAmount.toLocaleString('id-ID')}</small>
                </div>
                <h4 className="d-flex justify-content-between align-items-center mb-3"><span>Total</span><strong>Rp {total.toLocaleString('id-ID')}</strong></h4>
                <button className="btn btn-primary btn-lg w-100" onClick={completeTransaction} disabled={cart.length === 0 || subtotal <= 0}>Selesaikan Transaksi</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === MODAL KONFIRMASI TRANSAKSI === */}
      {showConfirmModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Konfirmasi Transaksi</h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirmModal(false)}></button>
              </div>
              <div className="modal-body">
                <h6>Detail Pembelian:</h6>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Qty</th>
                      <th>Harga</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>Rp {item.price_per_item.toLocaleString('id-ID')}</td>
                        <td>Rp {(item.quantity * item.price_per_item).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="d-flex justify-content-between mt-3">
                  <span>Subtotal</span>
                  <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="d-flex justify-content-between text-danger">
                  <span>Diskon</span>
                  <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
                </div>
                <h5 className="text-end mt-3">Total Pembelian: Rp {total.toLocaleString('id-ID')}</h5>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={handleConfirmAndComplete}>Konfirmasi & Selesaikan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL TRANSAKSI BERHASIL === */}
      {showSuccessModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Transaksi Berhasil!</h5>
                <button type="button" className="btn-close" onClick={() => setShowSuccessModal(false)}></button>
              </div>
              <div className="modal-body text-center">
                <p>Transaksi Anda dengan ID <strong>#{lastSaleId}</strong> telah berhasil diproses.</p>
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3rem' }}></i>
              </div>
              <div className="modal-footer justify-content-center">
                <button type="button" className="btn btn-primary" onClick={handlePrintReceipt}>Cetak Struk</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSuccessModal(false)}>Transaksi Baru</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
