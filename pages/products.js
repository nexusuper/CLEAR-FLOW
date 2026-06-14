import Layout from '@/components/Layout';
import PurifyProcess from '@/components/PurifyProcess';
import ClayCard from '@/components/ui/ClayCard';
import ClayButton from '@/components/ui/ClayButton';
import ClayIcon from '@/components/ui/ClayIcon';

const products = [
  { id: 'slim5', name: '5-Gallon Slim', description: 'Slim-type 5-gallon container refill. Fits most standard dispensers.', refillPrice: 30, containerPrice: 150, size: '5-Gal', tag: 'Most Popular' },
  { id: 'round5', name: '5-Gallon Round', description: 'Round-type 5-gallon container refill. Standard round bottom dispenser.', refillPrice: 35, containerPrice: 170, size: '5-Gal', tag: 'Standard' },
  { id: 'round3', name: '3-Gallon Round', description: 'Compact 3-gallon round container. Great for small families or offices.', refillPrice: 20, containerPrice: 100, size: '3-Gal', tag: 'Compact' },
];

const deliveryRules = [
  { label: '1 container', fee: '₱20' },
  { label: '2–4 containers', fee: '₱15' },
  { label: '5+ containers', fee: 'FREE' },
];

const payments = [
  { icon: 'cash', name: 'Cash on Delivery', desc: 'Pay when your water arrives.' },
  { icon: 'mobile', name: 'GCash', desc: 'Send via GCash before delivery.' },
  { icon: 'card', name: 'PayMaya', desc: 'Send via PayMaya before delivery.' },
];

export default function Products() {
  return (
    <Layout title="Products & Pricing — Clear Flow">
      <section className="px-4 pt-8">
        <ClayCard className="max-w-6xl mx-auto py-12 text-center text-white" style={{ background: 'linear-gradient(160deg,#7dd3fc,#0ea5e9)' }}>
          <h1 className="text-4xl font-extrabold mb-2">Products &amp; Pricing</h1>
          <p className="text-sky-50 font-semibold text-lg">Transparent pricing. No hidden fees.</p>
        </ClayCard>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {products.map((p) => (
            <ClayCard key={p.id} className="p-7 flex flex-col">
              <span className="self-center text-xs font-extrabold text-white rounded-full px-4 py-1.5 mb-4 clay-btn-primary">{p.tag}</span>
              <h2 className="text-xl font-display font-semibold text-clay-ink text-center mb-1">{p.name}</h2>
              <p className="text-clay-muted text-sm text-center mb-6 font-semibold">{p.description}</p>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center clay-inset rounded-xl px-4 py-2.5">
                  <span className="text-clay-muted text-sm font-semibold">Refill only</span>
                  <span className="font-display text-clay-skydeep font-bold text-lg">₱{p.refillPrice}</span>
                </div>
                <div className="flex justify-between items-center clay-inset rounded-xl px-4 py-2.5">
                  <span className="text-clay-muted text-sm font-semibold">Container + refill</span>
                  <span className="font-display text-clay-skydeep font-bold text-lg">₱{p.containerPrice}</span>
                </div>
              </div>
              <ClayButton href={`/order?product=${p.id}`} className="mt-auto w-full">Order Now</ClayButton>
            </ClayCard>
          ))}
        </div>
      </section>

      <PurifyProcess />

      <section className="max-w-2xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-clay-ink text-center mb-6">Delivery Fees</h2>
        <ClayCard className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="clay-inset">
              <tr>
                <th className="text-left px-5 py-3 text-clay-ink2 font-display">Order Size</th>
                <th className="text-right px-5 py-3 text-clay-ink2 font-display">Delivery Fee</th>
              </tr>
            </thead>
            <tbody>
              {deliveryRules.map((r, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 text-clay-ink font-semibold">{r.label}</td>
                  <td className="px-5 py-3 text-right font-display font-bold text-clay-skydeep">{r.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
        <p className="text-clay-muted text-xs text-center mt-3">Delivery available Mon–Sat, 7AM–6PM within service area.</p>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-clay-ink text-center mb-6">Accepted Payments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {payments.map((m) => (
            <ClayCard key={m.name} className="p-5 text-center">
              <div className="mx-auto mb-3 grid place-items-center w-14 h-14 rounded-2xl clay-raised-sm" style={{ background: 'linear-gradient(145deg,#e9f6ff,#d3ecfb)' }}>
                <ClayIcon name={m.icon} className="w-7 h-7 text-clay-sky" />
              </div>
              <h3 className="font-display font-semibold text-clay-ink2 mb-1">{m.name}</h3>
              <p className="text-clay-muted text-sm">{m.desc}</p>
            </ClayCard>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16">
        <ClayCard className="max-w-3xl mx-auto p-12 text-center text-white" style={{ background: 'linear-gradient(160deg,#38bdf8,#0284c7)' }}>
          <h2 className="text-2xl font-bold mb-4">Like what you see?</h2>
          <ClayButton href="/order" variant="white" size="lg">Place an Order</ClayButton>
        </ClayCard>
      </section>
    </Layout>
  );
}
