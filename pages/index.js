import Layout from '@/components/Layout';
import AnimatedHero from '@/components/AnimatedHero';
import PurifyProcess from '@/components/PurifyProcess';
import VideoShowcase from '@/components/VideoShowcase';
import ClayCard from '@/components/ui/ClayCard';
import ClayButton from '@/components/ui/ClayButton';
import ClayIcon from '@/components/ui/ClayIcon';
import { FB_PAGE_ID } from '@/pages/_app';
import { PRODUCTS } from '@/lib/products';

const features = [
  {
    icon: 'lock',
    title: 'No Login Required',
    desc: 'Order as a guest. We just need your name, address, and phone number — done in under 2 minutes.',
  },
  {
    icon: 'bolt',
    title: 'Same-Day Delivery',
    desc: 'Order before 2PM and get your water delivered today anywhere within your area.',
  },
  {
    icon: 'filter',
    title: 'Pure & Safe Water',
    desc: 'Multi-stage filtration and UV sterilization guarantee the cleanest water for your family.',
  },
];

const stats = [
  { num: '500+', label: 'Happy Households' },
  { num: 'Same Day', label: 'Delivery Available' },
  { num: '5-Stage', label: 'Purification' },
];

function Jug() {
  return (
    <svg className="mx-auto" width="80" height="100" viewBox="0 0 60 78" aria-hidden="true">
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

      {/* Stats bar */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="reveal clay-raised rounded-2xl px-6 py-5 grid grid-cols-3 divide-x divide-sky-100">
          {stats.map((s) => (
            <div key={s.label} className="text-center px-4 py-1">
              <div className="font-editorial font-bold text-2xl md:text-3xl text-clay-skydeep">{s.num}</div>
              <div className="text-xs font-bold text-clay-muted mt-0.5 tracking-wide uppercase">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Clear Flow — editorial split layout */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-14 items-start">
          {/* Sticky heading column */}
          <div className="reveal lg:sticky lg:top-28">
            <span className="section-pill mb-5 inline-block">Why Clear Flow</span>
            <h2 className="font-editorial text-4xl md:text-5xl font-bold text-clay-ink leading-[1.08] mb-4">
              Water quality<br />you can trust.
            </h2>
            <p className="text-clay-muted font-semibold text-base leading-relaxed max-w-[42ch]">
              We go beyond ordinary water refills — every drop is filtered, tested, and delivered with care.
            </p>
            <div className="mt-8">
              <ClayButton href="/order">Order Today</ClayButton>
            </div>
          </div>

          {/* Feature rows */}
          <div className="reveal reveal-d1 clay-raised rounded-3xl overflow-hidden">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="flex items-start gap-5 p-7"
                style={i < features.length - 1 ? { borderBottom: '1px solid #e0f2fe' } : {}}
              >
                <div
                  className="shrink-0 grid place-items-center w-12 h-12 rounded-[16px] clay-raised-sm"
                  style={{ background: 'linear-gradient(145deg,#e9f6ff,#d3ecfb)' }}
                >
                  <ClayIcon name={f.icon} className="w-6 h-6 text-clay-sky" />
                </div>
                <div>
                  <h3 className="font-editorial font-bold text-clay-ink mb-1">{f.title}</h3>
                  <p className="text-clay-muted text-sm font-semibold leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PurifyProcess />

      <VideoShowcase />

      {/* Our Products */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="reveal mb-10">
          <span className="section-pill mb-4 inline-block">Our Products</span>
          <h2 className="font-editorial text-4xl md:text-5xl font-bold text-clay-ink leading-[1.08]">
            Affordable, premium water.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {PRODUCTS.map((p, i) => (
            <ClayCard key={p.id} className={`p-7 text-center reveal reveal-d${i}`}>
              <span className="inline-block text-xs font-extrabold text-white rounded-full px-3 py-1 mb-4 clay-btn-primary">
                {p.tag}
              </span>
              <Jug />
              <h3 className="font-editorial text-lg font-bold text-clay-ink mt-3 mb-1">{p.name}</h3>
              <p className="font-editorial text-3xl font-bold text-clay-skydeep mb-5">₱{p.refill}</p>
              <ClayButton href={`/order?product=${p.id}`} className="w-full">Order This</ClayButton>
            </ClayCard>
          ))}
        </div>
        <div className="reveal text-center">
          <ClayButton href="/products" variant="outline">View All Products &amp; Pricing →</ClayButton>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-10">
        <div className="reveal max-w-6xl mx-auto rounded-[2rem] px-8 md:px-14 py-16 flex flex-col items-center text-center gap-6 clay-raised">
          <span className="section-pill">Ready to Order?</span>
          <h2 className="font-editorial text-4xl md:text-5xl font-bold text-clay-ink leading-[1.08] max-w-xl">
            Pure water, delivered the same day.
          </h2>
          <p className="text-clay-muted font-semibold text-base max-w-md">
            No account, no hassle. Fill the form and we handle the rest.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <ClayButton href="/order" size="lg">Place Your Order</ClayButton>
            <ClayButton href="/track" variant="outline" size="lg">Track an Order</ClayButton>
          </div>
        </div>
      </section>

      {/* Messenger contact */}
      <section className="px-4 pb-16">
        <ClayCard className="reveal max-w-3xl mx-auto p-8 md:p-10 text-center">
          <div
            className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-[18px] clay-raised-sm"
            style={{ background: 'linear-gradient(145deg,#3b9dff,#0084ff)' }}
          >
            <ClayIcon name="chat" className="w-7 h-7 text-white" />
          </div>
          <h2 className="font-editorial text-2xl font-bold text-clay-ink mb-2">Questions or concerns?</h2>
          <p className="text-clay-muted font-semibold mb-6 max-w-md mx-auto">
            Message us on Facebook anytime — tap the{' '}
            <span className="text-clay-ink2 font-bold">chat button</span> in the corner, or reach us directly below.
          </p>
          {FB_PAGE_ID && (
            <a
              href={`https://m.me/${FB_PAGE_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 font-editorial font-semibold text-white clay-pressable"
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
