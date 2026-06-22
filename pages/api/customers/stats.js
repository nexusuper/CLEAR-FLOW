import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { computeSegment } from '@/lib/segments';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

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
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const [totalRes, activeRes, newRes, topRes] = await Promise.all([
      sql`SELECT COUNT(DISTINCT phone_normalized)::int AS count FROM orders`,
      sql`SELECT COUNT(DISTINCT phone_normalized)::int AS count FROM orders WHERE created_at >= ${monthStart}`,
      sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT phone_normalized, MIN(created_at) AS first_order
          FROM orders GROUP BY phone_normalized
          HAVING MIN(created_at) >= ${monthStart}
        ) sub
      `,
      sql`
        SELECT phone_normalized, MAX(customer_name) AS name, SUM(total_amount)::real AS total_spent
        FROM orders
        GROUP BY phone_normalized
        ORDER BY total_spent DESC
        LIMIT 1
      `,
    ]);

    const top = topRes[0] || null;
    const allCusts = await sql`
      SELECT
        COUNT(*)::int AS total_orders,
        SUM(total_amount)::real AS total_spent,
        MAX(created_at) AS last_order
      FROM orders
      GROUP BY phone_normalized
    `;
    const segmentCounts = { new: 0, regular: 0, vip: 0, 'at-risk': 0, churned: 0 };
    for (const c of allCusts) {
      const seg = computeSegment({
        total_orders: Number(c.total_orders),
        total_spent: Number(c.total_spent),
        last_order: c.last_order,
      });
      segmentCounts[seg]++;
    }
    return res.status(200).json({
      totalCustomers: totalRes[0]?.count ?? 0,
      activeThisMonth: activeRes[0]?.count ?? 0,
      newThisMonth: newRes[0]?.count ?? 0,
      topSpender: top ? { name: top.name, phone: top.phone_normalized, total_spent: top.total_spent } : null,
      segmentCounts,
    });
  } catch (err) {
    console.error('Customer stats query failed:', err);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
}
