import { initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { dayKey, todayKey, daysAgoKey, REVENUE_ORDER_STATUSES, sumAmounts } from '@/lib/stats';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  const from = String(req.query.from || daysAgoKey(29));
  const to = String(req.query.to || todayKey());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
  }

  try {
    // Manila days run UTC+8, so widen the UTC fetch window by a day each side
    // and filter precisely by Manila day key below.
    const fetchFrom = new Date(`${from}T00:00:00+08:00`).toISOString();
    const fetchTo = new Date(`${to}T23:59:59+08:00`).toISOString();

    const [orders, walkins, expenses] = await Promise.all([
      sql`SELECT * FROM orders WHERE created_at >= ${fetchFrom} AND created_at <= ${fetchTo} ORDER BY created_at DESC`,
      sql`SELECT * FROM walkin_sales WHERE created_at >= ${fetchFrom} AND created_at <= ${fetchTo} ORDER BY created_at DESC`,
      sql`SELECT * FROM expenses WHERE expense_date >= ${from} AND expense_date <= ${to} ORDER BY expense_date DESC`,
    ]);

    const inRange = (iso) => {
      const d = dayKey(iso);
      return d >= from && d <= to;
    };
    const deliveredOrders = orders.filter((o) => REVENUE_ORDER_STATUSES.includes(o.status) && inRange(o.created_at));
    const walkinSales = walkins.filter((s) => inRange(s.created_at));

    const transactions = [
      ...deliveredOrders.map((o) => ({
        id: o.id,
        date: dayKey(o.created_at),
        type: 'delivery',
        description: `${o.product_type} x${o.quantity} — ${o.customer_name}`,
        payment_method: o.payment_method,
        amount: Number(o.total_amount),
      })),
      ...walkinSales.map((s) => ({
        id: s.id,
        date: dayKey(s.created_at),
        type: 'walk-in',
        description: `${s.product_name} (${s.sale_type}) x${s.quantity}`,
        payment_method: s.payment_method,
        amount: Number(s.total_amount),
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    const byPayment = {};
    for (const t of transactions) {
      byPayment[t.payment_method] = (byPayment[t.payment_method] || 0) + t.amount;
    }

    const byProduct = {};
    for (const o of deliveredOrders) {
      const e = (byProduct[o.product_type] ||= { quantity: 0, revenue: 0 });
      e.quantity += Number(o.quantity);
      e.revenue += Number(o.total_amount);
    }
    for (const s of walkinSales) {
      const key = s.product_id || s.product_name;
      const e = (byProduct[key] ||= { quantity: 0, revenue: 0 });
      e.quantity += Number(s.quantity);
      e.revenue += Number(s.total_amount);
    }

    const expensesByCategory = {};
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
    }

    const totalRevenue = sumAmounts(transactions.map((t) => ({ amount: t.amount })));
    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

    return res.status(200).json({
      from,
      to,
      totals: {
        revenue: totalRevenue,
        deliveryRevenue: sumAmounts(deliveredOrders),
        walkinRevenue: sumAmounts(walkinSales),
        expenses: totalExpenses,
        net: totalRevenue - totalExpenses,
        transactionCount: transactions.length,
      },
      byPayment,
      byProduct,
      expensesByCategory,
      transactions,
      expenseList: expenses,
    });
  } catch (err) {
    return res.status(500).json({ error: `Query failed: ${err.message}` });
  }
}
