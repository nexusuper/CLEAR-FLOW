import { initDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { rateLimit } from '@/lib/rate-limit';
import { timingSafeEqual } from '@/lib/auth';
import { z } from 'zod';

const checkRate = rateLimit({ windowMs: 60_000, max: 10 });

const FbOrderSchema = z.object({
  customer_name: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  full_name: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  contact_number: z.string().max(30).optional(),
  contact: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  delivery_address: z.string().max(500).optional(),
  qty: z.union([z.string(), z.number()]).optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  gallons: z.union([z.string(), z.number()]).optional(),
  messenger_id: z.string().max(100).optional(),
  messenger_psid: z.string().max(100).optional(),
  psid: z.string().max(100).optional(),
  barangay: z.string().max(200).optional(),
  product_type: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

// Lightweight order intake for the Facebook Messenger (ManyChat) order flow.
// The chat collects only name/phone/address/gallons, so this endpoint fills the
// remaining required columns with sensible defaults and lands the order as
// `pending` for the admin to confirm. Catalog + delivery fee mirror pages/order.js.
const PRODUCTS = {
  slim5: { name: '5-Gallon Slim', refill: 30, container: 150, size: '5-Gal' },
  round5: { name: '5-Gallon Round', refill: 35, container: 170, size: '5-Gal' },
  round3: { name: '3-Gallon Round', refill: 20, container: 100, size: '3-Gal' },
};

function deliveryFee(qty) {
  if (qty >= 5) return 0;
  if (qty >= 2) return 15;
  return 20;
}

// Pull the first integer out of values like "10", "10 gallons", or 10.
function parseGallons(v) {
  const m = String(v ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkRate(req, res)) return;

  const secret = process.env.FB_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  if (!timingSafeEqual(req.headers['x-webhook-secret'], secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  const parsed = FbOrderSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request data' });
  }
  const b = parsed.data;
  const customer_name = b.customer_name || b.name || b.full_name || 'Messenger Customer';
  const phone = b.phone || b.contact_number || b.contact || '';
  const address = b.address || b.delivery_address || '';
  const gallons = parseGallons(b.qty ?? b.quantity ?? b.gallons);
  const messenger_psid = b.messenger_id || b.messenger_psid || b.psid || null;
  const barangay = b.barangay || 'TBD (via Messenger)';
  const productKey = PRODUCTS[b.product_type] ? b.product_type : 'slim5';

  if (!phone || !address || !gallons) {
    return res.status(400).json({ error: 'Missing required fields: need phone, address, and quantity' });
  }

  const product = PRODUCTS[productKey];
  // The flow asks for total gallons; convert to whole containers of the size.
  const perContainer = product.size === '3-Gal' ? 3 : 5;
  const quantity = Math.max(1, Math.round(gallons / perContainer));
  const subtotal = quantity * product.refill;
  const total_amount = subtotal + deliveryFee(quantity);

  const id = uuidv4().slice(0, 8).toUpperCase();
  const created_at = new Date().toISOString();
  const notes =
    `Ordered via Facebook Messenger (${gallons} gal requested)` +
    (b.notes ? ` — ${b.notes}` : '');

  try {
    await sql`
      INSERT INTO orders (
        id, customer_name, phone, address, barangay,
        product_type, container_size, quantity,
        need_container, container_quantity,
        payment_method, gcash_number, reference_number,
        notes, total_amount, created_at, messenger_psid,
        voucher_count, voucher_discount, reward_requested
      ) VALUES (
        ${id}, ${customer_name}, ${phone}, ${address}, ${barangay},
        ${productKey}, ${product.size}, ${quantity},
        ${0}, ${0},
        ${'cod'}, ${null}, ${null},
        ${notes}, ${total_amount}, ${created_at}, ${messenger_psid},
        ${0}, ${0}, ${0}
      )
    `;
  } catch (err) {
    console.error('FB order insert failed:', err);
    return res.status(500).json({ error: 'Failed to place order' });
  }

  return res
    .status(201)
    .json({ id, created_at, quantity, container_size: product.size, total_amount });
}
