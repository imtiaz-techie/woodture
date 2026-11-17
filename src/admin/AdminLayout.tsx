import {
  Boxes, ExternalLink, FolderTree, Home, Images, LayoutDashboard, LogOut, Mail, Menu, Package, PlusCircle, Receipt,
  Settings, ShieldAlert, ShoppingCart, Star, Tag, UserCog, Users, X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Toasts } from '../components/Layout';
import { Empty, Field, Notice, PageLoader } from '../components/ui';
import { useAuth } from '../context/Auth';
import { db, isDemo } from '../lib/backend';
import { DEMO_ADMIN } from '../lib/localBackend';
import { cx, errorMessage } from '../lib/utils';

const NAV = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Package, end: true },
  { to: '/admin/products/new', label: 'Add Product', icon: PlusCircle },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/payments', label: 'Payments', icon: Receipt },
  { to: '/admin/coupons', label: 'Discounts & Coupons', icon: Tag },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/messages', label: 'Messages', icon: Mail },
  { to: '/admin/homepage', label: 'Homepage Management', icon: Home },
  { to: '/admin/settings', label: 'Website Settings', icon: Settings },
  { to: '/admin/profile', label: 'Admin Profile', icon: UserCog },
];

export function AdminLogin() {
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = 'Admin Login — Woodture'; }, []);

  if (loading) return <PageLoader />;
  if (user && isAdmin) return <Navigate to="/admin/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await db.auth.signIn(email, password); } catch (err) { setError(errorMessage(err)); }
    setBusy(false);
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-espresso px-5 py-12">
      <div className="w-full max-w-md rounded-3xl bg-ivory p-8 shadow-lift sm:p-10">
        <img src="/brand/logo-full.png" alt="Woodture — Kinetic Wood Art" className="mx-auto w-44" />
        <h1 className="mt-8 text-center text-2xl text-walnut">Admin Dashboard</h1>
        <p className="mt-1 text-center text-sm text-espresso/55">Sign in to manage your store.</p>
        {user && !isAdmin && <div className="mt-5"><Notice tone="error">This account does not have admin access. <button className="underline" onClick={() => db.auth.signOut()}>Sign out</button></Notice></div>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email"><input required type="email" autoComplete="username" className="input" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input required type="password" autoComplete="current-password" className="input" value={password} onChange={e => setPassword(e.target.value)} /></Field>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        {isDemo && (
          <div className="mt-6">
            <Notice>
              <strong>Demo mode.</strong> Login: {DEMO_ADMIN.email} / {DEMO_ADMIN.password}{' '}
              <button type="button" className="underline" onClick={() => { setEmail(DEMO_ADMIN.email); setPassword(DEMO_ADMIN.password); }}>Fill in</button>
            </Notice>
          </div>
        )}
        <Link to="/" className="mt-6 block text-center text-xs uppercase tracking-[0.16em] text-wood hover:text-walnut">← Back to website</Link>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, profile, isAdmin, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => { document.title = 'Admin — Woodture'; }, []);

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) {
    return <Empty icon={<ShieldAlert size={26} />} title="Admin access required" text="This account is not an administrator."
      action={<Link to="/" className="btn-primary btn-sm">Back to website</Link>} />;
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-espresso text-cream">
      <div className="flex items-center justify-between px-6 pb-5 pt-6">
        <Link to="/admin/dashboard"><img src="/brand/wordmark-light.png" alt="Woodture" className="h-6" /><span className="mt-1.5 block text-[9px] uppercase tracking-luxe text-gold">Admin</span></Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
      </div>
      <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] transition', isActive ? 'bg-cream/10 text-ivory' : 'text-cream/60 hover:bg-cream/5 hover:text-ivory')}>
            <n.icon size={17} strokeWidth={1.7} />{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-cream/10 p-3">
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] text-cream/60 hover:bg-cream/5 hover:text-ivory"><ExternalLink size={17} strokeWidth={1.7} />View website</a>
        <button onClick={async () => { await db.auth.signOut(); navigate('/admin/login'); }} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] text-cream/60 hover:bg-cream/5 hover:text-ivory">
          <LogOut size={17} strokeWidth={1.7} />Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F0E8]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-espresso/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72" onClick={e => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-walnut/10 bg-ivory/90 px-5 backdrop-blur sm:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} className="text-walnut" /></button>
          <p className="hidden text-sm text-espresso/55 lg:block">{isDemo ? 'Demo mode — changes are saved in this browser only.' : 'Store management'}</p>
          <Link to="/admin/profile" className="flex items-center gap-3 text-sm text-walnut">
            <span className="hidden sm:block">{profile?.full_name || user.email}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-walnut font-display text-ivory">{(profile?.full_name || user.email).charAt(0).toUpperCase()}</span>
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><Outlet /></main>
      </div>
      <Toasts />
    </div>
  );
}
