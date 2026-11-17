import { ArrowLeft, ArrowRight, Copy, Eye, EyeOff, ImagePlus, Pencil, Plus, Star, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Field, Notice, Spinner, StatusBadge } from '../components/ui';
import { useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { fetchCatalog, saveProduct, uploadImage, uploadVideo, type ProductInput } from '../lib/api';
import { db } from '../lib/backend';
import type { Product, ProductImage } from '../lib/types';
import { cx, errorMessage, primaryImage, slugify } from '../lib/utils';
import { AdminPage, LoadState, SearchInput, Section, TableCard, Toggle, iconBtn, selectSm, useAction, useLoad } from './common';

const toInput = (p: Product): ProductInput => {
  const { id, images, category, created_at, updated_at, sales_count, published_at, ...rest } = p;
  return rest;
};

export function ProductsList() {
  const { money, refresh } = useStore();
  const { data, loading, error, reload } = useLoad(() => fetchCatalog(true));
  const run = useAction();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  const sync = async () => { await reload(); void refresh(); };
  const patch = (p: Product, change: Partial<Product>, msg?: string) => run(async () => { await db.update('products', { id: p.id }, change); await sync(); }, msg);

  const duplicate = (p: Product) => run(async () => {
    const taken = new Set(data!.products.map(x => x.slug));
    let slug = `${p.slug}-copy`;
    for (let n = 2; taken.has(slug); n++) slug = `${p.slug}-copy-${n}`;
    const id = await saveProduct(null, { ...toInput(p), name: `${p.name} (Copy)`, slug, sku: null, status: 'draft' }, p.images);
    navigate(`/admin/products/${id}`);
  }, 'Product duplicated as a draft');

  const remove = (p: Product) => {
    if (!confirm(`Delete “${p.name}” permanently? This cannot be undone.`)) return;
    void run(async () => { await db.remove('products', { id: p.id }); await sync(); }, 'Product deleted');
  };

  const rows = useMemo(() => (data?.products ?? []).filter(p =>
    (!status || p.status === status) && (!category || p.category_id === category) &&
    (!q || `${p.name} ${p.sku ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [data, q, status, category]);

  const flag = (p: Product, key: 'is_featured' | 'is_new_arrival' | 'is_bestseller', label: string) => (
    <button onClick={() => patch(p, { [key]: !p[key] })} aria-pressed={p[key]} title={`Toggle ${label}`}
      className={cx('rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset transition', p[key] ? 'bg-gold/20 text-walnut ring-gold/50' : 'text-espresso/35 ring-walnut/10 hover:text-espresso/70')}>
      {label}
    </button>
  );

  return (
    <AdminPage title="Products" text="Everything on the public website is loaded from this list."
      action={<Link to="/admin/products/new" className="btn-primary btn-sm"><Plus size={15} />Add new product</Link>}>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search name or SKU" />
        <select className={selectSm} value={status} onChange={e => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option>
        </select>
        <select className={selectSm} value={category} onChange={e => setCategory(e.target.value)} aria-label="Category filter">
          <option value="">All categories</option>
          {data?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <LoadState loading={loading} error={error} />
      {data && (
        <TableCard head={['Product', 'Category', 'Price', 'Stock', 'Status', 'Highlights', '']} empty={!rows.length}>
          {rows.map(p => (
            <tr key={p.id} className="hover:bg-cream/30">
              <td>
                <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-cream">{primaryImage(p) && <img src={primaryImage(p)} alt="" className="h-full w-full object-cover" />}</span>
                  <span><span className="block font-medium text-walnut">{p.name}</span><span className="text-xs text-espresso/45">{p.sku || 'No SKU'}</span></span>
                </Link>
              </td>
              <td className="text-espresso/65">{p.category?.name ?? '—'}</td>
              <td className="whitespace-nowrap tabular-nums">{money(p.discount_price ?? p.price)}{p.discount_price != null && <span className="ml-1.5 text-xs text-espresso/40 line-through">{money(p.price)}</span>}</td>
              <td className={cx('tabular-nums', p.stock === 0 ? 'text-red-700' : p.stock <= 3 ? 'text-amber-700' : '')}>{p.stock}{!p.is_available && <span className="ml-1 text-xs text-espresso/45">(off)</span>}</td>
              <td><StatusBadge status={p.status} /></td>
              <td><div className="flex flex-wrap gap-1">{flag(p, 'is_featured', 'Featured')}{flag(p, 'is_new_arrival', 'New')}{flag(p, 'is_bestseller', 'Best')}</div></td>
              <td>
                <div className="flex justify-end gap-0.5">
                  <Link to={`/admin/products/${p.id}`} className={iconBtn} title="Edit" aria-label={`Edit ${p.name}`}><Pencil size={15} /></Link>
                  <button className={iconBtn} title={p.status === 'published' ? 'Unpublish' : 'Publish'} aria-label={p.status === 'published' ? 'Unpublish' : 'Publish'}
                    onClick={() => patch(p, { status: p.status === 'published' ? 'draft' : 'published' }, p.status === 'published' ? 'Product unpublished' : 'Product published')}>
                    {p.status === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button className={iconBtn} title="Duplicate" aria-label={`Duplicate ${p.name}`} onClick={() => duplicate(p)}><Copy size={15} /></button>
                  <button className={cx(iconBtn, 'hover:!text-red-700')} title="Delete" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </TableCard>
      )}
    </AdminPage>
  );
}

const BLANK: ProductInput = {
  name: '', slug: '', category_id: null, short_description: '', description: '', price: 0, discount_price: null, video_url: '',
  material: '', dimensions: '', weight: '', movement: '', sku: '', stock: 0, is_available: true,
  is_featured: false, is_new_arrival: false, is_bestseller: false, status: 'draft', seo_title: '', seo_description: '',
};

export function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh } = useStore();
  const { toast } = useShop();
  const { data, loading, error } = useLoad(() => fetchCatalog(true));
  const [form, setForm] = useState<ProductInput>(BLANK);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [slugEdited, setSlugEdited] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [videoBusy, setVideoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const dragFrom = useRef<number | null>(null);
  const existing = id ? data?.products.find(p => p.id === id) : undefined;

  useEffect(() => {
    if (!id) { setForm(BLANK); setImages([]); setSlugEdited(false); return; }
    if (existing) { setForm({ ...BLANK, ...toInput(existing) }); setImages(existing.images); setSlugEdited(true); }
  }, [id, existing]);

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const text = (k: 'short_description' | 'description' | 'material' | 'dimensions' | 'weight' | 'movement' | 'sku' | 'video_url' | 'seo_title' | 'seo_description') => ({
    value: form[k] ?? '', onChange: (e: { target: { value: string } }) => set(k, e.target.value),
  });

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading(n => n + list.length);
    for (const file of list) {
      try {
        const url = await uploadImage(file, 'products');
        setImages(imgs => [...imgs, { url, alt: '', sort_order: imgs.length, is_primary: imgs.length === 0 }]);
      } catch (e) { toast(`${file.name}: ${errorMessage(e)}`, 'error'); }
      setUploading(n => n - 1);
    }
  };
  const move = (from: number, to: number) => setImages(imgs => {
    if (to < 0 || to >= imgs.length || from === to) return imgs;
    const next = [...imgs];
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
  });

  const save = async (status: 'draft' | 'published') => {
    setFormError('');
    const name = form.name.trim();
    const slug = slugify(form.slug || name);
    const discount = form.discount_price == null || (form.discount_price as unknown) === '' ? null : Number(form.discount_price);
    if (!name) return setFormError('Please enter a product name.');
    if (!slug) return setFormError('Please enter a URL slug.');
    if (data!.products.some(p => p.slug === slug && p.id !== id)) return setFormError('Another product already uses this URL slug.');
    if (!(Number(form.price) >= 0)) return setFormError('Please enter a valid price.');
    if (discount != null && !(discount < Number(form.price))) return setFormError('The discount price must be lower than the regular price.');
    const sku = form.sku?.trim() || null;
    if (sku && data!.products.some(p => p.sku === sku && p.id !== id)) return setFormError('Another product already uses this SKU.');
    if (status === 'published' && !images.length && !confirm('Publish without any product photo?')) return;

    setSaving(true);
    try {
      const clean = (v?: string | null) => v?.trim() || null;
      await saveProduct(id ?? null, {
        ...form, name, slug, sku, status, discount_price: discount,
        price: Number(form.price), stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
        category_id: form.category_id || null,
        short_description: clean(form.short_description), description: clean(form.description), video_url: clean(form.video_url),
        material: clean(form.material), dimensions: clean(form.dimensions), weight: clean(form.weight), movement: clean(form.movement),
        seo_title: clean(form.seo_title), seo_description: clean(form.seo_description),
      }, images);
      void refresh();
      toast(status === 'published' ? 'Product published — it is now live on the website' : 'Draft saved');
      navigate('/admin/products');
    } catch (e) { setFormError(errorMessage(e)); } finally { setSaving(false); }
  };

  if (!data) return <AdminPage title="Product"><LoadState loading={loading} error={error} /></AdminPage>;
  if (id && !existing) return <AdminPage title="Product"><Notice tone="error">Product not found.</Notice></AdminPage>;

  return (
    <AdminPage title={id ? 'Edit product' : 'Add new product'} text={id ? existing?.name : 'Fill in the details, add photos, then publish. No code needed.'}
      action={<Link to="/admin/products" className="btn-outline btn-sm"><ArrowLeft size={14} />All products</Link>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save(form.status); }} className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="Basic information">
            <Field label="Product name">
              <input required className="input" value={form.name} onChange={e => { const name = e.target.value; setForm(f => ({ ...f, name, slug: slugEdited ? f.slug : slugify(name) })); }} />
            </Field>
            <Field label="URL slug" hint={`— yoursite.com/product/${form.slug || '…'}`}>
              <input className="input" value={form.slug} onChange={e => { setSlugEdited(true); set('slug', e.target.value); }} onBlur={() => set('slug', slugify(form.slug))} />
            </Field>
            <Field label="Short description" hint="(optional — shown on cards and at the top of the product page)"><textarea rows={2} maxLength={300} className="input" {...text('short_description')} /></Field>
            <Field label="Full description" hint="(optional)"><textarea rows={6} className="input" {...text('description')} /></Field>
          </Section>

          <Section title="Photos" text="Drag to reorder. The first photo is the primary image shown on product cards.">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {images.map((img, i) => (
                <div key={img.url} draggable onDragStart={() => { dragFrom.current = i; }} onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (dragFrom.current != null) move(dragFrom.current, i); dragFrom.current = null; }}
                  className={cx('group relative aspect-square cursor-grab overflow-hidden rounded-xl border-2 bg-cream', i === 0 ? 'border-wood' : 'border-transparent')}>
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-wood px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ivory">Primary</span>}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-espresso/70 p-1 text-ivory opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)} className="p-1 disabled:opacity-30"><ArrowLeft size={14} /></button>
                    {i !== 0 && <button type="button" aria-label="Make primary image" title="Make primary" onClick={() => move(i, 0)} className="p-1"><Star size={14} /></button>}
                    <button type="button" aria-label="Move later" disabled={i === images.length - 1} onClick={() => move(i, i + 1)} className="p-1 disabled:opacity-30"><ArrowRight size={14} /></button>
                    <button type="button" aria-label="Remove image" onClick={() => setImages(imgs => imgs.filter((_, x) => x !== i))} className="p-1 hover:text-red-300"><X size={14} /></button>
                  </div>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-walnut/25 text-xs text-wood transition hover:bg-cream/60">
                {uploading > 0 ? <Spinner /> : <ImagePlus size={20} />}{uploading > 0 ? `Uploading ${uploading}…` : 'Add photos'}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => { void addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
          </Section>

          <Section title="Product video" text="Optional. Upload a short clip or paste a YouTube link.">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input className="input" placeholder="https://youtube.com/watch?v=…" value={form.video_url?.startsWith('data:') ? 'Uploaded video (stored in browser)' : form.video_url ?? ''} readOnly={!!form.video_url?.startsWith('data:')} onChange={e => set('video_url', e.target.value)} aria-label="Video link" />
              <label className="btn-outline btn-sm shrink-0 cursor-pointer">
                {videoBusy ? <Spinner className="h-4 w-4" /> : <Upload size={14} />}Upload video
                <input type="file" accept="video/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; e.target.value = '';
                  if (!file) return;
                  setVideoBusy(true);
                  try { set('video_url', await uploadVideo(file, 'videos')); } catch (err) { toast(errorMessage(err), 'error'); } finally { setVideoBusy(false); }
                }} />
              </label>
              {form.video_url && <button type="button" className="btn-outline btn-sm shrink-0" onClick={() => set('video_url', '')}>Remove</button>}
            </div>
          </Section>

          <Section title="Details" text="All optional — empty fields are simply not shown on the website.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Material"><input className="input" {...text('material')} /></Field>
              <Field label="Dimensions"><input className="input" placeholder="e.g. 30 × 20 × 25 cm" {...text('dimensions')} /></Field>
              <Field label="Weight"><input className="input" placeholder="e.g. 450 g" {...text('weight')} /></Field>
            </div>
            <Field label="Mechanical movement description"><textarea rows={3} className="input" {...text('movement')} /></Field>
          </Section>

          <Section title="Search engine (SEO)" text="Optional. Defaults to the product name and short description.">
            <Field label="SEO title"><input maxLength={70} className="input" {...text('seo_title')} /></Field>
            <Field label="SEO description"><textarea rows={2} maxLength={170} className="input" {...text('seo_description')} /></Field>
          </Section>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Section title="Publish">
            <div className="flex items-center justify-between text-sm"><span className="text-espresso/60">Current status</span><StatusBadge status={form.status} /></div>
            {formError && <Notice tone="error">{formError}</Notice>}
            <div className="grid gap-2">
              <button type="button" className="btn-primary" disabled={saving || uploading > 0} onClick={() => save('published')}>{saving ? 'Saving…' : form.status === 'published' ? 'Save & keep published' : 'Publish'}</button>
              <button type="button" className="btn-outline" disabled={saving || uploading > 0} onClick={() => save('draft')}>{form.status === 'published' ? 'Unpublish (save as draft)' : 'Save draft'}</button>
            </div>
          </Section>

          <Section title="Price & stock">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Price (৳)"><input required type="number" min={0} step="0.01" className="input" value={form.price} onChange={e => set('price', e.target.value as unknown as number)} /></Field>
              <Field label="Discount price"><input type="number" min={0} step="0.01" className="input" placeholder="None" value={form.discount_price ?? ''} onChange={e => set('discount_price', (e.target.value === '' ? null : e.target.value) as unknown as number)} /></Field>
              <Field label="Stock quantity"><input required type="number" min={0} step={1} className="input" value={form.stock} onChange={e => set('stock', e.target.value as unknown as number)} /></Field>
              <Field label="SKU"><input className="input" {...text('sku')} /></Field>
            </div>
            <Toggle checked={form.is_available} onChange={v => set('is_available', v)} label="Available for purchase" hint="Turn off to show as out of stock" />
          </Section>

          <Section title="Organise">
            <Field label="Category">
              <select className="input" value={form.category_id ?? ''} onChange={e => set('category_id', e.target.value || null)}>
                <option value="">No category</option>
                {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Toggle checked={form.is_featured} onChange={v => set('is_featured', v)} label="Featured product" />
            <Toggle checked={form.is_new_arrival} onChange={v => set('is_new_arrival', v)} label="New arrival" />
            <Toggle checked={form.is_bestseller} onChange={v => set('is_bestseller', v)} label="Bestseller" />
          </Section>
        </div>
      </form>
    </AdminPage>
  );
}
