import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from './AdminLayout';

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });

function manilaToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

const PRESETS = [
  { label: 'Today', from: () => manilaToday(), to: () => manilaToday() },
  { label: 'Last 7 days', from: () => daysAgo(6), to: () => manilaToday() },
  { label: 'Last 30 days', from: () => daysAgo(29), to: () => manilaToday() },
  { label: 'This month', from: () => manilaToday().slice(0, 8) + '01', to: () => manilaToday() },
];

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPanel() {
  const { authFetch } = useAdmin();
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(manilaToday());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (f, t) => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`/api/admin/reports?from=${f}&to=${t}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setReport(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load(from, to); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function exportSalesCsv() {
    if (!report) return;
    downloadCsv(`clearflow-sales-${report.from}-to-${report.to}.csv`, [
      ['ID', 'Date', 'Type', 'Description', 'Payment', 'Amount'],
      ...report.transactions.map((t) => [t.id, t.date, t.type, t.description, t.payment_method, t.amount]),
    ]);
  }

  function exportExpensesCsv() {
    if (!report) return;
    downloadCsv(`clearflow-expenses-${report.from}-to-${report.to}.csv`, [
      ['ID', 'Date', 'Category', 'Description', 'Amount'],
      ...report.expenseList.map((e) => [e.id, e.expense_date, e.category, e.description || '', e.amount]),
    ]);
  }

  return (
    <div className="space-y-5">

      {/* Date range controls */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
          </div>
          <button onClick={() => load(from, to)} disabled={loading}
            className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2 rounded-full text-sm font-bold transition-colors disabled:opacity-50">
            {loading ? 'Loading...' : 'Run Report'}
          </button>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button key={p.label}
                onClick={() => { const f = p.from(); const t = p.to(); setFrom(f); setTo(t); load(f, t); }}
                className="text-xs border border-sky-200 text-sky-600 px-3 py-1.5 rounded-full hover:bg-sky-50 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      {report && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Sales</div>
              <div className="text-2xl font-extrabold text-sky-600">{peso(report.totals.revenue)}</div>
              <div className="text-xs text-gray-400 mt-1">{report.totals.transactionCount} transactions</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Delivery vs Walk-in</div>
              <div className="text-lg font-bold text-gray-700">{peso(report.totals.deliveryRevenue)} <span className="text-gray-300">/</span> {peso(report.totals.walkinRevenue)}</div>
              <div className="text-xs text-gray-400 mt-1">delivered orders / walk-in</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Expenses</div>
              <div className="text-2xl font-extrabold text-red-500">{peso(report.totals.expenses)}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Net Profit</div>
              <div className={`text-2xl font-extrabold ${report.totals.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>{peso(report.totals.net)}</div>
              <div className="text-xs text-gray-400 mt-1">sales − expenses</div>
            </div>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-700 mb-3 text-sm">Sales by Product</h2>
              {Object.keys(report.byProduct).length === 0 ? (
                <p className="text-gray-400 text-sm">No sales in this period.</p>
              ) : (
                Object.entries(report.byProduct).sort((a, b) => b[1].revenue - a[1].revenue).map(([product, d]) => (
                  <div key={product} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600">{product} <span className="text-gray-400">x{d.quantity}</span></span>
                    <span className="font-semibold text-sky-600">{peso(d.revenue)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-700 mb-3 text-sm">Sales by Payment Method</h2>
              {Object.keys(report.byPayment).length === 0 ? (
                <p className="text-gray-400 text-sm">No sales in this period.</p>
              ) : (
                Object.entries(report.byPayment).sort((a, b) => b[1] - a[1]).map(([method, amt]) => (
                  <div key={method} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600 uppercase">{method}</span>
                    <span className="font-semibold text-sky-600">{peso(amt)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-700 mb-3 text-sm">Expenses by Category</h2>
              {Object.keys(report.expensesByCategory).length === 0 ? (
                <p className="text-gray-400 text-sm">No expenses in this period.</p>
              ) : (
                Object.entries(report.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600 capitalize">{cat}</span>
                    <span className="font-semibold text-red-500">{peso(amt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-gray-700 text-sm">Sales Transactions ({report.from} → {report.to})</h2>
              <div className="flex gap-2">
                <button onClick={exportSalesCsv} className="text-xs border border-sky-300 text-sky-600 font-semibold px-3 py-1.5 rounded-full hover:bg-sky-50 transition-colors">
                  ⬇ Export Sales CSV
                </button>
                <button onClick={exportExpensesCsv} className="text-xs border border-gray-300 text-gray-600 font-semibold px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors">
                  ⬇ Export Expenses CSV
                </button>
              </div>
            </div>
            {report.transactions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No sales in this period</div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.transactions.map((t, i) => (
                      <tr key={`${t.type}-${t.id}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{t.date}</td>
                        <td className="px-4 py-2.5 font-mono text-sky-600 font-bold">{t.id}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.type === 'delivery' ? 'bg-sky-100 text-sky-700' : 'bg-cyan-100 text-cyan-700'}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{t.description}</td>
                        <td className="px-4 py-2.5 text-gray-500 uppercase text-xs">{t.payment_method}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-sky-600">{peso(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
