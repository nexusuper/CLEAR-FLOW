import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
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
      SELECT DISTINCT trim(unnest(string_to_array(tags, ','))) AS tag
      FROM customer_notes
      WHERE tags IS NOT NULL AND tags != ''
      ORDER BY tag
    `;
    return res.status(200).json({ tags: rows.map((r) => r.tag).filter(Boolean) });
  } catch (err) {
    console.error('Tags query failed:', err);
    return res.status(500).json({ error: 'Failed to load tags' });
  }
}
