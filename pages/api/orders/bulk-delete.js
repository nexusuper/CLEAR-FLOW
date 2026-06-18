import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const checkRate = rateLimit({ windowMs: 60_000, max: 10 });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRate(req, res)) return;

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return res.status(400).json({ error: 'Invalid order IDs' });
  }
  const validId = /^[A-Z0-9]{1,8}$/i;
  if (!ids.every((id) => typeof id === 'string' && validId.test(id))) {
    return res.status(400).json({ error: 'Invalid order ID format' });
  }

  try {
    const sql = await initDb();
    await sql`
      DELETE FROM orders
      WHERE id = ANY(${ids})
      AND status IN ('delivered', 'cancelled')
    `;
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Bulk delete failed:', err);
    return res.status(500).json({ error: 'Failed to delete orders' });
  }
}
