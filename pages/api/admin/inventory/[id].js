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

  const { id } = req.query;

  if (req.method === 'GET') {
    const movements = await sql`
      SELECT * FROM inventory_movements WHERE item_id = ${id} ORDER BY created_at DESC LIMIT 50
    `;
    return res.status(200).json(movements);
  }

  if (req.method === 'PATCH') {
    const rows = await sql`SELECT * FROM inventory_items WHERE id = ${id}`;
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const { name, category, unit, low_stock_threshold, adjust, reason } = req.body;

    // Stock adjustment (positive = stock in, negative = stock out), logged as a movement
    if (adjust != null) {
      const change = Number(adjust);
      if (!change || Number.isNaN(change)) {
        return res.status(400).json({ error: 'Invalid adjustment amount' });
      }
      if (item.quantity + change < 0) {
        return res.status(400).json({ error: 'Stock cannot go below zero' });
      }
      const created_at = new Date().toISOString();
      await sql`UPDATE inventory_items SET quantity = quantity + ${change} WHERE id = ${id}`;
      await sql`
        INSERT INTO inventory_movements (id, item_id, change, reason, created_at)
        VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${id}, ${change}, ${reason || null}, ${created_at})
      `;
      return res.status(200).json({ success: true });
    }

    await sql`
      UPDATE inventory_items SET
        name = ${name ?? item.name},
        category = ${category ?? item.category},
        unit = ${unit ?? item.unit},
        low_stock_threshold = ${low_stock_threshold ?? item.low_stock_threshold}
      WHERE id = ${id}
    `;
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM inventory_movements WHERE item_id = ${id}`;
    await sql`DELETE FROM inventory_items WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
