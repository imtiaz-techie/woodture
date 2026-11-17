import { AlertTriangle, Banknote, CheckCircle2, Clock, FileEdit, Globe, Package, ShoppingCart, Sparkles, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/ui';
import { useStore } from '../context/Store';
import { allOrders, fetchCatalog } from '../lib/api';
import { db } from '../lib/backend';
import type { Order, Profile } from '../lib/types';
import { cx, formatDate } from '../lib/utils';
import { AdminPage, LoadState, TableCard, useLoad } from './common';

export const LOW_STOCK = 3;
/** Revenue counts every order that was not cancelled or returned. */
export const countsAsRevenue = (o: Order) => o.status !== 'cancelled' && o.status !== 'returned';

function Stat({ icon, label, value, to, tone }: { icon: ReactNode; label: string; value: string | number; to?: string; tone?: 'warn' }) {
  const body = (
    <div className="card flex h-full items-center gap-4 p-5 transition hover:shadow-soft">
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-cream text-wood')}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-display text-2xl leading-tight text-walnut">{value}</span>
        <span className="block text-xs text-espresso/55">{label}</span>
      </span>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 2.5, 5, 10].map(m => m * pow).find(v => v >= n)!;
}

/** Daily revenue — one series, one hue, hover for exact values. */
function RevenueChart({ orders }: { orders: Order[] }) {
  const { money, general } = useStore();
  const [days, setDays] = useState(30);
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(() => {
    const buckets = new Map<string, { revenue: number; orders: number }>();
    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    for (const o of orders) {
      if (!countsAsRevenue(o)) continue;
      const k = key(new Date(o.created_at));
      const b = buckets.get(k) ?? { revenue: 0, orders: 0 };
      b.revenue += o.total; b.orders += 1;
      buckets.set(k, b);
    }
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (days - 1 - i));
      return { date: d, ...(buckets.get(key(d)) ?? { revenue: 0, orders: 0 }) };
    });
  }, [orders, days]);

  const max = niceCeil(Math.max(...series.map(s => s.revenue)));
  const total = series.reduce((s, d) => s + d.revenue, 0);
  const compact = (n: number) => `${general.currency}${n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : n}`;
  const label = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const active = hover != null ? series[hover] : null;

  return (
    <div className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl text-walnut">Revenue</h2>
          <p className="mt-1 text-xs text-espresso/55">Last {days} days · {money(total)} · excludes cancelled &amp; returned orders</p>
        </div>
        <div className="flex rounded-full border border-walnut/15 p-0.5 text-xs" role="group" aria-label="Date range">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={cx('rounded-full px-3.5 py-1.5 transition', days === d ? 'bg-walnut text-ivory' : 'text-espresso/60 hover:text-walnut')}>{d}d</button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <div className="flex h-52 flex-col justify-between text-right text-[10.5px] tabular-nums text-espresso/45" aria-hidden="true">
          {[1, 0.5, 0].map(f => <span key={f} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{compact(max * f)}</span>)}
        </div>
        <div className="relative h-52 flex-1" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map(f => <span key={f} className="absolute inset-x-0 border-t border-walnut/[0.08]" style={{ bottom: `${f * 100}%` }} />)}
          <div className="absolute inset-0 flex items-end" role="img" aria-label={`Daily revenue for the last ${days} days, total ${money(total)}`}>
            {series.map((s, i) => (
              <div key={i} className="group relative flex h-full flex-1 items-end justify-center px-px" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
                aria-label={`${label(s.date)}: ${money(s.revenue)}, ${s.orders} orders`}>
                <span className={cx('w-full max-w-[28px] rounded-t-[4px] transition-colors', hover === i ? 'bg-walnut' : 'bg-wood')}
                  style={{ height: `${(s.revenue / max) * 100}%`, minHeight: s.revenue > 0 ? 3 : 0 }} />
              </div>
            ))}
          </div>
          {active && hover != null && (
            <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-espresso px-3 py-2 text-xs text-ivory shadow-lift"
              style={{ left: `${Math.min(88, Math.max(12, ((hover + 0.5) / series.length) * 100))}%` }}>
              <span className="block text-cream/70">{label(active.date)}</span>
              <span className="block font-medium">{money(active.revenue)}</span>
              <span className="block text-cream/70">{active.orders} order{active.orders === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>
      </div>
      <div className="ml-10 mt-2 flex justify-between text-[10.5px] text-espresso/45" aria-hidden="true">
        <span>{label(series[0].date)}</span><span>{label(series[Math.floor(series.length / 2)].date)}</span><span>Today</span>
      </div>
    </div>
  );
}

export default function Overview() {
  const { money } = useStore();
  const { data, loading, error } = useLoad(async () => {
    const [orders, catalog, profiles] = await Promise.all([allOrders(), fetchCatalog(true), db.select<Profile>('profiles')]);
    return { orders, products: catalog.products, customers: profiles.filter(p => p.role !== 'admin').length };
  });
  if (!data) return <AdminPage title="Overview"><LoadState loading={loading} error={error} /></AdminPage>;

  const { orders, products } = data;
  const revenue = orders.filter(countsAsRevenue).reduce((s, o) => s + o.total, 0);
  const published = products.filter(p => p.status === 'published');
  const low = published.filter(p => p.stock <= LOW_STOCK);

  return (
    <AdminPage title="Overview" text="A live summary of your store, calculated from real orders and products.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat icon={<Banknote size={20} />} label="Total revenue" value={money(revenue)} to="/admin/payments" />
        <Stat icon={<ShoppingCart size={20} />} label="Total orders" value={orders.length} to="/admin/orders" />
        <Stat icon={<Clock size={20} />} label="Pending orders" value={orders.filter(o => o.status === 'pending').length} to="/admin/orders?status=pending" tone={orders.some(o => o.status === 'pending') ? 'warn' : undefined} />
        <Stat icon={<CheckCircle2 size={20} />} label="Completed orders" value={orders.filter(o => o.status === 'delivered').length} to="/admin/orders?status=delivered" />
        <Stat icon={<Users size={20} />} label="Total customers" value={data.customers} to="/admin/customers" />
        <Stat icon={<Package size={20} />} label="Total products" value={products.length} to="/admin/products" />
        <Stat icon={<Globe size={20} />} label="Published products" value={published.length} to="/admin/products" />
        <Stat icon={<FileEdit size={20} />} label="Draft products" value={products.length - published.length} to="/admin/products" />
        <Stat icon={<AlertTriangle size={20} />} label="Low stock products" value={low.length} to="/admin/inventory" tone={low.length ? 'warn' : undefined} />
        <Stat icon={<Sparkles size={20} />} label="New arrivals" value={published.filter(p => p.is_new_arrival).length} to="/admin/products" />
      </div>

      <div className="mt-6"><RevenueChart orders={orders} /></div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl text-walnut">Recent orders</h2>
          <Link to="/admin/orders" className="text-xs font-medium uppercase tracking-[0.14em] text-wood hover:text-walnut">View all →</Link>
        </div>
        <TableCard head={['Order', 'Customer', 'Date', 'Status', 'Payment', 'Total']} empty={!orders.length}>
          {orders.slice(0, 8).map(o => (
            <tr key={o.id} className="hover:bg-cream/30">
              <td><Link to={`/admin/orders?open=${o.order_number}`} className="font-medium text-walnut hover:text-wood">{o.order_number}</Link></td>
              <td>{o.customer_name}</td>
              <td className="whitespace-nowrap text-espresso/60">{formatDate(o.created_at)}</td>
              <td><StatusBadge status={o.status} /></td>
              <td><StatusBadge status={o.payment_status} /></td>
              <td className="font-medium tabular-nums">{money(o.total)}</td>
            </tr>
          ))}
        </TableCard>
      </div>
    </AdminPage>
  );
}
