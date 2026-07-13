import { getSupabase } from '@/lib/supabaseAdmin';
import { DEFAULT_BRANCH_ID } from '@/lib/constants';
import crypto from 'node:crypto';
import { computeRewards, normalizePhone } from '@/lib/loyalty';
import { hashCode, CODE_MAX_ATTEMPTS } from '@/lib/reward-codes';
import { verifyAdminWithLockout, timingSafeEqual } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { PRODUCTS_BY_ID } from '@/lib/products';
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
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!adminRate(req, res)) return;
    if (!await verifyAdminWithLockout(req, res)) return;
    try {
      const supabase = getSupabase();
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const offset = (page - 1) * limit;
      const statusFilter = req.query.status || '';
      const search = (req.query.search || '').trim();
      const sortParam = req.query.sort || 'date_desc';

      const validStatuses = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
      const hasStatus = validStatuses.includes(statusFilter);

      const sortMap = {
        date_desc: ['created_at', false], date_asc: ['created_at', true],
        total_desc: ['total_amount', false], total_asc: ['total_amount', true],
        name_asc: ['customer_name', true], name_desc: ['customer_name', false],
        status_asc: ['status', true],
      };
      const [sortCol, sortAsc] = sortMap[sortParam] || sortMap.date_desc;

      let query = supabase.from('orders').select('*', { count: 'exact' });
      if (hasStatus) query = query.eq('status', statusFilter);
      if (search) query = query.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%`);
      query = query.order(sortCol, { ascending: sortAsc }).range(offset, offset + limit - 1);

      const [{ data: rows, count: total, error }, { data: statusRows }] = await Promise.all([
        query,
        supabase.from('orders').select('status'),
      ]);
      if (error) throw error;

      const statusCounts = {};
      for (const r of statusRows || []) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

      return res.status(200).json({
        orders: rows,
        total: total ?? 0,
        page,
        totalPages: Math.ceil((total ?? 0) / limit) || 1,
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
    const supabase = getSupabase();
    const normPhone = normalizePhone(phone);

    let available = 0;
    try {
      const { data: prior } = await supabase
        .from('orders')
        .select('status, container_size, quantity, voucher_count')
        .eq('phone_normalized', normPhone);
      available = computeRewards(prior || []).available;
    } catch (e) {
      available = 0;
    }
    const requested = Math.max(0, Math.min(reward_requested || 0, quantity));

    let voucher_count = 0;
    let reward_requested_store = 0;
    if (requested > 0 && reward_code) {
      try {
        const { data: codeRows } = await supabase
          .from('reward_codes')
          .select('id, code_hash, expires_at, used, attempts')
          .eq('phone', normPhone)
          .eq('used', false)
          .order('created_at', { ascending: false })
          .limit(1);
        const row = codeRows?.[0];
        const nowIso = new Date().toISOString();
        if (row && row.expires_at > nowIso && row.attempts < CODE_MAX_ATTEMPTS) {
          if (timingSafeEqual(row.code_hash, hashCode(normPhone, String(reward_code)))) {
            const { data: claimed } = await supabase
              .from('reward_codes')
              .update({ used: true })
              .eq('id', row.id)
              .eq('used', false)
              .select('id');
            if (claimed && claimed.length > 0) {
              voucher_count = Math.min(requested, available);
            } else {
              reward_requested_store = requested;
            }
          } else {
            await supabase.from('reward_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
            reward_requested_store = requested;
          }
        } else {
          if (row && row.attempts >= CODE_MAX_ATTEMPTS) {
            await supabase.from('reward_codes').update({ used: true }).eq('id', row.id);
          }
          reward_requested_store = requested;
        }
      } catch (e) {
        reward_requested_store = requested;
      }
    } else if (requested > 0) {
      reward_requested_store = requested;
    }

    const id = crypto.randomUUID();

    let screenshotPath = null;
    if (payment_screenshot) {
      const match = /^data:(image\/\w+);base64,(.+)$/.exec(payment_screenshot);
      if (match) {
        const [, contentType, base64] = match;
        const ext = contentType === 'image/png' ? 'png' : 'jpg';
        screenshotPath = `${id}/payment.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('payment-screenshots')
          .upload(screenshotPath, Buffer.from(base64, 'base64'), { contentType, upsert: true });
        if (uploadErr) {
          console.error('Screenshot upload failed:', uploadErr);
          screenshotPath = null;
        }
      }
    }

    const { data: order, error: rpcErr } = await supabase.rpc('create_order', {
      p_client_order_id: id,
      p_branch_id: DEFAULT_BRANCH_ID,
      p_customer_name: customer_name,
      p_phone: phone,
      p_address: address,
      p_barangay: barangay,
      p_address_label: 'Home',
      p_product_type: product_type,
      p_container_size: containerSize,
      p_quantity: quantity,
      p_need_container: !!need_container,
      p_container_quantity: container_quantity || 0,
      p_payment_method: payment_method,
      p_gcash_number: gcash_number || null,
      p_reference_number: reference_number || null,
      p_payment_screenshot_path: screenshotPath,
      p_notes: notes || null,
      p_total_amount: 0,
      p_sale_channel: 'online',
      p_cash_tendered: null,
      p_voucher_count: voucher_count,
      p_reward_requested: reward_requested_store,
    });

    if (rpcErr) {
      console.error('Order insert failed:', rpcErr);
      return res.status(500).json({ error: 'Failed to place order' });
    }

    if (hasEmptyContainers) {
      const { error: pickupErr } = await supabase.from('container_pickups').insert({
        branch_id: DEFAULT_BRANCH_ID,
        order_id: order.id,
        customer_name, phone, address, barangay,
        container_qty: quantity,
        pickup_date: pickupDate, pickup_time: pickupTime,
        delivery_date: deliveryDate, delivery_time: deliveryTime,
        status: 'scheduled', notes: '',
      });
      if (pickupErr) console.error('Container pickup insert failed:', pickupErr);
    }

    return res.status(201).json({ id: order.id, created_at: order.created_at });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
