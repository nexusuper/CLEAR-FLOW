import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm border-b border-sky-100">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">💧</span>
          </div>
          <span className="text-xl font-bold text-sky-600">Clear Flow</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-gray-600 hover:text-sky-600 transition-colors">Home</Link>
          <Link href="/products" className="text-gray-600 hover:text-sky-600 transition-colors">Products</Link>
          <Link href="/track" className="text-gray-600 hover:text-sky-600 transition-colors">Track Order</Link>
          <Link href="/order" className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-full font-medium transition-colors">
            Order Now
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-gray-600" onClick={() => setOpen(!open)}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-sky-100 px-4 pb-4 flex flex-col gap-3">
          <Link href="/" className="text-gray-600 hover:text-sky-600 py-2" onClick={() => setOpen(false)}>Home</Link>
          <Link href="/products" className="text-gray-600 hover:text-sky-600 py-2" onClick={() => setOpen(false)}>Products</Link>
          <Link href="/track" className="text-gray-600 hover:text-sky-600 py-2" onClick={() => setOpen(false)}>Track Order</Link>
          <Link href="/order" className="bg-sky-500 text-white px-5 py-2 rounded-full text-center font-medium" onClick={() => setOpen(false)}>Order Now</Link>
        </div>
      )}
    </nav>
  );
}
