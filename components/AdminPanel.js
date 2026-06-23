import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import ClayIcon from './ui/ClayIcon';
import { SEGMENT_DEFS } from '@/lib/segments';

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

  const [activeTab, setActiveTab] = useState('orders');
  const [customers, setCustomers] = useState([]);
  const [custPage, setCustPage] = useState(1);
  const [custTotalPages, setCustTotalPages] = useState(1);
  const [custTotal, setCustTotal] = useState(0);
  const [custSearch, setCustSearch] = useState('');
  const [custSort, setCustSort] = useState('last_order_desc');
  const [custStats, setCustStats] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [custLoading, setCustLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newTags, setNewTags] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [newLogSummary, setNewLogSummary] = useState('');
  const [newLogChannel, setNewLogChannel] = useState('manual');
  const [savingLog, setSavingLog] = useState(false);
  const [custSegment, setCustSegment] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [custTagFilter, setCustTagFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageResult, setMessageResult] = useState(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');

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

  async function togglePaymentVerified(id, verified) {
    await fetch('/api/orders/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', password: savedPassword },
      body: JSON.stringify({ payment_verified: verified }),
    });
    await fetchOrders();
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

  async function fetchCustomers(p, overrides) {
    setCustLoading(true);
    const s = overrides?.search ?? custSearch;
    const sort = overrides?.sort ?? custSort;
    const target = p || custPage;
    const params = new URLSearchParams({ page: target, limit: 50, sort });
    if (s) params.set('search', s);
    const seg = overrides?.segment ?? custSegment;
    if (seg) params.set('segment', seg);
    const tag = overrides?.tag ?? custTagFilter;
    if (tag) params.set('tag', tag);
    try {
      const res = await fetch(`/api/customers?${params}`, { headers: { password: savedPassword } });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setCustTotal(data.total);
        setCustTotalPages(data.totalPages);
        setCustPage(data.page);
      }
    } catch (e) {
      console.error('Failed to fetch customers:', e);
    }
    setCustLoading(false);
  }

  async function fetchCustStats() {
    try {
      const res = await fetch('/api/customers/stats', { headers: { password: savedPassword } });
      if (res.ok) setCustStats(await res.json());
    } catch (e) {
      console.error('Failed to fetch customer stats:', e);
    }
  }

  async function fetchCustomerDetail(phone) {
    setNewNote('');
    setNewTags('');
    setNewLogSummary('');
    setNewLogChannel('manual');
    setQuickMessage('');
    setMessageResult(null);
    setShowTagInput(false);
    setTagInputValue('');
    try {
      const res = await fetch(`/api/customers/${phone}`, { headers: { password: savedPassword } });
      if (res.ok) setSelectedCustomer(await res.json());
    } catch (e) {
      console.error('Failed to fetch customer detail:', e);
    }
  }

  async function saveNote() {
    if (!newNote.trim() || !selectedCustomer) return;
    setSavingNote(true);
    try {
      await fetch(`/api/customers/${selectedCustomer.phone_normalized}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', password: savedPassword },
        body: JSON.stringify({ content: newNote, tags: newTags }),
      });
      setNewNote('');
      setNewTags('');
      await fetchCustomerDetail(selectedCustomer.phone_normalized);
      fetchCustomers();
    } catch (e) {
      console.error('Failed to save note:', e);
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId) {
    if (!selectedCustomer) return;
    try {
      await fetch(`/api/customers/${selectedCustomer.phone_normalized}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { password: savedPassword },
      });
      await fetchCustomerDetail(selectedCustomer.phone_normalized);
      fetchCustomers();
    } catch (e) {
      console.error('Failed to delete note:', e);
    }
  }

  async function saveContactLog() {
    if (!newLogSummary.trim() || !selectedCustomer) return;
    setSavingLog(true);
    try {
      await fetch(`/api/customers/${selectedCustomer.phone_normalized}/contact-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', password: savedPassword },
        body: JSON.stringify({ channel: newLogChannel, direction: 'outbound', summary: newLogSummary }),
      });
      setNewLogSummary('');
      await fetchCustomerDetail(selectedCustomer.phone_normalized);
    } catch (e) {
      console.error('Failed to save contact log:', e);
    }
    setSavingLog(false);
  }

  const custSearchTimer = useRef(null);
  function handleCustSearchChange(val) {
    setCustSearch(val);
    clearTimeout(custSearchTimer.current);
    custSearchTimer.current = setTimeout(() => { setCustPage(1); fetchCustomers(1, { search: val }); }, 400);
  }

  async function fetchAllTags() {
    try {
      const res = await fetch('/api/customers/tags', { headers: { password: savedPassword } });
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || []);
      }
    } catch (e) {
      console.error('Failed to fetch tags:', e);
    }
  }

  async function exportCSV() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ sort: custSort });
      if (custSearch) params.set('search', custSearch);
      if (custTagFilter) params.set('tag', custTagFilter);
      if (custSegment) params.set('segment', custSegment);
      const res = await fetch(`/api/customers/export?${params}`, { headers: { password: savedPassword } });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const headers = ['Name', 'Phone', 'Total Orders', 'Total Spent', 'First Order', 'Last Order', 'Segment', 'Tags'];
      const csvRows = [headers.join(',')];
      for (const c of data.customers) {
        const row = [
          `"${(c.customer_name || '').replace(/"/g, '""')}"`,
          c.phone_normalized,
          c.total_orders,
          c.total_spent,
          c.first_order || '',
          c.last_order || '',
          c.segment || '',
          `"${(c.tags || '').replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(','));
      }
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clear-flow-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
    setExporting(false);
  }

  async function sendQuickMessage() {
    if (!quickMessage.trim() || !selectedCustomer) return;
    setSendingMessage(true);
    setMessageResult(null);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.phone_normalized}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', password: savedPassword },
        body: JSON.stringify({ message: quickMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessageResult({ success: true });
        setQuickMessage('');
        await fetchCustomerDetail(selectedCustomer.phone_normalized);
      } else {
        setMessageResult({ error: data.error || 'Failed to send' });
      }
    } catch (e) {
      setMessageResult({ error: 'Network error' });
    }
    setSendingMessage(false);
  }

  async function addTagToCustomer(tag) {
    if (!tag.trim() || !selectedCustomer) return;
    const existingTags = (selectedCustomer.notes || []).flatMap((n) =>
      typeof n.tags === 'string' ? n.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
    );
    if (existingTags.includes(tag.trim())) return;
    try {
      await fetch(`/api/customers/${selectedCustomer.phone_normalized}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', password: savedPassword },
        body: JSON.stringify({ content: `Tag added: ${tag.trim()}`, tags: tag.trim() }),
      });
      setTagInputValue('');
      setShowTagInput(false);
      await fetchCustomerDetail(selectedCustomer.phone_normalized);
      fetchCustomers();
      fetchAllTags();
    } catch (e) {
      console.error('Failed to add tag:', e);
    }
  }

  useEffect(() => {
    if (activeTab === 'customers' && authed) {
      if (customers.length === 0) fetchCustomers(1);
      fetchCustStats();
      fetchAllTags();
    }
  }, [activeTab, authed]);

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
        <div className="text-white" style={{ background: 'linear-gradient(160deg,#38bdf8,#0284c7)' }}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Clear Flow — Admin</h1>
              <p className="text-sky-200 text-sm">
                {activeTab === 'orders' ? `${totalOrders} total orders` : `${custTotal} customers`}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => activeTab === 'orders' ? fetchOrders() : (fetchCustomers(1), fetchCustStats())} className="bg-sky-500 hover:bg-sky-400 px-4 py-2 rounded-full text-sm font-medium transition-colors">
                <ClayIcon name="refresh" className="w-4 h-4 inline" /> Refresh
              </button>
              <button
                onClick={() => { setAuthed(false); setOrders([]); setSavedPassword(''); setCustomers([]); setSelectedCustomer(null); }}
                className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="flex gap-1 px-6 pb-0">
            <button
              onClick={() => setActiveTab('orders')}
              className={'px-5 py-2 rounded-t-xl text-sm font-semibold transition-colors ' + (activeTab === 'orders' ? 'bg-clay-bg text-sky-700' : 'text-white/70 hover:text-white hover:bg-white/10')}
            >
              <ClayIcon name="clipboard" className="w-4 h-4 inline mr-1" /> Orders
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={'px-5 py-2 rounded-t-xl text-sm font-semibold transition-colors ' + (activeTab === 'customers' ? 'bg-clay-bg text-sky-700' : 'text-white/70 hover:text-white hover:bg-white/10')}
            >
              <ClayIcon name="users" className="w-4 h-4 inline mr-1" /> Customers
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">

          {/* ===== ORDERS TAB ===== */}
          {activeTab === 'orders' && (<>

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
                            {(o.payment_method === 'gcash' || o.payment_method === 'paymaya') && (
                              <label className="flex items-center gap-1 mt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!o.payment_verified}
                                  onChange={(e) => togglePaymentVerified(o.id, e.target.checked)}
                                  className="w-3.5 h-3.5 accent-green-500"
                                />
                                <span className={'text-[10px] font-semibold ' + (o.payment_verified ? 'text-green-600' : 'text-amber-600')}>
                                  {o.payment_verified ? 'Verified' : 'Unverified'}
                                </span>
                              </label>
                            )}
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
                            {o.delivery_slot ? (
                              <div className="text-[10px] font-semibold text-sky-600">
                                {o.delivery_slot === 'am' ? 'AM' : 'PM'}{o.delivery_date ? ` · ${o.delivery_date}` : ''}
                              </div>
                            ) : null}
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
                            {o.sms_pending ? (
                              <div className="text-[10px] font-semibold text-amber-600 mt-1">SMS reminder pending</div>
                            ) : null}
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

          </>)}

          {/* ===== CUSTOMERS TAB ===== */}
          {activeTab === 'customers' && (<>

          {/* Customer Stats Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-2xl p-4 text-center clay-raised-sm">
              <ClayIcon name="users" className="w-6 h-6 mx-auto mb-1 text-sky-600" />
              <div className="text-2xl font-bold text-sky-700">{custStats?.totalCustomers ?? '-'}</div>
              <div className="text-xs text-gray-500">Total Customers</div>
            </div>
            <div className="rounded-2xl p-4 text-center clay-raised-sm">
              <ClayIcon name="check" className="w-6 h-6 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold text-green-700">{custStats?.activeThisMonth ?? '-'}</div>
              <div className="text-xs text-gray-500">Active This Month</div>
            </div>
            <div className="rounded-2xl p-4 text-center clay-raised-sm">
              <ClayIcon name="star" className="w-6 h-6 mx-auto mb-1 text-amber-500" />
              <div className="text-2xl font-bold text-amber-600">{custStats?.newThisMonth ?? '-'}</div>
              <div className="text-xs text-gray-500">New This Month</div>
            </div>
            <div className="rounded-2xl p-4 text-center clay-raised-sm">
              <ClayIcon name="user" className="w-6 h-6 mx-auto mb-1 text-purple-600" />
              <div className="text-lg font-bold text-purple-700 truncate">{custStats?.topSpender?.name ?? '-'}</div>
              <div className="text-xs text-gray-500">Top Spender</div>
            </div>
          </div>

          {/* Segment Filter */}
          {custStats?.segmentCounts && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => { setCustSegment(''); fetchCustomers(1, { segment: '' }); }}
                className={'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ' + (!custSegment ? 'bg-sky-600 text-white' : 'clay-raised-sm text-gray-600 hover:bg-sky-50')}
              >
                All ({custStats.totalCustomers})
              </button>
              {SEGMENT_DEFS.map((seg) => (
                <button
                  key={seg.value}
                  onClick={() => { setCustSegment(seg.value); fetchCustomers(1, { segment: seg.value }); }}
                  className={'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ' + (custSegment === seg.value ? seg.color + ' ring-2 ring-offset-1 ring-sky-400' : seg.color + ' opacity-70 hover:opacity-100')}
                >
                  {seg.label} ({custStats.segmentCounts[seg.value] || 0})
                </button>
              ))}
            </div>
          )}

          {/* Customer Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={custSearch}
              onChange={(e) => handleCustSearchChange(e.target.value)}
              placeholder="Search customers by name or phone..."
              className="clay-input flex-1"
            />
            {allTags.length > 0 && (
              <select
                value={custTagFilter}
                onChange={(e) => { setCustTagFilter(e.target.value); fetchCustomers(1, { tag: e.target.value }); setCustPage(1); }}
                className="clay-input"
              >
                <option value="">All Tags</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <select
              value={custSort}
              onChange={(e) => { setCustSort(e.target.value); fetchCustomers(1, { sort: e.target.value }); setCustPage(1); }}
              className="clay-input"
            >
              <option value="last_order_desc">Last Order: Newest</option>
              <option value="last_order_asc">Last Order: Oldest</option>
              <option value="total_spent_desc">Spent: High to Low</option>
              <option value="total_spent_asc">Spent: Low to High</option>
              <option value="total_orders_desc">Orders: Most</option>
              <option value="total_orders_asc">Orders: Fewest</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
            </select>
            <button
              onClick={exportCSV}
              disabled={exporting}
              className="clay-btn-white clay-pressable rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
            >
              <ClayIcon name="download" className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>

          {/* Customer Table */}
          <div className="clay-raised rounded-3xl overflow-hidden">
            {custLoading ? (
              <div className="text-center py-12 text-gray-400">Loading customers...</div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No customers found</div>
            ) : (
              <>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs text-gray-400">Showing {customers.length} of {custTotal} customers (page {custPage})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Orders</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Total Spent</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Order</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Tags</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Segment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c, i) => (
                        <tr
                          key={c.phone_normalized}
                          onClick={() => fetchCustomerDetail(c.phone_normalized)}
                          className={'cursor-pointer hover:bg-sky-50 transition-colors ' + (i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800 flex items-center gap-1">
                              {c.customer_name}
                              {c.has_messenger && <ClayIcon name="chat" title="Messenger linked" className="w-4 h-4 inline text-blue-500" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">{c.phone_display || c.phone_normalized}</td>
                          <td className="px-4 py-3 font-bold text-sky-600">{c.total_orders}</td>
                          <td className="px-4 py-3 font-bold text-sky-600">{'₱'}{c.total_spent}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            {c.last_order ? new Date(c.last_order).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {c.tags && c.tags.length > 0 && (() => {
                              const tagList = (typeof c.tags === 'string' ? c.tags.split(',').filter(Boolean) : c.tags);
                              return tagList.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {tagList.slice(0, 3).map((t) => (
                                    <span key={t} className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{t.trim()}</span>
                                  ))}
                                  {tagList.length > 3 && <span className="text-[10px] text-gray-400">+{tagList.length - 3}</span>}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            {c.segment && (() => {
                              const def = SEGMENT_DEFS.find((s) => s.value === c.segment);
                              return def ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${def.color}`}>{def.label}</span> : null;
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Customer Pagination */}
          {custTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => fetchCustomers(custPage - 1)}
                disabled={custPage <= 1}
                className="px-4 py-2 rounded-full text-sm font-semibold clay-raised-sm disabled:opacity-40 hover:bg-sky-50 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500 px-3">
                Page {custPage} of {custTotalPages}
              </span>
              <button
                onClick={() => fetchCustomers(custPage + 1)}
                disabled={custPage >= custTotalPages}
                className="px-4 py-2 rounded-full text-sm font-semibold clay-raised-sm disabled:opacity-40 hover:bg-sky-50 transition-colors"
              >
                Next →
              </button>
            </div>
          )}

          {/* ===== CUSTOMER DETAIL SLIDE-OUT ===== */}
          {selectedCustomer && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedCustomer(null)} />
              <div className="relative w-full max-w-xl bg-clay-bg overflow-y-auto shadow-2xl">
                {/* Detail Header */}
                <div className="sticky top-0 z-10 text-white px-6 py-4" style={{ background: 'linear-gradient(160deg,#38bdf8,#0284c7)' }}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedCustomer(null)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                      <ClayIcon name="arrow-left" className="w-4 h-4" />
                    </button>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        {selectedCustomer.customer_name}
                        {selectedCustomer.has_messenger && (
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Messenger</span>
                        )}
                      </h2>
                      <p className="text-sky-200 text-sm">{selectedCustomer.phone_display || selectedCustomer.phone_normalized}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {selectedCustomer.segment && (() => {
                          const def = SEGMENT_DEFS.find((s) => s.value === selectedCustomer.segment);
                          return def ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${def.color}`}>{def.label}</span> : null;
                        })()}
                        {selectedCustomer.notes && selectedCustomer.notes.flatMap((n) =>
                          (typeof n.tags === 'string' ? n.tags.split(',').filter(Boolean) : [])
                        ).filter((v, i, a) => a.indexOf(v) === i).map((t) => (
                          <span key={t} className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{t.trim()}</span>
                        ))}
                        {!showTagInput ? (
                          <button onClick={() => setShowTagInput(true)} className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full transition-colors">
                            <ClayIcon name="plus" className="w-3 h-3 inline" /> Tag
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={tagInputValue}
                              onChange={(e) => setTagInputValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') addTagToCustomer(tagInputValue); if (e.key === 'Escape') { setShowTagInput(false); setTagInputValue(''); } }}
                              placeholder="Add tag..."
                              list="tag-suggestions"
                              className="text-xs bg-white/20 border-0 rounded-full px-2 py-0.5 text-white placeholder-white/50 outline-none w-24"
                              autoFocus
                            />
                            <datalist id="tag-suggestions">
                              {allTags.map((t) => <option key={t} value={t} />)}
                            </datalist>
                            <button onClick={() => { setShowTagInput(false); setTagInputValue(''); }} className="text-white/60 hover:text-white">
                              <ClayIcon name="close" className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="clay-raised-sm rounded-2xl p-3 text-center">
                      <div className="text-xl font-bold text-sky-700">{selectedCustomer.total_orders}</div>
                      <div className="text-xs text-gray-500">Total Orders</div>
                    </div>
                    <div className="clay-raised-sm rounded-2xl p-3 text-center">
                      <div className="text-xl font-bold text-sky-700">{'₱'}{selectedCustomer.total_spent}</div>
                      <div className="text-xs text-gray-500">Total Spent</div>
                    </div>
                    <div className="clay-raised-sm rounded-2xl p-3 text-center">
                      <div className="text-xl font-bold text-sky-700">
                        {selectedCustomer.total_orders > 0 ? `₱${Math.round(selectedCustomer.total_spent / selectedCustomer.total_orders)}` : '-'}
                      </div>
                      <div className="text-xs text-gray-500">Avg Order</div>
                    </div>
                    <div className="clay-raised-sm rounded-2xl p-3 text-center">
                      <div className="text-xl font-bold text-emerald-600">{selectedCustomer.loyalty?.available ?? 0}</div>
                      <div className="text-xs text-gray-500">Free Refills</div>
                    </div>
                  </div>

                  {/* Loyalty Progress */}
                  {selectedCustomer.loyalty && (
                    <div className="clay-raised-sm rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700">
                          <ClayIcon name="star" className="w-4 h-4 inline text-amber-500 mr-1" /> Loyalty Progress
                        </span>
                        <span className="text-xs text-gray-500">
                          {selectedCustomer.loyalty.deliveredGallons} gal delivered &middot; {selectedCustomer.loyalty.gallonsToNext} gal to next free refill
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-amber-500 h-2.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, selectedCustomer.loyalty.progressPct * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="clay-raised-sm rounded-2xl p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      <ClayIcon name="info" className="w-4 h-4 inline mr-1" /> Customer Info
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-400">Phone:</span></div>
                      <div className="font-mono text-gray-700">{selectedCustomer.phone_display || selectedCustomer.phone_normalized}</div>
                      <div><span className="text-gray-400">First Order:</span></div>
                      <div className="text-gray-700">{selectedCustomer.first_order ? new Date(selectedCustomer.first_order).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</div>
                      <div><span className="text-gray-400">Last Order:</span></div>
                      <div className="text-gray-700">{selectedCustomer.last_order ? new Date(selectedCustomer.last_order).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</div>
                      <div><span className="text-gray-400">Messenger:</span></div>
                      <div>{selectedCustomer.has_messenger ? <span className="text-blue-600 font-medium">Linked</span> : <span className="text-gray-400">Not linked</span>}</div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="clay-raised-sm rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      <ClayIcon name="note" className="w-4 h-4 inline mr-1" /> Notes
                    </h3>
                    {/* Add Note Form */}
                    <div className="mb-3 space-y-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note..."
                        rows={2}
                        className="clay-input w-full text-sm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTags}
                          onChange={(e) => setNewTags(e.target.value)}
                          placeholder="Tags (comma-separated)"
                          className="clay-input flex-1 text-sm"
                        />
                        <button
                          onClick={saveNote}
                          disabled={savingNote || !newNote.trim()}
                          className="clay-btn-primary clay-pressable rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                        >
                          {savingNote ? 'Saving...' : 'Add'}
                        </button>
                      </div>
                    </div>
                    {/* Notes List */}
                    {selectedCustomer.notes && selectedCustomer.notes.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCustomer.notes.map((n) => (
                          <div key={n.id} className="clay-inset rounded-xl p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm text-gray-700">{n.content}</p>
                                {n.tags && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(typeof n.tags === 'string' ? n.tags.split(',').filter(Boolean) : n.tags).map((t) => (
                                      <span key={t} className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{t.trim()}</span>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <button onClick={() => deleteNote(n.id)} title="Delete note" className="text-red-400 hover:text-red-600 transition-colors p-1">
                                <ClayIcon name="trash" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">No notes yet</p>
                    )}
                  </div>

                  {/* Contact Log */}
                  <div className="clay-raised-sm rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      <ClayIcon name="phone" className="w-4 h-4 inline mr-1" /> Contact Log
                    </h3>
                    {/* Add Log Entry */}
                    <div className="mb-3 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={newLogChannel}
                          onChange={(e) => setNewLogChannel(e.target.value)}
                          className="clay-input text-sm"
                        >
                          <option value="manual">Manual</option>
                          <option value="call">Call</option>
                          <option value="sms">SMS</option>
                          <option value="messenger">Messenger</option>
                          <option value="viber">Viber</option>
                          <option value="in-person">In Person</option>
                        </select>
                        <input
                          type="text"
                          value={newLogSummary}
                          onChange={(e) => setNewLogSummary(e.target.value)}
                          placeholder="Contact summary..."
                          className="clay-input flex-1 text-sm"
                        />
                        <button
                          onClick={saveContactLog}
                          disabled={savingLog || !newLogSummary.trim()}
                          className="clay-btn-primary clay-pressable rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                        >
                          {savingLog ? '...' : 'Log'}
                        </button>
                      </div>
                    </div>
                    {/* Log Timeline */}
                    {selectedCustomer.contactLog && selectedCustomer.contactLog.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCustomer.contactLog.map((log) => (
                          <div key={log.id} className="clay-inset rounded-xl p-3 flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              <ClayIcon name={log.channel === 'messenger' ? 'chat' : log.channel === 'phone' ? 'phone' : 'note'} className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{log.channel}</span>
                                <span className="text-[10px] text-gray-400">{log.direction}</span>
                              </div>
                              <p className="text-sm text-gray-700 mt-0.5">{log.summary}</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(log.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">No contact log entries</p>
                    )}
                  </div>

                  {/* Messenger Quick-Send */}
                  {selectedCustomer.has_messenger && (
                    <div className="clay-raised-sm rounded-2xl p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        <ClayIcon name="send" className="w-4 h-4 inline mr-1" /> Send Messenger Message
                      </h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={quickMessage}
                          onChange={(e) => setQuickMessage(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !sendingMessage) sendQuickMessage(); }}
                          placeholder="Type a message..."
                          className="clay-input flex-1 text-sm"
                        />
                        <button
                          onClick={sendQuickMessage}
                          disabled={sendingMessage || !quickMessage.trim()}
                          className="clay-btn-primary clay-pressable rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                        >
                          {sendingMessage ? '...' : 'Send'}
                        </button>
                      </div>
                      {messageResult && (
                        <div className={`mt-2 text-xs font-medium ${messageResult.success ? 'text-green-600' : 'text-red-500'}`}>
                          {messageResult.success ? 'Message sent!' : messageResult.error}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order History */}
                  <div className="clay-raised-sm rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      <ClayIcon name="clipboard" className="w-4 h-4 inline mr-1" /> Order History
                    </h3>
                    {selectedCustomer.orders && selectedCustomer.orders.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-100">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs">ID</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs">Date</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs">Items</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs">Total</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedCustomer.orders.map((ord) => (
                              <tr key={ord.id} className="border-b border-gray-50">
                                <td className="px-3 py-2 font-mono text-sky-600 text-xs">{ord.id}</td>
                                <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                                  {new Date(ord.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                </td>
                                <td className="px-3 py-2 text-gray-700 text-xs">{ord.product_type} x{ord.quantity}</td>
                                <td className="px-3 py-2 font-bold text-sky-600 text-xs">{'₱'}{ord.total_amount}</td>
                                <td className="px-3 py-2">
                                  <span className={'text-[10px] font-semibold px-2 py-0.5 rounded-full ' + (STATUS_COLORS[ord.status] || '')}>
                                    {ord.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">No orders</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          </>)}

        </div>
      </div>
    </>
  );
}
