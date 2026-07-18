export const BUSINESS_PHONE_DISPLAY = '0912-345-6789';
export const BUSINESS_PHONE_TEL = '+639123456789';

export const PRODUCTS = [
  { id: 'slim5', name: '5-Gallon Slim', description: 'Slim-type 5-gallon container refill. Fits most standard dispensers.', refill: 30, container: 150, size: '5-Gal', tag: 'Standard' },
  { id: 'round5', name: '5-Gallon Round', description: 'Round-type 5-gallon container refill. Standard round bottom dispenser.', refill: 35, container: 170, size: '5-Gal', tag: 'Most Popular' },
];

export const PRODUCTS_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const DELIVERY_RULES = [
  { min: 3, fee: 0, label: '3+ containers', feeLabel: 'FREE' },
  { min: 1, fee: 15, label: '1–2 containers', feeLabel: '₱15' },
];

export function deliveryFee(qty) {
  if (qty >= 3) return 0;
  return 15;
}
