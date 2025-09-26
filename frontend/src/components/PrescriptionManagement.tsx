import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

const API_URL = 'http://localhost:3001/api';

// === INTERFACES ===
interface Prescription { id: number; prescription_date: string; status: string; patient_name: string; doctor_name: string; }
interface Patient { id: number; name: string; phone_number: string; }
interface Doctor { id: number; name: string; license_number: string; }
interface Product { id: number; name: string; sku: string; stock_quantity: number; price: number; }

// State for entities that can be selected or created
interface EntityState {
    id?: number;
    name: string;
}

interface PrescriptionItemState {
    tempId: number;
    product: EntityState | null;
    productSearch: string;
    searchResults: Product[];
    quantity: number;
    dosage_instruction: string;
}

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

    // Form state
    const [patient, setPatient] = useState<EntityState | null>(null);
    const [doctor, setDoctor] = useState<EntityState | null>(null);
    const [patientSearch, setPatientSearch] = useState('');
    const [doctorSearch, setDoctorSearch] = useState('');
    const [patientResults, setPatientResults] = useState<Patient[]>([]);
    const [doctorResults, setDoctorResults] = useState<Doctor[]>([]);
    const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0]);
    const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemState[]>([]);

    // --- DATA FETCHING EFFECTS ---
    useEffect(() => {
        if (patientSearch.length < 2) { setPatientResults([]); return; }
        const handler = setTimeout(() => {
            apiFetch(`${API_URL}/patients?search=${patientSearch}`)
                .then(d => setPatientResults(d.data || []))
                .catch(err => console.error(err));
        }, 300);
        return () => clearTimeout(handler);
    }, [patientSearch]);

    useEffect(() => {
        if (doctorSearch.length < 2) { setDoctorResults([]); return; }
        const handler = setTimeout(() => {
            apiFetch(`${API_URL}/doctors?search=${doctorSearch}`)
                .then(d => setDoctorResults(d.data || []))
                .catch(err => console.error(err));
        }, 300);
        return () => clearTimeout(handler);
    }, [doctorSearch]);

    useEffect(() => {
        const timeouts: NodeJS.Timeout[] = [];
        prescriptionItems.forEach(item => {
            if (item.productSearch.length < 2 || (item.product && item.product.name === item.productSearch)) {
                updateItem(item.tempId, 'searchResults', []);
                return;
            }
            const handler = setTimeout(() => {
                apiFetch(`${API_URL}/products?search=${item.productSearch}`)
                    .then(d => updateItem(item.tempId, 'searchResults', d.data || []))
                    .catch(err => console.error(err));
            }, 300);
            timeouts.push(handler);
        });
        return () => { timeouts.forEach(clearTimeout); };
    }, [prescriptionItems.map(i => i.productSearch).join(',')]);

    const fetchPrescriptions = () => {
        setIsLoading(true);
        apiFetch(`${API_URL}/prescriptions`)
            .then(data => setPrescriptions(data.data || []))
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    };
    useEffect(() => { fetchPrescriptions(); }, []);

    // --- FORM HANDLERS ---
    const resetForm = () => {
        setPatient(null);
        setDoctor(null);
        setPatientSearch('');
        setDoctorSearch('');
        setPatientResults([]);
        setDoctorResults([]);
        setPrescriptionItems([]);
        setPrescriptionDate(new Date().toISOString().split('T')[0]);
    };

    const openNewPrescriptionModal = () => {
        resetForm();
        setShowModal(true);
    };

    const handleSelectPatient = (p: Patient) => { setPatient({ id: p.id, name: p.name }); setPatientSearch(p.name); setPatientResults([]); };
    const handleSelectDoctor = (d: Doctor) => { setDoctor({ id: d.id, name: d.name }); setDoctorSearch(d.name); setDoctorResults([]); };

    const addNewItem = () => setPrescriptionItems(prev => [...prev, { tempId: Date.now(), product: null, productSearch: '', searchResults: [], quantity: 1, dosage_instruction: '' }]);
    const removeItem = (tempId: number) => setPrescriptionItems(prev => prev.filter(item => item.tempId !== tempId));
    const updateItem = (tempId: number, field: keyof PrescriptionItemState, value: any) => { setPrescriptionItems(prev => prev.map(item => item.tempId === tempId ? { ...item, [field]: value } : item)); };
    const selectProductForItem = (tempId: number, p: Product) => { updateItem(tempId, 'product', { id: p.id, name: p.name }); updateItem(tempId, 'productSearch', p.name); updateItem(tempId, 'searchResults', []); };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Finalize patient/doctor/product states from search inputs if not selected from dropdown
        const finalPatient = patient?.name === patientSearch ? patient : { name: patientSearch };
        const finalDoctor = doctor?.name === doctorSearch ? doctor : { name: doctorSearch };
        const finalItems = prescriptionItems.map(item => ({
            ...item,
            product: item.product?.name === item.productSearch ? item.product : { name: item.productSearch }
        }));

        // Validation
        if (!finalPatient.name) { alert('Nama Pasien harus diisi.'); return; }
        if (!finalDoctor.name) { alert('Nama Dokter harus diisi.'); return; }
        if (finalItems.length === 0) { alert('Resep harus memiliki setidaknya satu obat.'); return; }
        if (finalItems.some(i => !i.product.name)) { alert('Ada item obat yang namanya belum diisi.'); return; }

        const payload = {
            patient: finalPatient,
            doctor: finalDoctor,
            prescription_date: prescriptionDate,
            items: finalItems.map(i => ({ product: i.product, quantity: i.quantity, dosage_instruction: i.dosage_instruction }))
        };

        apiFetch(`${API_URL}/prescriptions`, { method: 'POST', body: JSON.stringify(payload) })
            .then(() => { 
                alert('Resep berhasil disimpan!'); 
                setShowModal(false); 
                fetchPrescriptions(); 
            })
            .catch(err => alert(`Terjadi kesalahan: ${err.message}`));
    };

    const handleShowDetails = (id: number) => {
        apiFetch(`${API_URL}/prescriptions/${id}`)
            .then(data => { if (data.data) { setSelectedPrescription(data.data); setShowDetailModal(true); } })
            .catch(err => console.error(err));
    };

    const handleRedeem = () => {
        if (!selectedPrescription || !selectedPrescription.items) return;
        const cartItems = selectedPrescription.items.map((item: any) => ({ 
            product_id: item.product_id, // This now comes from the expanded GET /api/prescriptions/:id
            name: item.name, 
            quantity: item.quantity, 
            price_per_item: item.price_per_item 
        }));
        navigate('/cashier', { state: { cartItems: cartItems } });
    };

    // ... (JSX for modals and table remains largely the same, but input values/handlers are updated)

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
                                            <label className="form-label fw-bold">1. Nama Pasien</label>
                                            <div className="dropdown">
                                                <input type="text" className="form-control" placeholder="Cari atau ketik nama baru..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
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
                                        </div>
                                        <div className="col-12 col-md-4 mb-3">
                                            <label className="form-label fw-bold">2. Nama Dokter</label>
                                            <div className="dropdown">
                                                <input type="text" className="form-control" placeholder="Cari atau ketik nama baru..." value={doctorSearch} onChange={e => setDoctorSearch(e.target.value)} />
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
                                        </div>
                                        <div className="col-12 col-md-4 mb-3">
                                            <label className="form-label fw-bold">3. Tanggal Resep</label>
                                            <input type="date" className="form-control" value={prescriptionDate} onChange={e => setPrescriptionDate(e.target.value)} />
                                        </div>
                                    </div>
                                    <hr />
                                    <h5 className="mb-3">4. Item Obat</h5>
                                    {prescriptionItems.map((item) => (
                                        <div key={item.tempId} className="row align-items-center mb-2 p-2 border rounded">
                                            <div className="col-12 col-md-4 dropdown mb-2 mb-md-0">
                                                <label className="form-label">Obat</label>
                                                <input type="text" placeholder="Cari atau ketik obat baru..." className="form-control" value={item.productSearch} onChange={e => updateItem(item.tempId, 'productSearch', e.target.value)} />
                                                {item.searchResults.length > 0 && (
                                                    <ul className="dropdown-menu show w-100">
                                                        {item.searchResults.map(p => (
                                                            <li key={p.id} className="dropdown-item" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); selectProductForItem(item.tempId, p); }}>
                                                                {p.name} <small className="text-muted">(Stok: {p.stock_quantity})</small>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            <div className="col-12 col-md-3 mb-2 mb-md-0"><label className="form-label">Aturan Pakai</label><input type="text" className="form-control" value={item.dosage_instruction} onChange={e => updateItem(item.tempId, 'dosage_instruction', e.target.value)} /></div>
                                            <div className="col-12 col-md-2 mb-2 mb-md-0"><label className="form-label">Jumlah</label><input type="number" min="1" className="form-control" value={item.quantity} onChange={e => updateItem(item.tempId, 'quantity', e.target.value)} /></div>
                                            <div className="col-12 col-md-2"><label className="form-label d-block">&nbsp;</label><button type="button" className="btn btn-danger w-100" onClick={() => removeItem(item.tempId)}>Hapus</button></div>
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
                        <div className="modal-body"><p><strong>Pasien:</strong> {selectedPrescription.patient_name}</p><p><strong>Dokter:</strong> {selectedPrescription.doctor_name}</p><p><strong>Tanggal:</strong> {new Date(selectedPrescription.prescription_date).toLocaleDateString('id-ID')}</p><hr /><h6>Item Obat:</h6><table className="table table-sm"><tbody>{selectedPrescription.items.map((item: any, index: number) => (<tr key={index}><td>{item.name}</td><td><strong>{item.quantity} pcs</strong></td><td><em>{item.dosage_instruction}</em></td></tr>))}</tbody></table></div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Tutup</button>
                            <button type="button" className="btn btn-info me-2" onClick={() => { /* Print logic here */ }}>Cetak Resep</button>
                            <button type="button" className="btn btn-primary" onClick={handleRedeem} disabled={!selectedPrescription.items.every((item: any) => item.price_per_item !== undefined)} title={!selectedPrescription.items.every((item: any) => item.price_per_item !== undefined) ? "Tidak bisa ditebus karena ada obat baru yang harganya belum diatur" : ""}>Tebus Resep di Kasir</button>
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