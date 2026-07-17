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
    const { available, earned } = computeRewards(prior);
    const allowed = Math.max(0, Math.min(order.reward_requested, available, order.quantity));
    if (allowed <= 0) {
      return res.status(400).json({ error: 'No vouchers available to apply' });
    }

    const discount = allowed * VOUCHER_VALUE;
    // The neon HTTP driver can't hold an interactive SELECT ... FOR UPDATE lock
    // across a JS round-trip, so collapse the check-and-write into ONE atomic
    // conditional UPDATE. `earned` (delivered gallons) is stable; the racy part
    // is the redeemed total, re-summed here over the customer's OTHER orders.
    // The update only applies while the reward is still pending and the pool
    // still covers `allowed` — otherwise it matches no row and we 409.
    const updated = await sql`
      UPDATE orders
      SET voucher_count = ${allowed},
          voucher_discount = ${discount},
          total_amount = GREATEST(0, total_amount - ${discount}),
          reward_requested = 0
      WHERE id = ${id}
        AND reward_requested > 0
        AND (
          SELECT COALESCE(SUM(CASE WHEN status <> 'cancelled' AND id <> ${id} THEN voucher_count ELSE 0 END), 0)
          FROM orders WHERE phone_normalized = ${normPhone}
        ) + ${allowed} <= ${earned}
      RETURNING total_amount
    `;
    if (updated.length === 0) {
      return res.status(409).json({ error: 'Voucher pool changed, please retry' });
    }
    return res.status(200).json({ success: true, applied: allowed, discount, total: updated[0].total_amount });
  } catch (err) {
    console.error('Apply reward failed:', err);
    return res.status(500).json({ error: 'Failed to apply reward' });
  }
}
