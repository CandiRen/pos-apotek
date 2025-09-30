import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { apiFetch } from '../api';

const API_URL = 'http://localhost:3001/api';

interface Promotion {
  id: number;
  name: string;
  type: 'BOGO' | 'PWP' | 'ITEM_DISCOUNT' | 'GWP';
  buy_quantity: number;
  get_quantity: number;
  discount_percent: number;
  discount_amount: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active: number;
  product_ids: number[];
  gift_product_id?: number | null;
  gift_quantity?: number | null;
  gift_product_name?: string | null;
  gift_product_price?: number | null;
  created_at?: string;
}

interface ProductOption {
  id: number;
  name: string;
  sku: string;
}

const PROMOTION_TYPES = [
  { value: 'BOGO', label: 'Buy One Get One (BOGO)' },
  { value: 'PWP', label: 'Purchase With Purchase (PWP)' },
  { value: 'ITEM_DISCOUNT', label: 'Promo Item' },
  { value: 'GWP', label: 'Gift With Purchase (GWP)' }
] as const;

const formatDateInput = (value?: string | null) => {
  if (!value) return '';
  return value.slice(0, 10);
};

export default function PromotionManagement() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    name: '',
    type: 'BOGO' as Promotion['type'],
    buy_quantity: 1,
    get_quantity: 1,
    discount_percent: 0,
    discount_amount: 0,
    start_date: '',
    end_date: '',
    is_active: true,
    product_ids: [] as number[],
    gift_product_id: undefined as number | undefined,
    gift_quantity: 1
  });

  const loadPromotions = () => {
    setIsLoading(true);
    apiFetch(`${API_URL}/promotions`)
      .then(data => {
        const list: Promotion[] = (data.data || []).map((promo: any) => ({
          ...promo,
          type: promo.type === 'BUY_X_PERCENT_OFF' ? 'PWP' : promo.type
        }));
        setPromotions(list);
      })
      .catch(err => console.error('Gagal memuat promo:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      apiFetch(`${API_URL}/products?search=${encodeURIComponent(productSearch)}`)
        .then(data => setProducts(data.data || []))
        .catch(err => console.error('Gagal memuat produk:', err));
    }, 300);
    return () => clearTimeout(handler);
  }, [productSearch]);

  const resetForm = () => {
    setFormData({
      id: undefined,
      name: '',
      type: 'BOGO',
      buy_quantity: 1,
      get_quantity: 1,
      discount_percent: 0,
      discount_amount: 0,
      start_date: '',
      end_date: '',
      is_active: true,
      product_ids: [],
      gift_product_id: undefined,
      gift_quantity: 1
    });
  };

  const handleAddNew = () => {
    setIsEditing(false);
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (promotion: Promotion) => {
    setIsEditing(true);
    setFormData({
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      buy_quantity: promotion.buy_quantity,
      get_quantity: promotion.get_quantity,
      discount_percent: promotion.discount_percent,
      discount_amount: promotion.discount_amount,
      start_date: formatDateInput(promotion.start_date),
      end_date: formatDateInput(promotion.end_date),
      is_active: promotion.is_active === 1,
      product_ids: promotion.product_ids || [],
      gift_product_id: promotion.gift_product_id ?? undefined,
      gift_quantity: promotion.gift_quantity ?? 1
    });
    setShowModal(true);
  };

  const handleDelete = (promotionId: number) => {
    if (!window.confirm('Hapus promo ini?')) return;
    apiFetch(`${API_URL}/promotions/${promotionId}`, { method: 'DELETE' })
      .then(() => loadPromotions())
      .catch(err => alert(`Gagal menghapus promo: ${err.message}`));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const { name, value } = target;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      const checked = target.checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
      return;
    }
    if (['buy_quantity', 'get_quantity', 'discount_percent', 'discount_amount', 'gift_quantity'].includes(name)) {
      setFormData(prev => ({
        ...prev,
        [name]: Number(value)
      }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGiftProductChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      gift_product_id: value ? Number(value) : undefined
    }));
  };

  const toggleProductSelection = (productId: number) => {
    setFormData(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(productId)
        ? prev.product_ids.filter(id => id !== productId)
        : [...prev.product_ids, productId]
    }));
  };

  const isPwp = formData.type === 'PWP';
  const isItemDiscount = formData.type === 'ITEM_DISCOUNT';
  const isGwp = formData.type === 'GWP';
  const requiresBonusQty = formData.type === 'BOGO';
  const showDiscountPercent = isPwp || isItemDiscount;
  const showDiscountAmount = isPwp || isItemDiscount;

  const promotionSummary = useMemo(() => {
    if (formData.type === 'BOGO') {
      return `Beli ${formData.buy_quantity} gratis ${formData.get_quantity}`;
    }
    if (formData.type === 'PWP') {
      const discountDescription = formData.discount_percent ? `${formData.discount_percent}%` : `Rp ${formData.discount_amount}`;
      return `Beli ${formData.buy_quantity} diskon ${discountDescription}`;
    }
    if (formData.type === 'ITEM_DISCOUNT') {
      const discountDescription = formData.discount_percent ? `${formData.discount_percent}%` : `Rp ${formData.discount_amount}`;
      return `Diskon item ${discountDescription}`;
    }
    if (formData.type === 'GWP') {
      return `Beli ${formData.buy_quantity} dapat hadiah ${formData.gift_quantity} item`;
    }
    return '';
  }, [formData.type, formData.buy_quantity, formData.get_quantity, formData.discount_percent, formData.discount_amount, formData.gift_quantity]);

  const giftOptions = useMemo(() => {
    const map = new Map<number, ProductOption>();
    products.forEach(product => map.set(product.id, product));
    if (formData.gift_product_id && !map.has(formData.gift_product_id)) {
      const relatedPromo = promotions.find(promo => promo.id === formData.id);
      map.set(formData.gift_product_id, {
        id: formData.gift_product_id,
        name: relatedPromo?.gift_product_name ?? `Produk #${formData.gift_product_id}`,
        sku: relatedPromo?.gift_product_name ? (relatedPromo.gift_product_name ?? '') : ''
      });
    }
    return Array.from(map.values());
  }, [products, formData.gift_product_id, formData.id, promotions]);

  const getPromoDetail = (promo: Promotion) => {
    switch (promo.type) {
      case 'BOGO':
        return `Beli ${promo.buy_quantity} gratis ${promo.get_quantity}`;
      case 'PWP': {
        const discountDesc = promo.discount_percent
          ? `${promo.discount_percent}%`
          : `Rp ${promo.discount_amount}`;
        return `Beli ${promo.buy_quantity} diskon ${discountDesc}`;
      }
      case 'ITEM_DISCOUNT': {
        const discountDesc = promo.discount_percent
          ? `${promo.discount_percent}%`
          : `Rp ${promo.discount_amount}`;
        return promo.buy_quantity > 0
          ? `Min beli ${promo.buy_quantity} diskon ${discountDesc}`
          : `Diskon ${discountDesc}`;
      }
      case 'GWP': {
        const giftName = promo.gift_product_name ?? `Produk #${promo.gift_product_id}`;
        const giftQty = promo.gift_quantity ?? 1;
        return `Beli ${promo.buy_quantity} gratis ${giftQty}x ${giftName}`;
      }
      default:
        return '-';
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const buyQuantity = Number(formData.buy_quantity) || 0;
    const getQuantity = Number(formData.get_quantity) || 0;
    const discountPercent = Number(formData.discount_percent) || 0;
    const discountAmount = Number(formData.discount_amount) || 0;
    const giftQuantity = Number(formData.gift_quantity) || 0;
    const giftProductId = isGwp ? (formData.gift_product_id ?? null) : null;
    const payload = {
      name: formData.name,
      type: formData.type,
      buy_quantity: buyQuantity,
      get_quantity: getQuantity,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      is_active: formData.is_active ? 1 : 0,
      product_ids: formData.product_ids,
      gift_product_id: giftProductId,
      gift_quantity: isGwp ? giftQuantity : 0
    };

    const requestOptions = {
      method: formData.id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    } as const;

    const url = formData.id ? `${API_URL}/promotions/${formData.id}` : `${API_URL}/promotions`;

    apiFetch(url, requestOptions)
      .then(() => {
        setShowModal(false);
        loadPromotions();
      })
      .catch(err => alert(`Gagal menyimpan promo: ${err.message}`));
  };

  return (
    <div className="container-fluid h-100">
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <form onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">{isEditing ? 'Edit Promo' : 'Tambah Promo'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Nama Promo</label>
                      <input type="text" className="form-control" name="name" value={formData.name} onChange={handleInputChange} required />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Status</label>
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} />
                        <label className="form-check-label">Aktif</label>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Tipe Promo</label>
                      <select className="form-select" name="type" value={formData.type} onChange={handleInputChange}>
                        {PROMOTION_TYPES.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Ringkasan</label>
                      <input type="text" className="form-control" value={promotionSummary} readOnly />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Qty Beli{isItemDiscount ? ' (opsional)' : ''}</label>
                      <input
                        type="number"
                        className="form-control"
                        min={isItemDiscount ? 0 : 1}
                        name="buy_quantity"
                        value={formData.buy_quantity}
                        onChange={handleInputChange}
                        required={!isItemDiscount}
                      />
                    </div>
                    {requiresBonusQty && (
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Qty Bonus</label>
                        <input type="number" className="form-control" min={1} name="get_quantity" value={formData.get_quantity} onChange={handleInputChange} required />
                      </div>
                    )}
                    {isGwp && (
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Qty Hadiah</label>
                        <input type="number" className="form-control" min={1} name="gift_quantity" value={formData.gift_quantity} onChange={handleInputChange} required />
                      </div>
                    )}
                  </div>

                  {(showDiscountPercent || showDiscountAmount) && (
                    <div className="row">
                      {showDiscountPercent && (
                        <div className="col-md-4 mb-3">
                          <label className="form-label">Diskon (%)</label>
                          <input type="number" className="form-control" min={0} max={100} name="discount_percent" value={formData.discount_percent} onChange={handleInputChange} />
                        </div>
                      )}
                      {showDiscountAmount && (
                        <div className="col-md-4 mb-3">
                          <label className="form-label">Diskon Nominal</label>
                          <input type="number" className="form-control" min={0} name="discount_amount" value={formData.discount_amount} onChange={handleInputChange} />
                        </div>
                      )}
                    </div>
                  )}

                  {isGwp && (
                    <div className="mb-3">
                      <label className="form-label">Produk Hadiah</label>
                      <select className="form-select" value={formData.gift_product_id ?? ''} onChange={handleGiftProductChange}>
                        <option value="">-- Pilih produk hadiah --</option>
                        {giftOptions.map(option => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                      <small className="text-muted">Gunakan kolom pencarian produk di bawah untuk menambahkan pilihan lain.</small>
                    </div>
                  )}

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Mulai Berlaku</label>
                      <input type="date" className="form-control" name="start_date" value={formData.start_date} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Berakhir</label>
                      <input type="date" className="form-control" name="end_date" value={formData.end_date} onChange={handleInputChange} />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Produk yang Dipromosikan</label>
                    {isGwp && <small className="text-muted d-block mb-2">Pilih produk yang memicu hadiah.</small>}
                    <input type="text" className="form-control mb-2" placeholder="Cari produk..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                    <div className="list-group" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {products.map(product => {
                        const checked = formData.product_ids.includes(product.id);
                        return (
                          <label key={product.id} className="list-group-item list-group-item-action">
                            <input
                              type="checkbox"
                              className="form-check-input me-2"
                              checked={checked}
                              onChange={() => toggleProductSelection(product.id)}
                            />
                            {product.name}
                          </label>
                        );
                      })}
                      {products.length === 0 && <div className="text-muted text-center py-2">Tidak ada produk ditemukan.</div>}
                    </div>
                    <small className="text-muted">Promo akan diterapkan pada produk yang dipilih.</small>
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
      )}

      <div className="card h-100 d-flex flex-column">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h3>Manajemen Promo</h3>
          <button className="btn btn-success" onClick={handleAddNew}>Tambah Promo</button>
        </div>
        <div className="card-body d-flex flex-column flex-grow-1">
          <div className="table-responsive flex-grow-1" style={{ overflowY: 'auto' }}>
            <table className="table table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  <th>Nama</th>
                  <th>Tipe</th>
                  <th>Detail</th>
                  <th>Masa Berlaku</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center">Memuat...</td></tr>
                ) : promotions.length > 0 ? (
                  promotions.map(promo => (
                    <tr key={promo.id}>
                      <td>{promo.name}</td>
                      <td>{PROMOTION_TYPES.find(type => type.value === promo.type)?.label ?? promo.type}</td>
                      <td>{getPromoDetail(promo)}</td>
                      <td>
                        {promo.start_date ? formatDateInput(promo.start_date) : '-'}
                        {' '}s/d{' '}
                        {promo.end_date ? formatDateInput(promo.end_date) : '-'}
                      </td>
                      <td>
                        <span className={`badge ${promo.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {promo.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-primary me-2" onClick={() => handleEdit(promo)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(promo.id)}>Hapus</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="text-center">Belum ada promo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
