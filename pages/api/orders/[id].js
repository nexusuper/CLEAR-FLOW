import { initDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { TRANSITIONS } from '@/lib/order-status';

const SAFE_PUBLIC_FIELDS = [
  'id', 'customer_name', 'phone', 'address', 'barangay',
  'product_type', 'container_size', 'quantity',
  'need_container', 'container_quantity',
  'payment_method', 'total_amount', 'created_at', 'status',
];

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch {
    return res.status(500).json({ error: 'Database unavailable' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;
      const order = rows[0];
      if (!order) return res.status(404).json({ error: 'Order not found' });
      const safe = Object.fromEntries(SAFE_PUBLIC_FIELDS.map(k => [k, order[k]]));
      return res.status(200).json(safe);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch order' });
    }
  }

  if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'PATCH') {
    const { status } = req.body;

    try {
      const current = await sql`SELECT status FROM orders WHERE id = ${id}`;
      if (!current[0]) return res.status(404).json({ error: 'Order not found' });

      const allowed = TRANSITIONS[current[0].status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Cannot transition from '${current[0].status}' to '${status}'`,
        });
      }

      await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Failed to update order' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const rows = await sql`SELECT status FROM orders WHERE id = ${id}`;
      const order = rows[0];
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (!['delivered', 'cancelled'].includes(order.status)) {
        return res.status(400).json({ error: 'Only delivered or cancelled orders can be deleted' });
      }
      await sql`DELETE FROM orders WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Failed to delete order' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
