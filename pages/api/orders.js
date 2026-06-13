import { initDb } from '@/lib/db';
import { checkAdminAuth } from '@/lib/auth';
import { PRODUCTS, VALID_PAYMENT_METHODS, calculateTotal } from '@/lib/pricing';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  let sql;
  try {
    sql = await initDb();
  } catch {
    return res.status(500).json({ error: 'Database unavailable' });
  }

  if (req.method === 'GET') {
    if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  if (req.method === 'POST') {
    const {
      customer_name, phone, address, barangay,
      product_type, container_size,
      quantity, need_container, container_quantity,
      payment_method, gcash_number, reference_number, notes,
    } = req.body;

    if (!customer_name || !phone || !address || !barangay || !product_type || !container_size || !payment_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!PRODUCTS[product_type]) {
      return res.status(400).json({ error: 'Invalid product type' });
    }

    if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      return res.status(400).json({ error: 'Quantity must be a number between 1 and 100' });
    }

    if ((payment_method === 'gcash' || payment_method === 'paymaya') && !gcash_number) {
      return res.status(400).json({ error: 'Payment number required for digital payment' });
    }

    const total_amount = calculateTotal({ product_type, quantity: qty, need_container, container_quantity });

    const id = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    const created_at = new Date().toISOString();
    const nc = need_container ? 1 : 0;
    const cq = need_container ? Math.max(1, parseInt(container_quantity, 10) || 1) : 0;
    const gn = gcash_number || null;
    const rn = reference_number || null;
    const nt = notes || null;

    try {
      await sql`
        INSERT INTO orders (
          id, customer_name, phone, address, barangay,
          product_type, container_size, quantity,
          need_container, container_quantity,
          payment_method, gcash_number, reference_number,
          notes, total_amount, created_at
        ) VALUES (
          ${id}, ${customer_name}, ${phone}, ${address}, ${barangay},
          ${product_type}, ${container_size}, ${qty},
          ${nc}, ${cq},
          ${payment_method}, ${gn}, ${rn},
          ${nt}, ${total_amount}, ${created_at}
        )
      `;
    } catch {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    return res.status(201).json({ id, created_at });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
