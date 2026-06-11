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

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM products ORDER BY sort_order, name`;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { id, name, description, refill_price, container_price, size, tag, sort_order } = req.body;
    if (!id || !name || refill_price == null || container_price == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^[a-z0-9_-]+$/i.test(id)) {
      return res.status(400).json({ error: 'ID may only contain letters, numbers, dashes and underscores' });
    }
    try {
      await sql`
        INSERT INTO products (id, name, description, refill_price, container_price, size, tag, active, sort_order)
        VALUES (${id}, ${name}, ${description || null}, ${refill_price}, ${container_price}, ${size || null}, ${tag || null}, 1, ${sort_order || 0})
      `;
    } catch (err) {
      return res.status(500).json({ error: `Insert failed: ${err.message}` });
    }
    return res.status(201).json({ id });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
