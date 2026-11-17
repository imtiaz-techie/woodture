import { Banknote, CreditCard, Landmark, Lock } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Field, Notice, PageHeader, PageLoader } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useShipping, useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { placeOrder, startOnlinePayment } from '../lib/api';
import { db, isDemo } from '../lib/backend';
import { useSeo } from '../lib/seo';
import type { Address, PaymentMethod } from '../lib/types';
import { cx, errorMessage, primaryImage } from '../lib/utils';
import { CouponBox, ZonePicker, useZone } from './Cart';

/** Lets the confirmation page load a guest's order (number + the phone they used). */
export function rememberOrder(orderNumber: string, phone: string) {
  try {
    const all = JSON.parse(sessionStorage.getItem('wt_orders') ?? '{}');
    sessionStorage.setItem('wt_orders', JSON.stringify({ ...all, [orderNumber]: phone }));
  } catch { /* ignore */ }
}

export default function Checkout() {
  const { lines, subtotal, coupon, clearCart } = useShop();
  const { money, general, loading, refresh } = useStore();
  const { user, profile } = useAuth();
  const [zone, setZone] = useZone();
  const shipping = useShipping(zone);
  const navigate = useNavigate();
  useSeo('Checkout');

  const pay = general.payment;
  const methods = [
    pay.cod_enabled && { id: 'cod' as const, icon: <Banknote size={20} />, title: 'Cash on Delivery', text: 'Pay when your order arrives.' },
    pay.manual_enabled && { id: 'manual' as const, icon: <Landmark size={20} />, title: 'Bank / Mobile Payment', text: 'bKash, Nagad or bank transfer — send payment, then enter the transaction ID.' },
    pay.online_enabled && !isDemo && { id: 'online' as const, icon: <CreditCard size={20} />, title: 'Online Payment', text: 'Pay securely by card or mobile wallet.' },
  ].filter(Boolean) as { id: PaymentMethod; icon: ReactNode; title: string; text: string }[];

  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', address: '', city: '', postal_code: '', notes: '' });
  const [method, setMethod] = useState<PaymentMethod>('cod');
  const [manualProvider, setManualProvider] = useState('bkash');
  const [payerRef, setPayerRef] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState(false);

  useEffect(() => { if (methods.length && !methods.some(m => m.id === method)) setMethod(methods[0].id); }, [methods, method]);

  useEffect(() => {
    if (!user) return;
    setForm(f => ({ ...f, customer_name: f.customer_name || profile?.full_name || '', phone: f.phone || profile?.phone || '', email: f.email || user.email }));
    db.select<Address>('addresses', { eq: { user_id: user.id } }).then(list => {
      setAddresses(list);
      const def = list.find(a => a.is_default) ?? list[0];
      if (def) setForm(f => (f.address ? f : { ...f, customer_name: def.full_name, phone: def.phone, address: def.address, city: def.city, postal_code: def.postal_code ?? '' }));
    }).catch(() => undefined);
  }, [user, profile]);

  if (loading) return <PageLoader />;
  if (!lines.length && !placed) return <Navigate to="/cart" replace />;

  const discount = coupon?.discount ?? 0;
  const total = subtotal - discount + shipping;
  const bind = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value })) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const order = await placeOrder({
        items: lines.map(l => ({ product_id: l.product.id, quantity: l.quantity })),
        ...form, delivery_zone: zone, coupon_code: coupon?.code, payment_method: method,
        ...(method === 'manual' ? { payer_ref: payerRef, manual_provider: manualProvider } : {}),
      });
      setPlaced(true);
      rememberOrder(order.order_number, order.phone);
      clearCart();
      void refresh(); // stock changed
      if (method === 'online') {
        try { window.location.href = (await startOnlinePayment(order.order_number, order.phone)).url; return; }
        catch { navigate(`/order/${order.order_number}?payment=failed`, { replace: true }); return; }
      }
      navigate(`/order/${order.order_number}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      void refresh();
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Almost there" title="Checkout" />
      <form onSubmit={submit} className="container-x grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
        <div className="space-y-10">
          {!user && (
            <Notice>Checking out as a guest. <Link to="/login?next=/checkout" className="font-medium underline">Sign in</Link> to save your details and follow your orders.</Notice>
          )}

          <section>
            <h2 className="mb-5 text-2xl text-walnut">1. Delivery details</h2>
            {addresses.length > 1 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {addresses.map(a => (
                  <button key={a.id} type="button" onClick={() => setForm(f => ({ ...f, customer_name: a.full_name, phone: a.phone, address: a.address, city: a.city, postal_code: a.postal_code ?? '' }))}
                    className="rounded-full border border-walnut/20 px-4 py-2 text-xs text-walnut hover:bg-cream">{a.label || a.city}</button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><input required minLength={2} maxLength={120} autoComplete="name" className="input" {...bind('customer_name')} /></Field>
              <Field label="Phone number"><input required type="tel" inputMode="tel" pattern="\+?[0-9 \(\)\-]{6,20}" title="Enter a valid phone number" autoComplete="tel" className="input" {...bind('phone')} /></Field>
              <Field label="Email" hint="(optional)" className="sm:col-span-2"><input type="email" autoComplete="email" className="input" {...bind('email')} /></Field>
              <Field label="Delivery address" className="sm:col-span-2"><textarea required minLength={5} maxLength={500} rows={2} autoComplete="street-address" className="input" {...bind('address')} /></Field>
              <Field label="City / District"><input required minLength={2} maxLength={120} autoComplete="address-level2" className="input" {...bind('city')} /></Field>
              <Field label="Postal code" hint="(optional)"><input maxLength={12} autoComplete="postal-code" className="input" {...bind('postal_code')} /></Field>
              <div className="sm:col-span-2"><ZonePicker zone={zone} onChange={setZone} /></div>
              <Field label="Order notes" hint="(optional)" className="sm:col-span-2"><textarea rows={2} maxLength={1000} className="input" placeholder="Anything we should know about delivery?" {...bind('notes')} /></Field>
            </div>
          </section>

          <section>
            <h2 className="mb-5 text-2xl text-walnut">2. Payment</h2>
            {!methods.length && <Notice tone="error">No payment method is available right now. Please contact us to place your order.</Notice>}
            <div className="space-y-3" role="radiogroup" aria-label="Payment method">
              {methods.map(m => (
                <label key={m.id} className={cx('flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition', method === m.id ? 'border-wood bg-white shadow-soft' : 'border-walnut/15 hover:border-walnut/30')}>
                  <input type="radio" name="payment" className="mt-1 accent-[#9B6339]" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <span className="text-wood">{m.icon}</span>
                  <span><span className="block font-medium text-walnut">{m.title}</span><span className="text-sm text-espresso/60">{m.text}</span></span>
                </label>
              ))}
            </div>
            {method === 'manual' && (
              <div className="mt-4 space-y-4 rounded-2xl bg-cream/60 p-5">
                {pay.manual_instructions && <p className="whitespace-pre-line text-sm leading-relaxed text-espresso/75">{pay.manual_instructions}</p>}
                <p className="text-sm font-medium text-walnut">Amount to send: {money(total)}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Paid with">
                    <select className="input" value={manualProvider} onChange={e => setManualProvider(e.target.value)}>
                      <option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="bank">Bank transfer</option>
                    </select>
                  </Field>
                  <Field label="Transaction ID"><input required minLength={4} maxLength={60} className="input" value={payerRef} onChange={e => setPayerRef(e.target.value)} /></Field>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="card h-fit space-y-5 p-6 sm:p-8 lg:sticky lg:top-28">
          <h2 className="text-2xl text-walnut">Your order</h2>
          <ul className="divide-y divide-walnut/10">
            {lines.map(l => (
              <li key={l.product.id} className="flex items-center gap-3 py-3 first:pt-0">
                <span className="relative h-14 w-14 shrink-0 rounded-lg bg-cream">
                  {primaryImage(l.product) && <img src={primaryImage(l.product)} alt="" className="h-full w-full rounded-lg object-cover" />}
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-walnut px-1 text-[10px] font-semibold text-ivory">{l.quantity}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-walnut">{l.product.name}</span>
                <span className="text-sm">{money(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <CouponBox />
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-espresso/60">Subtotal</dt><dd>{money(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-emerald-800"><dt>Discount</dt><dd>−{money(discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-espresso/60">Delivery charge</dt><dd>{shipping > 0 ? money(shipping) : 'Free'}</dd></div>
            <div className="flex justify-between border-t border-walnut/10 pt-4 text-lg font-medium text-walnut"><dt>Total</dt><dd>{money(total)}</dd></div>
          </dl>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={busy || !methods.length}>
            <Lock size={14} />{busy ? 'Placing order…' : method === 'online' ? 'Continue to payment' : 'Place order'}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-espresso/45">
            By placing your order you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/shipping-returns" className="underline">Shipping &amp; Returns Policy</Link>.
          </p>
        </aside>
      </form>
    </>
  );
}
