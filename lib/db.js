import { neon } from '@neondatabase/serverless';

let sql;
let initialized = false;

export function getDb() {
  if (!sql) {
    sql = neon(process.env.POSTGRES_URL);
  }
  return sql;
}

export async function initDb() {
  const sql = getDb();
  if (initialized) return sql;
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      barangay TEXT NOT NULL,
      product_type TEXT NOT NULL,
      container_size TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      need_container INTEGER NOT NULL DEFAULT 0,
      container_quantity INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      gcash_number TEXT,
      reference_number TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      messenger_psid TEXT,
      voucher_count INTEGER NOT NULL DEFAULT 0,
      voucher_discount REAL NOT NULL DEFAULT 0
    )
  `;
  
  // Migration: Add messenger_psid column to existing tables
  try {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS messenger_psid TEXT`;
  } catch (e) {
    // Column may already exist, ignore error
  }
  try {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_count INTEGER NOT NULL DEFAULT 0`;
  } catch (e) {
    // Column may already exist, ignore error
  }
  try {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_discount REAL NOT NULL DEFAULT 0`;
  } catch (e) {
    // Column may already exist, ignore error
  }

  initialized = true;
  return sql;
}
