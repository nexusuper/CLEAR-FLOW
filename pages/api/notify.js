import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { normalizePhone } from '@/lib/loyalty';

const MESSAGES = {
  confirmed: (name, id) =>
    `Hi ${name}! Your Clear Flow water order (ID: ${id}) has been confirmed and is being prepared. We'll be on our way soon! 💧`,
  out_for_delivery: (name, id) =>
    `Hi ${name}! Your Clear Flow water order (ID: ${id}) is now OUT FOR DELIVERY! 🛵 Our rider is heading to you. Please be available to receive it. Thank you!`,
  delivered: (name, id) =>
    `Hi ${name}! Your Clear Flow water order (ID: ${id}) has been delivered. 🎉 Thank you for choosing Clear Flow! Order again anytime.`,
  cancelled: (name, id) =>
    `Hi ${name}, your Clear Flow water order (ID: ${id}) has been cancelled. Please call us at 0912-345-6789 if you have questions.`,
};

const checkRate = rateLimit({ windowMs: 60_000, max: 20 });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRate(req, res)) return;

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ error: 'Missing orderId or status' });
  if (!MESSAGES[status]) return res.status(400).json({ error: 'No message for this status' });

  try {
    const sql = await initDb();
    const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const message = MESSAGES[status](order.customer_name, order.id);
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

    return res.status(200).json({ phone, message });
  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: 'Failed to generate notification' });
  }
}
