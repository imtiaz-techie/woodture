import { ArrowRight, Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty, PageHeader, PageLoader } from '../components/ui';
import { useShipping, useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { useSeo } from '../lib/seo';
import { cx, errorMessage, inStock, primaryImage, unitPrice } from '../lib/utils';

export type Zone = 'inside' | 'outside';

/** Delivery area, remembered between cart and checkout. */
export function useZone(): [Zone, (z: Zone) => void] {
  const [zone, setZone] = useState<Zone>(() => (localStorage.getItem('wt_zone') === 'inside' ? 'inside' : 'outside'));
  useEffect(() => { try { localStorage.setItem('wt_zone', zone); } catch { /* ignore */ } }, [zone]);
  return [zone, setZone];
}

export function ZonePicker({ zone, onChange }: { zone: Zone; onChange: (z: Zone) => void }) {
  const { general, money } = useStore();
  const { inside, outside } = general.shipping;
  if (Number(inside) === Number(outside)) return null;
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Delivery area">
      {([['inside', 'Inside Dhaka', inside], ['outside', 'Outside Dhaka', outside]] as const).map(([v, label, rate]) => (
        <button key={v} type="button" role="radio" aria-checked={zone === v} onClick={() => onChange(v)}
          className={cx('rounded-xl border px-3 py-2.5 text-left text-xs transition', zone === v ? 'border-wood bg-cream/70 text-walnut' : 'border-walnut/15 text-espresso/60 hover:border-walnut/30')}>
          <span className="block font-medium">{label}</span>{Number(rate) > 0 ? money(Number(rate)) : 'Free'}
        </button>
      ))}
    </div>
  );
}

export function CouponBox() {
  const { coupon, applyCoupon, removeCoupon } = useShop();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true); setMsg('');
    try { const err = await applyCoupon(code); if (err) setMsg(err); else setCode(''); }
    catch (er) { setMsg(errorMessage(er)); } finally { setBusy(false); }
  };
  if (coupon) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span className="flex items-center gap-2"><Tag size={15} />Code <strong>{coupon.code}</strong> applied</span>
        <button onClick={removeCoupon} aria-label="Remove discount code"><X size={16} /></button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Discount code" aria-label="Discount code" className="input !py-2.5"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }} />
        <button type="button" onClick={() => void submit()} className="btn-outline btn-sm shrink-0" disabled={busy}>Apply</button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-700">{msg}</p>}
    </div>
  );
}

export default function Cart() {
  const { lines, subtotal, coupon, setQuantity, removeFromCart } = useShop();
  const { money, loading } = useStore();
  const [zone, setZone] = useZone();
  const shipping = useShipping(zone);
  const navigate = useNavigate();
  useSeo('Shopping Cart');

  const discount = coupon?.discount ?? 0;
  const problems = lines.filter(l => !inStock(l.product) || l.quantity > l.product.stock);

  if (loading) return <PageLoader />;
  return (
    <>
      <PageHeader eyebrow="Your selection" title="Shopping Cart" />
      <div className="container-x py-10 sm:py-14">
        {!lines.length ? (
          <Empty icon={<ShoppingBag size={26} />} title="Your cart is empty" text="Discover a piece of kinetic art to bring home."
            action={<Link to="/shop" className="btn-primary">Explore the collection</Link>} />
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
            <ul className="divide-y divide-walnut/10 border-y border-walnut/10">
              {lines.map(({ product: p, quantity, lineTotal }) => {
                const bad = !inStock(p) || quantity > p.stock;
                return (
                  <li key={p.id} className="flex gap-4 py-6 sm:gap-6">
                    <Link to={`/product/${p.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-cream sm:h-32 sm:w-32">
                      {primaryImage(p) && <img src={primaryImage(p)} alt={p.name} className="h-full w-full object-cover" />}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <Link to={`/product/${p.slug}`} className="block truncate font-display text-xl text-walnut hover:text-wood">{p.name}</Link>
                          <p className="text-xs text-espresso/50">{p.category?.name}</p>
                          <p className="mt-1 text-sm text-espresso/70">
                            {money(unitPrice(p))}{p.discount_price != null && <span className="ml-2 text-xs text-espresso/40 line-through">{money(p.price)}</span>}
                          </p>
                        </div>
                        <button onClick={() => removeFromCart(p.id)} aria-label={`Remove ${p.name}`} className="h-9 w-9 shrink-0 rounded-full text-espresso/40 transition hover:bg-cream hover:text-red-700">
                          <Trash2 size={16} className="mx-auto" />
                        </button>
                      </div>
                      {bad && <p className="mt-2 text-xs text-red-700">{inStock(p) ? `Only ${p.stock} available — please reduce the quantity.` : 'This piece is now out of stock — please remove it.'}</p>}
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <div className="flex items-center rounded-full border border-walnut/20">
                          <button onClick={() => setQuantity(p.id, quantity - 1)} disabled={quantity <= 1} aria-label="Decrease quantity" className="flex h-9 w-9 items-center justify-center text-walnut disabled:opacity-30"><Minus size={14} /></button>
                          <span className="w-7 text-center text-sm font-medium">{quantity}</span>
                          <button onClick={() => setQuantity(p.id, quantity + 1)} disabled={quantity >= p.stock} aria-label="Increase quantity" className="flex h-9 w-9 items-center justify-center text-walnut disabled:opacity-30"><Plus size={14} /></button>
                        </div>
                        <p className="font-medium text-walnut">{money(lineTotal)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="card h-fit space-y-5 p-6 sm:p-8 lg:sticky lg:top-28">
              <h2 className="text-2xl text-walnut">Order summary</h2>
              <CouponBox />
              <ZonePicker zone={zone} onChange={setZone} />
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-espresso/60">Subtotal</dt><dd>{money(subtotal)}</dd></div>
                {discount > 0 && <div className="flex justify-between text-emerald-800"><dt>Discount</dt><dd>−{money(discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-espresso/60">Delivery</dt><dd>{shipping > 0 ? money(shipping) : 'Free'}</dd></div>
                <div className="flex justify-between border-t border-walnut/10 pt-4 text-lg font-medium text-walnut"><dt>Total</dt><dd>{money(subtotal - discount + shipping)}</dd></div>
              </dl>
              <button className="btn-primary w-full" disabled={problems.length > 0} onClick={() => navigate('/checkout')}>Proceed to checkout <ArrowRight size={15} /></button>
              {problems.length > 0 && <p className="text-center text-xs text-red-700">Please fix the stock issues above to continue.</p>}
              <Link to="/shop" className="block text-center text-[12px] font-medium uppercase tracking-[0.16em] text-wood hover:text-walnut">Continue shopping</Link>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
