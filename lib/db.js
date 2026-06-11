import { neon } from '@neondatabase/serverless';

let sql;
let initialized = false;

const DEFAULT_PRODUCTS = [
  { id: 'slim5', name: '5-Gallon Slim', description: 'Slim-type 5-gallon container refill. Fits most standard dispensers.', refill_price: 30, container_price: 150, size: '5-Gal', tag: 'Most Popular', sort_order: 1 },
  { id: 'round5', name: '5-Gallon Round', description: 'Round-type 5-gallon container refill. Standard round bottom dispenser.', refill_price: 35, container_price: 170, size: '5-Gal', tag: 'Standard', sort_order: 2 },
  { id: 'round3', name: '3-Gallon Round', description: 'Compact 3-gallon round container. Great for small families or offices.', refill_price: 20, container_price: 100, size: '3-Gal', tag: 'Compact', sort_order: 3 },
];

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
      messenger_psid TEXT
    )
  `;

  // Migration: Add messenger_psid column to existing tables
  try {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS messenger_psid TEXT`;
  } catch (e) {
    // Column may already exist, ignore error
  }

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      refill_price REAL NOT NULL,
      container_price REAL NOT NULL,
      size TEXT,
      tag TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'supplies',
      unit TEXT NOT NULL DEFAULT 'pcs',
      quantity REAL NOT NULL DEFAULT 0,
      low_stock_threshold REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      change REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS walkin_sales (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      product_name TEXT NOT NULL,
      sale_type TEXT NOT NULL DEFAULT 'refill',
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  // Seed products from the original hardcoded catalog if the table is empty
  const existing = await sql`SELECT COUNT(*)::int AS count FROM products`;
  if (existing[0].count === 0) {
    for (const p of DEFAULT_PRODUCTS) {
      await sql`
        INSERT INTO products (id, name, description, refill_price, container_price, size, tag, active, sort_order)
        VALUES (${p.id}, ${p.name}, ${p.description}, ${p.refill_price}, ${p.container_price}, ${p.size}, ${p.tag}, 1, ${p.sort_order})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  initialized = true;
  return sql;
}
