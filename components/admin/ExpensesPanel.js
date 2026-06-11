import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from './AdminLayout';

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });

const CATEGORIES = ['electricity', 'water source', 'filters & maintenance', 'salaries', 'fuel & delivery', 'rent', 'supplies', 'other'];

function manilaToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export default function ExpensesPanel() {
  const { authFetch } = useAdmin();
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ category: 'electricity', description: '', amount: '', expense_date: manilaToday() });

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/expenses');
    if (res.ok) setExpenses(await res.json());
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load(); }, [load]);

  async function addExpense(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add expense');
      setForm({ category: form.category, description: '', amount: '', expense_date: form.expense_date });
      await load();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function deleteExpense(id) {
    setDeleting(true);
    await authFetch('/api/admin/expenses/' + id, { method: 'DELETE' });
    setDeleteModal(null);
    setDeleting(false);
    await load();
  }

  if (!loaded) return <div className="text-gray-400 text-center py-16">Loading expenses...</div>;

  const monthPrefix = manilaToday().slice(0, 7);
  const monthExpenses = expenses.filter((e) => String(e.expense_date).startsWith(monthPrefix));
  const monthTotal = monthExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

  const byCategory = {};
  for (const e of monthExpenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  }

  const setF = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Form + month summary */}
      <div className="space-y-4">
        <form onSubmit={addExpense} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-700">Record an Expense</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={form.category}
              onChange={(e) => setF('category', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 capitalize"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱) *</label>
            <input
              type="number" min="0.01" step="0.01" required
              value={form.amount}
              onChange={(e) => setF('amount', e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date" required
              value={form.expense_date}
              onChange={(e) => setF('expense_date', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setF('description', e.target.value)}
              placeholder="e.g. Meralco bill for May"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-full transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Expense'}
          </button>
        </form>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">This Month</div>
          <div className="text-2xl font-extrabold text-red-500 mb-3">{peso(monthTotal)}</div>
          {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <div key={cat} className="flex justify-between text-sm py-1">
              <span className="text-gray-600 capitalize">{cat}</span>
              <span className="font-semibold text-gray-700">{peso(amt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expense list */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">Recent Expenses</div>
          {expenses.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <div className="text-4xl mb-2">💸</div>
              <p>No expenses recorded yet.</p>
              <p className="text-sm">Track electricity, filters, salaries and more to see your real profit.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.expense_date}</td>
                      <td className="px-4 py-3 capitalize text-gray-700">{e.category}</td>
                      <td className="px-4 py-3 text-gray-500">{e.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-500">{peso(e.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setDeleteModal(e)} title="Delete expense" className="text-xs bg-red-100 hover:bg-red-200 text-red-600 font-semibold px-2 py-1 rounded-full transition-colors">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-3xl text-center mb-3">🗑️</div>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-1">Delete Expense?</h2>
            <p className="text-sm text-gray-500 text-center mb-4">
              {deleteModal.category} — {peso(deleteModal.amount)} on {deleteModal.expense_date}
            </p>
            <p className="text-xs text-red-400 text-center mb-5">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => deleteExpense(deleteModal.id)} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-full transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
