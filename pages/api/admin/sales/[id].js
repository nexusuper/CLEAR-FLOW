import { initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  const { id } = req.query;

  if (req.method === 'DELETE') {
    await sql`DELETE FROM walkin_sales WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
