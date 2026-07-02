import { initDb } from '@/lib/db';
import { verifyAdminSoftLockout, verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';
import { deductInventoryForSale } from '@/lib/inventory';
import { buildStatusMessage, NOTIFIABLE_STATUSES } from '@/lib/notifications';
import { sendMessengerMessage } from '@/lib/facebook';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const PatchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled']).optional(),
  payment_verified: z.boolean().optional(),
});

const readRate = rateLimit({ windowMs: 60_000, max: 30 });
const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    if (!readRate(req, res)) return;

    const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!await verifyAdminSoftLockout(req)) {
      const phone = normalizePhone(req.query.phone);
      const orderPhone = normalizePhone(order.phone);
      if (!phone || phone !== orderPhone) {
        // Public view: status tracking only — first name only, not full name,
        // since anyone with the order ID (guessable-ish 8-char code) can hit this.
        return res.status(200).json({
          id: order.id,
          status: order.status,
          created_at: order.created_at,
          product_type: order.product_type,
          container_size: order.container_size,
          quantity: order.quantity,
          total_amount: order.total_amount,
          customer_name: (order.customer_name || '').trim().split(/\s+/)[0] || order.customer_name,
          voucher_count: order.voucher_count,
          voucher_discount: order.voucher_discount,
          reward_requested: order.reward_requested,
          delivery_slot: order.delivery_slot,
          delivery_date: order.delivery_date,
        });
      }
      // Phone-verified customer view: safe fields only — never expose payment/internal fields
      return res.status(200).json({
        id: order.id,
        status: order.status,
        created_at: order.created_at,
        product_type: order.product_type,
        container_size: order.container_size,
        quantity: order.quantity,
        total_amount: order.total_amount,
        customer_name: order.customer_name,
        phone: order.phone,
        address: order.address,
        barangay: order.barangay,
        notes: order.notes,
        payment_method: order.payment_method,
        need_container: order.need_container,
        container_quantity: order.container_quantity,
        voucher_count: order.voucher_count,
        voucher_discount: order.voucher_discount,
        reward_requested: order.reward_requested,
        delivery_slot: order.delivery_slot,
        delivery_date: order.delivery_date,
        payment_verified: order.payment_verified,
      });
    }

    return res.status(200).json(order);
  }

  if (req.method === 'PATCH') {
    if (!adminRate(req, res)) return;
    if (!await verifyAdminWithLockout(req, res)) return;

    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid update data' });
    }
    const { status, payment_verified } = parsed.data;

    if (status === undefined && payment_verified === undefined) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    // Payment verification toggle (independent of status)
    if (payment_verified !== undefined) {
      const exists = await sql`SELECT id FROM orders WHERE id = ${id}`;
      if (exists.length === 0) return res.status(404).json({ error: 'Order not found' });
      await sql`UPDATE orders SET payment_verified = ${payment_verified ? 1 : 0} WHERE id = ${id}`;
      if (status === undefined) {
        return res.status(200).json({ success: true });
      }
    }

    if (status !== undefined) {
      const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;
      const order = rows[0];
      if (!order) return res.status(404).json({ error: 'Order not found' });

      await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;

      // Auto-notify on notifiable status changes
      if (NOTIFIABLE_STATUSES.includes(status)) {
        if (order.messenger_psid) {
          try {
            const text = buildStatusMessage(order, status, 'messenger');
            await sendMessengerMessage(order.messenger_psid, text);
            await sql`
              INSERT INTO contact_log (id, phone_normalized, channel, direction, summary, order_id, created_at)
              VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${normalizePhone(order.phone)}, 'messenger', 'outbound', ${text}, ${id}, ${new Date().toISOString()})
            `;
          } catch (notifyErr) {
            console.error('Auto Messenger notify failed:', notifyErr);
          }
        } else {
          try {
            await sql`UPDATE orders SET sms_pending = 1 WHERE id = ${id}`;
          } catch (flagErr) {
            console.error('Set sms_pending failed:', flagErr);
          }
        }
      }

      // Inventory auto-deduct on delivery (idempotent via inventory_deducted flag)
      if (status === 'delivered' && Number(order.inventory_deducted) === 0) {
        try {
          const deducted = await deductInventoryForSale(sql, {
            product_id: order.product_type,
            qty: Number(order.quantity) || 0,
            order_id: id,
          });
          if (deducted) {
            await sql`UPDATE orders SET inventory_deducted = 1 WHERE id = ${id}`;
          }
        } catch (invErr) {
          console.error('Inventory auto-deduct failed:', invErr);
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Nothing to update' });
  }

  if (req.method === 'DELETE') {
    if (!adminRate(req, res)) return;
    if (!await verifyAdminWithLockout(req, res)) return;
    const rows = await sql`SELECT status FROM orders WHERE id = ${id}`;
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: 'Only delivered or cancelled orders can be deleted' });
    }
    await sql`DELETE FROM orders WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
