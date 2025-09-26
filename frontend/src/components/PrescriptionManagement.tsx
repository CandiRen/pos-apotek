import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3001/api';

// === INTERFACES ===
interface Prescription { id: number; prescription_date: string; status: string; patient_name: string; doctor_name: string; }
interface Patient { id: number; name: string; phone_number: string; }
interface Doctor { id: number; name: string; license_number: string; }
interface Product { id: number; name: string; sku: string; stock_quantity: number; price: number; }
interface PrescriptionItem { tempId: number; product: Product | null; productSearch: string; searchResults: Product[]; quantity: number; dosage_instruction: string; }

interface PrescriptionDetailItem {
    name: string;
    quantity: number;
    dosage_instruction: string;
}

interface PrescriptionDetail extends Prescription {
    items: PrescriptionDetailItem[];
}

export default function PrescriptionManagement() {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionDetail | null>(null);
    const navigate = useNavigate();

    const [patientSearch, setPatientSearch] = useState('');
    const [doctorSearch, setDoctorSearch] = useState('');
    const [patientResults, setPatientResults] = useState<Patient[]>([]);
    const [doctorResults, setDoctorResults] = useState<Doctor[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0]);
    const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);

    // Effect for patient search
    useEffect(() => {
        if (patientSearch.length < 2) { setPatientResults([]); return; }
        const handler = setTimeout(() => {
            fetch(`${API_URL}/patients?search=${patientSearch}`)
                .then(res => res.json())
                .then(d => setPatientResults(d.data || []));
        }, 500);
        return () => clearTimeout(handler);
    }, [patientSearch]);

    // Effect for doctor search
    useEffect(() => {
        if (doctorSearch.length < 2) { setDoctorResults([]); return; }
        const handler = setTimeout(() => {
            fetch(`${API_URL}/doctors?search=${doctorSearch}`)
                .then(res => res.json())
                .then(d => setDoctorResults(d.data || []));
        }, 500);
        return () => clearTimeout(handler);
    }, [doctorSearch]);

    // Effect for product search within prescription items
    useEffect(() => {
        const timeouts: NodeJS.Timeout[] = [];
        prescriptionItems.forEach(item => {
            if (item.productSearch.length < 2) return;
            const handler = setTimeout(() => {
apiFetch(`${API_URL}/products?search=${item.productSearch}`)
                    .then(res => res.json())
                    .then(d => updateItem(item.tempId, 'searchResults', d.data || []));
            }, 500);
            timeouts.push(handler);
        });

        return () => { timeouts.forEach(clearTimeout); };
    }, [prescriptionItems.map(i => i.productSearch).join(',')]);

    // Fetch all prescriptions on component mount
    const fetchPrescriptions = () => {
        setIsLoading(true);
        fetch(`${API_URL}/prescriptions`)
            .then(res => res.json())
            .then(data => {
                setPrescriptions(data.data || []);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    };
    useEffect(() => { fetchPrescriptions(); }, []);

    // Handlers for patient/doctor selection
    const handleSelectPatient = (p: Patient) => { setSelectedPatient(p); setPatientSearch(p.name); setPatientResults([]); };
    const handleSelectDoctor = (d: Doctor) => { setSelectedDoctor(d); setDoctorSearch(d.name); setDoctorResults([]); };

    // Handler to open new prescription modal and reset form
    const openNewPrescriptionModal = () => {
        setSelectedPatient(null);
        setSelectedDoctor(null);
        setPatientSearch('');
        setDoctorSearch('');
        setPrescriptionItems([]);
        setPrescriptionDate(new Date().toISOString().split('T')[0]);
        setShowModal(true);
    };
    
    // Handlers for prescription items
    const addNewItem = () => setPrescriptionItems(prev => [...prev, { tempId: Date.now(), product: null, productSearch: '', searchResults: [], quantity: 1, dosage_instruction: '' }]);
    const removeItem = (tempId: number) => setPrescriptionItems(prev => prev.filter(item => item.tempId !== tempId));
    const updateItem = (tempId: number, field: keyof PrescriptionItem, value: any) => { setPrescriptionItems(prev => prev.map(item => item.tempId === tempId ? { ...item, [field]: value } : item)); };
    const selectProductForItem = (tempId: number, product: Product) => { updateItem(tempId, 'product', product); updateItem(tempId, 'productSearch', product.name); updateItem(tempId, 'searchResults', []); };

    // Form submission handler
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        let errorMessage = '';
        if (!selectedPatient) errorMessage += 'Pasien belum dipilih.\n';
        if (!selectedDoctor) errorMessage += 'Dokter belum dipilih.\n';
        if (prescriptionItems.length === 0) errorMessage += 'Belum ada item obat.\n';
        if (prescriptionItems.some(i => !i.product)) errorMessage += 'Ada item obat yang belum dipilih produknya.\n';

        if (errorMessage) { alert(errorMessage); return; }

        const payload = {
            patient_id: selectedPatient!.id,
            doctor_id: selectedDoctor!.id,
            prescription_date: prescriptionDate,
            items: prescriptionItems.map(i => ({
                product_id: i.product!.id,
                quantity: i.quantity,
                dosage_instruction: i.dosage_instruction
            }))
        };
        fetch(`${API_URL}/prescriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(res => res.json()).then(data => { if (data.error) { alert(`Error: ${data.error}`); } else { alert('Resep berhasil disimpan!'); setShowModal(false); fetchPrescriptions(); } })
            .catch(err => alert(`Terjadi kesalahan: ${err.message}`));
    };

    // Handlers for detail modal
    const handleShowDetails = (id: number) => { fetch(`${API_URL}/prescriptions/${id}`).then(res => res.json()).then(data => { if (data.data) { setSelectedPrescription(data.data); setShowDetailModal(true); } }); };
    const handleRedeem = () => { if (!selectedPrescription || !selectedPrescription.items) return; const cartItems = selectedPrescription.items.map((item: any) => ({ product_id: item.product_id, name: item.name, quantity: item.quantity, price_per_item: item.price_per_item })); navigate('/cashier', { state: { cartItems: cartItems } }); };

    // Handler for printing prescription
    const handlePrintPrescription = () => {
        if (!selectedPrescription) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert('Pop-up diblokir. Izinkan pop-up untuk mencetak resep.'); return; }

        let prescriptionContent = `
            <html>
            <head>
                <title>Resep #${selectedPrescription.id}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; font-size: 12px; margin: 0; padding: 20px; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .section { margin-bottom: 15px; }
                    .item-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    .item-table th, .item-table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    .item-table th { background-color: #f2f2f2; }
                    .footer { margin-top: 30px; text-align: right; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h3>APOTEK GEMINI</h3>
                    <p>Jl. Contoh No. 123, Kota Contoh</p>
                    <p>Telp: (021) 1234567</p>
                    <p>------------------------------------</p>
                    <h4>RESEP DOKTER</h4>
                    <p>------------------------------------</p>
                </div>
                <div class="section">
                    <p><strong>ID Resep:</strong> #${selectedPrescription.id}</p>
                    <p><strong>Tanggal Resep:</strong> ${new Date(selectedPrescription.prescription_date).toLocaleDateString('id-ID')}</p>
                </div>
                <div class="section">
                    <p><strong>Pasien:</strong> ${selectedPrescription.patient_name}</p>
                    <p><strong>Dokter:</strong> ${selectedPrescription.doctor_name}</p>
                </div>
                <div class="section">
                    <h6>Item Obat:</h6>
                    <table class="item-table">
                        <thead>
                            <tr>
                                <th>Obat</th>
                                <th>Jumlah</th>
                                <th>Aturan Pakai</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        selectedPrescription.items.forEach(item => {
            prescriptionContent += `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>${item.dosage_instruction}</td>
                            </tr>
            `;
        });

        prescriptionContent += `
                        </tbody>
                    </table>
                </div>
                <div class="footer">
                    <p>Hormat kami,</p>
                    <p>Apoteker Penanggung Jawab</p>
                    <br/><br/>
                    <p>(_________________________)</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(prescriptionContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    return (
        <div className="container-fluid h-100">
            {showModal && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <form onSubmit={handleSubmit} className="d-flex flex-column h-100">
                                <div className="modal-header">
                                    <h5 className="modal-title">Tambah Resep Baru</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                                </div>
                                <div className="modal-body flex-grow-1 overflow-auto">
                                    <div className="row">
                                        <div className="col-12 col-md-4 mb-3">
                                            <label className="form-label fw-bold">1. Pilih Pasien</label>
                                            <div className="dropdown">
                                                <input type="text" className="form-control" placeholder="Cari nama/telepon..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
                                                {patientResults.length > 0 && (
                                                    <ul className="dropdown-menu show w-100">
                                                        {patientResults.map(p => (
                                                            <li key={p.id} className="dropdown-item" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); handleSelectPatient(p); }}>
                                                                {p.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            {selectedPatient && <div className="mt-2 p-2 bg-light border rounded">Terpilih: <strong>{selectedPatient.name}</strong></div>}
                                        </div>
                                        <div className="col-12 col-md-4 mb-3">
                                            <label className="form-label fw-bold">2. Pilih Dokter</label>
                                            <div className="dropdown">
                                                <input type="text" className="form-control" placeholder="Cari nama/SIP..." value={doctorSearch} onChange={e => setDoctorSearch(e.target.value)} />
                                                {doctorResults.length > 0 && (
                                                    <ul className="dropdown-menu show w-100">
                                                        {doctorResults.map(d => (
                                                            <li key={d.id} className="dropdown-item" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); handleSelectDoctor(d); }}>
                                                                {d.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            {selectedDoctor && <div className="mt-2 p-2 bg-light border rounded">Terpilih: <strong>{selectedDoctor.name}</strong></div>}
                                        </div>
                                        <div className="col-12 col-md-4 mb-3">
                                            <label className="form-label fw-bold">3. Tanggal Resep</label>
                                            <input type="date" className="form-control" value={prescriptionDate} onChange={e => setPrescriptionDate(e.target.value)} />
                                        </div>
                                    </div>
                                    <hr />
                                    <h5 className="mb-3">4. Item Obat</h5>
                                    {prescriptionItems.map((item, index) => (
                                        <div key={item.tempId} className="row align-items-center mb-2 p-2 border rounded">
                                            <div className="col-12 col-md-4 dropdown mb-2 mb-md-0">
                                                <label className="form-label">Obat</label>
                                                <input type="text" placeholder="Cari obat..." className="form-control" value={item.productSearch} onChange={e => updateItem(item.tempId, 'productSearch', e.target.value)} />
                                                {item.searchResults.length > 0 && (
                                                    <ul className="dropdown-menu show w-100">
                                                        {item.searchResults.map(p => (
                                                            <li key={p.id} className="dropdown-item" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); selectProductForItem(item.tempId, p); }}>
                                                                {p.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            <div className="col-12 col-md-3 mb-2 mb-md-0"><label className="form-label">Aturan Pakai</label><input type="text" className="form-control" value={item.dosage_instruction} onChange={e => updateItem(item.tempId, 'dosage_instruction', e.target.value)} /></div>
                                            <div className="col-12 col-md-2 mb-2 mb-md-0"><label className="form-label">Jumlah</label><input type="number" className="form-control" value={item.quantity} onChange={e => updateItem(item.tempId, 'quantity', e.target.value)} /></div>
                                            <div className="col-12 col-md-2"><label className="form-label text-white">.</label><button type="button" className="btn btn-danger d-block w-100" onClick={() => removeItem(item.tempId)}>Hapus</button></div>
                                        </div>
                                    ))}
                                    <button type="button" className="btn btn-outline-primary mt-2" onClick={addNewItem}>+ Tambah Obat</button>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                    <button type="submit" className="btn btn-primary">Simpan Resep</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showDetailModal && selectedPrescription && <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header"><h5 className="modal-title">Detail Resep #{selectedPrescription.id}</h5><button type="button" className="btn-close" onClick={() => setShowDetailModal(false)}></button></div>
                        <div className="modal-body"><p><strong>Pasien:</strong> {selectedPrescription.patient_name}</p><p><strong>Dokter:</strong> {selectedPrescription.doctor_name}</p><p><strong>Tanggal:</strong> {new Date(selectedPrescription.prescription_date).toLocaleDateString('id-ID')}</p><hr /><h6>Item Obat:</h6><table className="table table-sm"><tbody>{selectedPrescription.items.map((item: any) => (<tr key={item.name}><td>{item.name}</td><td><strong>{item.quantity} pcs</strong></td><td><em>{item.dosage_instruction}</em></td></tr>))}</tbody></table></div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Tutup</button>
                            <button type="button" className="btn btn-info me-2" onClick={handlePrintPrescription}>Cetak Resep</button>
                            <button type="button" className="btn btn-primary" onClick={handleRedeem}>Tebus Resep di Kasir</button>
                        </div>
                    </div>
                </div>
            </div>}

            <div className="card h-100 d-flex flex-column">
                <div className="card-header d-flex justify-content-between align-items-center"><h3>Manajemen Resep</h3><button className="btn btn-success" onClick={openNewPrescriptionModal}>Tambah Resep Baru</button></div>
                <div className="card-body d-flex flex-column flex-grow-1"><div className="table-responsive flex-grow-1" style={{overflowY: 'auto'}}><table className="table table-striped table-hover">
                    <thead className="table-dark"><tr><th>ID Resep</th><th>Tanggal</th><th>Nama Pasien</th><th>Nama Dokter</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                        {isLoading ? (<tr><td colSpan={6} className="text-center">Loading...</td></tr>) : prescriptions.length > 0 ? (prescriptions.map(presc => (
                            <tr key={presc.id}><td>#{presc.id}</td><td>{new Date(presc.prescription_date).toLocaleDateString('id-ID')}</td><td>{presc.patient_name}</td><td>{presc.doctor_name}</td><td><span className={`badge bg-${presc.status === 'Baru' ? 'primary' : 'secondary'}`}>{presc.status}</span></td><td><button className="btn btn-sm btn-info" onClick={() => handleShowDetails(presc.id)}>Lihat Detail</button></td></tr>
                        ))) : (<tr><td colSpan={6} className="text-center">Belum ada resep.</td></tr>)}
                    </tbody>
                </table></div></div>
            </div>
        </div>
    );
}