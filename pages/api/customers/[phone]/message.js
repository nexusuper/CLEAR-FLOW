import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';
import { sendMessengerMessage } from '@/lib/facebook';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 15 });

const MessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const phone = normalizePhone(req.query.phone);
  if (phone.length < 7) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const parsed = MessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid message data' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const orders = await sql`
      SELECT messenger_psid FROM orders
      WHERE phone_normalized = ${phone} AND messenger_psid IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (orders.length === 0 || !orders[0].messenger_psid) {
      return res.status(400).json({ error: 'Customer has no Messenger linked' });
    }

    const psid = orders[0].messenger_psid;
    await sendMessengerMessage(psid, parsed.data.message);

    const id = uuidv4().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    await sql`
      INSERT INTO contact_log (id, phone_normalized, channel, direction, summary, order_id, created_at)
      VALUES (${id}, ${phone}, 'messenger', 'outbound', ${parsed.data.message}, ${null}, ${now})
    `;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Messenger send failed:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
