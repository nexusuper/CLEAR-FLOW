import Layout from '@/components/Layout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

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
      <section className="bg-gradient-to-r from-sky-500 to-sky-400 text-white py-10 text-center">
        <h1 className="text-3xl font-extrabold">Place Your Order</h1>
        <p className="text-sky-100 mt-1">No account needed — just fill the form below.</p>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Customer Info */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100">
            <h2 className="text-lg font-bold text-sky-800 mb-4">Your Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  required
                  value={form.customer_name}
                  onChange={(e) => set('customer_name', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  placeholder="09XX-XXX-XXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                <input
                  required
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  placeholder="123 Rizal St."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
                <input
                  required
                  value={form.barangay}
                  onChange={(e) => set('barangay', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  placeholder="Brgy. San Jose"
                />
              </div>
            </div>
          </div>

          {/* Product Selection */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100">
            <h2 className="text-lg font-bold text-sky-800 mb-4">Water Selection</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product *</label>
                <div className="grid grid-cols-1 gap-2">
                  {PRODUCTS.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                        form.product_type === p.id
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-gray-200 hover:border-sky-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="product_type"
                          value={p.id}
                          checked={form.product_type === p.id}
                          onChange={() => set('product_type', p.id)}
                          className="accent-sky-500"
                        />
                        <span className="font-medium text-gray-700">{p.name}</span>
                      </div>
                      <span className="text-sky-600 font-bold">₱{p.refill}/refill</span>
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
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
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
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100">
            <h2 className="text-lg font-bold text-sky-800 mb-4">Payment Method</h2>
            <div className="space-y-2">
              {[
                { id: 'cod', label: '💵 Cash on Delivery' },
                { id: 'gcash', label: '📱 GCash' },
                { id: 'paymaya', label: '💳 PayMaya' },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                    form.payment_method === m.id
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-gray-200 hover:border-sky-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={m.id}
                    checked={form.payment_method === m.id}
                    onChange={() => set('payment_method', m.id)}
                    className="accent-sky-500"
                  />
                  <span className="font-medium text-gray-700">{m.label}</span>
                </label>
              ))}
            </div>

            {(form.payment_method === 'gcash' || form.payment_method === 'paymaya') && (
              <div className="mt-4 space-y-3 p-4 bg-sky-50 rounded-xl">
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
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    placeholder="09XX-XXX-XXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number (after payment)</label>
                  <input
                    value={form.reference_number}
                    onChange={(e) => set('reference_number', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    placeholder="Optional, fill after sending"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100">
            <h2 className="text-lg font-bold text-sky-800 mb-4">Additional Notes</h2>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="Delivery instructions, landmarks, etc."
            />
          </div>

          {/* Order Summary */}
          <div className="bg-sky-50 rounded-2xl p-6 border border-sky-200">
            <h2 className="text-lg font-bold text-sky-800 mb-4">Order Summary</h2>
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
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-bold py-4 rounded-full text-lg transition-colors shadow-lg"
          >
            {loading ? 'Placing Order...' : 'Place Order →'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
