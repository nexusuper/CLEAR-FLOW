import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-sky-900 text-sky-100 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-white font-bold text-lg mb-2">Clear Flow</h3>
          <p className="text-sky-300 text-sm">Fresh, clean water delivered to your doorstep. No account needed — just order and we deliver.</p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-2">Quick Links</h4>
          <ul className="space-y-1 text-sm">
            <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
            <li><Link href="/products" className="hover:text-white transition-colors">Products & Pricing</Link></li>
            <li><Link href="/order" className="hover:text-white transition-colors">Order Now</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-2">Contact</h4>
          <ul className="space-y-1 text-sm text-sky-300">
            <li>📞 0912-345-6789</li>
            <li>📧 clearflow@email.com</li>
            <li>🕐 Mon–Sat, 7AM–6PM</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sky-800 text-center text-sky-400 text-xs py-4">
        © {new Date().getFullYear()} Clear Flow. All rights reserved.
      </div>
    </footer>
  );
}
