import { Ban, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OrderTotals, PAYMENT_LABEL } from '../components/OrderView';
import { Field, Modal, StatusBadge } from '../components/ui';
import { useStore } from '../context/Store';
import { allOrders } from '../lib/api';
import { db } from '../lib/backend';
import { ORDER_STATUSES, PAYMENT_STATUSES, type GeneralSettings, type Order, type OrderStatus, type PaymentStatus } from '../lib/types';
import { cap, formatDate } from '../lib/utils';
import { AdminPage, LoadState, SearchInput, TableCard, selectSm, useAction, useLoad } from './common';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function printInvoice(o: Order, g: GeneralSettings, money: (n: number) => string) {
  const rows = o.items.map(i => `<tr><td>${esc(i.product_name)}${i.sku ? `<br><small>SKU ${esc(i.sku)}</small>` : ''}</td><td class="r">${money(i.unit_price)}</td><td class="r">${i.quantity}</td><td class="r">${money(i.line_total)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(o.order_number)}</title><style>
    body{font-family:Inter,Arial,sans-serif;color:#241810;margin:40px;font-size:13px;line-height:1.5}
    h1{font-family:Georgia,serif;font-weight:400;color:#4B2818;margin:0;font-size:28px} h2{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#9B6339;margin:0 0 6px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4B2818;padding-bottom:18px;margin-bottom:24px}
    .cols{display:flex;gap:40px;margin-bottom:24px}.cols div{flex:1} table{width:100%;border-collapse:collapse} th{font-size:10px;letter-spacing:.14em;text-transform:uppercase;text-align:left;color:#9B6339;border-bottom:1px solid #ccc;padding:8px 0}
    td{padding:10px 0;border-bottom:1px solid #eee;vertical-align:top}.r{text-align:right} small{color:#888}
    .tot{margin-left:auto;width:260px;margin-top:16px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .g{font-weight:600;font-size:15px;border-top:2px solid #4B2818;margin-top:6px;padding-top:8px}
    footer{margin-top:48px;text-align:center;color:#888;font-size:11px}
  </style></head><body>
  <div class="top"><div><h1>${esc(g.business_name)}</h1><div>${esc(g.tagline)}</div><small>${[g.address, g.phone, g.email].filter(Boolean).map(esc).join(' · ')}</small></div>
  <div class="r"><h2>Invoice</h2><div><strong>${esc(o.order_number)}</strong></div><div>${esc(formatDate(o.created_at))}</div></div></div>
  <div class="cols"><div><h2>Bill / Ship to</h2>${esc(o.customer_name)}<br>${esc(o.phone)}${o.email ? `<br>${esc(o.email)}` : ''}<br>${esc(o.address)}<br>${esc(o.city)} ${esc(o.postal_code)}</div>
  <div><h2>Payment</h2>${esc(PAYMENT_LABEL[o.payment_method])}<br>Status: ${esc(cap(o.payment_status))}<br>Order status: ${esc(cap(o.status))}</div></div>
  <table><thead><tr><th>Item</th><th class="r">Price</th><th class="r">Qty</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>${o.discount > 0 ? `<div><span>Discount</span><span>−${money(o.discount)}</span></div>` : ''}
  <div><span>Delivery</span><span>${money(o.shipping)}</span></div><div class="g"><span>Total</span><span>${money(o.total)}</span></div></div>
  <footer>Thank you for choosing ${esc(g.business_name)}.</footer>
  <script>window.onload=function(){window.print()}<\/script></body></html>`;
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return alert('Please allow pop-ups to print invoices.');
  w.document.write(html);
  w.document.close();
}

function OrderDetail({ order, onSaved }: { order: Order; onSaved: () => Promise<void> }) {
  const { money, general, refresh } = useStore();
  const run = useAction();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [payment, setPayment] = useState<PaymentStatus>(order.payment_status);
  const [notes, setNotes] = useState(order.internal_notes ?? '');
  const final = order.status === 'cancelled' || order.status === 'returned';
  const dirty = status !== order.status || payment !== order.payment_status || notes !== (order.internal_notes ?? '');

  const save = (patch: Partial<Order>, msg: string) => run(async () => {
    await db.update('orders', { id: order.id }, patch);
    await onSaved();
    void refresh(); // stock / sales counts may have changed
  }, msg);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
        <div>
          <h2 className="text-2xl text-walnut">{order.order_number}</h2>
          <p className="text-xs text-espresso/50">{formatDate(order.created_at, true)} · {PAYMENT_LABEL[order.payment_method]}</p>
        </div>
        <div className="flex gap-2"><StatusBadge status={order.status} /><StatusBadge status={order.payment_status} /></div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-cream/50 p-4 text-sm leading-relaxed">
          <p className="label">Customer &amp; delivery</p>
          <p className="font-medium text-walnut">{order.customer_name}</p>
          <p><a href={`tel:${order.phone}`} className="text-wood">{order.phone}</a>{order.email && <> · {order.email}</>}</p>
          <p className="mt-1.5 text-espresso/75">{order.address}<br />{order.city} {order.postal_code} · {order.delivery_zone === 'inside' ? 'Inside Dhaka' : 'Outside Dhaka'}</p>
          {order.notes && <p className="mt-2 rounded-lg bg-white p-2 text-xs text-espresso/70">Customer note: {order.notes}</p>}
          {order.payment?.payer_ref && <p className="mt-2 text-xs">Payment reference ({order.payment.provider}): <strong>{order.payment.payer_ref}</strong></p>}
        </div>
        <div>
          <ul className="divide-y divide-walnut/10 text-sm">
            {order.items.map(i => (
              <li key={i.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-cream">{i.product_image && <img src={i.product_image} alt="" className="h-full w-full object-cover" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-walnut">{i.product_name}</span><span className="text-xs text-espresso/50">{money(i.unit_price)} × {i.quantity}{i.sku && ` · ${i.sku}`}</span></span>
                <span className="tabular-nums">{money(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-walnut/10 pt-3"><OrderTotals order={order} /></div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-t border-walnut/10 pt-6 sm:grid-cols-2">
        <Field label="Order status">
          <select className="input" value={status} disabled={final} onChange={e => setStatus(e.target.value as OrderStatus)}>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </Field>
        <Field label="Payment status">
          <select className="input" value={payment} onChange={e => setPayment(e.target.value as PaymentStatus)}>
            {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </Field>
        <Field label="Internal notes" hint="(never shown to the customer)" className="sm:col-span-2">
          <textarea rows={2} className="input" value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
      </div>
      {final && <p className="mt-2 text-xs text-espresso/50">This order is {order.status}; its stock has been returned to inventory and the status is final.</p>}
      {!final && (status === 'cancelled' || status === 'returned') && <p className="mt-2 text-xs text-amber-700">Saving will return this order’s items to stock. This cannot be undone.</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn-primary btn-sm" disabled={!dirty} onClick={() => save({ status, payment_status: payment, internal_notes: notes.trim() || null }, 'Order updated')}>Save changes</button>
        <button className="btn-outline btn-sm" onClick={() => printInvoice(order, general, money)}><Printer size={14} />Print invoice</button>
        {!final && order.status !== 'delivered' && (
          <button className="btn btn-sm ml-auto border border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => { if (confirm('Cancel this order and return its items to stock?')) void save({ status: 'cancelled' }, 'Order cancelled — stock restored'); }}>
            <Ban size={14} />Cancel order
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const { money } = useStore();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useLoad(allOrders);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const status = params.get('status') ?? '';
  const openNumber = params.get('open');
  const open = data?.find(o => o.order_number === openNumber) ?? null;

  const setParam = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };
  useEffect(() => { if (data && openNumber && !open) setParam('open', ''); }, [data, openNumber, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (data ?? []).filter(o => {
    if (status && o.status !== status) return false;
    if (from && new Date(o.created_at) < new Date(`${from}T00:00:00`)) return false;
    if (to && new Date(o.created_at) > new Date(`${to}T23:59:59`)) return false;
    if (q) {
      const hay = `${o.order_number} ${o.customer_name} ${o.phone} ${o.email ?? ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [data, q, status, from, to]);

  return (
    <AdminPage title="Orders" text="Stock is reserved when an order is placed and restored automatically if it is cancelled or returned.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search order, name or phone" />
        <select className={selectSm} value={status} onChange={e => setParam('status', e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-espresso/55">From<input type="date" className={selectSm} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-xs text-espresso/55">To<input type="date" className={selectSm} value={to} onChange={e => setTo(e.target.value)} /></label>
        <span className="ml-auto text-xs text-espresso/50">{rows.length} order{rows.length === 1 ? '' : 's'}</span>
      </div>
      <LoadState loading={loading} error={error} />
      {data && (
        <TableCard head={['Order', 'Customer', 'Date', 'Items', 'Status', 'Payment', 'Total']} empty={!rows.length}>
          {rows.map(o => (
            <tr key={o.id} className="cursor-pointer hover:bg-cream/30" onClick={() => setParam('open', o.order_number)}>
              <td><button className="font-medium text-walnut hover:text-wood">{o.order_number}</button></td>
              <td>{o.customer_name}<span className="block text-xs text-espresso/45">{o.phone}</span></td>
              <td className="whitespace-nowrap text-espresso/60">{formatDate(o.created_at, true)}</td>
              <td className="tabular-nums">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
              <td><StatusBadge status={o.status} /></td>
              <td><StatusBadge status={o.payment_status} /><span className="mt-0.5 block text-[11px] text-espresso/45">{PAYMENT_LABEL[o.payment_method]}</span></td>
              <td className="font-medium tabular-nums">{money(o.total)}</td>
            </tr>
          ))}
        </TableCard>
      )}
      <Modal open={!!open} onClose={() => setParam('open', '')} wide title="Order details">
        {open && <OrderDetail key={open.id + open.updated_at} order={open} onSaved={reload} />}
      </Modal>
    </AdminPage>
  );
}
