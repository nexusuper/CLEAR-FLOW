import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from './AdminLayout';

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });

const EMPTY_FORM = { id: '', name: '', description: '', refill_price: '', container_price: '', size: '', tag: '', sort_order: 0 };

export default function ProductsPanel() {
  const { authFetch } = useAdmin();
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState(null); // null | 'new' | product
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/products');
    if (res.ok) setProducts(await res.json());
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load(); }, [load]);

  function openEdit(product) {
    setError('');
    if (product === 'new') {
      setForm(EMPTY_FORM);
    } else {
      setForm({
        id: product.id,
        name: product.name,
        description: product.description || '',
        refill_price: product.refill_price,
        container_price: product.container_price,
        size: product.size || '',
        tag: product.tag || '',
        sort_order: product.sort_order || 0,
      });
    }
    setEditModal(product);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const isNew = editModal === 'new';
    const body = {
      ...form,
      refill_price: Number(form.refill_price),
      container_price: Number(form.container_price),
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      const res = await authFetch(isNew ? '/api/admin/products' : '/api/admin/products/' + form.id, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setEditModal(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function toggleActive(product) {
    setToggling(product.id);
    await authFetch('/api/admin/products/' + product.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: product.active ? 0 : 1 }),
    });
    await load();
    setToggling(null);
  }

  async function deleteProduct(id) {
    setDeleting(true);
    await authFetch('/api/admin/products/' + id, { method: 'DELETE' });
    setDeleteModal(null);
    setDeleting(false);
    await load();
  }

  if (!loaded) return <div className="text-gray-400 text-center py-16">Loading products...</div>;

  const setF = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          Prices here drive the customer website and order form. Inactive products are hidden from customers.
        </p>
        <button onClick={() => openEdit('new')} className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shrink-0">
          + Add Product
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Size</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Refill Price</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Container Price</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Visible to Customers</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.tag}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.size || '—'}</td>
                  <td className="px-4 py-3 font-bold text-sky-600">{peso(p.refill_price)}</td>
                  <td className="px-4 py-3 font-bold text-sky-600">{peso(p.container_price)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={toggling === p.id}
                      className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
                        p.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {toggling === p.id ? '...' : p.active ? '✓ Active' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-semibold px-3 py-1 rounded-full transition-colors">
                        ✏️ Edit
                      </button>
                      <button onClick={() => setDeleteModal(p)} title="Delete product" className="text-xs bg-red-100 hover:bg-red-200 text-red-600 font-semibold px-2 py-1 rounded-full transition-colors">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <form onSubmit={save} className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-sky-800">{editModal === 'new' ? 'Add Product' : 'Edit Product'}</h2>
            {editModal === 'new' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product ID *</label>
                <input
                  required
                  value={form.id}
                  onChange={(e) => setF('id', e.target.value)}
                  placeholder="e.g. slim5, alkaline5"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <p className="text-xs text-gray-400 mt-1">Short code, letters/numbers only. Cannot be changed later.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setF('name', e.target.value)}
                placeholder="5-Gallon Slim"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setF('description', e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refill price (₱) *</label>
                <input
                  type="number" min="0" step="0.01" required
                  value={form.refill_price}
                  onChange={(e) => setF('refill_price', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Container price (₱) *</label>
                <input
                  type="number" min="0" step="0.01" required
                  value={form.container_price}
                  onChange={(e) => setF('container_price', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                <input
                  value={form.size}
                  onChange={(e) => setF('size', e.target.value)}
                  placeholder="5-Gal"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
                <input
                  value={form.tag}
                  onChange={(e) => setF('tag', e.target.value)}
                  placeholder="Most Popular"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setF('sort_order', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditModal(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-full transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-3xl text-center mb-3">🗑️</div>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-1">Delete Product?</h2>
            <p className="text-sm text-gray-500 text-center mb-2">{deleteModal.name}</p>
            <p className="text-xs text-gray-400 text-center mb-1">Past orders and sales keep their records.</p>
            <p className="text-xs text-red-400 text-center mb-5">Tip: use “Hidden” instead if you may sell this again.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => deleteProduct(deleteModal.id)} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-full transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
