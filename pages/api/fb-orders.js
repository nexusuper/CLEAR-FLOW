import { getSupabase } from '@/lib/supabaseAdmin';
import { DEFAULT_BRANCH_ID } from '@/lib/constants';
import { rateLimit } from '@/lib/rate-limit';
import { timingSafeEqual } from '@/lib/auth';
import { PRODUCTS_BY_ID } from '@/lib/products';
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
  delivery_slot: z.enum(['am', 'pm']).optional(),
});

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
  const productKey = PRODUCTS_BY_ID[b.product_type] ? b.product_type : 'slim5';

  if (!phone || !address || !gallons) {
    return res.status(400).json({ error: 'Missing required fields: need phone, address, and quantity' });
  }

  const product = PRODUCTS_BY_ID[productKey];
  const perContainer = product.size === '3-Gal' ? 3 : 5;
  const quantity = Math.max(1, Math.round(gallons / perContainer));
  const notes =
    `Ordered via Facebook Messenger (${gallons} gal requested)` +
    (b.notes ? ` — ${b.notes}` : '');

  const supabase = getSupabase();
  const { data: order, error } = await supabase.rpc('create_order', {
    p_client_order_id: crypto.randomUUID(),
    p_branch_id: DEFAULT_BRANCH_ID,
    p_customer_name: customer_name,
    p_phone: phone,
    p_address: address,
    p_barangay: barangay,
    p_address_label: 'Home',
    p_product_type: productKey,
    p_container_size: product.size,
    p_quantity: quantity,
    p_need_container: false,
    p_container_quantity: 0,
    p_payment_method: 'cod',
    p_gcash_number: null,
    p_reference_number: null,
    p_payment_screenshot_path: null,
    p_notes: notes,
    p_total_amount: 0,
    p_sale_channel: 'online',
    p_cash_tendered: null,
    p_voucher_count: 0,
    p_reward_requested: 0,
  });

  if (error) {
    console.error('FB order insert failed:', error);
    return res.status(500).json({ error: 'Failed to place order' });
  }

  if (messenger_psid) {
    await supabase.from('orders').update({ messenger_psid }).eq('id', order.id);
    await supabase.from('customers').update({ messenger_psid }).eq('id', order.customer_id);
  }
  if (b.delivery_slot) {
    await supabase.from('orders').update({ delivery_time: b.delivery_slot }).eq('id', order.id);
  }

  return res
    .status(201)
    .json({ id: order.id, created_at: order.created_at, quantity, container_size: product.size, total_amount: order.total_amount });
}
