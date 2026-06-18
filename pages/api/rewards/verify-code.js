import { initDb } from '@/lib/db';
import { computeRewards, normalizePhone } from '@/lib/loyalty';
import { hashCode, CODE_MAX_ATTEMPTS } from '@/lib/reward-codes';
import { rateLimit } from '@/lib/rate-limit';

const checkRate = rateLimit({ windowMs: 60_000, max: 10 });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkRate(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(200).json({ valid: false });
  }

  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code || '');
  if (phone.length < 7 || !code) return res.status(200).json({ valid: false });

  try {
    const rows = await sql`
      SELECT id, code_hash, expires_at, used, attempts
      FROM reward_codes
      WHERE phone = ${phone} AND used = 0
      ORDER BY created_at DESC LIMIT 1
    `;
    const row = rows[0];
    const nowIso = new Date().toISOString();
    if (!row || row.expires_at <= nowIso) return res.status(200).json({ valid: false });

    if (row.attempts >= CODE_MAX_ATTEMPTS) {
      await sql`UPDATE reward_codes SET used = 1 WHERE id = ${row.id}`;
      return res.status(200).json({ valid: false });
    }
    await sql`UPDATE reward_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;

    if (row.code_hash === hashCode(phone, code)) {
      const orderRows = await sql`
        SELECT status, container_size, quantity, voucher_count
        FROM orders
        WHERE regexp_replace(phone, '\\D', '', 'g') = ${phone}
      `;
      const { available } = computeRewards(orderRows);
      return res.status(200).json({ valid: true, available });
    }
    return res.status(200).json({ valid: false });
  } catch (err) {
    return res.status(200).json({ valid: false });
  }
}
