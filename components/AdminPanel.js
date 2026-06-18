import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import ClayIcon from './ui/ClayIcon';

const NOTIFIABLE_STATUSES = ['confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
const DELETABLE_STATUSES = ['delivered', 'cancelled'];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  out_for_delivery: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'total_desc', label: 'Total: High → Low' },
  { value: 'total_asc', label: 'Total: Low → High' },
  { value: 'name_asc', label: 'Name: A → Z' },
  { value: 'name_desc', label: 'Name: Z → A' },
  { value: 'status_asc', label: 'Status' },
];


function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/orders', { headers: { password } });
    if (res.ok) {
      const data = await res.json();
      onLogin(password, data);
    } else {
      setError('Invalid password');
    }
    setLoading(false);
  }

  return (
    <>
      <Head><title>Admin — Clear Flow</title></Head>
      <div className="min-h-screen bg-clay-bg flex items-center justify-center px-4">
        <div className="clay-raised rounded-3xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <ClayIcon name="lock" className="w-10 h-10 mx-auto mb-2 text-clay-sky" />
            <h1 className="text-2xl font-bold text-clay-ink font-display">Admin Panel</h1>
            <p className="text-gray-400 text-sm">Clear Flow Order Management</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="clay-input"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full clay-btn-primary clay-pressable rounded-full py-3 font-display font-semibold"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState([]);
  const [savedPassword, setSavedPassword] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [updating, setUpdating] = useState(null);
  const [notifyModal, setNotifyModal] = useState(null);
  const [notifying, setNotifying] = useState(null);
  const [messengerNotifying, setMessengerNotifying] = useState(null);
  const [messengerResult, setMessengerResult] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [applyRewardModal, setApplyRewardModal] = useState(null);
  const [applyingReward, setApplyingReward] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});

  function applyPageData(data) {
    setOrders(data.orders);
    setTotalOrders(data.total);
    setTotalPages(data.totalPages);
    setPage(data.page);
    setStatusCounts(data.statusCounts || {});
    setSelected([]);
  }

  function handleLogin(password, data) {
    setSavedPassword(password);
    applyPageData(data);
    setAuthed(true);
  }

  async function fetchOrders(p, overrides) {
    const f = overrides?.filter ?? filter;
    const s = overrides?.search ?? search;
    const sort = overrides?.sortBy ?? sortBy;
    const target = p || page;
    const params = new URLSearchParams({ page: target, limit: 50, sort });
    if (f && f !== 'all') params.set('status', f);
    if (s) params.set('search', s);
    const res = await fetch(`/api/orders?${params}`, { headers: { password: savedPassword } });
    if (res.ok) {
      const data = await res.json();
      if (data.orders.length === 0 && data.page > 1) {
        return fetchOrders(data.page - 1, overrides);
      }
      applyPageData(data);
    }
  }

  async function updateStatus(id, status) {
    setUpdating(id);
    await fetch('/api/orders/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', password: savedPassword },
      body: JSON.stringify({ status }),
    });
    await fetchOrders();
    setUpdating(null);
  }

  async function notifyCustomer(orderId, status) {
    setNotifying(orderId);
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', password: savedPassword },
      body: JSON.stringify({ orderId, status }),
    });
    setNotifyModal(await res.json());
    setNotifying(null);
  }

  async function notifyViaMessenger(orderId, status) {
    setMessengerNotifying(orderId);
    setMessengerResult(null);
    try {
      const res = await fetch('/api/messenger-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', password: savedPassword },
        body: JSON.stringify({ orderId, status }),
      });
      const data = await res.json();
      setMessengerResult(data);
    } catch (e) {
      setMessengerResult({ error: 'Network error' });
    }
    setMessengerNotifying(null);
  }

  async function deleteOrder(id) {
    setDeleting(id);
    await fetch('/api/orders/' + id, { method: 'DELETE', headers: { password: savedPassword } });
    await fetchOrders();
    setDeleting(null);
    setDeleteModal(null);
  }

  async function applyReward(id) {
    setApplyingReward(id);
    await fetch('/api/orders/' + id + '/apply-reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', password: savedPassword },
    });
    await fetchOrders();
    setApplyingReward(null);
    setApplyRewardModal(null);
  }

  async function bulkDelete() {
    setBulkDeleting(true);
    await fetch('/api/orders/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', password: savedPassword },
      body: JSON.stringify({ ids: selected }),
    });
    await fetchOrders();
    setBulkDeleting(false);
    setBulkDeleteModal(false);
  }

  const searchTimer = useRef(null);
  function handleSearchChange(val) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchOrders(1, { search: val }); }, 400);
  }

  const filtered = orders;

  const deletableInView = filtered.filter((o) => DELETABLE_STATUSES.includes(o.status));
  const allSelected = deletableInView.length > 0 && deletableInView.every((o) => selected.includes(o.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(deletableInView.map((o) => o.id));
    }
  }

  function toggleOne(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (!authed) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      <Head><title>Admin — Clear Flow</title></Head>
      <div className="min-h-screen bg-clay-bg">

        {/* Header */}
        <div className="text-white px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(160deg,#38bdf8,#0284c7)' }}>
          <div>
            <h1 className="text-xl font-bold">Clear Flow — Admin</h1>
            <p className="text-sky-200 text-sm">{totalOrders} total orders</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchOrders} className="bg-sky-500 hover:bg-sky-400 px-4 py-2 rounded-full text-sm font-medium transition-colors">
              <ClayIcon name="refresh" className="w-4 h-4 inline" /> Refresh
            </button>
            <button
              onClick={() => { setAuthed(false); setOrders([]); setSavedPassword(''); }}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => { const next = filter === s.value ? 'all' : s.value; setFilter(next); setPage(1); fetchOrders(1, { filter: next }); }}
                className={'rounded-2xl p-3 text-center clay-raised-sm ' + (filter === s.value ? 'clay-tile-selected' : '')}
              >
                <div className="text-2xl font-bold text-sky-700">{statusCounts[s.value] || 0}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </button>
            ))}
          </div>

          {/* Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, phone, or order ID..."
              className="clay-input flex-1"
            />
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); fetchOrders(1, { sortBy: e.target.value }); setPage(1); }}
              className="clay-input"
            >
              {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Notify Modal */}
          {notifyModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="clay-raised rounded-3xl p-6 max-w-md w-full">
                <h2 className="text-lg font-bold text-sky-800 mb-1"><ClayIcon name="clipboard" className="w-5 h-5 inline mr-1" /> Send Notification</h2>
                <p className="text-sm text-gray-500 mb-3">
                  Copy and send to <strong>{notifyModal.phone}</strong> via SMS, Viber, or Messenger:
                </p>
                <div className="clay-inset rounded-xl p-4 text-sm text-gray-700 mb-4 leading-relaxed">
                  {notifyModal.message}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(notifyModal.message)} className="flex-1 border border-sky-300 text-sky-600 font-semibold py-2 rounded-full hover:bg-sky-50 transition-colors text-sm">
                    Copy Message
                  </button>
                  <button onClick={() => setNotifyModal(null)} className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 rounded-full transition-colors text-sm">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messenger Result Toast */}
          {messengerResult && (
            <div className="fixed bottom-4 right-4 z-50">
              <div className={`rounded-xl shadow-lg p-4 max-w-sm ${messengerResult.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                <div className="flex items-center gap-2">
                  <span>{messengerResult.success ? <ClayIcon name="check" className="w-4 h-4" /> : <ClayIcon name="cancel" className="w-4 h-4" />}</span>
                  <span className="font-medium">
                    {messengerResult.success ? 'Messenger notification sent!' : messengerResult.message || messengerResult.error}
                  </span>
                  <button onClick={() => setMessengerResult(null)} className="ml-2 hover:opacity-70"><ClayIcon name="close" className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Delete Modal */}
          {bulkDeleteModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="clay-raised rounded-3xl p-6 max-w-sm w-full">
                <ClayIcon name="trash" className="w-8 h-8 mx-auto mb-3 text-red-500" />
                <h2 className="text-lg font-bold text-gray-800 text-center mb-2">Delete {selected.length} orders?</h2>
                <p className="text-sm text-gray-500 text-center mb-2">All selected delivered & cancelled orders will be permanently removed.</p>
                <p className="text-xs text-red-400 text-center mb-5">This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setBulkDeleteModal(false)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={bulkDelete} disabled={bulkDeleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-full transition-colors disabled:opacity-50">
                    {bulkDeleting ? 'Deleting...' : 'Delete ' + selected.length}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Single Delete Modal */}
          {deleteModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="clay-raised rounded-3xl p-6 max-w-sm w-full">
                <ClayIcon name="trash" className="w-8 h-8 mx-auto mb-3 text-red-500" />
                <h2 className="text-lg font-bold text-gray-800 text-center mb-1">Delete Order?</h2>
                <p className="text-sm text-gray-500 text-center mb-1">Order <span className="font-mono font-bold text-sky-600">{deleteModal.id}</span></p>
                <p className="text-sm text-gray-500 text-center mb-4">{deleteModal.customer_name} — ₱{deleteModal.total_amount}</p>
                <p className="text-xs text-red-400 text-center mb-5">This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteModal(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={() => deleteOrder(deleteModal.id)} disabled={deleting === deleteModal.id} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-full transition-colors disabled:opacity-50">
                    {deleting === deleteModal.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {applyRewardModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
                <h2 className="text-lg font-bold text-gray-800 text-center mb-1">Apply free refill reward?</h2>
                <p className="text-sm text-gray-500 text-center mb-1">Order <span className="font-mono font-bold text-sky-600">{applyRewardModal.id}</span></p>
                <p className="text-sm text-gray-500 text-center mb-4">{applyRewardModal.customer_name} requested {applyRewardModal.reward_requested} free refill(s) (−₱{applyRewardModal.reward_requested * 30}).</p>
                <p className="text-xs text-gray-400 text-center mb-5">Only apply after confirming this is the real customer.</p>
                <div className="flex gap-2">
                  <button onClick={() => setApplyRewardModal(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2 rounded-full hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={() => applyReward(applyRewardModal.id)} disabled={applyingReward === applyRewardModal.id} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-full transition-colors disabled:opacity-50">
                    {applyingReward === applyRewardModal.id ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Orders Table */}
          <div className="clay-raised rounded-3xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No orders found</div>
            ) : (
              <>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Showing {filtered.length} of {totalOrders} orders (page {page})</span>
                  {selected.length > 0 && (
                    <button onClick={() => setBulkDeleteModal(true)} className="text-xs bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1 rounded-full transition-colors">
                      <ClayIcon name="trash" className="w-3.5 h-3.5 inline" /> Delete {selected.length} selected
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3">
                          {deletableInView.length > 0 && (
                            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-red-500 cursor-pointer" />
                          )}
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Address</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Order</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Total</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o, i) => (
                        <tr key={o.id} className={(selected.includes(o.id) ? 'bg-red-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                          <td className="px-4 py-3">
                            {DELETABLE_STATUSES.includes(o.status) && (
                              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleOne(o.id)} className="w-4 h-4 accent-red-500 cursor-pointer" />
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-sky-600">{o.id}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800 flex items-center gap-1">
                              {o.customer_name}
                              {o.messenger_psid && <ClayIcon name="chat" title="Messenger linked" className="w-4 h-4 inline text-blue-500" />}
                            </div>
                            <div className="text-gray-400 text-xs">{o.phone}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[150px]">
                            <div className="truncate">{o.address}</div>
                            <div className="text-gray-400 text-xs">{o.barangay}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-700">{o.product_type} x{o.quantity}</div>
                            {o.need_container ? <div className="text-gray-400 text-xs">+{o.container_quantity} container(s)</div> : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="uppercase text-xs font-semibold text-gray-600">{o.payment_method}</div>
                            {o.reference_number && <div className="text-gray-400 text-xs">Ref: {o.reference_number}</div>}
                          </td>
                          <td className="px-4 py-3 font-bold text-sky-600">
                            ₱{o.total_amount}
                            {o.voucher_discount > 0 && (
                              <div className="text-[10px] font-semibold text-emerald-600">−₱{o.voucher_discount} reward</div>
                            )}
                            {o.reward_requested > 0 && (
                              <div className="text-[10px] font-semibold text-amber-600">wants {o.reward_requested} free refill{o.reward_requested > 1 ? 's' : ''}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            {new Date(o.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={o.status}
                              disabled={updating === o.id}
                              onChange={(e) => updateStatus(o.id, e.target.value)}
                              className={'text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ' + STATUS_COLORS[o.status]}
                            >
                              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {NOTIFIABLE_STATUSES.includes(o.status) && (
                                <>
                                  <button onClick={() => notifyCustomer(o.id, o.status)} disabled={notifying === o.id} title="Copy SMS message" className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-semibold px-2 py-1 rounded-full transition-colors disabled:opacity-50">
                                    {notifying === o.id ? '...' : <ClayIcon name="mobile" className="w-4 h-4" />}
                                  </button>
                                  {o.messenger_psid && (
                                    <button onClick={() => notifyViaMessenger(o.id, o.status)} disabled={messengerNotifying === o.id} title="Send via Messenger" className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold px-2 py-1 rounded-full transition-colors disabled:opacity-50">
                                      {messengerNotifying === o.id ? '...' : <ClayIcon name="chat" className="w-4 h-4" />}
                                    </button>
                                  )}
                                </>
                              )}
                              {DELETABLE_STATUSES.includes(o.status) && (
                                <button onClick={() => setDeleteModal(o)} title="Delete order" className="text-xs bg-red-100 hover:bg-red-200 text-red-600 font-semibold px-2 py-1 rounded-full transition-colors">
                                  <ClayIcon name="trash" className="w-4 h-4" />
                                </button>
                              )}
                              {o.reward_requested > 0 && (
                                <button onClick={() => setApplyRewardModal(o)} title="Apply free refill reward" className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold px-2 py-1 rounded-full transition-colors">
                                  Apply reward
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => fetchOrders(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 rounded-full text-sm font-semibold clay-raised-sm disabled:opacity-40 hover:bg-sky-50 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500 px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => fetchOrders(page + 1)}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-full text-sm font-semibold clay-raised-sm disabled:opacity-40 hover:bg-sky-50 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
