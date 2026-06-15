import { initDb } from '@/lib/db';
import { computeRewards, normalizePhone } from '@/lib/loyalty';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  const phone = normalizePhone(req.query.phone);
  if (phone.length < 7) {
    return res.status(400).json({ error: 'Enter a valid phone number' });
  }

  try {
    const rows = await sql`
      SELECT status, container_size, quantity, voucher_count
      FROM orders
      WHERE regexp_replace(phone, '\\D', '', 'g') = ${phone}
    `;
    return res.status(200).json(computeRewards(rows));
  } catch (err) {
    return res.status(500).json({ error: `Query failed: ${err.message}` });
  }
}
