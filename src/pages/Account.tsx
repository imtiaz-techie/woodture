import { Heart, LogOut, MapPin, Package, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Empty, Field, Modal, Notice, PageHeader, PageLoader, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { myOrders } from '../lib/api';
import { db } from '../lib/backend';
import { useSeo } from '../lib/seo';
import type { Address, Order } from '../lib/types';
import { cx, errorMessage, formatDate } from '../lib/utils';

type Tab = 'orders' | 'profile' | 'addresses';

function OrdersTab({ userId }: { userId: string }) {
  const { money } = useStore();
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => { myOrders(userId).then(setOrders).catch(() => setOrders([])); }, [userId]);
  if (!orders) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!orders.length) return <Empty icon={<Package size={26} />} title="No orders yet" text="When you place an order it will appear here." action={<Link to="/shop" className="btn-primary btn-sm">Start exploring</Link>} />;
  return (
    <ul className="space-y-4">
      {orders.map(o => (
        <li key={o.id}>
          <Link to={`/order/${o.order_number}`} className="card flex flex-wrap items-center gap-4 p-5 transition hover:shadow-soft">
            <div className="flex -space-x-3">
              {o.items.slice(0, 3).map(i => (
                <span key={i.id} className="h-14 w-14 overflow-hidden rounded-xl border-2 border-white bg-cream">{i.product_image && <img src={i.product_image} alt="" className="h-full w-full object-cover" />}</span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg text-walnut">{o.order_number}</p>
              <p className="text-xs text-espresso/55">{formatDate(o.created_at)} · {o.items.reduce((s, i) => s + i.quantity, 0)} item(s)</p>
            </div>
            <StatusBadge status={o.status} />
            <p className="font-medium text-walnut">{money(o.total)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProfileTab() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await db.update('profiles', { id: user!.id }, { full_name: name.trim(), phone: phone.trim() });
      if (password) { await db.auth.updatePassword(password); setPassword(''); }
      await refreshProfile();
      setMsg({ tone: 'ok', text: 'Your profile has been updated.' });
    } catch (err) { setMsg({ tone: 'error', text: errorMessage(err) }); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="card max-w-xl space-y-4 p-6 sm:p-8">
      <Field label="Email"><input disabled className="input" value={user?.email ?? ''} /></Field>
      <Field label="Full name"><input required className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Phone"><input type="tel" className="input" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      <Field label="New password" hint="(leave blank to keep current)"><input type="password" minLength={8} autoComplete="new-password" className="input" value={password} onChange={e => setPassword(e.target.value)} /></Field>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}

const EMPTY_ADDRESS = { label: '', full_name: '', phone: '', address: '', city: '', postal_code: '', is_default: false };

function AddressesTab({ userId }: { userId: string }) {
  const [list, setList] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<(typeof EMPTY_ADDRESS & { id?: string }) | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => db.select<Address>('addresses', { eq: { user_id: userId }, order: [['created_at', 'asc']] }).then(setList).catch(() => setList([])), [userId]);
  useEffect(() => { void load(); }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      const { id, ...data } = editing;
      if (data.is_default) await db.update('addresses', { user_id: userId }, { is_default: false });
      if (id) await db.update('addresses', { id }, data);
      else await db.insert('addresses', { ...data, user_id: userId });
      setEditing(null);
      await load();
    } catch (err) { setError(errorMessage(err)); }
  };
  const bind = (k: 'label' | 'full_name' | 'phone' | 'address' | 'city' | 'postal_code') => ({
    value: editing?.[k] ?? '', onChange: (e: { target: { value: string } }) => setEditing(a => a && { ...a, [k]: e.target.value }),
  });

  if (!list) return <div className="flex justify-center py-16"><Spinner /></div>;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map(a => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-lg text-walnut">{a.label || 'Address'}{a.is_default && <span className="ml-2 rounded-full bg-cream px-2 py-0.5 font-sans text-[10px] uppercase tracking-wider text-wood">Default</span>}</p>
              <div className="flex gap-1">
                <button aria-label="Edit address" onClick={() => setEditing({ ...EMPTY_ADDRESS, ...a, label: a.label ?? '', postal_code: a.postal_code ?? '' })} className="rounded-full p-2 text-espresso/50 hover:bg-cream hover:text-walnut"><Pencil size={15} /></button>
                <button aria-label="Delete address" onClick={async () => { if (confirm('Delete this address?')) { await db.remove('addresses', { id: a.id }); void load(); } }} className="rounded-full p-2 text-espresso/50 hover:bg-cream hover:text-red-700"><Trash2 size={15} /></button>
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-espresso/70">{a.full_name}<br />{a.phone}<br />{a.address}<br />{a.city} {a.postal_code}</p>
          </div>
        ))}
        <button onClick={() => setEditing({ ...EMPTY_ADDRESS, is_default: !list.length })} className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-walnut/25 text-sm text-wood transition hover:bg-cream/60">
          <Plus size={20} />Add address
        </button>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Address">
        <form onSubmit={save} className="space-y-4 p-7">
          <h2 className="text-2xl text-walnut">{editing?.id ? 'Edit address' : 'New address'}</h2>
          <Field label="Label" hint="(e.g. Home, Office)"><input className="input" {...bind('label')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input required className="input" {...bind('full_name')} /></Field>
            <Field label="Phone"><input required type="tel" className="input" {...bind('phone')} /></Field>
          </div>
          <Field label="Address"><textarea required rows={2} className="input" {...bind('address')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City / District"><input required className="input" {...bind('city')} /></Field>
            <Field label="Postal code" hint="(optional)"><input className="input" {...bind('postal_code')} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-espresso/70">
            <input type="checkbox" className="accent-[#9B6339]" checked={editing?.is_default ?? false} onChange={e => setEditing(a => a && { ...a, is_default: e.target.checked })} />Use as my default address
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full">Save address</button>
        </form>
      </Modal>
    </>
  );
}

export default function Account() {
  const { user, profile, isAdmin, loading } = useAuth();
  const { wishlist } = useShop();
  const [tab, setTab] = useState<Tab>('orders');
  const navigate = useNavigate();
  useSeo('My Account');
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login?next=/account" replace />;

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'orders', label: 'Orders', icon: <Package size={16} /> },
    { id: 'profile', label: 'Profile', icon: <UserRound size={16} /> },
    { id: 'addresses', label: 'Addresses', icon: <MapPin size={16} /> },
  ];
  const item = 'flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-sm transition lg:rounded-xl';
  return (
    <>
      <PageHeader eyebrow="My Account" title={`Hello, ${profile?.full_name?.split(' ')[0] || 'there'}`} />
      <div className="container-x grid gap-8 py-10 sm:py-14 lg:grid-cols-[220px_1fr] lg:gap-12">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col" aria-label="Account">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cx(item, tab === t.id ? 'bg-walnut text-ivory' : 'text-espresso/70 hover:bg-cream')}>{t.icon}{t.label}</button>
          ))}
          <Link to="/wishlist" className={cx(item, 'text-espresso/70 hover:bg-cream')}><Heart size={16} />Wishlist ({wishlist.length})</Link>
          {isAdmin && <Link to="/admin/dashboard" className={cx(item, 'text-wood hover:bg-cream')}>Admin dashboard →</Link>}
          <button onClick={async () => { await db.auth.signOut(); navigate('/'); }} className={cx(item, 'text-espresso/70 hover:bg-cream')}><LogOut size={16} />Sign out</button>
        </nav>
        <div>
          {tab === 'orders' && <OrdersTab userId={user.id} />}
          {tab === 'profile' && <ProfileTab />}
          {tab === 'addresses' && <AddressesTab userId={user.id} />}
        </div>
      </div>
    </>
  );
}
