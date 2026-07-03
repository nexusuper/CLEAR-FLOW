export const PRODUCTS = [
  { id: 'slim5', name: '5-Gallon Slim', description: 'Slim-type 5-gallon container refill. Fits most standard dispensers.', refill: 30, container: 150, size: '5-Gal', tag: 'Most Popular' },
  { id: 'round5', name: '5-Gallon Round', description: 'Round-type 5-gallon container refill. Standard round bottom dispenser.', refill: 35, container: 170, size: '5-Gal', tag: 'Standard' },
];

export const PRODUCTS_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const DELIVERY_RULES = [
  { min: 5, fee: 0, label: '5+ containers', feeLabel: 'FREE' },
  { min: 2, fee: 15, label: '2–4 containers', feeLabel: '₱15' },
  { min: 1, fee: 20, label: '1 container', feeLabel: '₱20' },
];

export function deliveryFee(qty) {
  if (qty >= 5) return 0;
  if (qty >= 2) return 15;
  return 20;
}
