import { initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { dayKey, todayKey, daysAgoKey, REVENUE_ORDER_STATUSES, sumAmounts } from '@/lib/stats';

const CHART_DAYS = 14;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  try {
    // Pull the recent window once and aggregate in JS — volumes at a refilling
    // station are small, and this keeps timezone handling in one place.
    const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    const [orders, walkins, expenses, inventory] = await Promise.all([
      sql`SELECT id, customer_name, product_type, quantity, status, total_amount, created_at FROM orders WHERE created_at >= ${since} ORDER BY created_at DESC`,
      sql`SELECT id, product_name, sale_type, quantity, total_amount, created_at FROM walkin_sales WHERE created_at >= ${since}`,
      sql`SELECT amount, expense_date FROM expenses WHERE expense_date >= ${daysAgoKey(35)}`,
      sql`SELECT id, name, category, unit, quantity, low_stock_threshold FROM inventory_items ORDER BY name`,
    ]);

    const today = todayKey();
    const monthPrefix = today.slice(0, 7);
    const weekStart = daysAgoKey(6);

    const deliveredOrders = orders.filter((o) => REVENUE_ORDER_STATUSES.includes(o.status));
    const revenueRows = [
      ...deliveredOrders.map((o) => ({ day: dayKey(o.created_at), total_amount: o.total_amount, source: 'delivery' })),
      ...walkins.map((s) => ({ day: dayKey(s.created_at), total_amount: s.total_amount, source: 'walkin' })),
    ];

    const inRange = (rows, from) => rows.filter((r) => r.day >= from && r.day <= today);

    // Daily revenue for the chart
    const chart = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const day = daysAgoKey(i);
      const rows = revenueRows.filter((r) => r.day === day);
      chart.push({
        day,
        delivery: sumAmounts(rows.filter((r) => r.source === 'delivery')),
        walkin: sumAmounts(rows.filter((r) => r.source === 'walkin')),
      });
    }

    // Top products this month (delivered orders + walk-ins, by refill quantity)
    const productCounts = {};
    for (const o of deliveredOrders) {
      if (dayKey(o.created_at).startsWith(monthPrefix)) {
        productCounts[o.product_type] = (productCounts[o.product_type] || 0) + Number(o.quantity);
      }
    }
    for (const s of walkins) {
      if (dayKey(s.created_at).startsWith(monthPrefix)) {
        const key = s.product_id || s.product_name;
        productCounts[key] = (productCounts[key] || 0) + Number(s.quantity);
      }
    }
    const topProducts = Object.entries(productCounts)
      .map(([product, quantity]) => ({ product, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const monthExpenses = expenses
      .filter((e) => String(e.expense_date).startsWith(monthPrefix))
      .reduce((acc, e) => acc + Number(e.amount), 0);

    const lowStock = inventory.filter(
      (i) => Number(i.low_stock_threshold) > 0 && Number(i.quantity) <= Number(i.low_stock_threshold)
    );

    const statusCounts = {};
    for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

    return res.status(200).json({
      revenue: {
        today: sumAmounts(revenueRows.filter((r) => r.day === today)),
        week: sumAmounts(inRange(revenueRows, weekStart)),
        month: sumAmounts(revenueRows.filter((r) => r.day.startsWith(monthPrefix))),
      },
      monthExpenses,
      monthNet: sumAmounts(revenueRows.filter((r) => r.day.startsWith(monthPrefix))) - monthExpenses,
      statusCounts,
      chart,
      topProducts,
      lowStock,
      recentOrders: orders.slice(0, 8),
    });
  } catch (err) {
    return res.status(500).json({ error: `Query failed: ${err.message}` });
  }
}
