import Layout from '@/components/Layout';
import AnimatedHero from '@/components/AnimatedHero';
import PurifyProcess from '@/components/PurifyProcess';
import ClayCard from '@/components/ui/ClayCard';
import ClayButton from '@/components/ui/ClayButton';
import ClayIcon from '@/components/ui/ClayIcon';
import { FB_PAGE_ID } from '@/pages/_app';
import { PRODUCTS } from '@/lib/products';

const features = [
  { icon: 'lock', title: 'No Login Required', desc: 'Order as a guest. We just need your name, address, and phone number.' },
  { icon: 'bolt', title: 'Same-Day Delivery', desc: 'Order before 2PM and get your water delivered today within your area.' },
  { icon: 'filter', title: 'Pure & Safe Water', desc: 'Multi-stage filtration and UV sterilization for the cleanest water.' },
];

function Jug() {
  return (
    <svg className="mx-auto" width="62" height="78" viewBox="0 0 60 78">
      <rect x="20" y="2" width="20" height="8" rx="2" fill="#7dd3fc" />
      <path d="M12 16 Q12 12 18 12 H42 Q48 12 48 16 V70 Q48 76 42 76 H18 Q12 76 12 70 Z" fill="#bae6fd" stroke="#38bdf8" strokeWidth="2" />
      <rect x="18" y="30" width="24" height="34" rx="4" fill="#7dd3fc" opacity="0.6" />
      <ellipse cx="24" cy="40" rx="3" ry="7" fill="#fff" opacity="0.7" />
    </svg>
  );
}

export default function Home() {
  return (
    <Layout title="Clear Flow — Pure Water Delivery">
      <AnimatedHero />

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-clay-ink mb-10">Why Choose Clear Flow?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <ClayCard key={f.title} className="p-7 text-center">
              <div className="mx-auto mb-4 grid place-items-center w-[74px] h-[74px] rounded-[22px] clay-raised-sm"
                   style={{ background: 'linear-gradient(145deg,#e9f6ff,#d3ecfb)' }}>
                <ClayIcon name={f.icon} className="w-9 h-9 text-clay-sky" />
              </div>
              <h3 className="text-xl font-display font-semibold text-clay-ink2 mb-2">{f.title}</h3>
              <p className="text-clay-muted text-sm font-semibold">{f.desc}</p>
            </ClayCard>
          ))}
        </div>
      </section>

      <PurifyProcess />

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-clay-ink mb-2">Our Products</h2>
        <p className="text-center text-clay-muted font-semibold mb-10">Affordable prices, premium quality</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {PRODUCTS.map((p) => (
            <ClayCard key={p.id} className="p-7 text-center">
              <span className="inline-block text-xs font-extrabold text-white rounded-full px-3 py-1 mb-1 clay-btn-primary">{p.tag}</span>
              <Jug />
              <h3 className="text-lg font-display font-semibold text-clay-ink2 mt-2 mb-1">{p.name}</h3>
              <p className="font-display text-3xl font-bold text-clay-skydeep mb-4">₱{p.refill}</p>
              <ClayButton href={`/order?product=${p.id}`} className="w-full">Order This</ClayButton>
            </ClayCard>
          ))}
        </div>
        <div className="text-center">
          <ClayButton href="/products" variant="outline">View All Products &amp; Pricing →</ClayButton>
        </div>
      </section>

      <section className="px-4 pb-16">
        <ClayCard className="max-w-3xl mx-auto p-12 text-center text-white" style={{ background: 'linear-gradient(160deg,#38bdf8,#0284c7)' }}>
          <h2 className="text-3xl font-bold mb-3">Ready to Order?</h2>
          <p className="text-sky-50 font-semibold mb-7">It takes less than 2 minutes. No account, no hassle.</p>
          <ClayButton href="/order" variant="white" size="lg">Place Your Order</ClayButton>
        </ClayCard>
      </section>

      <section className="px-4 pb-16">
        <ClayCard className="max-w-3xl mx-auto p-8 md:p-10 text-center">
          <div className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-[22px] clay-raised-sm"
               style={{ background: 'linear-gradient(145deg,#3b9dff,#0084ff)' }}>
            <ClayIcon name="chat" className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-clay-ink mb-2">Questions, or concerns?</h2>
          <p className="text-clay-muted font-semibold mb-6 max-w-md mx-auto">
            Message us on Facebook anytime — just tap the blue <span className="text-clay-ink2 font-bold">chat button</span> in the bottom-right corner, or message us directly below.
          </p>
          {FB_PAGE_ID && (
            <a
              href={`https://m.me/${FB_PAGE_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-display font-semibold text-white clay-pressable"
              style={{ background: 'linear-gradient(145deg,#3b9dff,#0084ff)', boxShadow: '5px 5px 12px #b3c9e6, -3px -3px 8px #ffffff' }}
            >
              <ClayIcon name="chat" className="w-5 h-5" /> Chat on Messenger
            </a>
          )}
        </ClayCard>
      </section>
    </Layout>
  );
}
