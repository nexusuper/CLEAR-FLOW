import { getSupabase } from '@/lib/supabaseAdmin';
import { DEFAULT_BRANCH_ID } from '@/lib/constants';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';
import { buildStatusMessage } from '@/lib/notifications';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });
const BodySchema = z.object({ order_id: z.string().uuid() });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!adminRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  const supabase = getSupabase();
  const { data: order } = await supabase.from('orders').select('*').eq('id', parsed.data.order_id).single();
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const text = buildStatusMessage(order, order.status, 'sms');
  await supabase.from('contact_log').insert({
    branch_id: DEFAULT_BRANCH_ID, phone_normalized: normalizePhone(order.phone),
    channel: 'sms', direction: 'outbound', summary: text, order_id: order.id,
  });

  return res.status(200).json({ text, phone: order.phone });
}
