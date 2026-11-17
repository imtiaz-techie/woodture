import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadUserCart, loadUserWishlist, saveUserCart, saveUserWishlist, validateCoupon } from '../lib/api';
import type { Product } from '../lib/types';
import { inStock, unitPrice } from '../lib/utils';
import { useAuth } from './Auth';
import { useStore } from './Store';

export interface CartEntry { product_id: string; quantity: number }
export interface CartLine { product: Product; quantity: number; lineTotal: number }
interface Toast { id: number; text: string; tone: 'ok' | 'error' }

interface ShopState {
  lines: CartLine[];
  cartCount: number;
  subtotal: number;
  addToCart: (p: Product, qty?: number) => boolean;
  setQuantity: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  wishlist: string[];
  toggleWishlist: (p: Product) => void;
  recent: string[];
  markViewed: (productId: string) => void;
  coupon: { code: string; discount: number } | null;
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => void;
  quickView: Product | null;
  setQuickView: (p: Product | null) => void;
  toasts: Toast[];
  toast: (text: string, tone?: 'ok' | 'error') => void;
}

const Ctx = createContext<ShopState>(null!);
export const useShop = () => useContext(Ctx);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { products, loading: catalogLoading } = useStore();
  const [cart, setCart] = useState<CartEntry[]>(() => read('wt_cart', []));
  const [wishlist, setWishlist] = useState<string[]>(() => read('wt_wishlist', []));
  const [recent, setRecent] = useState<string[]>(() => read('wt_recent', []));
  const [couponCode, setCouponCode] = useState<string | null>(() => read('wt_coupon', null));
  const [discount, setDiscount] = useState(0);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const syncedFor = useRef<string | null>(null);

  const toast = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  useEffect(() => write('wt_cart', cart), [cart]);
  useEffect(() => write('wt_wishlist', wishlist), [wishlist]);
  useEffect(() => write('wt_recent', recent), [recent]);
  useEffect(() => write('wt_coupon', couponCode), [couponCode]);

  // Signed-in customers: merge this device's cart/wishlist with the account's, then keep them in sync.
  useEffect(() => {
    if (!user) { syncedFor.current = null; return; }
    let cancelled = false;
    (async () => {
      try {
        const [remoteCart, remoteWish] = await Promise.all([loadUserCart(user.id), loadUserWishlist(user.id)]);
        if (cancelled) return;
        setCart(local => {
          const merged = new Map(remoteCart.map(i => [i.product_id, i.quantity]));
          for (const i of local) merged.set(i.product_id, Math.max(merged.get(i.product_id) ?? 0, i.quantity));
          return [...merged].map(([product_id, quantity]) => ({ product_id, quantity }));
        });
        setWishlist(local => [...new Set([...remoteWish, ...local])]);
      } catch { /* offline: keep local copy */ }
      if (!cancelled) syncedFor.current = user.id;
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || syncedFor.current !== user.id) return;
    const t = setTimeout(() => { saveUserCart(user.id, cart).catch(() => undefined); }, 700);
    return () => clearTimeout(t);
  }, [cart, user]);

  useEffect(() => {
    if (!user || syncedFor.current !== user.id) return;
    const t = setTimeout(() => { saveUserWishlist(user.id, wishlist).catch(() => undefined); }, 700);
    return () => clearTimeout(t);
  }, [wishlist, user]);

  const lines = useMemo<CartLine[]>(() => {
    const byId = new Map(products.map(p => [p.id, p]));
    return cart.flatMap(e => {
      const product = byId.get(e.product_id);
      return product ? [{ product, quantity: e.quantity, lineTotal: unitPrice(product) * e.quantity }] : [];
    });
  }, [cart, products]);

  // Drop cart entries whose product was unpublished or deleted.
  useEffect(() => {
    if (catalogLoading || !products.length) return;
    const ids = new Set(products.map(p => p.id));
    setCart(c => (c.every(e => ids.has(e.product_id)) ? c : c.filter(e => ids.has(e.product_id))));
  }, [products, catalogLoading]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);
  const cartCount = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  // The server re-checks the coupon at checkout; this keeps the on-screen discount honest.
  useEffect(() => {
    if (!couponCode || subtotal <= 0) { setDiscount(0); return; }
    let cancelled = false;
    validateCoupon(couponCode, subtotal)
      .then(r => { if (!cancelled) { if (r.valid) setDiscount(Number(r.discount)); else { setDiscount(0); setCouponCode(null); } } })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [couponCode, subtotal]);

  const addToCart = useCallback((p: Product, qty = 1) => {
    if (!inStock(p)) { toast(`${p.name} is out of stock`, 'error'); return false; }
    const current = cart.find(e => e.product_id === p.id)?.quantity ?? 0;
    const next = Math.min(p.stock, current + qty);
    if (next === current) { toast(`Only ${p.stock} available — already in your cart`, 'error'); return false; }
    setCart(c => (current ? c.map(e => (e.product_id === p.id ? { ...e, quantity: next } : e)) : [...c, { product_id: p.id, quantity: next }]));
    toast(next < current + qty ? `Only ${p.stock} available — cart updated` : `${p.name} added to cart`);
    return true;
  }, [cart, toast]);

  const setQuantity = useCallback((productId: string, qty: number) => {
    const stock = products.find(p => p.id === productId)?.stock ?? qty;
    const q = Math.max(1, Math.min(stock, Math.floor(qty) || 1));
    setCart(c => c.map(e => (e.product_id === productId ? { ...e, quantity: q } : e)));
  }, [products]);

  const removeFromCart = useCallback((productId: string) => setCart(c => c.filter(e => e.product_id !== productId)), []);
  const clearCart = useCallback(() => { setCart([]); setCouponCode(null); }, []);

  const toggleWishlist = useCallback((p: Product) => {
    const has = wishlist.includes(p.id);
    setWishlist(w => (has ? w.filter(id => id !== p.id) : [...w, p.id]));
    toast(has ? 'Removed from wishlist' : 'Saved to wishlist');
  }, [wishlist, toast]);

  const markViewed = useCallback((productId: string) => {
    setRecent(r => (r[0] === productId ? r : [productId, ...r.filter(id => id !== productId)].slice(0, 8)));
  }, []);

  const applyCoupon = useCallback(async (code: string) => {
    const r = await validateCoupon(code, subtotal);
    if (!r.valid) return r.message;
    setCouponCode(r.code!);
    setDiscount(Number(r.discount));
    return null;
  }, [subtotal]);

  const value: ShopState = {
    lines, cartCount, subtotal, addToCart, setQuantity, removeFromCart, clearCart,
    wishlist, toggleWishlist, recent, markViewed,
    coupon: couponCode ? { code: couponCode, discount } : null, applyCoupon, removeCoupon: () => setCouponCode(null),
    quickView, setQuickView, toasts, toast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Shipping for the current cart, using the rates set in Website Settings. */
export function useShipping(zone: 'inside' | 'outside') {
  const { general } = useStore();
  const { subtotal, coupon } = useShop();
  const free = Number(general.shipping.free_over ?? 0);
  const net = subtotal - (coupon?.discount ?? 0);
  if (free > 0 && net >= free) return 0;
  return Number(general.shipping[zone] ?? 0);
}
