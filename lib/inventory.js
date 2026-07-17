import { v4 as uuidv4 } from 'uuid';

// Builds the two un-awaited queries needed to deduct `qty` units of `product_id`
// from stock and record the sale in inventory_log. Meant to be passed as the
// array to a sql.transaction([...]) call so the stock update and the log insert
// commit atomically. Stock is clamped at 0 (GREATEST) so it can never go
// negative — matches the clamp used in pages/api/inventory/adjust.js.
export function buildInventoryDeduction(sql, { product_id, qty, order_id }) {
  const now = new Date().toISOString();
  return [
    sql`UPDATE inventory SET current_stock = GREATEST(0, current_stock - ${qty}), updated_at = ${now} WHERE product_id = ${product_id}`,
    sql`INSERT INTO inventory_log (id, product_id, delta, type, reason, order_id, created_at) VALUES (${uuidv4().slice(0, 8).toUpperCase()}, ${product_id}, ${-qty}, 'sale', '', ${order_id}, ${now})`,
  ];
}

// Checks the product has an inventory row, then deducts `qty` and logs it in a
// single atomic transaction (stock update + log insert commit together or not
// at all). Returns true if deduction happened, false if skipped (no inventory
// row for product).
export async function deductInventoryForSale(sql, { product_id, qty, order_id }) {
  if (!(qty > 0) || !product_id) return false;
  const inv = await sql`SELECT product_id FROM inventory WHERE product_id = ${product_id}`;
  if (inv.length === 0) {
    console.error('Inventory deduct skipped: no inventory row for product', product_id);
    return false;
  }
  await sql.transaction(buildInventoryDeduction(sql, { product_id, qty, order_id }));
  return true;
}
