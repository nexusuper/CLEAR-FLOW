import { initDb } from '@/lib/db';
import { computeRewards, normalizePhone, VOUCHER_VALUE } from '@/lib/loyalty';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const checkRate = rateLimit({ windowMs: 60_000, max: 20 });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  const { id } = req.query;
  try {
    const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.reward_requested || order.reward_requested <= 0) {
      return res.status(400).json({ error: 'No pending reward on this order' });
    }

    const normPhone = normalizePhone(order.phone);
    const prior = await sql`
      SELECT status, container_size, quantity, voucher_count
      FROM orders
      WHERE phone_normalized = ${normPhone}
    `;
    const { available } = computeRewards(prior);
    const allowed = Math.max(0, Math.min(order.reward_requested, available, order.quantity));
    if (allowed <= 0) {
      return res.status(400).json({ error: 'No vouchers available to apply' });
    }

    const discount = allowed * VOUCHER_VALUE;
    const newTotal = Math.max(0, Number(order.total_amount) - discount);
    await sql`
      UPDATE orders
      SET voucher_count = ${allowed}, voucher_discount = ${discount},
          total_amount = ${newTotal}, reward_requested = 0
      WHERE id = ${id}
    `;
    return res.status(200).json({ success: true, applied: allowed, discount, total: newTotal });
  } catch (err) {
    console.error('Apply reward failed:', err);
    return res.status(500).json({ error: 'Failed to apply reward' });
  }
}
