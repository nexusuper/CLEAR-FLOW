import { initDb } from '@/lib/db';
import { computeRewards, normalizePhone } from '@/lib/loyalty';
import { rateLimit } from '@/lib/rate-limit';

const checkRate = rateLimit({ windowMs: 60_000, max: 20 });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkRate(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  const phone = normalizePhone(req.query.phone);
  if (phone.length < 7) {
    return res.status(400).json({ error: 'Enter a valid phone number' });
  }

  try {
    const rows = await sql`
      SELECT status, container_size, quantity, voucher_count
      FROM orders
      WHERE phone_normalized = ${phone}
    `;
    return res.status(200).json(computeRewards(rows));
  } catch (err) {
    console.error('Rewards query failed:', err);
    return res.status(500).json({ error: 'Failed to check rewards' });
  }
}
