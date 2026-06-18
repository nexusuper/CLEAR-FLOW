import Layout from '@/components/Layout';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ClayCard from '@/components/ui/ClayCard';
import ClayIcon from '@/components/ui/ClayIcon';
import { maxRedeemable, VOUCHER_VALUE, normalizePhone } from '@/lib/loyalty';
import { PRODUCTS, deliveryFee } from '@/lib/products';

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
  const [rewards, setRewards] = useState(null);
  const [rewardCount, setRewardCount] = useState(0);
  const [codePhase, setCodePhase] = useState('idle'); // idle|sending|entry|verifying|verified|fallback
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  function resetReward() {
    setRewardCount(0);
    setCodePhase('idle');
    setCodeInput('');
    setCodeError('');
  }

  useEffect(() => {
    if (queryProduct) setForm((f) => ({ ...f, product_type: queryProduct }));
  }, [queryProduct]);

  // Look up loyalty rewards when the phone number looks complete.
  useEffect(() => {
    const digits = normalizePhone(form.phone);
    if (digits.length < 7) {
      setRewards(null);
      resetReward();
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rewards?phone=${encodeURIComponent(digits)}`);
        if (res.ok) setRewards(await res.json());
        else setRewards(null);
      } catch {
        setRewards(null);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form.phone]);

  const selectedProduct = PRODUCTS.find((p) => p.id === form.product_type) || PRODUCTS[0];
  const refillTotal = selectedProduct.refill * form.quantity;
  const containerTotal = form.need_container ? selectedProduct.container * form.container_quantity : 0;
  const delivery = deliveryFee(form.quantity);
  const baseTotal = refillTotal + containerTotal + delivery;
  const maxVouchers = maxRedeemable({
    available: rewards ? rewards.available : 0,
    quantity: form.quantity,
    refillSubtotal: refillTotal,
  });
  const codeApplied = codePhase === 'verified';
  const voucherDiscount = codeApplied ? rewardCount * VOUCHER_VALUE : 0;
  const grandTotal = Math.max(0, baseTotal - voucherDiscount);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Keep the chosen count within bounds; any bound change cancels a prior verification.
  useEffect(() => {
    setRewardCount((n) => Math.min(n, maxVouchers));
  }, [maxVouchers]);

  function changeCount(next) {
    setRewardCount(Math.max(0, Math.min(maxVouchers, next)));
    setCodePhase('idle');
    setCodeInput('');
    setCodeError('');
  }

  async function sendCode() {
    setCodePhase('sending');
    setCodeError('');
    try {
      const res = await fetch('/api/rewards/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone }),
      });
      const data = await res.json();
      setCodePhase(res.ok && data.sent ? 'entry' : 'fallback');
    } catch {
      setCodePhase('fallback');
    }
  }

  async function verifyCode() {
    setCodePhase('verifying');
    setCodeError('');
    try {
      const res = await fetch('/api/rewards/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, code: codeInput }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setCodePhase('verified');
      } else {
        setCodePhase('entry');
        setCodeError('That code is invalid or expired.');
      }
    } catch {
      setCodePhase('entry');
      setCodeError('Could not verify. Please try again.');
    }
  }

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
          total_amount: baseTotal,
          reward_requested: rewardCount,
          reward_code: codeApplied ? codeInput : null,
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
                <input required value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} className="clay-input" placeholder="Juan Dela Cruz" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input required value={form.phone} onChange={(e) => set('phone', e.target.value)} className="clay-input" placeholder="09XX-XXX-XXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                <input required value={form.address} onChange={(e) => set('address', e.target.value)} className="clay-input" placeholder="123 Rizal St." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
                <input required value={form.barangay} onChange={(e) => set('barangay', e.target.value)} className="clay-input" placeholder="Brgy. San Jose" />
              </div>
            </div>
          </ClayCard>

          {/* Loyalty reward */}
          {rewards && rewards.available > 0 && (
            <ClayCard variant="inset" className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="grid place-items-center w-11 h-11 rounded-2xl text-white clay-raised-sm" style={{ background: 'linear-gradient(145deg,#38bdf8,#0284c7)' }}>
                  <ClayIcon name="party" className="w-6 h-6" />
                </span>
                <div>
                  <p className="font-display font-bold text-clay-ink">You have {rewards.available} free refill{rewards.available > 1 ? 's' : ''}!</p>
                  <p className="text-xs text-clay-muted font-semibold">Each free 5-gallon refill saves you ₱{VOUCHER_VALUE}.</p>
                </div>
              </div>

              {maxVouchers > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-clay-ink2">Free refills to use</span>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => changeCount(rewardCount - 1)} className="w-8 h-8 rounded-full clay-raised-sm font-bold text-clay-skydeep clay-pressable" aria-label="Use fewer">−</button>
                      <span className="font-display font-bold text-clay-ink w-6 text-center">{rewardCount}</span>
                      <button type="button" onClick={() => changeCount(rewardCount + 1)} className="w-8 h-8 rounded-full clay-raised-sm font-bold text-clay-skydeep clay-pressable" aria-label="Use more">+</button>
                    </div>
                  </div>

                  {rewardCount > 0 && (
                    <>
                      {codePhase === 'idle' && (
                        <button type="button" onClick={sendCode} className="w-full clay-btn-primary clay-pressable rounded-full py-2.5 font-display font-semibold text-sm">
                          Verify with a Messenger code
                        </button>
                      )}
                      {codePhase === 'sending' && (
                        <p className="text-xs text-clay-muted font-semibold text-center">Sending your code…</p>
                      )}
                      {(codePhase === 'entry' || codePhase === 'verifying') && (
                        <div className="space-y-2">
                          <p className="text-xs text-clay-muted font-semibold">Enter the 6-digit code we sent to your Messenger:</p>
                          <div className="flex gap-2">
                            <input
                              value={codeInput}
                              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              inputMode="numeric"
                              placeholder="123456"
                              className="clay-input flex-1 font-mono tracking-widest"
                            />
                            <button type="button" onClick={verifyCode} disabled={codePhase === 'verifying' || codeInput.length < 6} className="clay-btn-primary clay-pressable rounded-full px-5 font-display font-semibold text-sm disabled:opacity-60">
                              {codePhase === 'verifying' ? '…' : 'Apply'}
                            </button>
                          </div>
                          {codeError && <p className="text-red-500 text-xs">{codeError}</p>}
                          <button type="button" onClick={() => setCodePhase('fallback')} className="text-xs text-clay-skydeep font-semibold hover:underline">
                            Didn&apos;t get it? Apply on delivery instead
                          </button>
                        </div>
                      )}
                      {codePhase === 'verified' && (
                        <p className="text-sm font-semibold text-clay-skydeep flex items-center gap-1">
                          <ClayIcon name="check" className="w-4 h-4" /> Code verified — ₱{rewardCount * VOUCHER_VALUE} off applied.
                        </p>
                      )}
                      {codePhase === 'fallback' && (
                        <p className="text-xs text-clay-muted font-semibold">
                          No problem — we&apos;ll apply your {rewardCount} free refill{rewardCount > 1 ? 's' : ''} when we confirm your delivery.
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-clay-muted font-semibold">Add at least ₱{VOUCHER_VALUE} of refills to use a free refill on this order.</p>
              )}
            </ClayCard>
          )}

          {/* Product Selection */}
          <ClayCard className="p-6">
            <h2 className="text-lg font-display font-semibold text-clay-ink2 mb-4">Water Selection</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product *</label>
                <div className="grid grid-cols-1 gap-2">
                  {PRODUCTS.map((p) => (
                    <label key={p.id} className={`flex items-center justify-between rounded-2xl px-4 py-3 cursor-pointer clay-tile ${form.product_type === p.id ? 'clay-tile-selected' : ''}`}>
                      <div className="flex items-center gap-3">
                        <input type="radio" name="product_type" value={p.id} checked={form.product_type === p.id} onChange={() => set('product_type', p.id)} className="accent-clay-sky" />
                        <span className="font-semibold text-clay-ink">{p.name}</span>
                      </div>
                      <span className="font-display text-clay-skydeep font-bold">₱{p.refill}/refill</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (refills) *</label>
                <input type="number" min="1" max="50" required value={form.quantity} onChange={(e) => set('quantity', parseInt(e.target.value) || 1)} className="clay-input" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.need_container} onChange={(e) => set('need_container', e.target.checked)} className="w-4 h-4 accent-sky-500" />
                <span className="text-sm text-gray-700">I also need a new container (+₱{selectedProduct.container} each)</span>
              </label>

              {form.need_container && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of containers *</label>
                  <input type="number" min="1" max="10" value={form.container_quantity} onChange={(e) => set('container_quantity', parseInt(e.target.value) || 1)} className="clay-input" />
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
                <label key={m.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer clay-tile ${form.payment_method === m.id ? 'clay-tile-selected' : ''}`}>
                  <input type="radio" name="payment_method" value={m.id} checked={form.payment_method === m.id} onChange={() => set('payment_method', m.id)} className="accent-clay-sky" />
                  <span className="font-semibold text-clay-ink">{m.label}</span>
                </label>
              ))}
            </div>

            {(form.payment_method === 'gcash' || form.payment_method === 'paymaya') && (
              <div className="mt-4 space-y-3 p-4 clay-inset rounded-xl">
                <p className="text-sm text-sky-700">Send payment to: <strong>0912-345-6789</strong> (Clear Flow)</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your {form.payment_method === 'gcash' ? 'GCash' : 'PayMaya'} Number *</label>
                  <input required value={form.gcash_number} onChange={(e) => set('gcash_number', e.target.value)} className="clay-input" placeholder="09XX-XXX-XXXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number (after payment)</label>
                  <input value={form.reference_number} onChange={(e) => set('reference_number', e.target.value)} className="clay-input" placeholder="Optional, fill after sending" />
                </div>
              </div>
            )}
          </ClayCard>

          {/* Notes */}
          <ClayCard className="p-6">
            <h2 className="text-lg font-display font-semibold text-clay-ink2 mb-4">Additional Notes</h2>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="clay-input" placeholder="Delivery instructions, landmarks, etc." />
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
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-clay-skydeep font-semibold">
                  <span>Free refill reward ×{rewardCount}</span>
                  <span>−₱{voucherDiscount}</span>
                </div>
              )}
              {!codeApplied && codePhase === 'fallback' && rewardCount > 0 && (
                <div className="flex justify-between text-clay-muted">
                  <span>Free refill requested ×{rewardCount}</span>
                  <span>on delivery</span>
                </div>
              )}
              <div className="border-t border-sky-200 pt-2 mt-2 flex justify-between font-bold text-base">
                <span className="text-sky-900">Total</span>
                <span className="text-sky-600">₱{grandTotal}</span>
              </div>
            </div>
          </ClayCard>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <button type="submit" disabled={loading} className="w-full clay-btn-primary clay-pressable rounded-full py-4 text-lg font-display font-semibold disabled:opacity-60">
            {loading ? 'Placing Order...' : 'Place Order →'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
