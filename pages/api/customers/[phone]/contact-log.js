import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

const LogSchema = z.object({
  channel: z.enum(['sms', 'messenger', 'manual', 'call', 'viber', 'in-person']),
  direction: z.enum(['outbound', 'inbound']),
  summary: z.string().min(1).max(2000),
  order_id: z.string().max(20).optional().nullable(),
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

  const parsed = LogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid log entry data' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const id = uuidv4().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    const { channel, direction, summary, order_id } = parsed.data;

    await sql`
      INSERT INTO contact_log (id, phone_normalized, channel, direction, summary, order_id, created_at)
      VALUES (${id}, ${phone}, ${channel}, ${direction}, ${summary}, ${order_id || null}, ${now})
    `;

    return res.status(201).json({ id, created_at: now });
  } catch (err) {
    console.error('Contact log insert failed:', err);
    return res.status(500).json({ error: 'Failed to save contact log' });
  }
}
