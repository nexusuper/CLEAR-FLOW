import { initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    return res.status(500).json({ error: `DB init failed: ${err.message}` });
  }

  if (req.method === 'GET') {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const rows = await sql`SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC LIMIT ${limit}`;
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { category, description, amount, expense_date } = req.body;
    if (!category || amount == null || !expense_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const id = uuidv4().slice(0, 8).toUpperCase();
    const created_at = new Date().toISOString();

    try {
      await sql`
        INSERT INTO expenses (id, category, description, amount, expense_date, created_at)
        VALUES (${id}, ${category}, ${description || null}, ${Number(amount)}, ${expense_date}, ${created_at})
      `;
    } catch (err) {
      return res.status(500).json({ error: `Insert failed: ${err.message}` });
    }
    return res.status(201).json({ id });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
