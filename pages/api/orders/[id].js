import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';
import { buildStatusMessage, NOTIFIABLE_STATUSES } from '@/lib/notifications';
import { sendMessengerMessage } from '@/lib/facebook';
import { v4 as uuidv4 } from 'uuid';

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

    const { status, payment_verified } = req.body;

    // Payment verification toggle (independent of status)
    if (payment_verified !== undefined) {
      if (typeof payment_verified !== 'boolean') {
        return res.status(400).json({ error: 'payment_verified must be a boolean' });
      }
      await sql`UPDATE orders SET payment_verified = ${payment_verified ? 1 : 0} WHERE id = ${id}`;
      if (status === undefined) {
        return res.status(200).json({ success: true });
      }
    }

    if (status !== undefined) {
      const valid = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
      if (!valid.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;
      const order = rows[0];
      if (!order) return res.status(404).json({ error: 'Order not found' });

      await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;

      // Auto-notify on notifiable status changes
      if (NOTIFIABLE_STATUSES.includes(status)) {
        if (order.messenger_psid) {
          try {
            const text = buildStatusMessage(order, status, 'messenger');
            await sendMessengerMessage(order.messenger_psid, text);
            await sql`
              INSERT INTO contact_log (id, phone_normalized, channel, direction, summary, order_id, created_at)
              VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${normalizePhone(order.phone)}, 'messenger', 'outbound', ${text}, ${id}, ${new Date().toISOString()})
            `;
          } catch (notifyErr) {
            console.error('Auto Messenger notify failed:', notifyErr);
          }
        } else {
          try {
            await sql`UPDATE orders SET sms_pending = 1 WHERE id = ${id}`;
          } catch (flagErr) {
            console.error('Set sms_pending failed:', flagErr);
          }
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Nothing to update' });
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
