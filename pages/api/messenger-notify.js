import { initDb } from '@/lib/db';
import { sendMessengerMessage } from '@/lib/facebook';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { normalizePhone } from '@/lib/loyalty';
import { buildStatusMessage } from '@/lib/notifications';

const checkRate = rateLimit({ windowMs: 60_000, max: 20 });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkRate(req, res)) return;
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orderId, status } = req.body;
  if (!orderId || !status) {
    return res.status(400).json({ error: 'Missing orderId or status' });
  }
  if (!buildStatusMessage({ customer_name: 'x', id: 'x' }, status, 'messenger')) {
    return res.status(400).json({ error: 'No message template for this status' });
  }

  try {
    const sql = await initDb();
    const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    const order = rows[0];

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.messenger_psid) {
      return res.status(400).json({
        error: 'No Messenger linked',
        message: 'Customer has not linked their Messenger account. Use SMS instead.',
      });
    }

    const messageText = buildStatusMessage(order, status, 'messenger');
    await sendMessengerMessage(order.messenger_psid, messageText);

    const normPhone = normalizePhone(order.phone);
    try {
      await sql`
        INSERT INTO contact_log (id, phone_normalized, channel, direction, summary, order_id, created_at)
        VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${normPhone}, 'messenger', 'outbound', ${messageText}, ${orderId}, ${new Date().toISOString()})
      `;
    } catch (logErr) {
      console.error('Contact log insert failed:', logErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Notification sent via Messenger',
    });

  } catch (error) {
    console.error('Messenger notify error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
