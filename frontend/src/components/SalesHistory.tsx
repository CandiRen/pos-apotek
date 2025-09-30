import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

const API_URL = 'http://localhost:3001/api';

interface Sale {
    id: number;
    total_amount: number;
    discount_amount: number;
    item_discount_total?: number;
    payment_method: string;
    created_at: string;
}

interface SaleItem {
    name: string;
    quantity: number;
    price_per_item: number;
    discount_amount: number;
}

interface SaleDetail extends Sale {
    items: SaleItem[];
    subtotal_amount?: number;
}

export default function SalesHistory() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);

    const subtotalForSelectedSale = selectedSale
        ? selectedSale.subtotal_amount ?? selectedSale.items.reduce((sum, item) => sum + (item.quantity * item.price_per_item) - (item.discount_amount || 0), 0)
        : 0;
    const itemDiscountForSelectedSale = selectedSale
        ? selectedSale.item_discount_total ?? selectedSale.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0)
        : 0;
    const grossSubtotalForSelectedSale = subtotalForSelectedSale + itemDiscountForSelectedSale;
    const discountForSelectedSale = selectedSale?.discount_amount ?? 0;

    const fetchSales = () => {
        setIsLoading(true);
        apiFetch(`${API_URL}/sales`)
            .then(data => {
                setSales(data.data || []);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Error fetching sales history:', err);
                setIsLoading(false);
            });
    };

    useEffect(() => {
        fetchSales();
    }, []);

    const handleShowDetails = (id: number) => {
        apiFetch(`${API_URL}/sales/${id}`)
            .then(data => {
                if (data.data) {
                    setSelectedSale(data.data);
                    setShowDetailModal(true);
                }
            })
            .catch(err => console.error('Error fetching sale details:', err));
    };

    const handlePrintReceipt = async () => {
        if (!selectedSale) return;

        try {
            const printWindow = window.open('', '_blank');
            if (!printWindow) { alert('Pop-up diblokir. Izinkan pop-up untuk mencetak struk.'); return; }

            const subtotalAmount = selectedSale.subtotal_amount ?? selectedSale.items.reduce((sum, item) => sum + (item.quantity * item.price_per_item) - (item.discount_amount || 0), 0);
            const itemDiscountTotal = selectedSale.item_discount_total ?? selectedSale.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
            const grossSubtotal = subtotalAmount + itemDiscountTotal;
            const saleDiscountValue = selectedSale.discount_amount || 0;
            const saleDiscountDisplay = saleDiscountValue > 0
                ? `- Rp ${saleDiscountValue.toLocaleString('id-ID')}`
                : `Rp ${saleDiscountValue.toLocaleString('id-ID')}`;

            let receiptContent = `
                <html>
                <head>
                    <title>Struk Pembelian #${selectedSale.id}</title>
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
                    <p>ID Transaksi: #${selectedSale.id}</p>
                    <p>Tanggal: ${new Date(selectedSale.created_at).toLocaleString('id-ID')}</p>
                    <p>Pembayaran: ${selectedSale.payment_method}</p>
                    <table class="item-table">
                        <thead>
                            <tr>
                                <th>Produk</th>
                                <th>Qty</th>
                                <th>Harga</th>
                                <th>Diskon</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            selectedSale.items.forEach(item => {
                const lineGross = item.quantity * item.price_per_item;
                const lineDiscount = item.discount_amount || 0;
                const lineNet = lineGross - lineDiscount;
                receiptContent += `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>${item.price_per_item.toLocaleString('id-ID')}</td>
                                <td>${lineDiscount.toLocaleString('id-ID')}</td>
                                <td>${lineNet.toLocaleString('id-ID')}</td>
                            </tr>
                `;
            });

            receiptContent += `
                        </tbody>
                    </table>
                    <p style="text-align:right; margin-top:10px;">Subtotal (Kotor): Rp ${grossSubtotal.toLocaleString('id-ID')}</p>
                    <p style="text-align:right; margin:0;">Diskon Item: - Rp ${itemDiscountTotal.toLocaleString('id-ID')}</p>
                    <p style="text-align:right; margin:0;">Subtotal (Bersih): Rp ${subtotalAmount.toLocaleString('id-ID')}</p>
                    <p style="text-align:right; margin:0;">Diskon Transaksi: ${saleDiscountDisplay}</p>
                    <div class="total">
                        Total: Rp ${selectedSale.total_amount.toLocaleString('id-ID')}
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

    return (
        <div className="container-fluid h-100">
            {/* === MODAL DETAIL STRUK === */}
            {showDetailModal && selectedSale && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Detail Transaksi #{selectedSale.id}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowDetailModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p><strong>Tanggal:</strong> {new Date(selectedSale.created_at).toLocaleString('id-ID')}</p>
                                <p><strong>Metode Pembayaran:</strong> {selectedSale.payment_method}</p>
                                <hr />
                                <h6>Item Terjual:</h6>
                                <table className="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Produk</th>
                                            <th>Jumlah</th>
                                            <th>Harga Satuan</th>
                                            <th>Diskon</th>
                                            <th>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSale.items.map((item, index) => (
                                            <tr key={index}>
                                                <td>{item.name}</td>
                                                <td>{item.quantity}</td>
                                                <td>Rp {item.price_per_item.toLocaleString('id-ID')}</td>
                                                <td>Rp {(item.discount_amount || 0).toLocaleString('id-ID')}</td>
                                                <td>Rp {((item.quantity * item.price_per_item) - (item.discount_amount || 0)).toLocaleString('id-ID')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="d-flex justify-content-between mt-3">
                                    <span>Subtotal (Kotor)</span>
                                    <span>Rp {grossSubtotalForSelectedSale.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="d-flex justify-content-between text-danger">
                                    <span>Diskon Item</span>
                                    <span>- Rp {itemDiscountForSelectedSale.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="d-flex justify-content-between mt-1">
                                    <span>Subtotal (Bersih)</span>
                                    <span>Rp {subtotalForSelectedSale.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="d-flex justify-content-between text-danger">
                                    <span>Diskon Transaksi</span>
                                    <span>- Rp {discountForSelectedSale.toLocaleString('id-ID')}</span>
                                </div>
                                <h5 className="text-end mt-3">Total: Rp {selectedSale.total_amount.toLocaleString('id-ID')}</h5>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowDetailModal(false)}>Tutup</button>
                                <button type="button" className="btn btn-primary" onClick={handlePrintReceipt}>Cetak Struk</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === TABEL RIWAYAT PENJUALAN === */}
            <div className="card h-100 d-flex flex-column">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h3>Riwayat Penjualan</h3>
                </div>
                <div className="card-body d-flex flex-column flex-grow-1">
                    <div className="table-responsive flex-grow-1" style={{overflowY: 'auto'}}>
                        <table className="table table-striped table-hover">
                            <thead className="table-dark">
                                <tr>
                                    <th>ID Transaksi</th>
                                    <th>Tanggal</th>
                                    <th>Total</th>
                                    <th>Pembayaran</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={5} className="text-center">Loading...</td></tr>
                                ) : sales.length > 0 ? (
                                    sales.map(sale => (
                                        <tr key={sale.id}>
                                            <td>#{sale.id}</td>
                                            <td>{new Date(sale.created_at).toLocaleString('id-ID')}</td>
                                            <td>Rp {sale.total_amount.toLocaleString('id-ID')}</td>
                                            <td>{sale.payment_method}</td>
                                            <td>
                                                <button className="btn btn-sm btn-info" onClick={() => handleShowDetails(sale.id)}>Lihat Detail</button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={5} className="text-center">Belum ada transaksi penjualan.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
