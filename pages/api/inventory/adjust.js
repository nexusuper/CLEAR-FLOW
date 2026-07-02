import { initDb } from '@/lib/db';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { PRODUCTS_BY_ID } from '@/lib/products';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

const PRODUCT_IDS = Object.keys(PRODUCTS_BY_ID);
const AdjustSchema = z.object({
  product_id: z.enum(PRODUCT_IDS),
  delta: z.coerce.number().int().min(-10000).max(10000),
  reason: z.string().max(200).optional().default(''),
  threshold: z.coerce.number().int().min(0).max(10000).optional(),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  const parsed = AdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid adjustment data' });
  }
  const { product_id, delta, reason, threshold } = parsed.data;
  if (delta === 0 && threshold === undefined) {
    return res.status(400).json({ error: 'Nothing to adjust' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const now = new Date().toISOString();
    let current;
    if (threshold !== undefined) {
      const updated = await sql`
        UPDATE inventory
        SET current_stock = GREATEST(0, current_stock + ${delta}), low_stock_threshold = ${threshold}, updated_at = ${now}
        WHERE product_id = ${product_id}
        RETURNING current_stock
      `;
      if (updated.length === 0) return res.status(404).json({ error: 'Product not found' });
      current = updated[0].current_stock;
    } else {
      const updated = await sql`
        UPDATE inventory
        SET current_stock = GREATEST(0, current_stock + ${delta}), updated_at = ${now}
        WHERE product_id = ${product_id}
        RETURNING current_stock
      `;
      if (updated.length === 0) return res.status(404).json({ error: 'Product not found' });
      current = updated[0].current_stock;
    }
    if (delta !== 0) {
      await sql`
        INSERT INTO inventory_log (id, product_id, delta, type, reason, order_id, created_at)
        VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${product_id}, ${delta}, 'adjust', ${reason}, NULL, ${now})
      `;
    }
    return res.status(200).json({ success: true, current_stock: current });
  } catch (err) {
    console.error('Adjust failed:', err);
    return res.status(500).json({ error: 'Failed to adjust' });
  }
}
