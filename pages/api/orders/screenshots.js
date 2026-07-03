import { initDb } from '@/lib/db';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const readRate = rateLimit({ windowMs: 60_000, max: 30 });
const writeRate = rateLimit({ windowMs: 60_000, max: 10 });

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (req.method === 'GET') {
    if (!readRate(req, res)) return;
    if (!await verifyAdminWithLockout(req, res)) return;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 24;
    const offset = (page - 1) * limit;

    try {
      const [rows, countRows] = await Promise.all([
        sql`
          SELECT id, customer_name, phone, created_at, payment_method,
                 reference_number, payment_verified, payment_screenshot
          FROM orders
          WHERE payment_screenshot IS NOT NULL
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS total FROM orders WHERE payment_screenshot IS NOT NULL`,
      ]);
      const total = countRows[0]?.total || 0;
      return res.status(200).json({
        items: rows,
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (err) {
      console.error('Screenshot list failed:', err);
      return res.status(500).json({ error: 'Failed to load screenshots' });
    }
  }

  if (req.method === 'DELETE') {
    if (!writeRate(req, res)) return;
    if (!await verifyAdminWithLockout(req, res)) return;

    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
      return res.status(400).json({ error: 'Invalid order IDs' });
    }
    const validId = /^[A-Z0-9]{1,8}$/i;
    if (!ids.every((id) => typeof id === 'string' && validId.test(id))) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }

    try {
      await sql`
        UPDATE orders SET payment_screenshot = NULL
        WHERE id = ANY(${ids})
      `;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Screenshot delete failed:', err);
      return res.status(500).json({ error: 'Failed to delete screenshots' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
