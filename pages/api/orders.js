import { getDb, rowsToObjects } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    return res.status(500).json({ error: 'DB init failed', detail: err.message });
  }

  if (req.method === 'GET') {
    const { password } = req.headers;
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await db.execute('SELECT * FROM orders ORDER BY created_at DESC');
    return res.status(200).json(rowsToObjects(result));
  }

  if (req.method === 'POST') {
    const {
      customer_name, phone, address, barangay,
      product_type, container_size, quantity,
      need_container, container_quantity,
      payment_method, gcash_number, reference_number,
      notes, total_amount,
    } = req.body;

    if (!customer_name || !phone || !address || !barangay || !product_type || !container_size || !quantity || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4().slice(0, 8).toUpperCase();
    const created_at = new Date().toISOString();

    try {
      await db.execute({
        sql: `INSERT INTO orders (
          id, customer_name, phone, address, barangay,
          product_type, container_size, quantity,
          need_container, container_quantity,
          payment_method, gcash_number, reference_number,
          notes, total_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, customer_name, phone, address, barangay,
          product_type, container_size, quantity,
          need_container ? 1 : 0, container_quantity || 0,
          payment_method, gcash_number || null, reference_number || null,
          notes || null, total_amount, created_at,
        ],
      });
    } catch (err) {
      return res.status(500).json({ error: 'Insert failed', detail: err.message });
    }

    return res.status(201).json({ id, created_at });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
