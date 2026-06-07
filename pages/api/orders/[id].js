import { getDb, rowsToObjects } from '@/lib/db';

export default async function handler(req, res) {
  const db = await getDb();
  const { id } = req.query;

  if (req.method === 'GET') {
    const result = await db.execute({
      sql: 'SELECT * FROM orders WHERE id = ?',
      args: [id],
    });
    const order = rowsToObjects(result)[0];
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
    await db.execute({ sql: 'UPDATE orders SET status = ? WHERE id = ?', args: [status, id] });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
