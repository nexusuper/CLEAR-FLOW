import { initDb } from '@/lib/db';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

const AdjustSchema = z.object({
  delta: z.coerce.number().int().min(-100).max(100),
  reason: z.string().max(200).optional().default(''),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  const phone = normalizePhone(req.query.phone);
  if (phone.length < 7) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const parsed = AdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid adjustment data' });
  }
  if (parsed.data.delta === 0) {
    return res.status(400).json({ error: 'Delta must be non-zero' });
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
    const { delta, reason } = parsed.data;
    await sql`
      INSERT INTO container_adjustments (id, phone_normalized, delta, reason, created_at)
      VALUES (${id}, ${phone}, ${delta}, ${reason}, ${now})
    `;
    return res.status(201).json({ id, delta, reason, created_at: now });
  } catch (err) {
    console.error('Container adjust insert failed:', err);
    return res.status(500).json({ error: 'Failed to save adjustment' });
  }
}
