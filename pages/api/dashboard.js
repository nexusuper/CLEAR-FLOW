import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const adminRate = rateLimit({ windowMs: 60_000, max: 60 });

// YYYY-MM-DD in Asia/Manila
function manilaDate(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const today = manilaDate();
    const monthPrefix = today.slice(0, 7); // YYYY-MM

    // 30-day window: build the list of dates (oldest..today) in Manila tz
    const days = [];
    for (let i = 29; i >= 0; i--) {
      days.push(manilaDate(new Date(Date.now() - i * 86_400_000)));
    }
    // Query lower bound covers BOTH the 30-day series and the full current
    // month (the latter can start before the 30-day window late in a long month).
    const monthStart = `${monthPrefix}-01`;
    const windowStart = days[0] < monthStart ? days[0] : monthStart;

    // Pull orders created within the window (created_at is ISO; compare by date prefix).
    const recent = await sql`
      SELECT created_at, total_amount, status, phone_normalized
      FROM orders
      WHERE created_at >= ${windowStart}
    `;

    // KPIs (this calendar month, Manila)
    const monthOrders = recent.filter(
      (o) => manilaDate(new Date(o.created_at)).slice(0, 7) === monthPrefix && o.status !== 'cancelled'
    );
    const revenueThisMonth = monthOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const ordersThisMonth = monthOrders.length;
    const avgOrderValue = ordersThisMonth > 0 ? revenueThisMonth / ordersThisMonth : 0;
    const activeCustomers30d = new Set(
      recent.map((o) => o.phone_normalized).filter(Boolean)
    ).size;

    // Revenue series (zero-filled per day, Manila), excluding cancelled
    const seriesMap = new Map(days.map((d) => [d, { date: d, revenue: 0, orders: 0 }]));
    for (const o of recent) {
      if (o.status === 'cancelled') continue;
      const d = manilaDate(new Date(o.created_at));
      const entry = seriesMap.get(d);
      if (entry) {
        entry.revenue += Number(o.total_amount) || 0;
        entry.orders += 1;
      }
    }
    const revenueSeries = days.map((d) => {
      const e = seriesMap.get(d);
      return { date: d, revenue: Math.round(e.revenue * 100) / 100, orders: e.orders };
    });

    // Status breakdown (all-time)
    const statusRows = await sql`
      SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status ORDER BY count DESC
    `;
    const statusBreakdown = statusRows.map((r) => ({ status: r.status, count: Number(r.count) }));

    // Top barangays (all-time, by order count)
    const barangayRows = await sql`
      SELECT barangay, COUNT(*)::int AS count
      FROM orders
      WHERE barangay IS NOT NULL AND barangay <> ''
      GROUP BY barangay ORDER BY count DESC LIMIT 5
    `;
    const topBarangays = barangayRows.map((r) => ({ barangay: r.barangay, count: Number(r.count) }));

    // Top customers (all-time, by spend; exclude cancelled)
    const customerRows = await sql`
      SELECT phone_normalized,
             MAX(customer_name) AS customer_name,
             MAX(phone) AS phone_display,
             SUM(total_amount)::float AS total_spent,
             COUNT(*)::int AS total_orders
      FROM orders
      WHERE status <> 'cancelled' AND phone_normalized IS NOT NULL AND phone_normalized <> ''
      GROUP BY phone_normalized
      ORDER BY total_spent DESC
      LIMIT 5
    `;
    const topCustomers = customerRows.map((r) => ({
      customer_name: r.customer_name,
      phone_display: r.phone_display,
      total_spent: Math.round((Number(r.total_spent) || 0) * 100) / 100,
      total_orders: Number(r.total_orders),
    }));

    return res.status(200).json({
      kpis: {
        revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
        ordersThisMonth,
        activeCustomers30d,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      },
      revenueSeries,
      statusBreakdown,
      topBarangays,
      topCustomers,
    });
  } catch (err) {
    console.error('Dashboard query failed:', err);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
}
