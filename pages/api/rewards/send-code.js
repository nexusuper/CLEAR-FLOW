import { initDb } from '@/lib/db';
import { computeRewards, normalizePhone } from '@/lib/loyalty';
import { generateCode, hashCode, CODE_TTL_MINUTES } from '@/lib/reward-codes';
import { sendMessengerMessage } from '@/lib/facebook';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  const phone = normalizePhone(req.body?.phone);
  if (phone.length < 7) return res.status(200).json({ sent: false });

  try {
    const rows = await sql`
      SELECT status, container_size, quantity, voucher_count, messenger_psid
      FROM orders
      WHERE regexp_replace(phone, '\\D', '', 'g') = ${phone}
    `;
    const { available } = computeRewards(rows);
    if (available < 1) return res.status(200).json({ sent: false });

    const linked = rows.find((r) => r.messenger_psid);
    if (!linked) return res.status(200).json({ sent: false });

    const code = generateCode();
    const id = uuidv4();
    const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
    const created = new Date().toISOString();

    await sql`
      INSERT INTO reward_codes (id, phone, code_hash, expires_at, used, attempts, created_at)
      VALUES (${id}, ${phone}, ${hashCode(phone, code)}, ${expires}, 0, 0, ${created})
    `;

    try {
      await sendMessengerMessage(
        linked.messenger_psid,
        `Your Clear Flow reward code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. Enter it at checkout to use your free refill.`
      );
      return res.status(200).json({ sent: true });
    } catch (e) {
      await sql`DELETE FROM reward_codes WHERE id = ${id}`;
      return res.status(200).json({ sent: false });
    }
  } catch (err) {
    return res.status(200).json({ sent: false });
  }
}
