import { initDb } from '@/lib/db';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  try {
    const statusFilter = req.query.status || '';
    const sortParam = req.query.sort || 'pickup_date_asc';

    const validStatuses = ['scheduled', 'picked_up', 'delivered', 'cancelled'];
    const hasStatus = validStatuses.includes(statusFilter);

    const sortMap = {
      pickup_date_asc: sql`pickup_date ASC, pickup_time ASC`,
      pickup_date_desc: sql`pickup_date DESC, pickup_time DESC`,
      status_asc: sql`status ASC`,
      name_asc: sql`customer_name ASC`,
      name_desc: sql`customer_name DESC`,
    };
    const orderBy = sortMap[sortParam] || sql`pickup_date ASC, pickup_time ASC`;

    const where = hasStatus ? sql`WHERE status = ${statusFilter}` : sql``;

    const [rows, statusRows] = await Promise.all([
      sql`SELECT * FROM container_pickups ${where} ORDER BY ${orderBy}`,
      sql`SELECT status, COUNT(*)::int AS count FROM container_pickups GROUP BY status`,
    ]);

    const statusCounts = Object.fromEntries(statusRows.map((r) => [r.status, r.count]));
    return res.status(200).json({ pickups: rows, total: rows.length, statusCounts });
  } catch (err) {
    console.error('Container pickups list query failed:', err);
    return res.status(500).json({ error: 'Failed to load container pickups' });
  }
}
