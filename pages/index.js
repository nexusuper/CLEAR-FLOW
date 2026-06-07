import Layout from '@/components/Layout';
import Link from 'next/link';

const features = [
  {
    icon: '🚫🔐',
    title: 'No Login Required',
    desc: 'Order as a guest. We just need your name, address, and phone number.',
  },
  {
    icon: '⚡',
    title: 'Same-Day Delivery',
    desc: 'Order before 2PM and get your water delivered today within your area.',
  },
  {
    icon: '💧',
    title: 'Pure & Safe Water',
    desc: 'Multi-stage filtration and UV sterilization for the cleanest water.',
  },
];

const steps = [
  { num: '1', title: 'Choose Your Water', desc: 'Pick your container size and how many gallons you need.' },
  { num: '2', title: 'Fill the Form', desc: 'Enter your name, address, and preferred payment method.' },
  { num: '3', title: 'We Deliver', desc: 'Sit back and relax — your water arrives fresh to your door.' },
];

const products = [
  { name: '5-Gal Slim Refill', price: 30, tag: 'Most Popular', id: 'slim5' },
  { name: '5-Gal Round Refill', price: 35, tag: 'Standard', id: 'round5' },
  { name: '3-Gal Refill', price: 20, tag: 'Compact', id: 'round3' },
];

export default function Home() {
  return (
    <Layout title="Clear Flow — Pure Water Delivery">
      {/* Hero */}
      <section className="bg-gradient-to-b from-sky-500 to-sky-400 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 flex flex-col items-center text-center">
          <div className="text-7xl mb-6">💧</div>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
            Fresh Water,<br />
            <span className="text-sky-100">Delivered to Your Door</span>
          </h1>
          <p className="text-sky-100 text-lg md:text-xl max-w-xl mb-8">
            Order purified water refills in minutes. No account needed — just fill the form and we deliver.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/order"
              className="bg-white text-sky-600 font-bold px-8 py-3 rounded-full hover:bg-sky-50 transition-colors text-lg shadow-lg"
            >
              Order Now
            </Link>
            <Link
              href="/products"
              className="border-2 border-white text-white font-bold px-8 py-3 rounded-full hover:bg-sky-600 transition-colors text-lg"
            >
              See Pricing
            </Link>
          </div>
        </div>
        <div className="overflow-hidden">
          <svg viewBox="0 0 1440 60" className="w-full" preserveAspectRatio="none">
            <path fill="#f0f9ff" d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-sky-900 mb-10">Why Choose Clear Flow?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100 text-center">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-xl font-bold text-sky-800 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-sky-900 mb-10">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-sky-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 shadow">
                  {s.num}
                </div>
                <h3 className="text-lg font-bold text-sky-800 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products preview */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-sky-900 mb-2">Our Products</h2>
        <p className="text-center text-gray-500 mb-10">Affordable prices, premium quality</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {products.map((p) => (
            <div key={p.name} className="bg-white rounded-2xl p-6 shadow-sm border border-sky-100 text-center">
              <span className="text-xs bg-sky-100 text-sky-600 font-semibold px-3 py-1 rounded-full">{p.tag}</span>
              <div className="text-5xl my-4">🫙</div>
              <h3 className="text-lg font-bold text-sky-800 mb-1">{p.name}</h3>
              <p className="text-3xl font-extrabold text-sky-500 mb-4">₱{p.price}</p>
              <Link href={`/order?product=${p.id}`} className="block bg-sky-500 hover:bg-sky-600 text-white py-2 rounded-full font-medium transition-colors">
                Order This
              </Link>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link href="/products" className="text-sky-600 font-semibold hover:underline">View All Products & Pricing →</Link>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-sky-600 text-white py-14">
        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to Order?</h2>
          <p className="text-sky-100 mb-8">It takes less than 2 minutes. No account, no hassle.</p>
          <Link
            href="/order"
            className="bg-white text-sky-600 font-bold px-10 py-3 rounded-full hover:bg-sky-50 transition-colors text-lg shadow"
          >
            Place Your Order
          </Link>
        </div>
      </section>
    </Layout>
  );
}
