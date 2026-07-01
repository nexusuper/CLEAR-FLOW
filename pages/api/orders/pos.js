import { initDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { computeRewards, normalizePhone, maxRedeemable, VOUCHER_VALUE } from '@/lib/loyalty';
import { deductInventoryForSale } from '@/lib/inventory';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { PRODUCTS_BY_ID, deliveryFee } from '@/lib/products';
import { z } from 'zod';

const posRate = rateLimit({ windowMs: 60_000, max: 20 });

const POSLineSchema = z.object({
  product_type: z.string().min(1).max(50),
  quantity: z.coerce.number().int().min(1).max(50),
  need_container: z.boolean().or(z.literal(0)).or(z.literal(1)).optional().default(false),
  container_quantity: z.coerce.number().int().min(0).max(50).optional().default(0),
});

const POSOrderSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  fulfillment_type: z.enum(['pickup', 'delivery']),
  address: z.string().max(500).optional().default(''),
  barangay: z.string().max(200).optional().default(''),
  delivery_slot: z.enum(['am', 'pm']).optional().nullable(),
  delivery_date: z.string().max(20).optional().nullable(),
  lines: z.array(POSLineSchema).min(1).max(20),
  payment_method: z.enum(['cod', 'gcash', 'paymaya']),
  cash_tendered: z.coerce.number().min(0).optional().nullable(),
  gcash_number: z.string().max(20).optional().nullable(),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  redeem_vouchers: z.coerce.number().int().min(0).max(50).optional().default(0),
}).superRefine((data, ctx) => {
  if (data.fulfillment_type === 'delivery') {
    if (!data.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Address required for delivery' });
    if (!data.barangay) ctx.addIssue({ code: 'custom', path: ['barangay'], message: 'Barangay required for delivery' });
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!posRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  const parsed = POSOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid POS sale data', details: parsed.error.flatten() });
  }
  const {
    customer_name, phone, fulfillment_type,
    address, barangay, delivery_slot, delivery_date,
    lines, payment_method, cash_tendered,
    gcash_number, reference_number, notes,
    redeem_vouchers,
  } = parsed.data;

  // Resolve + price every line server-side — never trust client-submitted prices.
  const resolvedLines = [];
  for (const line of lines) {
    const product = PRODUCTS_BY_ID[line.product_type];
    if (!product) {
      return res.status(400).json({ error: `Unknown product: ${line.product_type}` });
    }
    const refill_subtotal = product.refill * line.quantity;
    const container_subtotal = line.need_container ? product.container * (line.container_quantity || 0) : 0;
    resolvedLines.push({
      product_type: line.product_type,
      product_name: product.name,
      container_size: product.size,
      quantity: line.quantity,
      need_container: line.need_container ? 1 : 0,
      container_quantity: line.container_quantity || 0,
      refill_subtotal,
      container_subtotal,
      line_base: refill_subtotal + container_subtotal,
    });
  }

  const isPickup = fulfillment_type === 'pickup';
  const totalQuantity = resolvedLines.reduce((sum, l) => sum + l.quantity, 0);
  const totalRefillSubtotal = resolvedLines.reduce((sum, l) => sum + l.refill_subtotal, 0);
  const cartDeliveryFee = isPickup ? 0 : deliveryFee(totalQuantity);

  // Loyalty: direct redemption at checkout (admin-mediated, no Messenger OTP).
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
  const maxAllowedVouchers = maxRedeemable({
    available,
    quantity: totalQuantity,
    refillSubtotal: totalRefillSubtotal,
  });
  const appliedVouchers = Math.min(redeem_vouchers, maxAllowedVouchers);

  // Distribute redeemed vouchers across lines, greedily, capped by each line's own quantity.
  let remainingVouchers = appliedVouchers;
  for (const line of resolvedLines) {
    const take = Math.min(remainingVouchers, line.quantity);
    line.voucher_count = take;
    line.voucher_discount = take * VOUCHER_VALUE;
    remainingVouchers -= take;
  }

  const voucherDiscountTotal = resolvedLines.reduce((sum, l) => sum + l.voucher_discount, 0);
  const cartSubtotal = resolvedLines.reduce((sum, l) => sum + l.line_base, 0);
  const totalAmount = Math.max(0, cartSubtotal + cartDeliveryFee - voucherDiscountTotal);
  const changeDue = payment_method === 'cod' && cash_tendered != null
    ? Math.max(0, cash_tendered - totalAmount)
    : null;

  // Attribute the whole-cart delivery fee to the first line only (avoids splitting
  // a single ₱15/₱20 fee across multiple rows and any per-row rounding oddity).
  resolvedLines[0].delivery_fee = cartDeliveryFee;
  for (let i = 1; i < resolvedLines.length; i++) resolvedLines[i].delivery_fee = 0;

  for (const line of resolvedLines) {
    line.line_total = Math.max(0, line.line_base + line.delivery_fee - line.voucher_discount);
  }

  const status = isPickup ? 'delivered' : 'pending';
  const transaction_id = 'TX-' + uuidv4().slice(0, 8).toUpperCase();
  const created_at = new Date().toISOString();
  const pickupAddress = address || 'Counter Pickup';
  const pickupBarangay = barangay || 'N/A';
  const gn = gcash_number || null;
  const rn = reference_number || null;
  const nt = notes || null;
  const ct = payment_method === 'cod' && cash_tendered != null ? cash_tendered : null;

  for (const line of resolvedLines) {
    line.order_id = uuidv4().slice(0, 8).toUpperCase();
  }

  try {
    const inserts = resolvedLines.map((line) => sql`
      INSERT INTO orders (
        id, customer_name, phone, address, barangay,
        product_type, container_size, quantity,
        need_container, container_quantity,
        payment_method, gcash_number, reference_number,
        notes, status, total_amount, created_at,
        voucher_count, voucher_discount, reward_requested,
        phone_normalized, delivery_slot, delivery_date,
        transaction_id, sale_channel, cash_tendered
      ) VALUES (
        ${line.order_id}, ${customer_name}, ${phone}, ${isPickup ? pickupAddress : address}, ${isPickup ? pickupBarangay : barangay},
        ${line.product_type}, ${line.container_size}, ${line.quantity},
        ${line.need_container}, ${line.container_quantity},
        ${payment_method}, ${gn}, ${rn},
        ${nt}, ${status}, ${line.line_total}, ${created_at},
        ${line.voucher_count}, ${line.voucher_discount}, 0,
        ${normPhone}, ${isPickup ? null : (delivery_slot || null)}, ${isPickup ? null : (delivery_date || null)},
        ${transaction_id}, 'pos', ${ct}
      )
    `);
    await sql.transaction(inserts);
  } catch (err) {
    console.error('POS sale insert failed:', err);
    return res.status(500).json({ error: 'Failed to complete sale' });
  }

  // Inventory deduction for pickup sales is best-effort — the sale is already
  // recorded above; a stock hiccup here is logged but never rolls back the sale.
  if (isPickup) {
    for (const line of resolvedLines) {
      try {
        const deducted = await deductInventoryForSale(sql, {
          product_id: line.product_type,
          qty: line.quantity,
          order_id: line.order_id,
        });
        if (deducted) {
          await sql`UPDATE orders SET inventory_deducted = 1 WHERE id = ${line.order_id}`;
        }
      } catch (invErr) {
        console.error('POS inventory deduct failed for', line.product_type, invErr);
      }
    }
  }

  return res.status(201).json({
    transaction_id,
    created_at,
    fulfillment_type,
    customer_name,
    phone,
    lines: resolvedLines.map((l) => ({
      order_id: l.order_id,
      product_type: l.product_type,
      product_name: l.product_name,
      quantity: l.quantity,
      refill_subtotal: l.refill_subtotal,
      need_container: !!l.need_container,
      container_quantity: l.container_quantity,
      container_subtotal: l.container_subtotal,
      voucher_count: l.voucher_count,
      voucher_discount: l.voucher_discount,
      line_total: l.line_total,
      status,
    })),
    delivery_fee: cartDeliveryFee,
    subtotal: cartSubtotal,
    voucher_count_total: appliedVouchers,
    voucher_discount_total: voucherDiscountTotal,
    total_amount: totalAmount,
    payment_method,
    cash_tendered: ct,
    change_due: changeDue,
    loyalty_available_after: Math.max(0, available - appliedVouchers),
  });
}
