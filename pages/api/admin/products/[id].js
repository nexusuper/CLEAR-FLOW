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

  if (req.method === 'PATCH') {
    const rows = await sql`SELECT * FROM products WHERE id = ${id}`;
    const product = rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { name, description, refill_price, container_price, size, tag, active, sort_order } = req.body;
    await sql`
      UPDATE products SET
        name = ${name ?? product.name},
        description = ${description ?? product.description},
        refill_price = ${refill_price ?? product.refill_price},
        container_price = ${container_price ?? product.container_price},
        size = ${size ?? product.size},
        tag = ${tag ?? product.tag},
        active = ${active ?? product.active},
        sort_order = ${sort_order ?? product.sort_order}
      WHERE id = ${id}
    `;
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM products WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
