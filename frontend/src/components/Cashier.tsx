
import { useState, useEffect, useMemo, useCallback } from 'react';
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
}

interface CartItem {
  product_id: number;
  name: string;
  quantity: number;
  price_per_item: number;
  discount_amount: number;
  is_manual_discount?: boolean;
  applied_promotion_id?: number | null;
  applied_promotion_name?: string | null;
  is_gift?: boolean;
  gift_source_promotion_id?: number | null;
}

interface SaleDetailItem {
    name: string;
    quantity: number;
    price_per_item: number;
    discount_amount: number;
}

interface SaleDetail {
    id: number;
    total_amount: number;
    discount_amount: number;
    subtotal_amount?: number;
    item_discount_total?: number;
    payment_method: string;
    created_at: string;
    items: SaleDetailItem[];
}

interface PromotionCalculationResult {
  discount: number;
  promotion: Promotion | null;
}

const currencyClamp = (value: number, max: number) => {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

const calculateBestPromotion = (
  item: { product_id: number; quantity: number; price_per_item: number },
  promotions: Promotion[]
): PromotionCalculationResult => {
  let bestDiscount = 0;
  let bestPromotion: Promotion | null = null;
  const lineValue = item.quantity * item.price_per_item;

  promotions.forEach((promotion) => {
    if (promotion.product_ids.length > 0 && !promotion.product_ids.includes(item.product_id)) {
      return;
    }

    let discount = 0;
    if (promotion.type === 'BOGO') {
      const setSize = promotion.buy_quantity + promotion.get_quantity;
      if (promotion.buy_quantity > 0 && promotion.get_quantity > 0 && setSize > 0) {
        const eligibleSets = Math.floor(item.quantity / setSize);
        const freeItems = eligibleSets * promotion.get_quantity;
        discount = freeItems * item.price_per_item;
      }
    } else if (promotion.type === 'PWP') {
      if (promotion.buy_quantity > 0) {
        const groups = Math.floor(item.quantity / promotion.buy_quantity);
        if (groups > 0) {
          const discountedUnits = groups * promotion.buy_quantity;
          const percentDiscount = promotion.discount_percent > 0
            ? discountedUnits * item.price_per_item * (promotion.discount_percent / 100)
            : 0;
          const amountDiscount = promotion.discount_amount > 0
            ? discountedUnits * promotion.discount_amount
            : 0;
          discount = Math.max(percentDiscount, amountDiscount);
        }
      }
    } else if (promotion.type === 'ITEM_DISCOUNT') {
      const minimumQty = promotion.buy_quantity > 0 ? promotion.buy_quantity : 0;
      if (minimumQty === 0 || item.quantity >= minimumQty) {
        const percentDiscount = promotion.discount_percent > 0
          ? item.quantity * item.price_per_item * (promotion.discount_percent / 100)
          : 0;
        const amountDiscount = promotion.discount_amount > 0
          ? promotion.discount_amount * item.quantity
          : 0;
        discount = Math.max(percentDiscount, amountDiscount);
      }
    }

    discount = currencyClamp(discount, lineValue);

    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestPromotion = promotion;
    }
  });

  return {
    discount: bestDiscount,
    promotion: bestPromotion
  };
};

export default function Cashier() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleDiscountType, setSaleDiscountType] = useState<'amount' | 'percent'>('amount');
  const [saleDiscountValue, setSaleDiscountValue] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    quantity: 1,
    discount: 0,
    maxDiscount: 0,
    recommendedDiscount: 0,
    recommendedPromotionId: null as number | null,
    recommendedPromotionName: null as string | null,
    useManual: false,
    pricePerItem: 0,
    name: ''
  });

  const applyPromotionsToCart = useCallback((items: CartItem[]) => {
    let changed = false;
    const baseItems = items.filter(item => !item.is_gift);
    const adjustedBase = baseItems.map(item => {
      const maxDiscount = item.quantity * item.price_per_item;
      const currentDiscount = item.discount_amount || 0;

      if (item.is_manual_discount) {
        const bounded = currencyClamp(currentDiscount, maxDiscount);
        if (bounded !== currentDiscount) {
          changed = true;
          return { ...item, discount_amount: bounded };
        }
        return item;
      }

      const { discount, promotion } = calculateBestPromotion(
        { product_id: item.product_id, quantity: item.quantity, price_per_item: item.price_per_item },
        promotions
      );
      const bounded = currencyClamp(discount, maxDiscount);

      if (
        bounded !== currentDiscount ||
        (promotion?.id ?? null) !== (item.applied_promotion_id ?? null) ||
        (promotion?.name ?? null) !== (item.applied_promotion_name ?? null)
      ) {
        changed = true;
        return {
          ...item,
          discount_amount: bounded,
          is_manual_discount: false,
          applied_promotion_id: promotion ? promotion.id : null,
          applied_promotion_name: promotion ? promotion.name : null
        };
      }
      return item;
    });

    const previousGiftCount = items.filter(item => item.is_gift).length;
    const gifts: CartItem[] = [];

    promotions.forEach(promotion => {
      if (promotion.type !== 'GWP') return;
      if (!promotion.product_ids || promotion.product_ids.length === 0) return;
      if (!promotion.gift_product_id || promotion.buy_quantity <= 0) return;

      const totalTriggerQty = adjustedBase
        .filter(item => promotion.product_ids.includes(item.product_id))
        .reduce((sum, item) => sum + item.quantity, 0);

      const giftMultiplier = Math.floor(totalTriggerQty / promotion.buy_quantity);
      if (giftMultiplier <= 0) return;

      const giftQtyPerSet = promotion.gift_quantity && promotion.gift_quantity > 0 ? promotion.gift_quantity : 1;
      const totalGiftQty = giftMultiplier * giftQtyPerSet;
      const giftProductId = promotion.gift_product_id;

      const giftName = promotion.gift_product_name
        || products.find(product => product.id === giftProductId)?.name
        || `Produk #${giftProductId}`;
      const giftUnitPrice = promotion.gift_product_price
        ?? products.find(product => product.id === giftProductId)?.price
        ?? 0;

      gifts.push({
        product_id: giftProductId,
        name: `${giftName} (Hadiah)` ,
        quantity: totalGiftQty,
        price_per_item: giftUnitPrice,
        discount_amount: giftUnitPrice * totalGiftQty,
        is_manual_discount: false,
        applied_promotion_id: promotion.id,
        applied_promotion_name: promotion.name,
        is_gift: true,
        gift_source_promotion_id: promotion.id
      });
    });

    const combined = [...adjustedBase, ...gifts];
    if (gifts.length > 0 || previousGiftCount > 0) {
      changed = true;
    }

    return { updated: combined, changed };
  }, [promotions, products]);

  const updateCart = useCallback((updater: (prev: CartItem[]) => CartItem[]) => {
    setCart(prev => {
      const base = updater(prev);
      const { updated, changed } = applyPromotionsToCart(base);
      return changed ? updated : base;
    });
  }, [applyPromotionsToCart]);

  const getRecommendedPromotion = useCallback((productId: number, quantity: number, pricePerItem: number) => {
    const { discount, promotion } = calculateBestPromotion({ product_id: productId, quantity, price_per_item: pricePerItem }, promotions);
    const bounded = currencyClamp(discount, quantity * pricePerItem);
    return {
      discount: bounded,
      promotionId: promotion ? promotion.id : null,
      promotionName: promotion ? promotion.name : null
    };
  }, [promotions]);

  const handleRemoveItem = useCallback((productId: number) => {
    const target = cart.find(item => item.product_id === productId && !item.is_gift);
    if (!target) {
      return;
    }
    updateCart(prev => prev.filter(item => !(item.product_id === productId && !item.is_gift)));
    if (editingItemId === productId) {
      setEditingItemId(null);
    }
  }, [updateCart, editingItemId, cart]);

  const handleOpenEditItem = (productId: number) => {
    const item = cart.find(cartItem => cartItem.product_id === productId);
    if (!item || item.is_gift) return;
    const recommended = getRecommendedPromotion(item.product_id, item.quantity, item.price_per_item);
    const maxDiscount = item.quantity * item.price_per_item;
    setEditingItemId(productId);
    setEditForm({
      quantity: item.quantity,
      discount: currencyClamp(item.discount_amount || 0, maxDiscount),
      maxDiscount,
      recommendedDiscount: recommended.discount,
      recommendedPromotionId: recommended.promotionId,
      recommendedPromotionName: recommended.promotionName,
      useManual: item.is_manual_discount ?? false,
      pricePerItem: item.price_per_item,
      name: item.name
    });
  };

  const handleCloseEditModal = () => {
    setEditingItemId(null);
  };

  const handleEditQuantityChange = (rawValue: number) => {
    if (editingItemId === null) return;
    const quantity = Number.isNaN(rawValue) ? 1 : Math.max(1, Math.floor(rawValue));
    const maxDiscount = quantity * editForm.pricePerItem;
    const recommended = getRecommendedPromotion(editingItemId, quantity, editForm.pricePerItem);
    setEditForm(prev => {
      const useManual = prev.useManual;
      const discount = useManual ? currencyClamp(prev.discount, maxDiscount) : recommended.discount;
      return {
        ...prev,
        quantity,
        maxDiscount,
        discount,
        recommendedDiscount: recommended.discount,
        recommendedPromotionId: recommended.promotionId,
        recommendedPromotionName: recommended.promotionName
      };
    });
  };

  const handleEditDiscountChange = (rawValue: number) => {
    const numericValue = Number.isNaN(rawValue) ? 0 : rawValue;
    setEditForm(prev => ({
      ...prev,
      discount: currencyClamp(numericValue, prev.maxDiscount),
      useManual: true
    }));
  };

  const handleApplyPromotionInEdit = () => {
    setEditForm(prev => ({
      ...prev,
      discount: prev.recommendedDiscount,
      useManual: false
    }));
  };

  const handleSaveEdit = () => {
    if (editingItemId === null) return;
    const productId = editingItemId;
    const discount = currencyClamp(editForm.discount, editForm.maxDiscount);
    const isManual = editForm.useManual;
    updateCart(prev => prev.map(item => {
      if (item.product_id !== productId) return item;
      return {
        ...item,
        quantity: editForm.quantity,
        discount_amount: discount,
        is_manual_discount: isManual,
        applied_promotion_id: isManual ? null : editForm.recommendedPromotionId,
        applied_promotion_name: isManual ? null : editForm.recommendedPromotionName
      };
    }));
    setEditingItemId(null);
  };

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state && location.state.cartItems) {
      const incomingItems = location.state.cartItems as CartItem[];
      updateCart(() => incomingItems.map(item => ({
        ...item,
        discount_amount: item.discount_amount || 0,
        is_manual_discount: item.is_manual_discount ?? false,
        applied_promotion_id: item.applied_promotion_id ?? null,
        applied_promotion_name: item.applied_promotion_name ?? null
      })));
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, updateCart]);

  useEffect(() => {
    setIsLoadingPromotions(true);
    apiFetch(`${API_URL}/promotions/active`)
      .then(data => {
        const list: Promotion[] = (data.data || []).map((promo: any) => ({
          ...promo,
          type: promo.type === 'BUY_X_PERCENT_OFF' ? 'PWP' : promo.type
        }));
        setPromotions(list);
      })
      .catch(err => console.error('Gagal memuat promo aktif:', err))
      .finally(() => setIsLoadingPromotions(false));
  }, []);

  useEffect(() => {
    setCart(prev => {
      const { updated, changed } = applyPromotionsToCart(prev);
      return changed ? updated : prev;
    });
  }, [applyPromotionsToCart]);

  const grossSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.price_per_item, 0);
  }, [cart]);

  const itemDiscountTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  }, [cart]);

  const netSubtotal = useMemo(() => {
    return Math.max(0, grossSubtotal - itemDiscountTotal);
  }, [grossSubtotal, itemDiscountTotal]);

  const saleDiscountAmount = useMemo(() => {
    if (netSubtotal <= 0) return 0;
    if (saleDiscountType === 'percent') {
      const boundedPercent = Math.min(Math.max(saleDiscountValue, 0), 100);
      return parseFloat(((netSubtotal * boundedPercent) / 100).toFixed(2));
    }
    const boundedAmount = Math.max(0, saleDiscountValue);
    return Math.min(netSubtotal, boundedAmount);
  }, [saleDiscountType, saleDiscountValue, netSubtotal]);

  const total = useMemo(() => {
    if (netSubtotal <= 0) return 0;
    return Math.max(0, netSubtotal - saleDiscountAmount);
  }, [netSubtotal, saleDiscountAmount]);

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
    updateCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === product.id);
      if (existingItem) {
        return prevCart.map(item => {
          if (item.product_id !== product.id) return item;
          const nextQuantity = item.quantity + 1;
          const maxDiscount = nextQuantity * item.price_per_item;
          const adjustedDiscount = Math.min(item.discount_amount, maxDiscount);
          return {
            ...item,
            quantity: nextQuantity,
            discount_amount: adjustedDiscount,
            is_manual_discount: item.is_manual_discount,
            applied_promotion_id: item.applied_promotion_id ?? null,
            applied_promotion_name: item.applied_promotion_name ?? null
          };
        });
      } else {
        return [...prevCart, {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          price_per_item: product.price,
          discount_amount: 0,
          is_manual_discount: false,
          applied_promotion_id: null,
          applied_promotion_name: null
        }];
      }
    });
  };

  const handleSaleDiscountTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as 'amount' | 'percent';
    if (nextType === saleDiscountType) return;

    const currentDiscountAmount = saleDiscountAmount;

    if (nextType === 'amount') {
      setSaleDiscountValue(parseFloat(currentDiscountAmount.toFixed(2)));
    } else {
      const percentage = netSubtotal === 0 ? 0 : (currentDiscountAmount / netSubtotal) * 100;
      setSaleDiscountValue(parseFloat(percentage.toFixed(2)));
    }

    setSaleDiscountType(nextType);
  };

  const handleSaleDiscountValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);

    if (Number.isNaN(rawValue)) {
      setSaleDiscountValue(0);
      return;
    }

    if (saleDiscountType === 'percent') {
      const bounded = Math.min(Math.max(rawValue, 0), 100);
      setSaleDiscountValue(bounded);
    } else {
      setSaleDiscountValue(Math.max(0, rawValue));
    }
  };

  const completeTransaction = () => {
    if (cart.length === 0) { alert('Keranjang masih kosong!'); return; }
    setShowConfirmModal(true);
  };

  const handleConfirmAndComplete = () => {
    const transactionData = { total_amount: total, discount_amount: saleDiscountAmount, payment_method: 'Tunai', items: cart };
    apiFetch(`${API_URL}/sales`, { method: 'POST', body: JSON.stringify(transactionData) }) // Gunakan apiFetch
    .then(data => {
      setLastSaleId(data.sale_id);
      setShowConfirmModal(false);
      setShowSuccessModal(true);
      setCart([]);
      setSaleDiscountValue(0);
      setSaleDiscountType('amount');
    })
    .catch(err => { alert(`Terjadi kesalahan: ${err.message}`); setShowConfirmModal(false); });
  };

  const handlePrintReceipt = async () => {
    if (!lastSaleId) return;

    try {
        const data = await apiFetch(`${API_URL}/sales/${lastSaleId}`); // Gunakan apiFetch
        const sale: SaleDetail = data.data;
        const subtotalAmount = sale.subtotal_amount ?? sale.items.reduce((sum, item) => sum + (item.quantity * item.price_per_item) - (item.discount_amount || 0), 0);
        const itemDiscountTotal = sale.item_discount_total ?? sale.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
        const grossSubtotal = subtotalAmount + itemDiscountTotal;
        const saleDiscountValue = sale.discount_amount || 0;
        const saleDiscountDisplay = saleDiscountValue > 0
            ? `- Rp ${saleDiscountValue.toLocaleString('id-ID')}`
            : `Rp ${saleDiscountValue.toLocaleString('id-ID')}`;

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
                                <th>Diskon</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        sale.items.forEach(item => {
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
                    products.slice(0, 10).map(product => (
                        <button key={product.id} type="button" className="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onClick={() => addToCart(product)} disabled={product.stock_quantity <= 0}>
                            <div><h6 className="mb-1">{product.name}</h6><small>Stok: {product.stock_quantity}</small></div>
                            <span className="fw-bold">Rp {product.price.toLocaleString('id-ID')}</span>
                        </button>
                    ))
                ) : (
                    <div className="text-center text-muted">Tidak ada produk ditemukan.</div>
                )}
                {products.length > 10 && (
                  <div className="text-center text-muted mt-2">Menampilkan 10 dari {products.length} hasil. Gunakan pencarian untuk mempersempit.</div>
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
                  {cart.map(item => {
                    const lineGross = item.quantity * item.price_per_item;
                    const lineNet = lineGross - (item.discount_amount || 0);
                    return (
                      <li key={item.product_id} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="me-3 flex-grow-1">
                            <h6 className="my-0">{item.name}</h6>
                            <small className="text-muted">Harga: Rp {item.price_per_item.toLocaleString('id-ID')}</small><br />
                            <small className="text-muted">Qty: {item.quantity}</small>
                            {item.applied_promotion_name && !item.is_manual_discount && (
                              <div className="text-success small mt-1">Promo: {item.applied_promotion_name}</div>
                            )}
                            {item.is_manual_discount && (
                              <div className="text-warning small mt-1">Diskon manual diterapkan</div>
                            )}
                          </div>
                          <div className="text-end">
                            <span className="text-muted d-block">Subtotal: Rp {lineGross.toLocaleString('id-ID')}</span>
                            {item.discount_amount > 0 && (
                              <span className="text-danger d-block">Diskon: Rp {item.discount_amount.toLocaleString('id-ID')}</span>
                            )}
                            <strong>Rp {lineNet.toLocaleString('id-ID')}</strong>
                          </div>
                        </div>
                        <div className="mt-2 d-flex justify-content-end gap-2">
                          {item.is_gift ? (
                            <span className="text-muted small">Hadiah otomatis</span>
                          ) : (
                            <>
                              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleOpenEditItem(item.product_id)}>Edit</button>
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveItem(item.product_id)}>Hapus</button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {cart.length === 0 && <li className="list-group-item">Keranjang kosong</li>}
                </ul>
              </div>
              <div className="flex-shrink-0">
                {isLoadingPromotions && <small className="text-muted d-block mb-2">Memuat promo aktif...</small>}
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span>Subtotal (Kotor)</span>
                  <strong>Rp {grossSubtotal.toLocaleString('id-ID')}</strong>
                </div>
                <div className="d-flex justify-content-between text-danger mb-1">
                  <span>Diskon Item</span>
                  <span>- Rp {itemDiscountTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span>Subtotal (Bersih)</span>
                  <strong>Rp {netSubtotal.toLocaleString('id-ID')}</strong>
                </div>
                <div className="mb-3">
                  <label className="form-label">Diskon Transaksi</label>
                  <div className="input-group">
                    <select className="form-select flex-shrink-0" style={{ maxWidth: '140px' }} value={saleDiscountType} onChange={handleSaleDiscountTypeChange}>
                      <option value="amount">Nominal</option>
                      <option value="percent">Persen</option>
                    </select>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step={saleDiscountType === 'percent' ? '0.1' : '1'}
                      value={saleDiscountValue}
                      onChange={handleSaleDiscountValueChange}
                      disabled={netSubtotal <= 0}
                    />
                    <span className="input-group-text">{saleDiscountType === 'percent' ? '%' : 'Rp'}</span>
                  </div>
                  <small className="text-muted">Diskon terhitung: Rp {saleDiscountAmount.toLocaleString('id-ID')}</small>
                </div>
                <h4 className="d-flex justify-content-between align-items-center mb-3"><span>Total</span><strong>Rp {total.toLocaleString('id-ID')}</strong></h4>
                <button className="btn btn-primary btn-lg w-100" onClick={completeTransaction} disabled={cart.length === 0 || netSubtotal <= 0}>Selesaikan Transaksi</button>
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
                      <th>Diskon</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>Rp {item.price_per_item.toLocaleString('id-ID')}</td>
                        <td>Rp {item.discount_amount.toLocaleString('id-ID')}</td>
                        <td>Rp {((item.quantity * item.price_per_item) - item.discount_amount).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="d-flex justify-content-between mt-3">
                  <span>Subtotal (Kotor)</span>
                  <span>Rp {grossSubtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="d-flex justify-content-between text-danger">
                  <span>Diskon Item</span>
                  <span>- Rp {itemDiscountTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <span>Subtotal (Bersih)</span>
                  <span>Rp {netSubtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="d-flex justify-content-between text-danger">
                  <span>Diskon Transaksi</span>
                  <span>- Rp {saleDiscountAmount.toLocaleString('id-ID')}</span>
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

      {editingItemId !== null && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Item Keranjang</h5>
                <button type="button" className="btn-close" onClick={handleCloseEditModal}></button>
              </div>
              <div className="modal-body">
                <p className="fw-semibold mb-3">{editForm.name}</p>
                <div className="mb-3">
                  <label className="form-label">Jumlah</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    value={editForm.quantity}
                    onChange={e => handleEditQuantityChange(Number(e.target.value))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Diskon Item (Rp)</label>
                  <input
                    type="number"
                    className="form-control"
                    min={0}
                    max={editForm.maxDiscount}
                    value={editForm.discount}
                    onChange={e => handleEditDiscountChange(Number(e.target.value))}
                  />
                  <small className="text-muted">Maksimal diskon: Rp {editForm.maxDiscount.toLocaleString('id-ID')}</small>
                </div>
                <div className="mb-3">
                  <label className="form-label">Promo Tersedia</label>
                  {editForm.recommendedDiscount > 0 ? (
                    <div>
                      <p className="mb-2">{editForm.recommendedPromotionName ?? 'Promo aktif'} memberikan potongan Rp {editForm.recommendedDiscount.toLocaleString('id-ID')}.</p>
                      <button type="button" className="btn btn-sm btn-outline-success" onClick={handleApplyPromotionInEdit}>Gunakan Promo</button>
                    </div>
                  ) : (
                    <p className="text-muted mb-0">Tidak ada promo aktif untuk item ini.</p>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-danger me-auto" onClick={() => handleRemoveItem(editingItemId)}>Hapus Item</button>
                <button type="button" className="btn btn-secondary" onClick={handleCloseEditModal}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
