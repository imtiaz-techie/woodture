import { Check, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/Store';
import { startOnlinePayment } from '../lib/api';
import type { Order } from '../lib/types';
import { cx, errorMessage, formatDate, whatsappLink } from '../lib/utils';
import { Notice, StatusBadge } from './ui';

const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;
const FLOW_LABEL: Record<string, string> = { pending: 'Order placed', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered' };
export const PAYMENT_LABEL: Record<string, string> = { cod: 'Cash on Delivery', manual: 'Bank / Mobile payment', online: 'Online payment' };

export function OrderTotals({ order }: { order: Pick<Order, 'subtotal' | 'discount' | 'shipping' | 'total' | 'coupon_code'> }) {
  const { money } = useStore();
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-espresso/60">Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
      {order.discount > 0 && <div className="flex justify-between text-emerald-800"><dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</dt><dd>−{money(order.discount)}</dd></div>}
      <div className="flex justify-between"><dt className="text-espresso/60">Delivery</dt><dd>{order.shipping > 0 ? money(order.shipping) : 'Free'}</dd></div>
      <div className="flex justify-between border-t border-walnut/10 pt-3 text-base font-medium text-walnut"><dt>Total</dt><dd>{money(order.total)}</dd></div>
    </dl>
  );
}

export default function OrderView({ order }: { order: Order }) {
  const { money, general } = useStore();
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);
  const step = FLOW.indexOf(order.status as (typeof FLOW)[number]);
  const closed = order.status === 'cancelled' || order.status === 'returned';
  const wa = whatsappLink(general.whatsapp, `Hello Woodture! I have a question about my order ${order.order_number}.`);
  const canPayOnline = order.payment_method === 'online' && !closed && ['pending', 'failed', 'unpaid'].includes(order.payment_status);

  const pay = async () => {
    setPaying(true); setPayError('');
    try { window.location.href = (await startOnlinePayment(order.order_number, order.phone)).url; }
    catch (e) { setPayError(errorMessage(e)); setPaying(false); }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label !mb-1">Order number</p>
            <p className="font-display text-2xl text-walnut">{order.order_number}</p>
            <p className="mt-1 text-xs text-espresso/50">Placed {formatDate(order.created_at, true)}</p>
          </div>
          <div className="flex flex-wrap gap-2"><StatusBadge status={order.status} /><StatusBadge status={order.payment_status} /></div>
        </div>

        {closed ? (
          <Notice>This order was {order.status}.</Notice>
        ) : (
          <ol className="mt-8 grid grid-cols-5 gap-1" aria-label="Order progress">
            {FLOW.map((s, i) => (
              <li key={s} className="relative flex flex-col items-center text-center">
                {i > 0 && <span className={cx('absolute right-1/2 top-4 z-0 h-0.5 w-full', i <= step ? 'bg-wood' : 'bg-walnut/10')} />}
                <span className={cx('relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium', i <= step ? 'bg-wood text-ivory' : 'bg-cream text-espresso/40')}>
                  {i <= step ? <Check size={15} /> : i + 1}
                </span>
                <span className={cx('mt-2 text-[10.5px] leading-tight sm:text-xs', i <= step ? 'text-walnut' : 'text-espresso/40')}>{FLOW_LABEL[s]}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="card p-6 sm:p-8">
          <h3 className="mb-5 text-xl text-walnut">Items</h3>
          <ul className="divide-y divide-walnut/10">
            {order.items.map(i => (
              <li key={i.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream">{i.product_image && <img src={i.product_image} alt="" className="h-full w-full object-cover" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg text-walnut">{i.product_name}</span>
                  <span className="text-xs text-espresso/55">{money(i.unit_price)} × {i.quantity}</span>
                </span>
                <span className="text-sm font-medium text-walnut">{money(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-walnut/10 pt-5"><OrderTotals order={order} /></div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-3 text-xl text-walnut">Delivery</h3>
            <p className="text-sm leading-relaxed text-espresso/70">
              {order.customer_name}<br />{order.phone}<br />{order.address}<br />{order.city}{order.postal_code ? ` ${order.postal_code}` : ''}
            </p>
            {order.notes && <p className="mt-3 text-xs text-espresso/55">Note: {order.notes}</p>}
          </div>
          <div className="card p-6">
            <h3 className="mb-3 text-xl text-walnut">Payment</h3>
            <p className="text-sm text-espresso/70">{PAYMENT_LABEL[order.payment_method]}</p>
            {order.payment?.payer_ref && <p className="mt-1 text-xs text-espresso/55">Transaction ID: {order.payment.payer_ref}</p>}
            {order.payment_method === 'manual' && order.payment_status === 'pending' && <p className="mt-2 text-xs text-espresso/55">We will confirm your payment shortly.</p>}
            {canPayOnline && <button onClick={pay} disabled={paying} className="btn-primary btn-sm mt-4 w-full">{paying ? 'Redirecting…' : 'Pay now'}</button>}
            {payError && <p className="mt-2 text-xs text-red-700">{payError}</p>}
          </div>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn w-full border border-[#1FAF57]/40 !normal-case !tracking-normal text-[#157a3c] hover:bg-[#1FAF57]/10">
              <MessageCircle size={16} />Questions? Message us on WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
