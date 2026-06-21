import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const phone = normalizePhone(req.query.phone);
  const { id } = req.query;
  if (phone.length < 7 || !id) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const rows = await sql`
      DELETE FROM customer_notes WHERE id = ${id} AND phone_normalized = ${phone} RETURNING id
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Note delete failed:', err);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
}
