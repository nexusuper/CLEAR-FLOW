import Layout from '@/components/Layout';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const STEPS = [
  { key: 'pending', label: 'Order Received', icon: '📋', desc: 'Your order is in our queue.' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅', desc: 'We\'ve confirmed your order and are preparing your water.' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🛵', desc: 'Your water is on its way!' },
  { key: 'delivered', label: 'Delivered', icon: '🎉', desc: 'Your order has been delivered. Enjoy!' },
];

const STATUS_ORDER = ['pending', 'confirmed', 'out_for_delivery', 'delivered'];

function StatusStepper({ status }) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-2">❌</div>
        <p className="text-red-700 font-semibold">This order has been cancelled.</p>
        <p className="text-red-400 text-sm mt-1">Please contact us if you have questions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const upcoming = i > currentIndex;
        return (
          <div key={step.key} className="flex gap-4">
            {/* Line + circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-colors ${
                  done ? 'bg-sky-500 text-white' :
                  active ? 'bg-sky-500 text-white ring-4 ring-sky-100' :
                  'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? '✓' : step.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 ${done ? 'bg-sky-400' : 'bg-gray-200'}`} style={{ minHeight: '2rem' }} />
              )}
            </div>
            {/* Content */}
            <div className={`pb-6 ${i === STEPS.length - 1 ? 'pb-0' : ''}`}>
              <p className={`font-bold ${active ? 'text-sky-700' : done ? 'text-sky-500' : 'text-gray-400'}`}>
                {step.label}
                {active && <span className="ml-2 text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full">Current</span>}
              </p>
              {!upcoming && (
                <p className={`text-sm mt-0.5 ${active ? 'text-gray-600' : 'text-gray-400'}`}>{step.desc}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Track() {
  const router = useRouter();
  const { id: queryId } = router.query;

  const [inputId, setInputId] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchOrder = useCallback(async (id) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders/${id.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) throw new Error('Order not found. Please check your Order ID.');
      setOrder(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
      setOrder(null);
    }
    setLoading(false);
  }, []);

  // Auto-load from URL query
  useEffect(() => {
    if (queryId) {
      setInputId(queryId);
      fetchOrder(queryId);
    }
  }, [queryId, fetchOrder]);

  // Auto-refresh every 30s when tracking active order
  useEffect(() => {
    if (!order || order.status === 'delivered' || order.status === 'cancelled') return;
    const interval = setInterval(() => fetchOrder(order.id), 30000);
    return () => clearInterval(interval);
  }, [order, fetchOrder]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!inputId.trim()) return;
    router.push(`/track?id=${inputId.trim().toUpperCase()}`, undefined, { shallow: true });
    fetchOrder(inputId.trim());
  }

  return (
    <Layout title="Track Your Order — Clear Flow">
      <section className="bg-gradient-to-r from-sky-500 to-sky-400 text-white py-10 text-center">
        <div className="text-4xl mb-2">🔍</div>
        <h1 className="text-3xl font-extrabold">Track Your Order</h1>
        <p className="text-sky-100 mt-1">Enter your Order ID to see your delivery status.</p>
      </section>

      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        {/* Search form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">Order ID</label>
          <div className="flex gap-2">
            <input
              value={inputId}
              onChange={(e) => setInputId(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3D4"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300 font-mono uppercase"
              maxLength={8}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-sky-500 hover:bg-sky-600 text-white font-bold px-5 py-2.5 rounded-lg transition-colors disabled:bg-sky-300"
            >
              {loading ? '...' : 'Track'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </form>

        {/* Order status */}
        {order && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Order ID</p>
                  <p className="font-mono font-extrabold text-sky-600 text-xl tracking-widest">{order.id}</p>
                </div>
                <button
                  onClick={() => fetchOrder(order.id)}
                  className="text-sky-500 hover:text-sky-700 text-sm font-medium"
                >
                  ↻ Refresh
                </button>
              </div>

              <div className="text-sm text-gray-500 mb-5 space-y-1">
                <div><span className="font-medium text-gray-700">Name:</span> {order.customer_name}</div>
                <div><span className="font-medium text-gray-700">Address:</span> {order.address}, {order.barangay}</div>
                <div><span className="font-medium text-gray-700">Total:</span> <span className="text-sky-600 font-bold">₱{order.total_amount}</span></div>
              </div>

              <StatusStepper status={order.status} />

              {lastUpdated && (
                <p className="text-xs text-gray-300 text-right mt-4">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && ' · Auto-refreshes every 30s'}
                </p>
              )}
            </div>

            {(order.status !== 'delivered' && order.status !== 'cancelled') && (
              <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100 text-sm text-sky-700 text-center">
                📞 Questions about your order? Call us at <strong>0912-345-6789</strong>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Link href="/order" className="block text-center bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-full transition-colors">
                Place Another Order
              </Link>
              <Link href="/" className="block text-center border border-sky-300 text-sky-600 font-semibold py-3 rounded-full hover:bg-sky-50 transition-colors">
                Back to Home
              </Link>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
