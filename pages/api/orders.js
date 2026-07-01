import { initDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { computeRewards, normalizePhone, VOUCHER_VALUE } from '@/lib/loyalty';
import { hashCode } from '@/lib/reward-codes';
import { verifyAdmin, verifyAdminWithLockout, timingSafeEqual } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { PRODUCTS_BY_ID, deliveryFee } from '@/lib/products';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });
const orderRate = rateLimit({ windowMs: 60_000, max: 10 });

const OrderSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  address: z.string().min(1).max(500),
  barangay: z.string().min(1).max(200),
  product_type: z.string().min(1).max(50),
  container_size: z.string().min(1).max(20),
  quantity: z.coerce.number().int().min(1).max(50),
  need_container: z.boolean().or(z.literal(0)).or(z.literal(1)).optional().default(false),
  container_quantity: z.coerce.number().int().min(0).max(50).optional().default(0),
  payment_method: z.enum(['cod', 'gcash', 'paymaya']),
  gcash_number: z.string().max(20).optional().nullable(),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  total_amount: z.coerce.number().min(0),
  reward_requested: z.coerce.number().int().min(0).max(50).optional().default(0),
  reward_code: z.string().max(10).optional().nullable(),
  delivery_slot: z.enum(['am', 'pm']).optional().nullable(),
  delivery_date: z.string().max(20).optional().nullable(),
});

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  if (req.method === 'GET') {
    if (!adminRate(req, res)) return;
    if (!await verifyAdminWithLockout(req, res)) return;
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const offset = (page - 1) * limit;
      const statusFilter = req.query.status || '';
      const search = (req.query.search || '').trim();
      const sortParam = req.query.sort || 'date_desc';

      const validStatuses = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
      const hasStatus = validStatuses.includes(statusFilter);
      const hasSearch = search.length > 0;
      const escSearch = search.replace(/[%_\\]/g, '\\$&');
      const searchPattern = `%${escSearch}%`;

      const sortMap = {
        date_desc: sql`created_at DESC`,
        date_asc: sql`created_at ASC`,
        total_desc: sql`total_amount DESC`,
        total_asc: sql`total_amount ASC`,
        name_asc: sql`customer_name ASC`,
        name_desc: sql`customer_name DESC`,
        status_asc: sql`status ASC`,
      };
      const orderBy = sortMap[sortParam] || sql`created_at DESC`;

      const where =
        hasStatus && hasSearch ? sql`WHERE status = ${statusFilter} AND (customer_name ILIKE ${searchPattern} OR phone ILIKE ${searchPattern} OR id ILIKE ${searchPattern})`
        : hasStatus ? sql`WHERE status = ${statusFilter}`
        : hasSearch ? sql`WHERE (customer_name ILIKE ${searchPattern} OR phone ILIKE ${searchPattern} OR id ILIKE ${searchPattern})`
        : sql``;

      const [rows, countResult, statusRows] = await Promise.all([
        sql`SELECT * FROM orders ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT COUNT(*)::int AS total FROM orders ${where}`,
        sql`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`,
      ]);

      const total = countResult[0]?.total ?? 0;
      const statusCounts = Object.fromEntries(statusRows.map((r) => [r.status, r.count]));
      return res.status(200).json({
        orders: rows,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        statusCounts,
      });
    } catch (err) {
      console.error('Order list query failed:', err);
      return res.status(500).json({ error: 'Failed to load orders' });
    }
  }

  if (req.method === 'POST') {
    if (!orderRate(req, res)) return;

    const parsed = OrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid order data' });
    }
    const {
      customer_name, phone, address, barangay,
      product_type, quantity,
      need_container, container_quantity,
      payment_method, gcash_number, reference_number,
      notes, reward_requested, reward_code,
      delivery_slot, delivery_date,
    } = parsed.data;

    // Price is computed server-side from the catalog — never trust the client's
    // total_amount or container_size (prevents price tampering).
    const product = PRODUCTS_BY_ID[product_type];
    if (!product) {
      return res.status(400).json({ error: 'Unknown product' });
    }
    const containerSize = product.size;
    const refillSubtotal = product.refill * quantity;
    const containerSubtotal = need_container ? product.container * (container_quantity || 0) : 0;
    const computedBase = refillSubtotal + containerSubtotal + deliveryFee(quantity);

    const normPhone = normalizePhone(phone);
    let available = 0;
    try {
      const prior = await sql`
        SELECT status, container_size, quantity, voucher_count
        FROM orders
        WHERE phone_normalized = ${normPhone}
      `;
      available = computeRewards(prior).available;
    } catch (e) {
      available = 0;
    }
    const requested = Math.max(0, Math.min(reward_requested || 0, quantity));

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
          (r) => r.expires_at > nowIso && timingSafeEqual(r.code_hash, hashCode(normPhone, String(reward_code)))
        );
        if (match) {
          await sql`UPDATE reward_codes SET used = 1 WHERE id = ${match.id}`;
          voucher_count = Math.min(requested, available);
        } else {
          reward_requested_store = requested;
        }
      } catch (e) {
        reward_requested_store = requested;
      }
    } else if (requested > 0) {
      reward_requested_store = requested;
    }
    const voucher_discount = voucher_count * VOUCHER_VALUE;
    const finalTotal = Math.max(0, computedBase - voucher_discount);

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
          voucher_count, voucher_discount, reward_requested,
          phone_normalized, delivery_slot, delivery_date
        ) VALUES (
          ${id}, ${customer_name}, ${phone}, ${address}, ${barangay},
          ${product_type}, ${containerSize}, ${quantity},
          ${nc}, ${cq},
          ${payment_method}, ${gn}, ${rn},
          ${nt}, ${finalTotal}, ${created_at},
          ${voucher_count}, ${voucher_discount}, ${reward_requested_store},
          ${normPhone}, ${delivery_slot || null}, ${delivery_date || null}
        )
      `;
    } catch (err) {
      console.error('Order insert failed:', err);
      return res.status(500).json({ error: 'Failed to place order' });
    }

    return res.status(201).json({ id, created_at });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
