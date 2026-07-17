// Pure loyalty math — no DB or React imports, safe in both server and client bundles.
export const GALLONS_BY_SIZE = { '5-Gal': 5, '3-Gal': 3 };
export const VOUCHER_VALUE = 30;       // ₱ value of one free 5-gallon refill
export const GALLONS_PER_VOUCHER = 10; // gallons needed to earn one voucher

export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function gallonsForOrder(order) {
  const per = GALLONS_BY_SIZE[order.container_size];
  if (per === undefined) {
    console.error(`gallonsForOrder: unmapped container_size "${order?.container_size}" — defaulting to 0 gallons`);
  }
  const qty = Number(order.quantity) || 0;
  return (per || 0) * qty;
}

// `orders` = all order rows for ONE customer (already filtered by phone).
export function computeRewards(orders) {
  let deliveredGallons = 0;
  let redeemed = 0;
  for (const o of orders) {
    if (o.status === 'delivered') deliveredGallons += gallonsForOrder(o);
    if (o.status !== 'cancelled') redeemed += Number(o.voucher_count) || 0;
  }
  const earned = Math.floor(deliveredGallons / GALLONS_PER_VOUCHER);
  const available = Math.max(0, earned - redeemed);
  const remainder = deliveredGallons % GALLONS_PER_VOUCHER;
  const gallonsToNext = remainder === 0 ? GALLONS_PER_VOUCHER : GALLONS_PER_VOUCHER - remainder;
  const progressPct = remainder / GALLONS_PER_VOUCHER;
  return { deliveredGallons, earned, redeemed, available, gallonsToNext, progressPct };
}

// How many vouchers may be applied to one order: capped by what's available,
// the number of refills in the cart, and whole-voucher value vs the refill subtotal.
export function maxRedeemable({ available, quantity, refillSubtotal }) {
  const byValue = Math.floor((Number(refillSubtotal) || 0) / VOUCHER_VALUE);
  return Math.max(0, Math.min(Number(available) || 0, Number(quantity) || 0, byValue));
}
