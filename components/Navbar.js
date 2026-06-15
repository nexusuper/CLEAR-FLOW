import Link from 'next/link';
import { useState } from 'react';
import ClayIcon from './ui/ClayIcon';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Products' },
  { href: '/rewards', label: 'Rewards' },
  { href: '/track', label: 'Track Order' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-40 px-4 pt-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between rounded-3xl px-5 py-3 clay-raised">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-[13px] text-white clay-raised-sm"
                style={{ background: 'linear-gradient(145deg,#7dd3fc,#0ea5e9)' }}>
            <ClayIcon name="drop" className="w-5 h-5" fill="#fff" stroke="none" />
          </span>
          <span className="font-display text-xl font-bold text-clay-ink2">Clear Flow</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="font-semibold text-clay-muted hover:text-clay-skydeep transition-colors">{l.label}</Link>
          ))}
          <Link href="/order" className="rounded-full px-5 py-2 font-display font-semibold text-white clay-btn-primary clay-pressable">Order Now</Link>
        </div>

        <button className="md:hidden text-clay-ink2" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
          <ClayIcon name={open ? 'close' : 'menu'} className="w-7 h-7" />
        </button>
      </div>

      {open && (
        <div className="md:hidden max-w-6xl mx-auto mt-2 rounded-3xl p-4 flex flex-col gap-2 clay-raised">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="py-2 font-semibold text-clay-muted hover:text-clay-skydeep" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <Link href="/order" className="text-center rounded-full px-5 py-2.5 font-display font-semibold text-white clay-btn-primary" onClick={() => setOpen(false)}>Order Now</Link>
        </div>
      )}
    </nav>
  );
}
