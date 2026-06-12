import { initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  if (req.method === 'GET') {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await sql`SELECT * FROM walkin_sales ORDER BY created_at DESC LIMIT ${limit}`;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { product_id, product_name, sale_type, quantity, unit_price, total_amount, payment_method, notes } = req.body;
    if (!product_name || !quantity || unit_price == null || total_amount == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4().slice(0, 8).toUpperCase();
    const created_at = new Date().toISOString();

    try {
      await sql`
        INSERT INTO walkin_sales (id, product_id, product_name, sale_type, quantity, unit_price, total_amount, payment_method, notes, created_at)
        VALUES (${id}, ${product_id || null}, ${product_name}, ${sale_type || 'refill'}, ${quantity}, ${unit_price}, ${total_amount}, ${payment_method || 'cash'}, ${notes || null}, ${created_at})
      `;
    } catch (err) {
      return res.status(500).json({ error: `Insert failed: ${err.message}` });
    }
    return res.status(201).json({ id, created_at });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
