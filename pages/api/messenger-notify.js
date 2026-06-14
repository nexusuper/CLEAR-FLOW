import { initDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendMessengerMessage } from '@/lib/facebook';

const MESSAGES = {
  confirmed: (name, id) =>
    `✅ Hi ${name}! Your Clear Flow water order (#${id}) has been confirmed and is being prepared.\n\nWe'll notify you when it's on the way! 💧`,
  out_for_delivery: (name, id) =>
    `🛵 Hi ${name}! Your Clear Flow water order (#${id}) is now OUT FOR DELIVERY!\n\nOur rider is heading to you. Please be available to receive it. Thank you! 💧`,
  delivered: (name, id) =>
    `🎉 Hi ${name}! Your Clear Flow water order (#${id}) has been delivered!\n\nThank you for choosing Clear Flow! Order again anytime at our website. 💧`,
  cancelled: (name, id) =>
    `❌ Hi ${name}, your Clear Flow water order (#${id}) has been cancelled.\n\nIf you have questions, please reply to this message or call us at 0912-345-6789.`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ error: 'Missing orderId or status' });
  if (!MESSAGES[status]) return res.status(400).json({ error: 'No message template for this status' });

  try {
    const sql = await initDb();
    const rows = await sql`SELECT customer_name, id, messenger_psid FROM orders WHERE id = ${orderId}`;
    const order = rows[0];

    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!order.messenger_psid) {
      return res.status(400).json({
        error: 'No Messenger linked',
        message: 'Customer has not linked their Messenger account. Use SMS instead.',
      });
    }

    const messageText = MESSAGES[status](order.customer_name, order.id);
    await sendMessengerMessage(order.messenger_psid, messageText);

    return res.status(200).json({ success: true, message: 'Notification sent via Messenger' });
  } catch {
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
