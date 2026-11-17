import { AnimatePresence, motion } from 'framer-motion';
import { Facebook, Heart, Instagram, Mail, MapPin, Menu, MessageCircle, Phone, Search, ShoppingBag, User, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { isDemo } from '../lib/backend';
import { cx, primaryImage, whatsappLink } from '../lib/utils';
import QuickView from './QuickView';
import { Price } from './ui';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/collections', label: 'Collections' },
  { to: '/shop', label: 'Shop' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
];

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  const { general } = useStore();
  if (general.logo_url && !light) return <img src={general.logo_url} alt={general.business_name} className={cx('h-10 w-auto', className)} />;
  return (
    <span className={cx('flex items-center gap-2.5', className)}>
      {!light && <img src="/brand/bird.png" alt="" className="h-9 w-auto sm:h-10" />}
      <img src={light ? '/brand/wordmark-light.png' : '/brand/wordmark.png'} alt={general.business_name || 'Woodture'} className="h-6 w-auto sm:h-7" />
    </span>
  );
}

function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { products, categories } = useStore();
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const term = q.trim().toLowerCase();
  const hits = useMemo(() => (term.length < 2 ? [] : products.filter(p =>
    p.name.toLowerCase().includes(term) || p.category?.name.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term)).slice(0, 6)), [term, products]);
  const catHits = useMemo(() => (term.length < 2 ? [] : categories.filter(c => c.name.toLowerCase().includes(term)).slice(0, 3)), [term, categories]);
  const go = (to: string) => { onClose(); navigate(to); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] bg-espresso/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog" aria-modal="true" aria-label="Search products"
            className="bg-ivory shadow-lift" initial={{ y: -30 }} animate={{ y: 0 }} exit={{ y: -30 }} transition={{ duration: 0.3 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="container-x py-6">
              <form onSubmit={e => { e.preventDefault(); if (term) go(`/shop?q=${encodeURIComponent(q.trim())}`); }} className="flex items-center gap-4 border-b border-walnut/20 pb-4">
                <Search size={20} className="text-wood" />
                <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search sculptures, collections…" aria-label="Search"
                  className="w-full bg-transparent font-display text-xl text-walnut placeholder:text-walnut/30 focus:outline-none sm:text-2xl" />
                <button type="button" onClick={onClose} aria-label="Close search" className="text-walnut/60 hover:text-walnut"><X size={22} /></button>
              </form>
              {term.length >= 2 && (
                <div className="max-h-[60vh] overflow-y-auto py-4">
                  {catHits.map(c => (
                    <button key={c.id} onClick={() => go(`/shop?category=${c.slug}`)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-espresso/70 hover:bg-cream">
                      Collection · <span className="text-walnut">{c.name}</span>
                    </button>
                  ))}
                  {hits.map(p => (
                    <button key={p.id} onClick={() => go(`/product/${p.slug}`)} className="flex w-full items-center gap-4 rounded-lg px-3 py-2 text-left hover:bg-cream">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-cream">{primaryImage(p) && <img src={primaryImage(p)} alt="" className="h-full w-full object-cover" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base text-walnut">{p.name}</span>
                        <span className="block text-xs text-espresso/50">{p.category?.name}</span>
                      </span>
                      <Price price={p.price} discount={p.discount_price} className="text-sm" />
                    </button>
                  ))}
                  {!hits.length && !catHits.length && <p className="px-3 py-4 text-sm text-espresso/55">No matches for “{q.trim()}”.</p>}
                  {hits.length > 0 && (
                    <button onClick={() => go(`/shop?q=${encodeURIComponent(q.trim())}`)} className="mt-2 px-3 text-xs font-medium uppercase tracking-[0.16em] text-wood hover:text-walnut">
                      See all results →
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header() {
  const { cartCount, wishlist } = useShop();
  const { user } = useAuth();
  const { homepage } = useStore();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setMenu(false), [location.pathname, location.search]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { document.body.style.overflow = menu ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [menu]);

  const iconBtn = 'relative flex h-10 w-10 items-center justify-center rounded-full text-walnut transition hover:bg-cream';
  return (
    <>
      {isDemo && (
        <div className="no-print bg-espresso px-4 py-2 text-center text-[11.5px] leading-snug text-cream/90">
          Demo mode — sample products, data saved only in this browser. Connect Supabase to go live (see README).
        </div>
      )}
      {homepage.banner_enabled && homepage.banner_text && (
        <div className="no-print bg-walnut px-4 py-2 text-center text-[12px] tracking-wide text-ivory">{homepage.banner_text}</div>
      )}
      <header className={cx('no-print sticky top-0 z-50 border-b transition duration-300', scrolled ? 'border-walnut/10 bg-ivory/90 shadow-soft backdrop-blur-md' : 'border-transparent bg-ivory')}>
        <div className="container-x flex h-[68px] items-center justify-between gap-4 lg:h-20">
          <button className={cx(iconBtn, '-ml-2 lg:hidden')} onClick={() => setMenu(true)} aria-label="Open menu"><Menu size={22} /></button>
          <Link to="/" aria-label="Woodture home" className="shrink-0"><Logo /></Link>
          <nav className="hidden items-center gap-9 lg:flex" aria-label="Main">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({ isActive }) => cx('link-underline text-[12.5px] font-medium uppercase tracking-[0.16em] transition', isActive ? 'text-walnut after:w-full' : 'text-espresso/60 hover:text-walnut')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="-mr-2 flex items-center">
            <button className={iconBtn} onClick={() => setSearch(true)} aria-label="Search"><Search size={19} /></button>
            <Link className={cx(iconBtn, 'hidden sm:flex')} to={user ? '/account' : '/login'} aria-label="Account"><User size={19} /></Link>
            <Link className={cx(iconBtn, 'hidden sm:flex')} to="/wishlist" aria-label={`Wishlist, ${wishlist.length} items`}>
              <Heart size={19} />
              {wishlist.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold" />}
            </Link>
            <Link className={iconBtn} to="/cart" aria-label={`Cart, ${cartCount} items`}>
              <ShoppingBag size={19} />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span key={cartCount} initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-walnut px-1 text-[10px] font-semibold text-ivory">
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-[60] bg-espresso/50 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)}>
            <motion.aside
              role="dialog" aria-modal="true" aria-label="Menu"
              className="flex h-full w-[86%] max-w-sm flex-col bg-ivory px-7 pb-8 pt-6"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button onClick={() => setMenu(false)} aria-label="Close menu" className={iconBtn}><X size={22} /></button>
              </div>
              <nav className="mt-10 flex flex-1 flex-col" aria-label="Mobile">
                {NAV.map((n, i) => (
                  <motion.div key={n.to} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.05 }}>
                    <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => cx('block border-b border-walnut/10 py-4 font-display text-2xl', isActive ? 'text-wood' : 'text-walnut')}>
                      {n.label}
                    </NavLink>
                  </motion.div>
                ))}
              </nav>
              <div className="grid grid-cols-2 gap-3 text-[12px] font-medium uppercase tracking-[0.14em] text-walnut">
                <Link to={user ? '/account' : '/login'} className="flex items-center justify-center gap-2 rounded-full border border-walnut/20 py-3"><User size={15} />Account</Link>
                <Link to="/wishlist" className="flex items-center justify-center gap-2 rounded-full border border-walnut/20 py-3"><Heart size={15} />Wishlist</Link>
                <Link to="/track" className="col-span-2 flex items-center justify-center rounded-full bg-walnut py-3 text-ivory">Track an order</Link>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  );
}

function Footer() {
  const { general, homepage, categories } = useStore();
  const col = 'mb-5 text-[11px] font-medium uppercase tracking-luxe text-gold';
  const link = 'block py-1.5 text-sm text-cream/65 transition hover:text-ivory';
  const contact = [
    general.phone && { icon: <Phone size={15} />, text: general.phone, href: `tel:${general.phone.replace(/\s/g, '')}` },
    general.email && { icon: <Mail size={15} />, text: general.email, href: `mailto:${general.email}` },
    general.address && { icon: <MapPin size={15} />, text: general.address },
  ].filter(Boolean) as { icon: JSX.Element; text: string; href?: string }[];

  return (
    <footer className="no-print bg-espresso text-cream">
      <div className="container-x grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:py-20">
        <div>
          <Logo light />
          <p className="mt-2 text-[10px] uppercase tracking-luxe text-gold">{general.tagline}</p>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-cream/60">{homepage.footer_text}</p>
          <div className="mt-6 flex gap-3">
            {general.facebook && <a href={general.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 transition hover:border-gold hover:text-gold"><Facebook size={17} /></a>}
            {general.instagram && <a href={general.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 transition hover:border-gold hover:text-gold"><Instagram size={17} /></a>}
          </div>
        </div>
        <div>
          <h3 className={col}>Collections</h3>
          {categories.slice(0, 6).map(c => <Link key={c.id} to={`/shop?category=${c.slug}`} className={link}>{c.name}</Link>)}
          <Link to="/new-arrivals" className={link}>New Arrivals</Link>
        </div>
        <div>
          <h3 className={col}>Woodture</h3>
          <Link to="/about" className={link}>Our Story</Link>
          <Link to="/gallery" className={link}>Gallery</Link>
          <Link to="/contact" className={link}>Contact Us</Link>
          <Link to="/track" className={link}>Track Order</Link>
          <Link to="/account" className={link}>My Account</Link>
        </div>
        <div>
          <h3 className={col}>Customer Care</h3>
          <Link to="/shipping-returns" className={link}>Shipping &amp; Returns</Link>
          <Link to="/privacy" className={link}>Privacy Policy</Link>
          <Link to="/terms" className={link}>Terms &amp; Conditions</Link>
          <div className="mt-5 space-y-2.5">
            {contact.map((c, i) => {
              const inner = <><span className="mt-0.5 text-gold">{c.icon}</span><span>{c.text}</span></>;
              return c.href
                ? <a key={i} href={c.href} className="flex gap-3 text-sm text-cream/65 hover:text-ivory">{inner}</a>
                : <p key={i} className="flex gap-3 text-sm text-cream/65">{inner}</p>;
            })}
          </div>
        </div>
      </div>
      <div className="border-t border-cream/10">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-6 text-xs text-cream/45 sm:flex-row">
          <p>© {new Date().getFullYear()} {general.business_name}. All rights reserved.</p>
          <p className="uppercase tracking-luxe">Art in motion</p>
        </div>
      </div>
    </footer>
  );
}

function Toasts() {
  const { toasts } = useShop();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            className={cx('rounded-full px-5 py-3 text-[13px] shadow-lift', t.tone === 'error' ? 'bg-red-900 text-white' : 'bg-espresso text-ivory')}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function WhatsAppFab() {
  const { general } = useStore();
  const href = whatsappLink(general.whatsapp, 'Hello Woodture! I would like to know more about your kinetic wooden art.');
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp"
      className="no-print fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1FAF57] text-white shadow-lift transition hover:scale-105">
      <MessageCircle size={26} />
    </a>
  );
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function Layout() {
  const { quickView, setQuickView } = useShop();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-walnut focus:px-4 focus:py-2 focus:text-ivory">Skip to content</a>
      <Header />
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
      <WhatsAppFab />
      <QuickView product={quickView} onClose={() => setQuickView(null)} />
      <Toasts />
    </div>
  );
}

export { Toasts };
