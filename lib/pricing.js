const PRODUCTS = {
  slim5:  { refill: 30, container: 150 },
  round5: { refill: 35, container: 170 },
  round3: { refill: 20, container: 100 },
};

const VALID_PAYMENT_METHODS = ['cod', 'gcash', 'paymaya'];

function deliveryFee(qty) {
  if (qty >= 5) return 0;
  if (qty >= 2) return 15;
  return 20;
}

function calculateTotal({ product_type, quantity, need_container, container_quantity }) {
  const product = PRODUCTS[product_type];
  if (!product) return null;
  const qty = Math.max(1, parseInt(quantity, 10) || 0);
  const cq = need_container ? Math.max(1, parseInt(container_quantity, 10) || 0) : 0;
  return product.refill * qty + (need_container ? product.container * cq : 0) + deliveryFee(qty);
}

export { PRODUCTS, VALID_PAYMENT_METHODS, deliveryFee, calculateTotal };
