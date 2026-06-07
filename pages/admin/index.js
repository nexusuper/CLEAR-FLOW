import { useState } from 'react';
import Head from 'next/head';

const NOTIFIABLE_STATUSES = ['confirmed', 'out_for_delivery', 'delivered', 'cancelled'];

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

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);
  const [savedPassword, setSavedPassword] = useState('');
  const [notifyModal, setNotifyModal] = useState(null); // { phone, message, sent, via }
  const [notifying, setNotifying] = useState(null);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/orders', { headers: { password } });
    if (res.ok) {
      const data = await res.json();
      setOrders(data);
      setSavedPassword(password);
      setAuthed(true);
    } else {
      setError('Invalid password');
    }
    setLoading(false);
  }

  async function fetchOrders() {
    const res = await fetch('/api/orders', { headers: { password: savedPassword } });
    if (res.ok) setOrders(await res.json());
  }

  async function updateStatus(id, status) {
    setUpdating(id);
    await fetch(`/api/orders/${id}`, {
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
    const data = await res.json();
    setNotifyModal(data);
    setNotifying(null);
  }

  const filtered = orders.filter((o) => {
    const matchFilter = filter === 'all' || o.status === filter;
    const matchSearch =
      !search ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.phone.includes(search) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  if (!authed) {
    return (
      <>
        <Head><title>Admin — Clear Flow</title></Head>
        <div className="min-h-screen bg-sky-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🔒</div>
              <h1 className="text-2xl font-bold text-sky-800">Admin Panel</h1>
              <p className="text-gray-400 text-sm">Clear Flow Order Management</p>
            </div>
            <form onSubmit={login} className="space-y-4">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-full transition-colors"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Admin — Clear Flow</title></Head>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-sky-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Clear Flow — Admin</h1>
            <p className="text-sky-200 text-sm">{orders.length} total orders</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchOrders} className="bg-sky-500 hover:bg-sky-400 px-4 py-2 rounded-full text-sm font-medium transition-colors">
              ↻ Refresh
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
            {STATUS_OPTIONS.map((s) => {
              const count = orders.filter((o) => o.status === s.value).length;
              return (
                <button
                  key={s.value}
                  onClick={() => setFilter(filter === s.value ? 'all' : s.value)}
                  className={`rounded-xl p-3 text-center border-2 transition-colors ${
                    filter === s.value ? 'border-sky-500 bg-sky-50' : 'bg-white border-transparent'
                  }`}
                >
                  <div className="text-2xl font-bold text-sky-700">{count}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, or order ID..."
              className="w-full max-w-md border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            />
          </div>

          {/* Notify Modal */}
          {notifyModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
                <h2 className="text-lg font-bold text-sky-800 mb-1">📋 Send Notification</h2>
                <p className="text-sm text-gray-500 mb-1">
                  Copy this message and send it to <strong>{notifyModal.phone}</strong> via SMS, Viber, or Messenger:
                </p>
                <div className="bg-sky-50 rounded-xl p-4 text-sm text-gray-700 mb-4 border border-sky-100 leading-relaxed">
                  {notifyModal.message}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(notifyModal.message)}
                    className="flex-1 border border-sky-300 text-sky-600 font-semibold py-2 rounded-full hover:bg-sky-50 transition-colors text-sm"
                  >
                    Copy Message
                  </button>
                  <button
                    onClick={() => setNotifyModal(null)}
                    className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 rounded-full transition-colors text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Orders table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No orders found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Address</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Order</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Total</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Notify</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o, i) => (
                      <tr key={o.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-3 font-mono font-bold text-sky-600">{o.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{o.customer_name}</div>
                          <div className="text-gray-400 text-xs">{o.phone}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[150px]">
                          <div className="truncate">{o.address}</div>
                          <div className="text-gray-400 text-xs">{o.barangay}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-700">{o.product_type} x{o.quantity}</div>
                          {o.need_container ? (
                            <div className="text-gray-400 text-xs">+{o.container_quantity} container(s)</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="uppercase text-xs font-semibold text-gray-600">{o.payment_method}</div>
                          {o.reference_number && <div className="text-gray-400 text-xs">Ref: {o.reference_number}</div>}
                        </td>
                        <td className="px-4 py-3 font-bold text-sky-600">₱{o.total_amount}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(o.created_at).toLocaleDateString('en-PH', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={o.status}
                            disabled={updating === o.id}
                            onChange={(e) => updateStatus(o.id, e.target.value)}
                            className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[o.status]}`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {NOTIFIABLE_STATUSES.includes(o.status) && (
                            <button
                              onClick={() => notifyCustomer(o.id, o.status)}
                              disabled={notifying === o.id}
                              title="Send notification to customer"
                              className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 font-semibold px-3 py-1 rounded-full transition-colors disabled:opacity-50"
                            >
                              {notifying === o.id ? '...' : '📨 Notify'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
