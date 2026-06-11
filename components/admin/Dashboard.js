import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin } from './AdminLayout';

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  out_for_delivery: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });

function KpiCard({ label, value, sub, accent = 'text-sky-600' }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-extrabold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function SalesChart({ chart }) {
  const max = Math.max(...chart.map((d) => d.delivery + d.walkin), 1);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-700">Sales — Last 14 Days</h2>
        <div className="flex gap-3 text-xs text-gray-400">
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-500 mr-1" />Delivery</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-cyan-400 mr-1" />Walk-in</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-40">
        {chart.map((d) => {
          const total = d.delivery + d.walkin;
          return (
            <div key={d.day} className="flex-1 flex flex-col justify-end items-center group relative">
              <div className="absolute -top-7 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                {d.day.slice(5)}: {peso(total)}
              </div>
              <div className="w-full rounded-t bg-cyan-400" style={{ height: `${(d.walkin / max) * 100}%` }} />
              <div className="w-full bg-sky-500" style={{ height: `${(d.delivery / max) * 100}%` }} />
              <div className="text-[9px] text-gray-400 mt-1">{d.day.slice(8)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { authFetch } = useAdmin();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await authFetch('/api/admin/dashboard');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
        {error} <button onClick={load} className="underline font-semibold ml-2">Retry</button>
      </div>
    );
  }
  if (!data) return <div className="text-gray-400 text-center py-16">Loading dashboard...</div>;

  const pendingCount = (data.statusCounts.pending || 0) + (data.statusCounts.confirmed || 0) + (data.statusCounts.out_for_delivery || 0);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Sales Today" value={peso(data.revenue.today)} sub="Delivered + walk-in" />
        <KpiCard label="Sales This Week" value={peso(data.revenue.week)} sub="Last 7 days" />
        <KpiCard label="Sales This Month" value={peso(data.revenue.month)} sub={`Expenses: ${peso(data.monthExpenses)}`} />
        <KpiCard
          label="Net This Month"
          value={peso(data.monthNet)}
          sub="Sales minus expenses"
          accent={data.monthNet >= 0 ? 'text-green-600' : 'text-red-500'}
        />
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Link href="/admin/orders" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-sky-300 transition-colors block">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active Orders</div>
              <div className="text-2xl font-extrabold text-orange-500">{pendingCount}</div>
              <div className="text-xs text-gray-400 mt-1">
                {data.statusCounts.pending || 0} pending · {data.statusCounts.confirmed || 0} confirmed · {data.statusCounts.out_for_delivery || 0} out for delivery
              </div>
            </div>
            <span className="text-3xl">📦</span>
          </div>
        </Link>
        <Link href="/admin/inventory" className={`rounded-2xl p-5 shadow-sm border block transition-colors ${data.lowStock.length > 0 ? 'bg-red-50 border-red-200 hover:border-red-400' : 'bg-white border-gray-100 hover:border-sky-300'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Low Stock Items</div>
              <div className={`text-2xl font-extrabold ${data.lowStock.length > 0 ? 'text-red-500' : 'text-green-600'}`}>
                {data.lowStock.length}
              </div>
              <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">
                {data.lowStock.length > 0 ? data.lowStock.map((i) => i.name).join(', ') : 'All stock levels OK'}
              </div>
            </div>
            <span className="text-3xl">{data.lowStock.length > 0 ? '⚠️' : '✅'}</span>
          </div>
        </Link>
      </div>

      {/* Chart + top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <SalesChart chart={data.chart} />
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-700 mb-4">Top Products This Month</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-gray-400 text-sm">No sales yet this month.</p>
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((p, i) => (
                <div key={p.product} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    <span className="font-bold text-sky-600 mr-2">#{i + 1}</span>{p.product}
                  </span>
                  <span className="font-semibold text-gray-700">{p.quantity} refills</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="font-bold text-gray-700">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm text-sky-600 hover:underline font-medium">Manage all →</Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No orders in the last 35 days</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">ID</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Order</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Total</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o, i) => (
                  <tr key={o.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-5 py-3 font-mono font-bold text-sky-600">{o.id}</td>
                    <td className="px-5 py-3 text-gray-700">{o.customer_name}</td>
                    <td className="px-5 py-3 text-gray-600">{o.product_type} x{o.quantity}</td>
                    <td className="px-5 py-3 font-bold text-sky-600">{peso(o.total_amount)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
