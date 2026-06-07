import { initDb } from '@/lib/db';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.headers;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ error: 'Missing orderId or status' });
  if (!MESSAGES[status]) return res.status(400).json({ error: 'No message for this status' });

  const sql = await initDb();
  const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const message = MESSAGES[status](order.customer_name, order.id);
  const phone = order.phone.replace(/[-\s]/g, '');

  return res.status(200).json({ phone, message });
}
