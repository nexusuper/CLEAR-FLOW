import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from './AdminLayout';

const CATEGORIES = ['containers', 'caps & seals', 'filters', 'cleaning', 'supplies', 'other'];

export default function InventoryPanel() {
  const { authFetch } = useAdmin();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjusting, setAdjusting] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);
  const [history, setHistory] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [addForm, setAddForm] = useState({ name: '', category: 'containers', unit: 'pcs', quantity: 0, low_stock_threshold: 0 });
  const [adjustForm, setAdjustForm] = useState({ direction: 'in', amount: 1, reason: '' });

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/inventory');
    if (res.ok) setItems(await res.json());
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load(); }, [load]);

  async function addItem(e) {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add item');
      setShowAdd(false);
      setAddForm({ name: '', category: 'containers', unit: 'pcs', quantity: 0, low_stock_threshold: 0 });
      await load();
    } catch (err) {
      setError(err.message);
    }
    setAdding(false);
  }

  async function applyAdjust(e) {
    e.preventDefault();
    setAdjusting(true);
    setError('');
    const change = (adjustForm.direction === 'in' ? 1 : -1) * Math.abs(Number(adjustForm.amount));
    try {
      const res = await authFetch('/api/admin/inventory/' + adjustModal.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjust: change, reason: adjustForm.reason || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Adjustment failed');
      setAdjustModal(null);
      setAdjustForm({ direction: 'in', amount: 1, reason: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
    setAdjusting(false);
  }

  async function openHistory(item) {
    setHistoryModal(item);
    setHistory(null);
    const res = await authFetch('/api/admin/inventory/' + item.id);
    if (res.ok) setHistory(await res.json());
    else setHistory([]);
  }

  async function deleteItem(id) {
    setDeleting(true);
    await authFetch('/api/admin/inventory/' + id, { method: 'DELETE' });
    setDeleteModal(null);
    setDeleting(false);
    await load();
  }

  if (!loaded) return <div className="text-gray-400 text-center py-16">Loading inventory...</div>;

  const lowCount = items.filter((i) => Number(i.low_stock_threshold) > 0 && Number(i.quantity) <= Number(i.low_stock_threshold)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          {items.length} items{lowCount > 0 && <span className="text-red-500 font-semibold"> · {lowCount} low on stock</span>}
        </p>
        <button onClick={() => setShowAdd(true)} className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors">
          + Add Item
        </button>
      </div>

      {error && !adjustModal && !showAdd && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {items.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <div className="text-4xl mb-2">🫙</div>
            <p>No inventory items yet.</p>
            <p className="text-sm">Add containers, caps, seals, filters and other supplies to track stock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">In Stock</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Low-stock Alert</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const low = Number(item.low_stock_threshold) > 0 && Number(item.quantity) <= Number(item.low_stock_threshold);
                  return (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{item.category}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">
                        {Number(item.quantity).toLocaleString()} <span className="font-normal text-gray-400">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {Number(item.low_stock_threshold) > 0 ? `≤ ${item.low_stock_threshold} ${item.unit}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {low ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-600">⚠️ Low stock</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setAdjustModal(item); setError(''); }} className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-semibold px-3 py-1 rounded-full transition-colors">
                            ± Stock
                          </button>
                          <button onClick={() => openHistory(item)} title="Movement history" className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold px-2 py-1 rounded-full transition-colors">
                            🕘
                          </button>
                          <button onClick={() => setDeleteModal(item)} title="Delete item" className="text-xs bg-red-100 hover:bg-red-200 text-red-600 font-semibold px-2 py-1 rounded-full transition-colors">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add item modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <form onSubmit={addItem} className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-sky-800">Add Inventory Item</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                required
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 5-Gal Slim Containers (empty)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 capitalize"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  value={addForm.unit}
                  onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="pcs"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starting quantity</label>
                <input
                  type="number"
                  min="0"
                  value={addForm.quantity}
                  onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert when ≤</label>
                <input
                  type="number"
                  min="0"
                  value={addForm.low_stock_threshold}
                  onChange={(e) => setAddForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" disabled={adding} className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-full transition-colors disabled:opacity-50">
                {adding ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Adjust stock modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <form onSubmit={applyAdjust} className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold text-sky-800">Adjust Stock</h2>
            <p className="text-sm text-gray-500">
              {adjustModal.name} — currently <strong>{adjustModal.quantity} {adjustModal.unit}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustForm((f) => ({ ...f, direction: 'in' }))}
                className={`py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${adjustForm.direction === 'in' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}
              >
                ⬆ Stock In
              </button>
              <button
                type="button"
                onClick={() => setAdjustForm((f) => ({ ...f, direction: 'out' }))}
                className={`py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${adjustForm.direction === 'out' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500'}`}
              >
                ⬇ Stock Out
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                min="1"
                required
                value={adjustForm.amount}
                onChange={(e) => setAdjustForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Restock delivery, sold, damaged"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setAdjustModal(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" disabled={adjusting} className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-full transition-colors disabled:opacity-50">
                {adjusting ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-sky-800 mb-1">Movement History</h2>
            <p className="text-sm text-gray-500 mb-4">{historyModal.name}</p>
            {history === null ? (
              <div className="text-gray-400 text-sm text-center py-6">Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-gray-400 text-sm text-center py-6">No movements recorded</div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {history.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <div className="text-gray-600">{m.reason || 'Adjustment'}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(m.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`font-bold ${Number(m.change) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {Number(m.change) >= 0 ? '+' : ''}{m.change}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setHistoryModal(null)} className="w-full mt-4 bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-full transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-3xl text-center mb-3">🗑️</div>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-1">Delete Item?</h2>
            <p className="text-sm text-gray-500 text-center mb-4">{deleteModal.name} and its movement history will be removed.</p>
            <p className="text-xs text-red-400 text-center mb-5">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => deleteItem(deleteModal.id)} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-full transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
