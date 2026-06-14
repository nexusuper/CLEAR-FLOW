import { initDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No order IDs provided' });
  }

  const validIds = ids.filter(id => typeof id === 'string' && /^[A-Z0-9]{8}$/.test(id));
  if (validIds.length === 0) {
    return res.status(400).json({ error: 'No valid order IDs provided' });
  }

  try {
    const sql = await initDb();
    const result = await sql`
      DELETE FROM orders
      WHERE id = ANY(${validIds})
      AND status IN ('delivered', 'cancelled')
      RETURNING id
    `;
    return res.status(200).json({ success: true, deleted: result.length });
  } catch {
    return res.status(500).json({ error: 'Failed to delete orders' });
  }
}
