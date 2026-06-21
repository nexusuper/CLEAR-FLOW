import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

const NoteSchema = z.object({
  content: z.string().min(1).max(2000),
  tags: z.string().max(500).optional().default(''),
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

  const parsed = NoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid note data' });
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
    const { content, tags } = parsed.data;

    await sql`
      INSERT INTO customer_notes (id, phone_normalized, content, tags, created_at, updated_at)
      VALUES (${id}, ${phone}, ${content}, ${tags}, ${now}, ${now})
    `;

    return res.status(201).json({ id, content, tags, created_at: now, updated_at: now });
  } catch (err) {
    console.error('Note insert failed:', err);
    return res.status(500).json({ error: 'Failed to save note' });
  }
}
