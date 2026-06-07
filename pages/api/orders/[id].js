import { initDb } from '@/lib/db';

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.status(200).json(order);
  }

  if (req.method === 'PATCH') {
    const { password } = req.headers;
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
