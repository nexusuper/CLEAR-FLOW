import Layout from '@/components/Layout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ClayCard from '@/components/ui/ClayCard';

const PRODUCTS = [
  { id: 'slim5', name: '5-Gallon Slim', refill: 30, container: 150, size: '5-Gal' },
  { id: 'round5', name: '5-Gallon Round', refill: 35, container: 170, size: '5-Gal' },
  { id: 'round3', name: '3-Gallon Round', refill: 20, container: 100, size: '3-Gal' },
];

function deliveryFee(qty) {
  if (qty >= 5) return 0;
  if (qty >= 2) return 15;
  return 20;
}

export default function Order() {
  const router = useRouter();
  const { product: queryProduct } = router.query;

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    barangay: '',
    product_type: 'slim5',
    quantity: 1,
    need_container: false,
    container_quantity: 1,
    payment_method: 'cod',
    gcash_number: '',
    reference_number: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (queryProduct) setForm((f) => ({ ...f, product_type: queryProduct }));
  }, [queryProduct]);

  const selectedProduct = PRODUCTS.find((p) => p.id === form.product_type) || PRODUCTS[0];
  const refillTotal = selectedProduct.refill * form.quantity;
  const containerTotal = form.need_container ? selectedProduct.container * form.container_quantity : 0;
  const delivery = deliveryFee(form.quantity);
  const grandTotal = refillTotal + containerTotal + delivery;

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          container_size: selectedProduct.size,
          total_amount: grandTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      router.push(`/order/confirmation?id=${data.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <Layout title="Place an Order — Clear Flow">
      <section className="px-4 pt-8">
        <ClayCard className="max-w-2xl mx-auto py-10 text-center text-white" style={{ background: 'linear-gradient(160deg,#7dd3fc,#0ea5e9)' }}>
          <h1 className="text-3xl font-extrabold">Place Your Order</h1>
          <p className="text-sky-50 font-semibold mt-1">No account needed — just fill the form below.</p>
        </ClayCard>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Customer Info */}
          <ClayCard className="p-6">
            <h2 className="text-lg font-display font-semibold text-clay-ink2 mb-4">Your Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  required
                  value={form.customer_name}
                  onChange={(e) => set('customer_name', e.target.value)}
                  className="clay-input"
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className="clay-input"
                  placeholder="09XX-XXX-XXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                <input
                  required
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  className="clay-input"
                  placeholder="123 Rizal St."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
                <input
                  required
                  value={form.barangay}
                  onChange={(e) => set('barangay', e.target.value)}
                  className="clay-input"
                  placeholder="Brgy. San Jose"
                />
              </div>
            </div>
          </ClayCard>

          {/* Product Selection */}
          <ClayCard className="p-6">
            <h2 className="text-lg font-display font-semibold text-clay-ink2 mb-4">Water Selection</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product *</label>
                <div className="grid grid-cols-1 gap-2">
                  {PRODUCTS.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 cursor-pointer clay-tile ${form.product_type === p.id ? 'clay-tile-selected' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="product_type"
                          value={p.id}
                          checked={form.product_type === p.id}
                          onChange={() => set('product_type', p.id)}
                          className="accent-clay-sky"
                        />
                        <span className="font-semibold text-clay-ink">{p.name}</span>
                      </div>
                      <span className="font-display text-clay-skydeep font-bold">₱{p.refill}/refill</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (refills) *</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={form.quantity}
                  onChange={(e) => set('quantity', parseInt(e.target.value) || 1)}
                  className="clay-input"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.need_container}
                  onChange={(e) => set('need_container', e.target.checked)}
                  className="w-4 h-4 accent-sky-500"
                />
                <span className="text-sm text-gray-700">I also need a new container (+₱{selectedProduct.container} each)</span>
              </label>

              {form.need_container && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of containers *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.container_quantity}
                    onChange={(e) => set('container_quantity', parseInt(e.target.value) || 1)}
                    className="clay-input"
                  />
                </div>
              )}
            </div>
          </ClayCard>

          {/* Payment */}
          <ClayCard className="p-6">
            <h2 className="text-lg font-display font-semibold text-clay-ink2 mb-4">Payment Method</h2>
            <div className="space-y-2">
              {[
                { id: 'cod', label: 'Cash on Delivery' },
                { id: 'gcash', label: 'GCash' },
                { id: 'paymaya', label: 'PayMaya' },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer clay-tile ${form.payment_method === m.id ? 'clay-tile-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={m.id}
                    checked={form.payment_method === m.id}
                    onChange={() => set('payment_method', m.id)}
                    className="accent-clay-sky"
                  />
                  <span className="font-semibold text-clay-ink">{m.label}</span>
                </label>
              ))}
            </div>

            {(form.payment_method === 'gcash' || form.payment_method === 'paymaya') && (
              <div className="mt-4 space-y-3 p-4 clay-inset rounded-xl">
                <p className="text-sm text-sky-700">
                  Send payment to: <strong>0912-345-6789</strong> (Clear Flow)
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your {form.payment_method === 'gcash' ? 'GCash' : 'PayMaya'} Number *
                  </label>
                  <input
                    required
                    value={form.gcash_number}
                    onChange={(e) => set('gcash_number', e.target.value)}
                    className="clay-input"
                    placeholder="09XX-XXX-XXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number (after payment)</label>
                  <input
                    value={form.reference_number}
                    onChange={(e) => set('reference_number', e.target.value)}
                    className="clay-input"
                    placeholder="Optional, fill after sending"
                  />
                </div>
              </div>
            )}
          </ClayCard>

          {/* Notes */}
          <ClayCard className="p-6">
            <h2 className="text-lg font-display font-semibold text-clay-ink2 mb-4">Additional Notes</h2>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className="clay-input"
              placeholder="Delivery instructions, landmarks, etc."
            />
          </ClayCard>

          {/* Order Summary */}
          <ClayCard className="p-6">
            <h2 className="text-lg font-display font-semibold text-clay-ink2 mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{selectedProduct.name} x{form.quantity}</span>
                <span className="font-medium">₱{refillTotal}</span>
              </div>
              {form.need_container && form.container_quantity > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Container x{form.container_quantity}</span>
                  <span className="font-medium">₱{containerTotal}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery fee</span>
                <span className="font-medium">{delivery === 0 ? 'FREE' : `₱${delivery}`}</span>
              </div>
              <div className="border-t border-sky-200 pt-2 mt-2 flex justify-between font-bold text-base">
                <span className="text-sky-900">Total</span>
                <span className="text-sky-600">₱{grandTotal}</span>
              </div>
            </div>
          </ClayCard>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full clay-btn-primary clay-pressable rounded-full py-4 text-lg font-display font-semibold disabled:opacity-60"
          >
            {loading ? 'Placing Order...' : 'Place Order →'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
