import { createClient } from '@libsql/client';

let client;

export async function getDb() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    await client.execute(`
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
        created_at TEXT NOT NULL
      )
    `);
  }
  return client;
}

export function rowsToObjects(result) {
  const { rows, columns } = result;
  return rows.map((row) =>
    columns.reduce((obj, col, i) => ({ ...obj, [col]: row[i] }), {})
  );
}
