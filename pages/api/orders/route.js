import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const adminRate = rateLimit({ windowMs: 60_000, max: 60 });

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
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const rows = await sql`
      SELECT id, customer_name, phone, address, barangay,
             product_type, quantity, delivery_slot, status, messenger_psid
      FROM orders
      WHERE status IN ('confirmed', 'out_for_delivery')
        AND (delivery_date = ${today} OR delivery_date IS NULL OR delivery_date = '')
      ORDER BY barangay ASC, delivery_slot ASC NULLS LAST, created_at ASC
    `;

    const groups = new Map();
    for (const o of rows) {
      const key = o.barangay || 'Unspecified';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    const barangays = Array.from(groups.entries())
      .map(([barangay, orders]) => ({ barangay, count: orders.length, orders }))
      .sort((a, b) => a.barangay.localeCompare(b.barangay));

    return res.status(200).json({ barangays, total: rows.length });
  } catch (err) {
    console.error('Route query failed:', err);
    return res.status(500).json({ error: 'Failed to load route' });
  }
}
