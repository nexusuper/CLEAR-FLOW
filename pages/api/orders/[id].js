import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';

const readRate = rateLimit({ windowMs: 60_000, max: 30 });
const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    if (!readRate(req, res)) return;

    const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!verifyAdmin(req)) {
      const phone = normalizePhone(req.query.phone);
      const orderPhone = normalizePhone(order.phone);
      if (!phone || phone !== orderPhone) {
        return res.status(200).json({
          id: order.id,
          status: order.status,
          created_at: order.created_at,
          product_type: order.product_type,
          container_size: order.container_size,
          quantity: order.quantity,
          total_amount: order.total_amount,
          customer_name: order.customer_name,
          voucher_count: order.voucher_count,
          voucher_discount: order.voucher_discount,
          reward_requested: order.reward_requested,
        });
      }
    }

    return res.status(200).json(order);
  }

  if (req.method === 'PATCH') {
    if (!adminRate(req, res)) return;
    if (!verifyAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    if (!adminRate(req, res)) return;
    if (!verifyAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const rows = await sql`SELECT status FROM orders WHERE id = ${id}`;
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: 'Only delivered or cancelled orders can be deleted' });
    }
    await sql`DELETE FROM orders WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
