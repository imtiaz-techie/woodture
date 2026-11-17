import { Check, Copy, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field, Modal, Notice, Stars, StatusBadge } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { allOrders, allPayments, fetchCatalog } from '../lib/api';
import { db } from '../lib/backend';
import { PAYMENT_STATUSES, type Coupon, type Inquiry, type PaymentStatus, type Profile, type Review } from '../lib/types';
import { cap, cx, errorMessage, formatDate } from '../lib/utils';
import { AdminPage, LoadState, SearchInput, Section, TableCard, Toggle, iconBtn, selectSm, useAction, useLoad } from './common';
import { countsAsRevenue } from './Overview';

// ----------------------------------------------------------------- customers
export function Customers() {
  const { money } = useStore();
  const { data, loading, error } = useLoad(async () => {
    const [profiles, orders] = await Promise.all([db.select<Profile>('profiles', { order: [['created_at', 'desc']] }), allOrders()]);
    return { profiles, orders };
  });
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data?.profiles ?? []).filter(p => p.role !== 'admin' &&
    (!q || `${p.full_name ?? ''} ${p.email ?? ''} ${p.phone ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [data, q]);
  const guests = new Set((data?.orders ?? []).filter(o => !o.user_id).map(o => o.phone.replace(/\D/g, ''))).size;

  return (
    <AdminPage title="Customers" text={data ? `${rows.length} registered customer(s) · ${guests} guest buyer(s) by phone number` : undefined}>
      <div className="mb-4"><SearchInput value={q} onChange={setQ} placeholder="Search name, email or phone" /></div>
      <LoadState loading={loading} error={error} />
      {data && (
        <TableCard head={['Customer', 'Phone', 'Joined', 'Orders', 'Total spent']} empty={!rows.length}>
          {rows.map(p => {
            const mine = data.orders.filter(o => o.user_id === p.id);
            return (
              <tr key={p.id}>
                <td><span className="block font-medium text-walnut">{p.full_name || '—'}</span><span className="text-xs text-espresso/50">{p.email}</span></td>
                <td>{p.phone || '—'}</td>
                <td className="whitespace-nowrap text-espresso/60">{formatDate(p.created_at)}</td>
                <td className="tabular-nums">{mine.length}</td>
                <td className="font-medium tabular-nums">{money(mine.filter(countsAsRevenue).reduce((s, o) => s + o.total, 0))}</td>
              </tr>
            );
          })}
        </TableCard>
      )}
    </AdminPage>
  );
}

// ------------------------------------------------------------------ payments
export function Payments() {
  const { money } = useStore();
  const { data, loading, error, reload } = useLoad(async () => {
    const [payments, orders] = await Promise.all([allPayments(), allOrders()]);
    return { payments, orders };
  });
  const run = useAction();
  const [status, setStatus] = useState('');
  const rows = (data?.payments ?? []).filter(p => !status || p.status === status);
  const paid = (data?.payments ?? []).filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <AdminPage title="Payments" text={data ? `Collected (paid): ${money(paid)}. Gateways are configured under Website Settings.` : undefined}>
      <div className="mb-4">
        <select className={selectSm} value={status} onChange={e => setStatus(e.target.value)} aria-label="Payment status filter">
          <option value="">All payment statuses</option>
          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
      </div>
      <LoadState loading={loading} error={error} />
      {data && (
        <TableCard head={['Order', 'Date', 'Method', 'Reference', 'Amount', 'Status', 'Set status']} empty={!rows.length}>
          {rows.map(p => {
            const order = data.orders.find(o => o.id === p.order_id);
            return (
              <tr key={p.id}>
                <td>{order ? <Link to={`/admin/orders?open=${order.order_number}`} className="font-medium text-walnut hover:text-wood">{order.order_number}</Link> : '—'}<span className="block text-xs text-espresso/45">{order?.customer_name}</span></td>
                <td className="whitespace-nowrap text-espresso/60">{formatDate(p.created_at, true)}</td>
                <td className="capitalize">{p.provider || p.method}</td>
                <td className="text-xs">{p.transaction_ref || p.payer_ref || '—'}</td>
                <td className="font-medium tabular-nums">{money(Number(p.amount))}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  <select className={selectSm} value={p.status} aria-label="Set payment status"
                    onChange={e => run(async () => { await db.update('orders', { id: p.order_id }, { payment_status: e.target.value as PaymentStatus }); await reload(); }, 'Payment status updated')}>
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </TableCard>
      )}
    </AdminPage>
  );
}

// ------------------------------------------------------------------- coupons
const BLANK_COUPON = { code: '', type: 'percent' as 'percent' | 'fixed', value: '', min_order: '', starts_at: '', expires_at: '', usage_limit: '', is_active: true };
const toLocal = (iso?: string | null) => (iso ? new Date(+new Date(iso) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export function Coupons() {
  const { money } = useStore();
  const { data, loading, error, reload } = useLoad(() => db.select<Coupon>('coupons', { order: [['created_at', 'desc']] }));
  const run = useAction();
  const [editing, setEditing] = useState<(typeof BLANK_COUPON & { id?: string }) | null>(null);
  const [formError, setFormError] = useState('');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const value = Number(editing.value);
    if (!(value > 0)) return setFormError('Enter a discount value greater than zero.');
    if (editing.type === 'percent' && value > 100) return setFormError('A percentage discount cannot exceed 100%.');
    if (editing.starts_at && editing.expires_at && new Date(editing.expires_at) <= new Date(editing.starts_at)) return setFormError('The expiry date must be after the start date.');
    const row = {
      code: editing.code.trim().toUpperCase().replace(/\s+/g, ''), type: editing.type, value,
      min_order: Number(editing.min_order) || 0,
      starts_at: editing.starts_at ? new Date(editing.starts_at).toISOString() : null,
      expires_at: editing.expires_at ? new Date(editing.expires_at).toISOString() : null,
      usage_limit: editing.usage_limit === '' ? null : Math.max(1, Math.floor(Number(editing.usage_limit))),
      is_active: editing.is_active,
    };
    try {
      if (editing.id) await db.update('coupons', { id: editing.id }, row);
      else await db.insert('coupons', row);
      setEditing(null);
      await reload();
    } catch (err) { setFormError(errorMessage(err).includes('duplicate') ? 'This coupon code already exists.' : errorMessage(err)); }
  };
  const state = (c: Coupon) => !c.is_active ? 'hidden' : c.expires_at && new Date(c.expires_at) < new Date() ? 'rejected'
    : c.usage_limit != null && c.used_count >= c.usage_limit ? 'rejected' : c.starts_at && new Date(c.starts_at) > new Date() ? 'pending' : 'approved';
  const stateLabel: Record<string, string> = { hidden: 'Disabled', rejected: 'Expired / used up', pending: 'Scheduled', approved: 'Active' };
  const bind = (k: 'code' | 'value' | 'min_order' | 'starts_at' | 'expires_at' | 'usage_limit') => ({
    value: editing?.[k] ?? '', onChange: (e: { target: { value: string } }) => setEditing(c => c && { ...c, [k]: e.target.value }),
  });

  return (
    <AdminPage title="Discounts & Coupons" text="Codes customers can enter in the cart. Product sale prices are set on each product."
      action={<button className="btn-primary btn-sm" onClick={() => { setFormError(''); setEditing(BLANK_COUPON); }}><Plus size={15} />New coupon</button>}>
      <LoadState loading={loading} error={error} />
      {data && (
        <TableCard head={['Code', 'Discount', 'Min. order', 'Valid', 'Used', 'State', '']} empty={!data.length}>
          {data.map(c => (
            <tr key={c.id}>
              <td className="font-medium tracking-wider text-walnut">{c.code}</td>
              <td>{c.type === 'percent' ? `${Number(c.value)}%` : money(Number(c.value))}</td>
              <td>{Number(c.min_order) > 0 ? money(Number(c.min_order)) : '—'}</td>
              <td className="text-xs text-espresso/60">{c.starts_at ? formatDate(c.starts_at) : 'Now'} → {c.expires_at ? formatDate(c.expires_at) : 'No expiry'}</td>
              <td className="tabular-nums">{c.used_count}{c.usage_limit != null && ` / ${c.usage_limit}`}</td>
              <td><span className={cx('text-xs font-medium', state(c) === 'approved' ? 'text-emerald-800' : state(c) === 'pending' ? 'text-amber-700' : 'text-espresso/50')}>{stateLabel[state(c)]}</span></td>
              <td>
                <div className="flex justify-end">
                  <button className={iconBtn} aria-label={`Edit ${c.code}`} onClick={() => { setFormError(''); setEditing({ id: c.id, code: c.code, type: c.type, value: String(Number(c.value)), min_order: Number(c.min_order) ? String(Number(c.min_order)) : '', starts_at: toLocal(c.starts_at), expires_at: toLocal(c.expires_at), usage_limit: c.usage_limit == null ? '' : String(c.usage_limit), is_active: c.is_active }); }}><Pencil size={15} /></button>
                  <button className={cx(iconBtn, 'hover:!text-red-700')} aria-label={`Delete ${c.code}`} onClick={() => { if (confirm(`Delete coupon ${c.code}?`)) void run(async () => { await db.remove('coupons', { id: c.id }); await reload(); }, 'Coupon deleted'); }}><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </TableCard>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Coupon">
        {editing && (
          <form onSubmit={save} className="space-y-4 p-7">
            <h2 className="text-2xl text-walnut">{editing.id ? 'Edit coupon' : 'New coupon'}</h2>
            <Field label="Coupon code"><input required minLength={3} maxLength={30} className="input uppercase tracking-wider" placeholder="WELCOME10" {...bind('code')} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <select className="input" value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as 'percent' | 'fixed' })}>
                  <option value="percent">Percentage (%)</option><option value="fixed">Fixed amount</option>
                </select>
              </Field>
              <Field label={editing.type === 'percent' ? 'Percent off' : 'Amount off'}><input required type="number" min={0} step="0.01" className="input" {...bind('value')} /></Field>
              <Field label="Minimum order" hint="(optional)"><input type="number" min={0} className="input" {...bind('min_order')} /></Field>
              <Field label="Usage limit" hint="(optional)"><input type="number" min={1} step={1} className="input" placeholder="Unlimited" {...bind('usage_limit')} /></Field>
              <Field label="Starts" hint="(optional)"><input type="datetime-local" className="input" {...bind('starts_at')} /></Field>
              <Field label="Expires" hint="(optional)"><input type="datetime-local" className="input" {...bind('expires_at')} /></Field>
            </div>
            <Toggle checked={editing.is_active} onChange={v => setEditing({ ...editing, is_active: v })} label="Coupon is active" />
            {formError && <Notice tone="error">{formError}</Notice>}
            <button className="btn-primary w-full">Save coupon</button>
          </form>
        )}
      </Modal>
    </AdminPage>
  );
}

// ------------------------------------------------------------------- reviews
export function Reviews() {
  const { data, loading, error, reload } = useLoad(async () => {
    const [reviews, catalog] = await Promise.all([db.select<Review>('reviews', { order: [['created_at', 'desc']] }), fetchCatalog(true)]);
    return { reviews, products: catalog.products };
  });
  const run = useAction();
  const [status, setStatus] = useState('');
  const rows = (data?.reviews ?? []).filter(r => !status || r.status === status);
  const set = (r: Review, s: Review['status']) => run(async () => { await db.update('reviews', { id: r.id }, { status: s }); await reload(); }, `Review ${s}`);

  return (
    <AdminPage title="Reviews" text="Only approved reviews from customers with a delivered order appear on the website.">
      <div className="mb-4">
        <select className={selectSm} value={status} onChange={e => setStatus(e.target.value)} aria-label="Review status filter">
          <option value="">All reviews</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="hidden">Hidden</option>
        </select>
      </div>
      <LoadState loading={loading} error={error} />
      {data && !rows.length && <div className="card px-4 py-12 text-center text-sm text-espresso/50">No reviews yet.</div>}
      <div className="space-y-4">
        {rows.map(r => (
          <article key={r.id} className="card flex flex-col gap-4 p-5 sm:flex-row">
            {r.image_url && <a href={r.image_url} target="_blank" rel="noreferrer"><img src={r.image_url} alt="Review" className="h-24 w-24 rounded-xl object-cover" /></a>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <Stars value={r.rating} /><StatusBadge status={r.status} />
                <span className="text-xs text-espresso/50">{formatDate(r.created_at)}</span>
              </div>
              <p className="mt-1.5 text-sm"><strong className="text-walnut">{r.customer_name}</strong> on <span className="text-wood">{data!.products.find(p => p.id === r.product_id)?.name ?? 'Deleted product'}</span></p>
              <p className="mt-2 text-sm leading-relaxed text-espresso/75">{r.body}</p>
            </div>
            <div className="flex shrink-0 gap-1 sm:flex-col">
              {r.status !== 'approved' && <button className="btn-outline btn-sm !px-4 !py-2" onClick={() => set(r, 'approved')}><Check size={14} />Approve</button>}
              {r.status === 'pending' && <button className="btn-outline btn-sm !px-4 !py-2" onClick={() => set(r, 'rejected')}><X size={14} />Reject</button>}
              {r.status === 'approved' && <button className="btn-outline btn-sm !px-4 !py-2" onClick={() => set(r, 'hidden')}><EyeOff size={14} />Hide</button>}
              <button className={cx(iconBtn, 'hover:!text-red-700')} aria-label="Delete review" onClick={() => { if (confirm('Delete this review?')) void run(async () => { await db.remove('reviews', { id: r.id }); await reload(); }, 'Review deleted'); }}><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </div>
    </AdminPage>
  );
}

// ------------------------------------------------------------------ messages
export function Messages() {
  const { toast } = useShop();
  const { data, loading, error, reload } = useLoad(() => db.select<Inquiry>('inquiries', { order: [['created_at', 'desc']] }));
  const run = useAction();
  const [tab, setTab] = useState<'contact' | 'newsletter'>('contact');
  const rows = (data ?? []).filter(i => i.kind === tab);
  const emails = [...new Set((data ?? []).filter(i => i.kind === 'newsletter' && i.email).map(i => i.email!))];

  return (
    <AdminPage title="Messages" text="Contact form enquiries and newsletter sign-ups."
      action={tab === 'newsletter' && emails.length ? <button className="btn-outline btn-sm" onClick={() => { void navigator.clipboard.writeText(emails.join(', ')); toast('Email list copied'); }}><Copy size={14} />Copy {emails.length} emails</button> : undefined}>
      <div className="mb-4 flex gap-2">
        {(['contact', 'newsletter'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cx('rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider', tab === t ? 'bg-walnut text-ivory' : 'border border-walnut/15 text-espresso/60')}>
            {t === 'contact' ? 'Enquiries' : 'Newsletter'} ({(data ?? []).filter(i => i.kind === t).length})
          </button>
        ))}
      </div>
      <LoadState loading={loading} error={error} />
      {data && !rows.length && <div className="card px-4 py-12 text-center text-sm text-espresso/50">Nothing here yet.</div>}
      <div className="space-y-3">
        {rows.map(i => (
          <article key={i.id} className={cx('card flex items-start gap-4 p-5', i.status === 'new' && tab === 'contact' && 'border-l-4 border-l-gold')}>
            <div className="min-w-0 flex-1">
              <p className="text-sm"><strong className="text-walnut">{i.name || i.email}</strong>{i.subject && <span className="text-espresso/60"> — {i.subject}</span>}</p>
              <p className="text-xs text-espresso/50">{[i.name && i.email, i.phone, formatDate(i.created_at, true)].filter(Boolean).join(' · ')}</p>
              {i.message && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-espresso/75">{i.message}</p>}
            </div>
            {tab === 'contact' && i.status === 'new' && <button className="btn-outline btn-sm shrink-0 !px-4 !py-2" onClick={() => run(async () => { await db.update('inquiries', { id: i.id }, { status: 'read' }); await reload(); })}>Mark read</button>}
            <button className={cx(iconBtn, 'shrink-0 hover:!text-red-700')} aria-label="Delete" onClick={() => { if (confirm('Delete this entry?')) void run(async () => { await db.remove('inquiries', { id: i.id }); await reload(); }); }}><Trash2 size={15} /></button>
          </article>
        ))}
      </div>
    </AdminPage>
  );
}

// ------------------------------------------------------------- admin profile
export function AdminProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const run = useAction();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');

  return (
    <AdminPage title="Admin Profile">
      <div className="grid max-w-3xl gap-6">
        <Section title="Your details">
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { await db.update('profiles', { id: user!.id }, { full_name: name.trim(), phone: phone.trim() }); await refreshProfile(); }, 'Profile saved'); }}>
            <Field label="Email"><input disabled className="input" value={user?.email ?? ''} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input required className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
              <Field label="Phone"><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
            </div>
            <button className="btn-primary btn-sm">Save details</button>
          </form>
        </Section>
        <Section title="Change password">
          <form className="space-y-4" onSubmit={async e => {
            e.preventDefault(); setError('');
            if (password !== confirmPw) return setError('The two passwords do not match.');
            if (await run(() => db.auth.updatePassword(password), 'Password changed')) { setPassword(''); setConfirmPw(''); }
          }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password"><input required type="password" minLength={8} autoComplete="new-password" className="input" value={password} onChange={e => setPassword(e.target.value)} /></Field>
              <Field label="Confirm password"><input required type="password" minLength={8} autoComplete="new-password" className="input" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} /></Field>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <button className="btn-primary btn-sm">Update password</button>
          </form>
        </Section>
      </div>
    </AdminPage>
  );
}
