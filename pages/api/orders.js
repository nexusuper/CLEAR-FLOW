import { initDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { computeRewards, normalizePhone, VOUCHER_VALUE } from '@/lib/loyalty';
import { hashCode } from '@/lib/reward-codes';

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  if (req.method === 'GET') {
    const { password } = req.headers;
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ error: `Query failed: ${err.message}` });
    }
  }

  if (req.method === 'POST') {
    const {
      customer_name, phone, address, barangay,
      product_type, container_size, quantity,
      need_container, container_quantity,
      payment_method, gcash_number, reference_number,
      notes, total_amount, reward_requested, reward_code,
    } = req.body;

    if (!customer_name || !phone || !address || !barangay || !product_type || !container_size || !quantity || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Loyalty redemption: never trust the client. A discount is applied only when
    // a valid Messenger code is consumed; otherwise the request is stored as
    // pending for admin approval. `available` re-clamp caps redemption to earned.
    const normPhone = normalizePhone(phone);
    let available = 0;
    try {
      const prior = await sql`
        SELECT status, container_size, quantity, voucher_count
        FROM orders
        WHERE regexp_replace(phone, '\\D', '', 'g') = ${normPhone}
      `;
      available = computeRewards(prior).available;
    } catch (e) {
      available = 0;
    }
    const requested = Math.max(0, Math.min(parseInt(reward_requested) || 0, parseInt(quantity) || 0));

    let voucher_count = 0;
    let reward_requested_store = 0;
    if (requested > 0 && reward_code) {
      try {
        const codeRows = await sql`
          SELECT id, code_hash, expires_at, used FROM reward_codes
          WHERE phone = ${normPhone} AND used = 0
          ORDER BY created_at DESC LIMIT 5
        `;
        const nowIso = new Date().toISOString();
        const match = codeRows.find(
          (r) => r.expires_at > nowIso && r.code_hash === hashCode(normPhone, String(reward_code))
        );
        if (match) {
          await sql`UPDATE reward_codes SET used = 1 WHERE id = ${match.id}`;
          voucher_count = Math.min(requested, available);
        } else {
          reward_requested_store = requested; // invalid/expired code → pending
        }
      } catch (e) {
        reward_requested_store = requested;
      }
    } else if (requested > 0) {
      reward_requested_store = requested; // no code → pending admin approval
    }
    const voucher_discount = voucher_count * VOUCHER_VALUE;
    const finalTotal = Math.max(0, (Number(total_amount) || 0) - voucher_discount);

    const id = uuidv4().slice(0, 8).toUpperCase();
    const created_at = new Date().toISOString();
    const nc = need_container ? 1 : 0;
    const cq = container_quantity || 0;
    const gn = gcash_number || null;
    const rn = reference_number || null;
    const nt = notes || null;

    try {
      await sql`
        INSERT INTO orders (
          id, customer_name, phone, address, barangay,
          product_type, container_size, quantity,
          need_container, container_quantity,
          payment_method, gcash_number, reference_number,
          notes, total_amount, created_at,
          voucher_count, voucher_discount, reward_requested
        ) VALUES (
          ${id}, ${customer_name}, ${phone}, ${address}, ${barangay},
          ${product_type}, ${container_size}, ${quantity},
          ${nc}, ${cq},
          ${payment_method}, ${gn}, ${rn},
          ${nt}, ${finalTotal}, ${created_at},
          ${voucher_count}, ${voucher_discount}, ${reward_requested_store}
        )
      `;
    } catch (err) {
      return res.status(500).json({ error: `Insert failed: ${err.message}` });
    }

    return res.status(201).json({ id, created_at });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
