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
    const rows = await sql`SELECT * FROM inventory_items ORDER BY category, name`;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { name, category, unit, quantity, low_stock_threshold } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing item name' });

    const id = uuidv4().slice(0, 8).toUpperCase();
    const created_at = new Date().toISOString();
    const qty = Number(quantity) || 0;

    try {
      await sql`
        INSERT INTO inventory_items (id, name, category, unit, quantity, low_stock_threshold, created_at)
        VALUES (${id}, ${name}, ${category || 'supplies'}, ${unit || 'pcs'}, ${qty}, ${Number(low_stock_threshold) || 0}, ${created_at})
      `;
      if (qty !== 0) {
        await sql`
          INSERT INTO inventory_movements (id, item_id, change, reason, created_at)
          VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${id}, ${qty}, ${'Initial stock'}, ${created_at})
        `;
      }
    } catch (err) {
      return res.status(500).json({ error: `Insert failed: ${err.message}` });
    }
    return res.status(201).json({ id });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
