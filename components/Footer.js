import Link from 'next/link';
import ClayIcon from './ui/ClayIcon';

export default function Footer() {
  return (
    <footer className="mt-auto px-4 pb-4">
      <div className="max-w-6xl mx-auto rounded-3xl px-8 py-10 text-clay-ink2 clay-raised">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-display text-lg font-bold text-clay-ink mb-2">Clear Flow</h3>
            <p className="text-sm text-clay-muted">Fresh, clean water delivered to your doorstep. No account needed — just order and we deliver.</p>
          </div>
          <div>
            <h4 className="font-display font-semibold text-clay-ink mb-2">Quick Links</h4>
            <ul className="space-y-1 text-sm">
              <li><Link href="/" className="text-clay-muted hover:text-clay-skydeep transition-colors">Home</Link></li>
              <li><Link href="/products" className="text-clay-muted hover:text-clay-skydeep transition-colors">Products &amp; Pricing</Link></li>
              <li><Link href="/order" className="text-clay-muted hover:text-clay-skydeep transition-colors">Order Now</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-clay-ink mb-2">Contact</h4>
            <ul className="space-y-2 text-sm text-clay-muted">
              <li className="flex items-center gap-2"><ClayIcon name="phone" className="w-4 h-4 text-clay-sky" /> 0912-345-6789</li>
              <li className="flex items-center gap-2"><ClayIcon name="chat" className="w-4 h-4 text-clay-sky" /> clearflow@email.com</li>
              <li className="flex items-center gap-2"><ClayIcon name="info" className="w-4 h-4 text-clay-sky" /> Mon–Sat, 7AM–6PM</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-center text-sm font-semibold text-clay-skydeep">
          <ClayIcon name="chat" className="w-5 h-5 text-clay-sky shrink-0" />
          Questions or concerns? Message us on Facebook using the chat button in the corner.
        </div>
        <div className="border-t border-sky-100 text-center text-clay-muted text-xs pt-5 mt-6">
          © {new Date().getFullYear()} Clear Flow. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
