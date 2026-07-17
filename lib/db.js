import { neon } from '@neondatabase/serverless';

let sql;
let initialized = false;

// Postgres error codes that are expected/ignorable when re-running idempotent
// migrations on every cold start: duplicate_column, duplicate_table,
// invalid_table_definition (raised for some duplicate-index conditions), and
// unique_violation (the ON CONFLICT DO NOTHING inventory seed racing itself).
// The neon serverless driver throws errors carrying the Postgres `.code`.
const EXPECTED_MIGRATION_CODES = new Set(['42701', '42P07', '42P16', '23505']);

// Runs an idempotent migration step, swallowing only the expected "already
// exists" family of errors. Anything else is logged loudly — a hard throw here
// would break every request through the shared initDb(), but silent failure
// (the previous behaviour) could hide a real migration failure forever.
async function safeMigrate(fn) {
  try {
    await fn();
  } catch (e) {
    if (!EXPECTED_MIGRATION_CODES.has(e?.code)) {
      console.error('[initDb] migration step failed unexpectedly:', e);
    }
  }
}

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
      voucher_discount REAL NOT NULL DEFAULT 0,
      reward_requested INTEGER NOT NULL DEFAULT 0
    )
  `;
  
  await sql`
    CREATE TABLE IF NOT EXISTS reward_codes (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `;

  // Migration: Add messenger_psid column to existing tables
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS messenger_psid TEXT`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_count INTEGER NOT NULL DEFAULT 0`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_discount REAL NOT NULL DEFAULT 0`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS reward_requested INTEGER NOT NULL DEFAULT 0`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone_normalized TEXT`);
  await safeMigrate(() => sql`UPDATE orders SET phone_normalized = regexp_replace(phone, '\\D', '', 'g') WHERE phone_normalized IS NULL`);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_orders_phone_norm ON orders (phone_normalized)`);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC)`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sms_pending INTEGER NOT NULL DEFAULT 0`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified INTEGER NOT NULL DEFAULT 0`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot TEXT`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date TEXT`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_screenshot TEXT`);

  await safeMigrate(() => sql`
    CREATE TABLE IF NOT EXISTS customer_notes (
      id TEXT PRIMARY KEY,
      phone_normalized TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_customer_notes_phone ON customer_notes (phone_normalized)`);

  await safeMigrate(() => sql`
    CREATE TABLE IF NOT EXISTS contact_log (
      id TEXT PRIMARY KEY,
      phone_normalized TEXT NOT NULL,
      channel TEXT NOT NULL,
      direction TEXT NOT NULL,
      summary TEXT NOT NULL,
      order_id TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_contact_log_phone ON contact_log (phone_normalized)`);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_contact_log_created ON contact_log (created_at DESC)`);

  await safeMigrate(() => sql`
    CREATE TABLE IF NOT EXISTS container_adjustments (
      id TEXT PRIMARY KEY,
      phone_normalized TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_container_adj_phone ON container_adjustments (phone_normalized)`);

  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_deducted INTEGER NOT NULL DEFAULT 0`);
  await safeMigrate(() => sql`
    CREATE TABLE IF NOT EXISTS inventory (
      product_id TEXT PRIMARY KEY,
      current_stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      updated_at TEXT NOT NULL
    )
  `);
  await safeMigrate(() => sql`
    CREATE TABLE IF NOT EXISTS inventory_log (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      type TEXT NOT NULL,
      reason TEXT DEFAULT '',
      order_id TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_inventory_log_product ON inventory_log (product_id)`);

  // Migration: POS (counter/walk-in sale) support
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_channel TEXT NOT NULL DEFAULT 'online'`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_tendered REAL`);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders (transaction_id)`);
  await safeMigrate(async () => {
    const now = new Date().toISOString();
    const ids = ['slim5', 'round5'];
    for (const pid of ids) {
      await sql`
        INSERT INTO inventory (product_id, current_stock, low_stock_threshold, updated_at)
        VALUES (${pid}, 0, 10, ${now})
        ON CONFLICT (product_id) DO NOTHING
      `;
    }
  });

  // Migration: pickup/delivery scheduling
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_empty_containers INTEGER NOT NULL DEFAULT 0`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_date TEXT`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TEXT`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date_new TEXT`);
  await safeMigrate(() => sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time TEXT`);
  await safeMigrate(() => sql`
    CREATE TABLE IF NOT EXISTS container_pickups (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      phone_normalized TEXT NOT NULL,
      address TEXT NOT NULL,
      barangay TEXT NOT NULL,
      container_qty INTEGER NOT NULL,
      pickup_date TEXT NOT NULL,
      pickup_time TEXT NOT NULL,
      delivery_date TEXT NOT NULL,
      delivery_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT DEFAULT '',
      messenger_psid TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_container_pickups_status ON container_pickups (status)`);
  await safeMigrate(() => sql`CREATE INDEX IF NOT EXISTS idx_container_pickups_date ON container_pickups (pickup_date)`);

  await safeMigrate(() => sql`
    CREATE TABLE IF NOT EXISTS auth_failures (
      ip TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  initialized = true;
  return sql;
}
