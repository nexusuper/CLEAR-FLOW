import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { PRODUCTS } from '@/lib/products';

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
    const rows = await sql`SELECT * FROM inventory`;
    const byId = Object.fromEntries(rows.map((r) => [r.product_id, r]));

    const items = PRODUCTS.map((p) => {
      const inv = byId[p.id] || { current_stock: 0, low_stock_threshold: 10 };
      const stock = Number(inv.current_stock) || 0;
      const threshold = Number(inv.low_stock_threshold) || 0;
      return {
        product_id: p.id,
        name: p.name,
        current_stock: stock,
        low_stock_threshold: threshold,
        low_stock: stock <= threshold,
      };
    });
    const low_stock_count = items.filter((i) => i.low_stock).length;

    const log = await sql`SELECT * FROM inventory_log ORDER BY created_at DESC LIMIT 20`;

    return res.status(200).json({ items, low_stock_count, log });
  } catch (err) {
    console.error('Inventory query failed:', err);
    return res.status(500).json({ error: 'Failed to load inventory' });
  }
}
