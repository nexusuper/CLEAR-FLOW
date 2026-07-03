import { initDb } from '@/lib/db';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const PatchSchema = z.object({
  status: z.enum(['scheduled', 'picked_up', 'delivered', 'cancelled']),
});

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

  if (req.method === 'PATCH') {
    if (!adminRate(req, res)) return;
    if (!await verifyAdminWithLockout(req, res)) return;

    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid update data' });
    }
    const exists = await sql`SELECT id FROM container_pickups WHERE id = ${id}`;
    if (exists.length === 0) return res.status(404).json({ error: 'Pickup not found' });

    await sql`UPDATE container_pickups SET status = ${parsed.data.status}, updated_at = ${new Date().toISOString()} WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    if (!adminRate(req, res)) return;
    if (!await verifyAdminWithLockout(req, res)) return;

    const rows = await sql`SELECT status FROM container_pickups WHERE id = ${id}`;
    const pickup = rows[0];
    if (!pickup) return res.status(404).json({ error: 'Pickup not found' });
    if (!['delivered', 'cancelled'].includes(pickup.status)) {
      return res.status(400).json({ error: 'Only delivered or cancelled pickups can be deleted' });
    }
    await sql`DELETE FROM container_pickups WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
