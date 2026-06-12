import Layout from '@/components/Layout';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// Fallback catalog while /api/products loads (or if it fails)
const DEFAULT_PRODUCTS = [
  {
    id: 'slim5',
    name: '5-Gallon Slim',
    description: 'Slim-type 5-gallon container refill. Fits most standard dispensers.',
    refillPrice: 30,
    containerPrice: 150,
    size: '5-Gal',
    tag: 'Most Popular',
    tagColor: 'bg-sky-500',
  },
  {
    id: 'round5',
    name: '5-Gallon Round',
    description: 'Round-type 5-gallon container refill. Standard round bottom dispenser.',
    refillPrice: 35,
    containerPrice: 170,
    size: '5-Gal',
    tag: 'Standard',
    tagColor: 'bg-blue-500',
  },
  {
    id: 'round3',
    name: '3-Gallon Round',
    description: 'Compact 3-gallon round container. Great for small families or offices.',
    refillPrice: 20,
    containerPrice: 100,
    size: '3-Gal',
    tag: 'Compact',
    tagColor: 'bg-cyan-500',
  },
];

const deliveryRules = [
  { label: '1 container', fee: '₱20' },
  { label: '2–4 containers', fee: '₱15' },
  { label: '5+ containers', fee: 'FREE' },
];

const TAG_COLORS = ['bg-sky-500', 'bg-blue-500', 'bg-cyan-500', 'bg-teal-500'];

export default function Products() {
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => (res.ok ? res.json() : null))
      .then((rows) => {
        if (rows && rows.length > 0) {
          setProducts(rows.map((p, i) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            refillPrice: Number(p.refill_price),
            containerPrice: Number(p.container_price),
            size: p.size || '',
            tag: p.tag || 'Available',
            tagColor: TAG_COLORS[i % TAG_COLORS.length],
          })));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Layout title="Products & Pricing — Clear Flow">
      {/* Header */}
      <section className="bg-gradient-to-r from-sky-500 to-sky-400 text-white py-14 text-center">
        <h1 className="text-4xl font-extrabold mb-2">Products & Pricing</h1>
        <p className="text-sky-100 text-lg">Transparent pricing. No hidden fees.</p>
      </section>

      {/* Products */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-sky-100 overflow-hidden flex flex-col">
              <div className={`${p.tagColor} text-white text-sm font-semibold text-center py-2`}>{p.tag}</div>
              <div className="p-6 flex flex-col flex-1">
                <div className="text-5xl text-center mb-4">🫙</div>
                <h2 className="text-xl font-bold text-sky-900 mb-1 text-center">{p.name}</h2>
                <p className="text-gray-500 text-sm text-center mb-6">{p.description}</p>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center border-b border-sky-50 pb-2">
                    <span className="text-gray-600 text-sm">Refill only</span>
                    <span className="text-sky-600 font-bold text-lg">₱{p.refillPrice}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Container + refill</span>
                    <span className="text-sky-600 font-bold text-lg">₱{p.containerPrice}</span>
                  </div>
                </div>

                <div className="mt-auto">
                  <Link
                    href={`/order?product=${p.id}`}
                    className="block text-center bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-full transition-colors"
                  >
                    Order Now
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Delivery fees */}
      <section className="bg-white py-12">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-sky-900 text-center mb-6">Delivery Fees</h2>
          <div className="rounded-2xl border border-sky-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-sky-50">
                <tr>
                  <th className="text-left px-5 py-3 text-sky-700">Order Size</th>
                  <th className="text-right px-5 py-3 text-sky-700">Delivery Fee</th>
                </tr>
              </thead>
              <tbody>
                {deliveryRules.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-sky-50/50'}>
                    <td className="px-5 py-3 text-gray-700">{r.label}</td>
                    <td className="px-5 py-3 text-right font-semibold text-sky-600">{r.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-400 text-xs text-center mt-3">Delivery available Mon–Sat, 7AM–6PM within service area.</p>
        </div>
      </section>

      {/* Payment methods */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-sky-900 text-center mb-6">Accepted Payments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '💵', name: 'Cash on Delivery', desc: 'Pay when your water arrives.' },
            { icon: '📱', name: 'GCash', desc: 'Send via GCash before delivery.' },
            { icon: '💳', name: 'PayMaya', desc: 'Send via PayMaya before delivery.' },
          ].map((m) => (
            <div key={m.name} className="bg-white rounded-2xl p-5 shadow-sm border border-sky-100 text-center">
              <div className="text-3xl mb-2">{m.icon}</div>
              <h3 className="font-bold text-sky-800 mb-1">{m.name}</h3>
              <p className="text-gray-400 text-sm">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-sky-600 text-white py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Like what you see?</h2>
        <Link href="/order" className="bg-white text-sky-600 font-bold px-10 py-3 rounded-full hover:bg-sky-50 transition-colors shadow">
          Place an Order
        </Link>
      </section>
    </Layout>
  );
}
