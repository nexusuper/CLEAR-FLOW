import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from './AdminLayout';

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });

const PAYMENT_METHODS = [
  { id: 'cash', label: '💵 Cash' },
  { id: 'gcash', label: '📱 GCash' },
  { id: 'paymaya', label: '💳 PayMaya' },
];

export default function PosPanel() {
  const { authFetch } = useAdmin();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    product_id: '',
    sale_type: 'refill',
    quantity: 1,
    payment_method: 'cash',
    notes: '',
    custom_price: '', // optional manual override
  });

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      authFetch('/api/admin/products'),
      authFetch('/api/admin/sales?limit=50'),
    ]);
    if (pRes.ok) {
      const list = await pRes.json();
      setProducts(list);
      setForm((f) => (f.product_id || list.length === 0 ? f : { ...f, product_id: list[0].id }));
    }
    if (sRes.ok) setSales(await sRes.json());
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load(); }, [load]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const product = products.find((p) => p.id === form.product_id);
  const defaultPrice = product
    ? Number(form.sale_type === 'container' ? product.container_price : product.refill_price)
    : 0;
  const unitPrice = form.custom_price !== '' ? Number(form.custom_price) : defaultPrice;
  const total = unitPrice * (Number(form.quantity) || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!product || total <= 0) return;
    setSaving(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          product_name: product.name,
          sale_type: form.sale_type,
          quantity: Number(form.quantity),
          unit_price: unitPrice,
          total_amount: total,
          payment_method: form.payment_method,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record sale');
      setSavedToast(`Sale recorded — ${peso(total)}`);
      setTimeout(() => setSavedToast(null), 3000);
      setForm((f) => ({ ...f, quantity: 1, notes: '', custom_price: '' }));
      await load();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function deleteSale(id) {
    setDeleting(true);
    await authFetch('/api/admin/sales/' + id, { method: 'DELETE' });
    setDeleteModal(null);
    setDeleting(false);
    await load();
  }

  if (!loaded) return <div className="text-gray-400 text-center py-16">Loading...</div>;

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const todaySales = sales.filter(
    (s) => new Date(s.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) === today
  );
  const todayTotal = todaySales.reduce((acc, s) => acc + Number(s.total_amount), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Sale form */}
      <div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-700">Record a Walk-in Sale</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
            <div className="grid grid-cols-1 gap-2">
              {products.filter((p) => p.active).map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center justify-between border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                    form.product_id === p.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-sky-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="product_id"
                      checked={form.product_id === p.id}
                      onChange={() => set('product_id', p.id)}
                      className="accent-sky-500"
                    />
                    <span className="font-medium text-gray-700">{p.name}</span>
                  </div>
                  <span className="text-sky-600 font-bold text-sm">
                    {peso(p.refill_price)} / {peso(p.container_price)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.sale_type}
                onChange={(e) => set('sale_type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
              >
                <option value="refill">Refill</option>
                <option value="container">Container + refill</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={form.quantity}
                onChange={(e) => set('quantity', parseInt(e.target.value) || 1)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit price <span className="text-gray-400 font-normal">(override)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.custom_price}
                onChange={(e) => set('custom_price', e.target.value)}
                placeholder={String(defaultPrice)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment</label>
              <select
                value={form.payment_method}
                onChange={(e) => set('payment_method', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
              >
                {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <div className="bg-sky-50 rounded-xl p-4 flex items-center justify-between border border-sky-200">
            <span className="font-bold text-sky-900">Total</span>
            <span className="text-2xl font-extrabold text-sky-600">{peso(total)}</span>
          </div>

          <button
            type="submit"
            disabled={saving || !product || total <= 0}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-bold py-3.5 rounded-full transition-colors"
          >
            {saving ? 'Saving...' : 'Record Sale'}
          </button>
        </form>
      </div>

      {/* Recent sales */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">Walk-in Sales Today</div>
            <div className="text-2xl font-extrabold text-sky-600">{peso(todayTotal)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase tracking-wide">Transactions</div>
            <div className="text-2xl font-extrabold text-gray-700">{todaySales.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">Recent Walk-in Sales</div>
          {sales.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No walk-in sales recorded yet</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
              {sales.map((s) => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">
                      {s.product_name} <span className="text-gray-400">({s.sale_type})</span> x{s.quantity}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}<span className="uppercase">{s.payment_method}</span>
                      {s.notes ? ` · ${s.notes}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-sky-600">{peso(s.total_amount)}</span>
                    <button onClick={() => setDeleteModal(s)} title="Delete sale" className="text-xs bg-red-100 hover:bg-red-200 text-red-600 font-semibold px-2 py-1 rounded-full transition-colors">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Saved toast */}
      {savedToast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-green-500 text-white rounded-xl shadow-lg px-4 py-3 font-medium">✅ {savedToast}</div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-3xl text-center mb-3">🗑️</div>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-1">Delete Sale?</h2>
            <p className="text-sm text-gray-500 text-center mb-4">
              {deleteModal.product_name} x{deleteModal.quantity} — {peso(deleteModal.total_amount)}
            </p>
            <p className="text-xs text-red-400 text-center mb-5">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => deleteSale(deleteModal.id)} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-full transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
