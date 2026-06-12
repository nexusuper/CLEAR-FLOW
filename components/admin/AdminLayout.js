import { useState, useEffect, createContext, useContext } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const AdminContext = createContext(null);

export function useAdmin() {
  return useContext(AdminContext);
}

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/orders', label: 'Orders', icon: '📦' },
  { href: '/admin/pos', label: 'Walk-in Sale', icon: '🧾' },
  { href: '/admin/inventory', label: 'Inventory', icon: '🫙' },
  { href: '/admin/products', label: 'Products & Pricing', icon: '💧' },
  { href: '/admin/expenses', label: 'Expenses', icon: '💸' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
];

const PW_KEY = 'cf_admin_pw';

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/auth', { method: 'POST', headers: { password } });
    if (res.ok) {
      onLogin(password);
    } else {
      setError('Invalid password');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-2xl font-bold text-sky-800">Owner Panel</h1>
          <p className="text-gray-400 text-sm">Clear Flow Business Management</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-full transition-colors"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLayout({ title, children }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(PW_KEY);
    if (saved) {
      fetch('/api/admin/auth', { method: 'POST', headers: { password: saved } }).then((res) => {
        if (res.ok) setPassword(saved);
        else sessionStorage.removeItem(PW_KEY);
        setChecked(true);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time auth check on mount
      setChecked(true);
    }
  }, []);

  function handleLogin(pw) {
    sessionStorage.setItem(PW_KEY, pw);
    setPassword(pw);
  }

  function logout() {
    sessionStorage.removeItem(PW_KEY);
    setPassword('');
  }

  // authFetch attaches the admin password header to every API call
  const authFetch = (url, options = {}) =>
    fetch(url, { ...options, headers: { ...(options.headers || {}), password } });

  const pageTitle = `${title} — Clear Flow Admin`;

  if (!checked) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (!password) {
    return (
      <>
        <Head><title>Admin — Clear Flow</title></Head>
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  return (
    <AdminContext.Provider value={{ password, authFetch }}>
      <Head><title>{pageTitle}</title></Head>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">

        {/* Mobile top bar */}
        <div className="md:hidden bg-sky-700 text-white px-4 py-3 flex items-center justify-between">
          <span className="font-bold">💧 Clear Flow Admin</span>
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-2xl leading-none">☰</button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-sky-700 text-white px-2 pb-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm ${router.pathname === n.href ? 'bg-sky-600 font-semibold' : 'hover:bg-sky-600/50'}`}
              >
                {n.icon} {n.label}
              </Link>
            ))}
            <button onClick={logout} className="block w-full text-left px-3 py-2 rounded-lg text-sm text-sky-200 hover:bg-sky-600/50">
              ⏻ Logout
            </button>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-60 bg-sky-700 text-white min-h-screen sticky top-0">
          <div className="px-5 py-5 border-b border-sky-600">
            <div className="font-bold text-lg">💧 Clear Flow</div>
            <div className="text-sky-300 text-xs">Business Management</div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  router.pathname === n.href ? 'bg-sky-500 font-semibold shadow' : 'text-sky-100 hover:bg-sky-600'
                }`}
              >
                <span>{n.icon}</span> {n.label}
              </Link>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-sky-600 space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-sky-200 hover:bg-sky-600 transition-colors">
              🌐 View Site
            </Link>
            <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-sky-200 hover:bg-sky-600 transition-colors">
              ⏻ Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white border-b border-gray-100 px-6 py-4 hidden md:block">
            <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          </div>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}
