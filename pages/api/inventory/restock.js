import { initDb } from '@/lib/db';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { PRODUCTS_BY_ID } from '@/lib/products';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

const PRODUCT_IDS = Object.keys(PRODUCTS_BY_ID);
const RestockSchema = z.object({
  product_id: z.enum(PRODUCT_IDS),
  quantity: z.coerce.number().int().min(1).max(10000),
  reason: z.string().max(200).optional().default(''),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  const parsed = RestockSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid restock data' });
  }
  const { product_id, quantity, reason } = parsed.data;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const now = new Date().toISOString();
    const updated = await sql`
      UPDATE inventory
      SET current_stock = current_stock + ${quantity}, updated_at = ${now}
      WHERE product_id = ${product_id}
      RETURNING current_stock
    `;
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await sql`
      INSERT INTO inventory_log (id, product_id, delta, type, reason, order_id, created_at)
      VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${product_id}, ${quantity}, 'restock', ${reason}, NULL, ${now})
    `;
    return res.status(201).json({ success: true, current_stock: updated[0].current_stock });
  } catch (err) {
    console.error('Restock failed:', err);
    return res.status(500).json({ error: 'Failed to restock' });
  }
}
