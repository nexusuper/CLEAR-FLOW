import { initDb } from '@/lib/db';

// Public endpoint: active products for the customer-facing pages.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  try {
    const rows = await sql`
      SELECT id, name, description, refill_price, container_price, size, tag
      FROM products WHERE active = 1 ORDER BY sort_order, name
    `;
    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({ error: `Query failed: ${err.message}` });
  }
}
