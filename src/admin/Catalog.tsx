import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Field, Modal, Notice } from '../components/ui';
import { useStore } from '../context/Store';
import { fetchCatalog } from '../lib/api';
import { db } from '../lib/backend';
import type { Category, InventoryTx, Product } from '../lib/types';
import { cx, errorMessage, formatDate, primaryImage, slugify } from '../lib/utils';
import { AdminPage, ImageInput, LoadState, SearchInput, TableCard, Toggle, iconBtn, selectSm, useAction, useLoad } from './common';
import { LOW_STOCK } from './Overview';

// ---------------------------------------------------------------- categories
const BLANK_CAT = { name: '', slug: '', description: '', image_url: '', is_featured: true, is_active: true };

export function Categories() {
  const { refresh } = useStore();
  const { data, loading, error, reload } = useLoad(() => fetchCatalog(true));
  const run = useAction();
  const [editing, setEditing] = useState<(typeof BLANK_CAT & { id?: string }) | null>(null);
  const [formError, setFormError] = useState('');
  const sync = async () => { await reload(); void refresh(); };
  const cats = data?.categories ?? [];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { id, ...rest } = editing;
    const row = { ...rest, name: rest.name.trim(), slug: slugify(rest.slug || rest.name), description: rest.description.trim() || null, image_url: rest.image_url || null };
    if (cats.some(c => c.slug === row.slug && c.id !== id)) return setFormError('Another category already uses this URL slug.');
    try {
      if (id) await db.update('categories', { id }, row);
      else await db.insert('categories', { ...row, sort_order: Math.max(0, ...cats.map(c => c.sort_order)) + 1 });
      setEditing(null);
      await sync();
    } catch (err) { setFormError(errorMessage(err)); }
  };

  const swap = (a: Category, b?: Category) => b && run(async () => {
    await db.update('categories', { id: a.id }, { sort_order: b.sort_order });
    await db.update('categories', { id: b.id }, { sort_order: a.sort_order });
    await sync();
  });
  const remove = (c: Category, count: number) => {
    if (!confirm(`Delete “${c.name}”?${count ? ` Its ${count} product(s) will stay, without a category.` : ''}`)) return;
    void run(async () => { await db.remove('categories', { id: c.id }); await sync(); }, 'Category deleted');
  };

  return (
    <AdminPage title="Categories" text="Collections shown on the website. Products appear in their category automatically."
      action={<button className="btn-primary btn-sm" onClick={() => { setFormError(''); setEditing(BLANK_CAT); }}><Plus size={15} />Add category</button>}>
      <LoadState loading={loading} error={error} />
      {data && (
        <TableCard head={['Category', 'Products', 'On homepage', 'Visible', 'Order', '']} empty={!cats.length}>
          {cats.map((c, i) => {
            const count = data.products.filter(p => p.category_id === c.id).length;
            return (
              <tr key={c.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-cream">{c.image_url && <img src={c.image_url} alt="" className="h-full w-full object-cover" />}</span>
                    <span><span className="block font-medium text-walnut">{c.name}</span><span className="text-xs text-espresso/45">/{c.slug}</span></span>
                  </div>
                </td>
                <td className="tabular-nums">{count}</td>
                <td><Toggle checked={c.is_featured} label={`Feature ${c.name}`} onChange={v => run(async () => { await db.update('categories', { id: c.id }, { is_featured: v }); await sync(); })} /></td>
                <td><Toggle checked={c.is_active} label={`Show ${c.name}`} onChange={v => run(async () => { await db.update('categories', { id: c.id }, { is_active: v }); await sync(); })} /></td>
                <td>
                  <button className={iconBtn} disabled={i === 0} aria-label="Move up" onClick={() => swap(c, cats[i - 1])}><ArrowUp size={15} /></button>
                  <button className={iconBtn} disabled={i === cats.length - 1} aria-label="Move down" onClick={() => swap(c, cats[i + 1])}><ArrowDown size={15} /></button>
                </td>
                <td>
                  <div className="flex justify-end">
                    <button className={iconBtn} aria-label={`Edit ${c.name}`} onClick={() => { setFormError(''); setEditing({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? '', image_url: c.image_url ?? '', is_featured: c.is_featured, is_active: c.is_active }); }}><Pencil size={15} /></button>
                    <button className={cx(iconBtn, 'hover:!text-red-700')} aria-label={`Delete ${c.name}`} onClick={() => remove(c, count)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </TableCard>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Category">
        {editing && (
          <form onSubmit={save} className="space-y-4 p-7">
            <h2 className="text-2xl text-walnut">{editing.id ? 'Edit category' : 'New category'}</h2>
            <Field label="Name"><input required className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value, slug: editing.id ? editing.slug : slugify(e.target.value) })} /></Field>
            <Field label="URL slug"><input className="input" value={editing.slug} onChange={e => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Description" hint="(optional)"><textarea rows={2} className="input" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div><span className="label">Cover image <span className="normal-case tracking-normal text-espresso/40">(optional — defaults to a product photo)</span></span>
              <ImageInput value={editing.image_url} onChange={url => setEditing({ ...editing, image_url: url })} folder="categories" /></div>
            {formError && <Notice tone="error">{formError}</Notice>}
            <button className="btn-primary w-full">Save category</button>
          </form>
        )}
      </Modal>
    </AdminPage>
  );
}

// ----------------------------------------------------------------- inventory
const REASON: Record<string, string> = { initial: 'Initial stock', manual: 'Manual update', order: 'Order placed', cancel: 'Order cancelled', return: 'Order returned' };

function StockRow({ p, onSave }: { p: Product; onSave: (patch: Partial<Product>, msg: string) => void }) {
  const [value, setValue] = useState(String(p.stock));
  const changed = value !== '' && Number(value) !== p.stock;
  return (
    <tr>
      <td>
        <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-cream">{primaryImage(p) && <img src={primaryImage(p)} alt="" className="h-full w-full object-cover" />}</span>
          <span><span className="block font-medium text-walnut">{p.name}</span><span className="text-xs text-espresso/45">{p.sku || 'No SKU'} · {p.status}</span></span>
        </Link>
      </td>
      <td>
        {p.stock === 0 ? <span className="text-xs font-medium text-red-700">Out of stock</span>
          : p.stock <= LOW_STOCK ? <span className="text-xs font-medium text-amber-700">Low stock</span>
            : <span className="text-xs text-emerald-800">In stock</span>}
      </td>
      <td>
        <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (changed) onSave({ stock: Math.max(0, Math.floor(Number(value))) }, 'Stock updated'); }}>
          <input type="number" min={0} step={1} value={value} onChange={e => setValue(e.target.value)} aria-label={`Stock for ${p.name}`} className="input !w-24 !py-2 tabular-nums" />
          <button className="btn-outline btn-sm !px-4 !py-2" disabled={!changed}>Save</button>
        </form>
      </td>
      <td><Toggle checked={p.is_available} label="Available" onChange={v => onSave({ is_available: v }, v ? 'Marked available' : 'Marked out of stock')} /></td>
    </tr>
  );
}

export function Inventory() {
  const { refresh } = useStore();
  const { data, loading, error, reload } = useLoad(async () => {
    const [catalog, history] = await Promise.all([
      fetchCatalog(true),
      db.select<InventoryTx>('inventory_transactions', { order: [['created_at', 'desc']], limit: 100 }),
    ]);
    return { products: catalog.products, history };
  });
  const run = useAction();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => (data?.products ?? []).filter(p =>
    (!q || `${p.name} ${p.sku ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
    (filter === 'low' ? p.stock > 0 && p.stock <= LOW_STOCK : filter === 'out' ? p.stock === 0 || !p.is_available : true),
  ).sort((a, b) => a.stock - b.stock), [data, q, filter]);
  const nameOf = (id: string) => data?.products.find(p => p.id === id)?.name ?? 'Deleted product';

  return (
    <AdminPage title="Inventory" text={`Products with ${LOW_STOCK} or fewer units are flagged as low stock.`}>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search name or SKU" />
        <select className={selectSm} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Stock filter">
          <option value="">All products</option><option value="low">Low stock</option><option value="out">Out of stock / unavailable</option>
        </select>
      </div>
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <TableCard head={['Product', 'Level', 'Stock quantity', 'Purchasable']} empty={!rows.length}>
            {rows.map(p => (
              <StockRow key={p.id + p.stock} p={p} onSave={(patch, msg) => run(async () => { await db.update('products', { id: p.id }, patch); await reload(); void refresh(); }, msg)} />
            ))}
          </TableCard>
          <h2 className="mb-3 mt-10 text-xl text-walnut">Inventory history</h2>
          <TableCard head={['Date', 'Product', 'Reason', 'Change', 'Stock after']} empty={!data.history.length}>
            {data.history.map(t => (
              <tr key={t.id}>
                <td className="whitespace-nowrap text-espresso/60">{formatDate(t.created_at, true)}</td>
                <td>{nameOf(t.product_id)}</td>
                <td className="text-espresso/65">{REASON[t.reason] ?? t.reason}</td>
                <td className={cx('font-medium tabular-nums', t.change > 0 ? 'text-emerald-800' : 'text-red-700')}>{t.change > 0 ? '+' : ''}{t.change}</td>
                <td className="tabular-nums">{t.stock_after}</td>
              </tr>
            ))}
          </TableCard>
        </>
      )}
    </AdminPage>
  );
}
