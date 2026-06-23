import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { normalizePhone } from '@/lib/loyalty';
import { buildStatusMessage } from '@/lib/notifications';

const checkRate = rateLimit({ windowMs: 60_000, max: 20 });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRate(req, res)) return;

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ error: 'Missing orderId or status' });
  if (!buildStatusMessage({ customer_name: 'x', id: 'x' }, status, 'sms')) {
    return res.status(400).json({ error: 'No message for this status' });
  }

  try {
    const sql = await initDb();
    const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const message = buildStatusMessage(order, status, 'sms');
    const phone = order.phone.replace(/[-\s]/g, '');

    const normPhone = normalizePhone(order.phone);
    try {
      await sql`
        INSERT INTO contact_log (id, phone_normalized, channel, direction, summary, order_id, created_at)
        VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${normPhone}, 'sms', 'outbound', ${message}, ${orderId}, ${new Date().toISOString()})
      `;
    } catch (logErr) {
      console.error('Contact log insert failed:', logErr);
    }

    try {
      await sql`UPDATE orders SET sms_pending = 0 WHERE id = ${orderId}`;
    } catch (clearErr) {
      console.error('Clear sms_pending failed:', clearErr);
    }

    return res.status(200).json({ phone, message });
  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: 'Failed to generate notification' });
  }
}
