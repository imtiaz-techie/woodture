import { motion } from 'framer-motion';
import { CheckCircle2, PackageSearch } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import OrderView from '../components/OrderView';
import { Empty, Field, Notice, PageHeader, PageLoader } from '../components/ui';
import { useAuth } from '../context/Auth';
import { myOrders, trackOrder } from '../lib/api';
import { useSeo } from '../lib/seo';
import type { Order } from '../lib/types';
import { errorMessage } from '../lib/utils';
import { rememberOrder } from './Checkout';

function rememberedPhone(orderNumber: string): string | null {
  try { return JSON.parse(sessionStorage.getItem('wt_orders') ?? '{}')[orderNumber] ?? null; } catch { return null; }
}

/** /order/:number — confirmation right after checkout, and the order detail page afterwards. */
export function OrderPage() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const payment = params.get('payment');
  useSeo(`Order ${number}`);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      let found: Order | null = null;
      try {
        const phone = rememberedPhone(number);
        if (phone) found = await trackOrder(number, phone);
        if (!found && user) found = (await myOrders(user.id)).find(o => o.order_number === number) ?? null;
      } catch { /* fall through to "not found" */ }
      if (!cancelled) setOrder(found);
    })();
    return () => { cancelled = true; };
  }, [number, user, authLoading]);

  if (order === undefined) return <PageLoader />;
  if (!order) {
    return <Empty icon={<PackageSearch size={26} />} title="We couldn’t open this order" text="For your privacy, please confirm the phone number used at checkout."
      action={<Link to={`/track?order=${encodeURIComponent(number)}`} className="btn-primary btn-sm">Track this order</Link>} />;
  }
  const fresh = Date.now() - +new Date(order.created_at) < 15 * 60 * 1000;
  return (
    <div className="container-x py-10 sm:py-14">
      {fresh && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-700" strokeWidth={1.4} />
          <p className="eyebrow mt-5">Thank you, {order.customer_name.split(' ')[0]}</p>
          <h1 className="mt-2 text-4xl text-walnut sm:text-5xl">Your order is placed</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-espresso/60">
            Keep your order number <strong className="text-walnut">{order.order_number}</strong> — with your phone number it lets you track this order anytime.
          </p>
        </motion.div>
      )}
      <div className="mx-auto max-w-5xl space-y-6">
        {payment === 'success' && order.payment_status === 'paid' && <Notice tone="ok">Payment received — thank you.</Notice>}
        {payment === 'success' && order.payment_status !== 'paid' && <Notice>Your payment is being verified. This page will show “paid” once confirmed.</Notice>}
        {(payment === 'failed' || payment === 'cancelled') && <Notice tone="error">The payment was not completed. Your order is saved — you can try paying again below.</Notice>}
        <OrderView order={order} />
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <Link to="/shop" className="btn-outline btn-sm">Continue shopping</Link>
          {user && <Link to="/account" className="btn-outline btn-sm">My orders</Link>}
        </div>
      </div>
    </div>
  );
}

/** /track — guests look an order up with order number + checkout phone number. */
export function TrackPage() {
  const [params] = useSearchParams();
  const [number, setNumber] = useState(params.get('order') ?? '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useSeo('Track Your Order');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setOrder(null);
    try {
      const found = await trackOrder(number, phone);
      if (found) { setOrder(found); rememberOrder(found.order_number, phone); }
      else setError('No order matches that order number and phone number. Please check both and try again.');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Order Tracking" title="Track your order" text="Enter your order number and the phone number used at checkout." />
      <div className="container-x py-10 sm:py-14">
        <form onSubmit={submit} className="card mx-auto grid max-w-2xl gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-8">
          <Field label="Order number"><input required className="input" placeholder="WT-000000-XXXXXX" value={number} onChange={e => setNumber(e.target.value.toUpperCase())} /></Field>
          <Field label="Phone number"><input required type="tel" className="input" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
          <button className="btn-primary" disabled={busy}>{busy ? 'Searching…' : 'Track'}</button>
        </form>
        {error && <div className="mx-auto mt-6 max-w-2xl"><Notice tone="error">{error}</Notice></div>}
        {order && <div className="mx-auto mt-10 max-w-5xl"><OrderView order={order} /></div>}
      </div>
    </>
  );
}
