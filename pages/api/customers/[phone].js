import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { computeRewards, normalizePhone } from '@/lib/loyalty';
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

  const phone = normalizePhone(req.query.phone);
  if (phone.length < 7) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  try {
    const [orders, notes, contactLog, containerAdjustments] = await Promise.all([
      sql`SELECT * FROM orders WHERE phone_normalized = ${phone} ORDER BY created_at DESC`,
      sql`SELECT * FROM customer_notes WHERE phone_normalized = ${phone} ORDER BY updated_at DESC`,
      sql`SELECT * FROM contact_log WHERE phone_normalized = ${phone} ORDER BY created_at DESC LIMIT 50`,
      sql`SELECT * FROM container_adjustments WHERE phone_normalized = ${phone} ORDER BY created_at DESC`,
    ]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const latest = orders[0];
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const hasMessenger = orders.some((o) => o.messenger_psid);
    const loyalty = computeRewards(orders);

    const segment = computeSegment({
      total_orders: orders.length,
      total_spent: Math.round(totalSpent * 100) / 100,
      last_order: latest.created_at,
    });

    const autoDerived = orders.reduce(
      (sum, o) => sum + (o.status === 'delivered' && o.need_container ? (Number(o.container_quantity) || 0) : 0),
      0
    );
    const manualSum = containerAdjustments.reduce((sum, a) => sum + (Number(a.delta) || 0), 0);
    const containers_out = autoDerived + manualSum;
    return res.status(200).json({
      customer_name: latest.customer_name,
      phone_normalized: phone,
      phone_display: latest.phone,
      total_orders: orders.length,
      total_spent: Math.round(totalSpent * 100) / 100,
      first_order: orders[orders.length - 1].created_at,
      last_order: latest.created_at,
      has_messenger: hasMessenger,
      segment,
      loyalty,
      containers_out,
      containerAdjustments,
      orders,
      notes,
      contactLog,
    });
  } catch (err) {
    console.error('Customer detail query failed:', err);
    return res.status(500).json({ error: 'Failed to load customer' });
  }
}
