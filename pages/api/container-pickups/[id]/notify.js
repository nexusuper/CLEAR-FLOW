import { initDb } from '@/lib/db';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendMessengerMessage } from '@/lib/facebook';
import { v4 as uuidv4 } from 'uuid';
import { normalizePhone } from '@/lib/loyalty';
import { buildPickupStatusMessage } from '@/lib/notifications';
import { z } from 'zod';

const BodySchema = z.object({
  status: z.enum(['scheduled', 'picked_up', 'delivered']),
  channel: z.enum(['sms', 'messenger']),
});

const checkRate = rateLimit({ windowMs: 60_000, max: 20 });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
  const { status, channel } = parsed.data;

  try {
    const sql = await initDb();
    const { id } = req.query;
    const rows = await sql`SELECT * FROM container_pickups WHERE id = ${id}`;
    const pickup = rows[0];
    if (!pickup) return res.status(404).json({ error: 'Pickup not found' });

    const message = buildPickupStatusMessage(pickup, status, channel);
    if (!message) return res.status(400).json({ error: 'No message template for this status' });

    if (channel === 'messenger') {
      if (!pickup.messenger_psid) {
        return res.status(400).json({ error: 'No Messenger linked', message: 'Customer has not linked their Messenger account. Use SMS instead.' });
      }
      await sendMessengerMessage(pickup.messenger_psid, message);
    }

    const normPhone = normalizePhone(pickup.phone);
    try {
      await sql`
        INSERT INTO contact_log (id, phone_normalized, channel, direction, summary, order_id, created_at)
        VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${normPhone}, ${channel}, 'outbound', ${message}, ${pickup.order_id}, ${new Date().toISOString()})
      `;
    } catch (logErr) {
      console.error('Contact log insert failed:', logErr);
    }

    return res.status(200).json({ success: true, phone: pickup.phone, message });
  } catch (err) {
    console.error('Pickup notify error:', err);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
