import { initDb } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.headers;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No order IDs provided' });
  }

  const sql = await initDb();
  await sql`
    DELETE FROM orders
    WHERE id = ANY(${ids})
    AND status IN ('delivered', 'cancelled')
  `;

  return res.status(200).json({ success: true });
}
