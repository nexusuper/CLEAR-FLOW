import { initDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { computeRewards, normalizePhone, maxRedeemable, VOUCHER_VALUE } from '@/lib/loyalty';
import { hashCode, CODE_MAX_ATTEMPTS } from '@/lib/reward-codes';
import { verifyAdmin, verifyAdminWithLockout, timingSafeEqual } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { PRODUCTS_BY_ID, deliveryFee } from '@/lib/products';
import { validateSchedule } from '@/lib/scheduling';
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
  payment_method: z.enum(['cod', 'gcash', 'bank_transfer']),
  gcash_number: z.string().max(20).optional().nullable(),
  reference_number: z.string().max(100).optional().nullable(),
  payment_screenshot: z.string().startsWith('data:image/').max(2_000_000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  total_amount: z.coerce.number().min(0),
  reward_requested: z.coerce.number().int().min(0).max(50).optional().default(0),
  reward_code: z.string().max(10).optional().nullable(),
  has_empty_containers: z.boolean().or(z.literal(0)).or(z.literal(1)).optional().default(false),
  pickupDate: z.string().max(10).optional().nullable(),
  pickupTime: z.string().max(5).optional().nullable(),
  deliveryDate: z.string().max(10).min(1),
  deliveryTime: z.string().max(5).min(1),
}).superRefine((data, ctx) => {
  // GCash payments must carry the payer's GCash number (mirrors the required
  // field on the public order form and the cross-field style in orders/pos.js).
  if (data.payment_method === 'gcash' && !data.gcash_number) {
    ctx.addIssue({ code: 'custom', path: ['gcash_number'], message: 'GCash number required for GCash payment' });
  }
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
      payment_method, gcash_number, reference_number, payment_screenshot,
      notes, reward_requested, reward_code,
      has_empty_containers, pickupDate, pickupTime, deliveryDate, deliveryTime,
    } = parsed.data;

    // Price is computed server-side from the catalog — never trust the client's
    // total_amount or container_size (prevents price tampering).
    const product = PRODUCTS_BY_ID[product_type];
    if (!product) {
      return res.status(400).json({ error: 'Unknown product' });
    }

    const hasEmptyContainers = !!has_empty_containers;
    const today = new Date().toISOString().slice(0, 10);
    const scheduleCheck = validateSchedule({
      hasEmptyContainers, pickupDate, pickupTime, deliveryDate, deliveryTime, today,
    });
    if (!scheduleCheck.ok) {
      return res.status(400).json({ error: scheduleCheck.error });
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
    // Cap the redemption by available vouchers, refill quantity, AND voucher
    // value vs the refill subtotal (same as orders/pos.js) — otherwise a customer
    // could redeem a voucher worth more than the order's refill line.
    const maxAllowed = maxRedeemable({ available, quantity, refillSubtotal });
    const requested = Math.max(0, Math.min(reward_requested || 0, maxAllowed));

    let voucher_count = 0;
    let reward_requested_store = 0;
    if (requested > 0 && reward_code) {
      try {
        // Mirror verify-code.js: only the single latest unused code counts, and
        // attempts are capped — otherwise reward_code could be brute-forced via
        // repeated order submissions without ever tripping CODE_MAX_ATTEMPTS.
        const codeRows = await sql`
          SELECT id, code_hash, expires_at, used, attempts FROM reward_codes
          WHERE phone = ${normPhone} AND used = 0
          ORDER BY created_at DESC LIMIT 1
        `;
        const row = codeRows[0];
        const nowIso = new Date().toISOString();
        if (row && row.expires_at > nowIso && row.attempts < CODE_MAX_ATTEMPTS) {
          if (timingSafeEqual(row.code_hash, hashCode(normPhone, String(reward_code)))) {
            // Atomic claim: WHERE used = 0 guards against two concurrent
            // orders spending the same code (double voucher grant).
            const claimed = await sql`
              UPDATE reward_codes SET used = 1
              WHERE id = ${row.id} AND used = 0
              RETURNING id
            `;
            if (claimed.length > 0) {
              voucher_count = Math.min(requested, available);
            } else {
              reward_requested_store = requested;
            }
          } else {
            await sql`UPDATE reward_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
            reward_requested_store = requested;
          }
        } else {
          if (row && row.attempts >= CODE_MAX_ATTEMPTS) {
            await sql`UPDATE reward_codes SET used = 1 WHERE id = ${row.id}`;
          }
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
    const ps = payment_screenshot || null;

    const hec = hasEmptyContainers ? 1 : 0;
    const insertOrder = sql`
      INSERT INTO orders (
        id, customer_name, phone, address, barangay,
        product_type, container_size, quantity,
        need_container, container_quantity,
        payment_method, gcash_number, reference_number, payment_screenshot,
        notes, total_amount, created_at,
        voucher_count, voucher_discount, reward_requested,
        phone_normalized, has_empty_containers, pickup_date, pickup_time,
        delivery_date_new, delivery_time
      ) VALUES (
        ${id}, ${customer_name}, ${phone}, ${address}, ${barangay},
        ${product_type}, ${containerSize}, ${quantity},
        ${nc}, ${cq},
        ${payment_method}, ${gn}, ${rn}, ${ps},
        ${nt}, ${finalTotal}, ${created_at},
        ${voucher_count}, ${voucher_discount}, ${reward_requested_store},
        ${normPhone}, ${hec}, ${hasEmptyContainers ? pickupDate : null}, ${hasEmptyContainers ? pickupTime : null},
        ${deliveryDate}, ${deliveryTime}
      )
    `;

    try {
      if (hasEmptyContainers) {
        const pickupId = uuidv4().slice(0, 8).toUpperCase();
        const insertPickup = sql`
          INSERT INTO container_pickups (
            id, order_id, customer_name, phone, phone_normalized, address, barangay,
            container_qty, pickup_date, pickup_time, delivery_date, delivery_time,
            status, notes, messenger_psid, created_at, updated_at
          ) VALUES (
            ${pickupId}, ${id}, ${customer_name}, ${phone}, ${normPhone}, ${address}, ${barangay},
            ${quantity}, ${pickupDate}, ${pickupTime}, ${deliveryDate}, ${deliveryTime},
            'scheduled', '', NULL, ${created_at}, ${created_at}
          )
        `;
        await sql.transaction([insertOrder, insertPickup]);
      } else {
        await insertOrder;
      }
    } catch (err) {
      console.error('Order insert failed:', err);
      return res.status(500).json({ error: 'Failed to place order' });
    }

    return res.status(201).json({ id, created_at });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
