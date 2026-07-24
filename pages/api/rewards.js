import { getSupabase } from '@/lib/supabaseAdmin';
import { computeRewards, normalizePhone } from '@/lib/loyalty';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const checkRate = rateLimit({ windowMs: 60_000, max: 20 });
const QuerySchema = z.object({ phone: z.string().min(1).max(20) });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRate(req, res)) return;

  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid phone number' });
  const phone = normalizePhone(parsed.data.phone);
  if (phone.length < 7) return res.status(400).json({ error: 'Enter a valid phone number' });

  try {
    const { data: rows, error } = await getSupabase()
      .from('orders').select('status, container_size, quantity, voucher_count').eq('phone_normalized', phone);
    if (error) throw error;
    return res.status(200).json(computeRewards(rows || []));
  } catch (err) {
    console.error('Rewards query failed:', err);
    return res.status(500).json({ error: 'Failed to check rewards' });
  }
}
