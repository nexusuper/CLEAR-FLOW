import Layout from '@/components/Layout';
import { useState } from 'react';
import ClayCard from '@/components/ui/ClayCard';
import ClayButton from '@/components/ui/ClayButton';
import ClayIcon from '@/components/ui/ClayIcon';
import { normalizePhone, GALLONS_PER_VOUCHER, VOUCHER_VALUE } from '@/lib/loyalty';

export default function Rewards() {
  const [phone, setPhone] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const digits = normalizePhone(phone);
    if (digits.length < 7) { setError('Enter a valid phone number.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/rewards?phone=${encodeURIComponent(digits)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not load rewards');
      setData(d);
    } catch (err) {
      setError(err.message);
      setData(null);
    }
    setLoading(false);
  }

  const earnedPct = data ? Math.round(data.progressPct * 100) : 0;

  return (
    <Layout title="My Rewards — Clear Flow">
      <section className="max-w-lg mx-auto px-4 pt-14 pb-4 reveal">
        <span className="section-pill mb-5 inline-block">Loyalty Rewards</span>
        <h1 className="font-editorial text-4xl font-bold leading-[1.08] tracking-tight text-clay-ink">
          Earn free <span style={{ color: '#0ea5e9' }}>refills.</span>
        </h1>
        <p className="text-clay-muted font-semibold mt-3">Earn a free 5-gallon refill every {GALLONS_PER_VOUCHER} gallons.</p>
      </section>

      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <form onSubmit={handleSubmit} className="clay-raised rounded-3xl p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Phone Number</label>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX-XXX-XXXX"
              className="clay-input flex-1"
            />
            <button type="submit" disabled={loading}
                    className="clay-btn-primary clay-pressable rounded-full px-5 py-2.5 font-editorial font-semibold disabled:opacity-60">
              {loading ? '...' : 'Check'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </form>

        {data && (
          <>
            <ClayCard className="p-6 text-center">
              <p className="text-sm text-clay-muted font-semibold mb-1">Free refills available</p>
              <p className="font-editorial text-6xl font-bold text-clay-skydeep mb-1">{data.available}</p>
              <p className="text-xs text-clay-muted">{data.deliveredGallons} gallons delivered all-time</p>
            </ClayCard>

            <ClayCard className="p-6">
              <div className="flex justify-between text-sm font-semibold text-clay-ink2 mb-2">
                <span>Progress to next free refill</span>
                <span>{data.gallonsToNext} gal to go</span>
              </div>
              <div className="clay-inset rounded-full h-4 overflow-hidden">
                <div className="h-full rounded-full clay-btn-primary" style={{ width: `${earnedPct}%` }} />
              </div>
            </ClayCard>

            <ClayCard variant="inset" className="p-5 text-center text-sm text-clay-skydeep font-semibold">
              <ClayIcon name="info" className="w-4 h-4 inline mr-1" />
              Use your free refills (₱{VOUCHER_VALUE} each) at checkout — verify with a Messenger code, or we&apos;ll apply them when we confirm your delivery.
            </ClayCard>

            <ClayButton href="/order" className="w-full">Order &amp; Redeem</ClayButton>
          </>
        )}
      </div>
    </Layout>
  );
}
