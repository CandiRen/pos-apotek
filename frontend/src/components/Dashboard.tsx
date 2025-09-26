import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api'; // Ganti import

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_URL = 'http://localhost:3001/api';

// ... (interface tetap sama)
interface Sale {
    id: number;
    total_amount: number;
    payment_method: string;
    created_at: string;
}

export default function Dashboard() {
    const [summary, setSummary] = useState({ today_sales: 0, low_stock_count: 0, new_prescriptions: 0 });
    const [topProducts, setTopProducts] = useState([]);
    const [salesChartData, setSalesChartData] = useState({
        labels: [],
        datasets: [{
            label: 'Penjualan Harian',
            data: [],
            backgroundColor: 'rgba(74, 144, 226, 0.7)',
            borderColor: 'rgba(74, 144, 226, 1)',
            borderWidth: 1,
        }]
    });
    const [isLoading, setIsLoading] = useState(true);
    const [showTodaySalesModal, setShowTodaySalesModal] = useState(false);
    const [todaySalesList, setTodaySalesList] = useState<Sale[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // Gunakan apiFetch untuk semua request
                const [summaryData, topProductsData, salesOverTimeData] = await Promise.all([
                    apiFetch(`${API_URL}/reports/summary`),
                    apiFetch(`${API_URL}/reports/top-products`),
                    apiFetch(`${API_URL}/reports/sales-over-time`)
                ]);

                setSummary(summaryData.data);
                setTopProducts(topProductsData.data);

                const labels = salesOverTimeData.data.map((item: any) => new Date(item.sale_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
                const data = salesOverTimeData.data.map((item: any) => item.daily_sales);

                setSalesChartData({
                    labels: labels,
                    datasets: [{
                        label: 'Penjualan Harian',
                        data: data,
                        backgroundColor: 'rgba(74, 144, 226, 0.7)',
                        borderColor: 'rgba(74, 144, 226, 1)',
                        borderWidth: 1,
                    }]
                });

            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const handleTodaySalesClick = () => {
        apiFetch(`${API_URL}/sales/today`) // Gunakan apiFetch
            .then(data => {
                setTodaySalesList(data.data || []);
                setShowTodaySalesModal(true);
            })
            .catch(err => console.error("Error fetching today's sales:", err));
    };

    // ... (return JSX tetap sama)
    if (isLoading) {
        return (
            <div className="spinner-container">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid h-100">
            <h2 className="mb-4">Dashboard Apotek</h2>
            <div className="row mb-4">
                <div className="col-12 col-md-6 col-lg-4 mb-3">
                    <div className="card bg-primary-custom h-100 clickable-card" onClick={handleTodaySalesClick}>
                        <div className="card-body d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="card-title">Penjualan Hari Ini</h5>
                                <h2>Rp {summary.today_sales.toLocaleString('id-ID')}</h2>
                            </div>
                            <i className="bi bi-currency-dollar icon-large"></i>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-6 col-lg-4 mb-3">
                    <div className="card bg-warning-custom h-100">
                        <div className="card-body d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="card-title">Produk Stok Menipis (&lt;10)</h5>
                                <h2>{summary.low_stock_count}</h2>
                            </div>
                            <i className="bi bi-box-seam icon-large"></i>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-6 col-lg-4 mb-3">
                    <div className="card bg-info-custom h-100">
                        <div className="card-body d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="card-title">Resep Baru</h5>
                                <h2>{summary.new_prescriptions}</h2>
                            </div>
                            <i className="bi bi-journal-medical icon-large"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-12 col-lg-6 mb-3">
                    <div className="card h-100">
                        <div className="card-header"><h4>Produk Terlaris</h4></div>
                        <div className="card-body">
                            <table className="table table-striped">
                                <thead><tr><th>Nama Produk</th><th>Total Terjual</th></tr></thead>
                                <tbody>
                                    {topProducts.map((p: any, index: number) => (
                                        <tr key={index}><td>{p.name}</td><td>{p.total_sold}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-lg-6 mb-3">
                    <div className="card h-100">
                        <div className="card-header"><h4>Grafik Penjualan 7 Hari Terakhir</h4></div>
                        <div className="card-body">
                            <Bar data={salesChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* === MODAL DETAIL PENJUALAN HARI INI === */}
            {showTodaySalesModal && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Detail Penjualan Hari Ini</h5>
                                <button type="button" className="btn-close" onClick={() => setShowTodaySalesModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                {todaySalesList.length > 0 ? (
                                    <table className="table table-striped">
                                        <thead>
                                            <tr>
                                                <th>ID Transaksi</th>
                                                <th>Waktu</th>
                                                <th>Total</th>
                                                <th>Pembayaran</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {todaySalesList.map(sale => (
                                                <tr key={sale.id}>
                                                    <td>#{sale.id}</td>
                                                    <td>{new Date(sale.created_at).toLocaleTimeString('id-ID')}</td>
                                                    <td>Rp {sale.total_amount.toLocaleString('id-ID')}</td>
                                                    <td>{sale.payment_method}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="text-center">Tidak ada penjualan hari ini.</p>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowTodaySalesModal(false)}>Tutup</button>
                                <button type="button" className="btn btn-primary" onClick={() => { navigate('/history'); setShowTodaySalesModal(false); }}>Lihat Riwayat Lengkap</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}