import { ArrowLeft, ArrowRight, ImagePlus, Link2, Trash2, Video } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Field, Notice, Spinner } from '../components/ui';
import { useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { fetchCatalog, saveSettings, uploadImage, uploadVideo } from '../lib/api';
import { db, isDemo } from '../lib/backend';
import type { GalleryItem, GeneralSettings, HomepageSettings } from '../lib/types';
import { cx, errorMessage, primaryImage } from '../lib/utils';
import { AdminPage, ImageInput, LoadState, Section, Toggle, iconBtn, useAction, useLoad } from './common';

// ------------------------------------------------------------------- gallery
export function GalleryAdmin() {
  const { toast } = useShop();
  const { data, loading, error, reload } = useLoad(() => db.select<GalleryItem>('gallery_items', { order: [['sort_order', 'asc'], ['created_at', 'desc']] }));
  const run = useAction();
  const [busy, setBusy] = useState(0);
  const items = data ?? [];
  const nextOrder = () => Math.max(-1, ...items.map(i => i.sort_order)) + 1;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setBusy(list.length);
    let order = nextOrder();
    for (const file of list) {
      try {
        const isVideo = file.type.startsWith('video/');
        const url = isVideo ? await uploadVideo(file, 'gallery') : await uploadImage(file, 'gallery');
        await db.insert('gallery_items', { type: isVideo ? 'video' : 'image', url, caption: null, sort_order: order++, is_published: true });
      } catch (e) { toast(`${file.name}: ${errorMessage(e)}`, 'error'); }
      setBusy(n => n - 1);
    }
    await reload();
  };
  const addLink = () => {
    const url = prompt('Paste a direct video link (.mp4 / .webm):')?.trim();
    if (!url) return;
    if (!/^https:\/\//i.test(url)) return toast('Please paste a full https:// link', 'error');
    void run(async () => { await db.insert('gallery_items', { type: 'video', url, caption: null, sort_order: nextOrder(), is_published: true }); await reload(); }, 'Video added');
  };
  const swap = (a: GalleryItem, b?: GalleryItem) => b && run(async () => {
    await db.update('gallery_items', { id: a.id }, { sort_order: b.sort_order });
    await db.update('gallery_items', { id: b.id }, { sort_order: a.sort_order === b.sort_order ? a.sort_order + 1 : a.sort_order });
    await reload();
  });

  return (
    <AdminPage title="Gallery" text="Photos and videos shown on the Gallery page and homepage preview."
      action={
        <div className="flex gap-2">
          <button className="btn-outline btn-sm" onClick={addLink}><Link2 size={14} />Add video link</button>
          <label className="btn-primary btn-sm cursor-pointer">
            {busy > 0 ? <Spinner className="h-4 w-4 !text-ivory" /> : <ImagePlus size={15} />}{busy > 0 ? `Uploading ${busy}…` : 'Upload photos / videos'}
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { void addFiles(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
      }>
      <LoadState loading={loading} error={error} />
      {data && !items.length && <div className="card px-4 py-16 text-center text-sm text-espresso/50">No gallery items yet. Upload your first photos or videos.</div>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {items.map((g, i) => (
          <div key={g.id} className={cx('card overflow-hidden', !g.is_published && 'opacity-60')}>
            <div className="relative aspect-square bg-cream">
              {g.type === 'video'
                ? <><video src={g.url} muted preload="metadata" className="h-full w-full object-cover" /><Video className="absolute left-2 top-2 h-6 w-6 rounded-md bg-espresso/70 p-1 text-ivory" /></>
                : <img src={g.url} alt={g.caption ?? ''} loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <div className="space-y-2.5 p-3">
              <input defaultValue={g.caption ?? ''} placeholder="Add a caption…" aria-label="Caption" className="input !px-3 !py-2 !text-xs"
                onBlur={e => { const v = e.target.value.trim() || null; if (v !== (g.caption ?? null)) void run(async () => { await db.update('gallery_items', { id: g.id }, { caption: v }); await reload(); }, 'Caption saved'); }} />
              <div className="flex items-center justify-between">
                <Toggle checked={g.is_published} label={`Publish item ${i + 1}`} onChange={v => run(async () => { await db.update('gallery_items', { id: g.id }, { is_published: v }); await reload(); }, v ? 'Published' : 'Unpublished')} />
                <div className="flex">
                  <button className={iconBtn} disabled={i === 0} aria-label="Move earlier" onClick={() => swap(g, items[i - 1])}><ArrowLeft size={15} /></button>
                  <button className={iconBtn} disabled={i === items.length - 1} aria-label="Move later" onClick={() => swap(g, items[i + 1])}><ArrowRight size={15} /></button>
                  <button className={cx(iconBtn, 'hover:!text-red-700')} aria-label="Delete item" onClick={() => { if (confirm('Delete this gallery item?')) void run(async () => { await db.remove('gallery_items', { id: g.id }); await reload(); }, 'Deleted'); }}><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminPage>
  );
}

// ------------------------------------------------------------------ homepage
export function HomepageAdmin() {
  const { homepage, refresh } = useStore();
  const { data, loading, error, reload } = useLoad(() => fetchCatalog(true));
  const run = useAction();
  const [form, setForm] = useState<HomepageSettings>(homepage);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(homepage), [homepage]);
  const text = (k: keyof HomepageSettings) => ({ value: String(form[k] ?? ''), onChange: (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value })) });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await run(async () => { await saveSettings('homepage', form); await refresh(); }, 'Homepage saved — changes are live');
    setSaving(false);
  };
  const flip = (table: 'products' | 'categories', id: string, value: boolean) =>
    run(async () => { await db.update(table, { id }, { is_featured: value }); await reload(); void refresh(); });

  return (
    <AdminPage title="Homepage Management" text="Edit what visitors see on the homepage. No code needed.">
      <form onSubmit={save} className="grid gap-6 xl:grid-cols-2">
        <Section title="Hero">
          <Field label="Heading"><input required className="input" {...text('hero_heading')} /></Field>
          <Field label="Description"><textarea rows={3} className="input" {...text('hero_description')} /></Field>
          <div><span className="label">Hero image</span><ImageInput wide value={form.hero_image} onChange={url => setForm(f => ({ ...f, hero_image: url || '/brand/cover.jpg' }))} folder="site" /></div>
        </Section>
        <Section title="Announcement banner" text="A thin strip at the very top of every page — e.g. an offer or delivery notice.">
          <Toggle checked={form.banner_enabled} onChange={v => setForm(f => ({ ...f, banner_enabled: v }))} label="Show banner" />
          <Field label="Banner text"><input className="input" maxLength={140} {...text('banner_text')} /></Field>
        </Section>
        <Section title="Brand introduction">
          <Field label="Heading"><input className="input" {...text('intro_heading')} /></Field>
          <Field label="Text"><textarea rows={5} className="input" {...text('intro_text')} /></Field>
        </Section>
        <Section title="Craftsmanship section">
          <Field label="Heading"><input className="input" {...text('craft_heading')} /></Field>
          <Field label="Text"><textarea rows={3} className="input" {...text('craft_text')} /></Field>
          <div><span className="label">Image</span><ImageInput wide value={form.craft_image} onChange={url => setForm(f => ({ ...f, craft_image: url }))} folder="site" /></div>
        </Section>
        <Section title="About section" text="Shown on the About Us page. Leave a blank line between paragraphs.">
          <textarea rows={8} className="input" aria-label="About text" {...text('about_text')} />
        </Section>
        <Section title="Footer content">
          <Field label="Footer description"><textarea rows={3} className="input" {...text('footer_text')} /></Field>
        </Section>
        <div className="xl:col-span-2"><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save homepage'}</button></div>
      </form>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Section title="Featured collections" text="Collections shown in the homepage “Explore by collection” section. Saved instantly.">
          <LoadState loading={loading} error={error} />
          <div className="space-y-3">
            {data?.categories.map(c => <Toggle key={c.id} checked={c.is_featured} onChange={v => flip('categories', c.id, v)} label={c.name} />)}
          </div>
        </Section>
        <Section title="Featured products" text="Products shown in the homepage “Featured Sculptures” section. Saved instantly.">
          <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
            {data?.products.filter(p => p.status === 'published').map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-cream">{primaryImage(p) && <img src={primaryImage(p)} alt="" className="h-full w-full object-cover" />}</span>
                <Toggle checked={p.is_featured} onChange={v => flip('products', p.id, v)} label={p.name} />
              </div>
            ))}
            {data && !data.products.some(p => p.status === 'published') && <p className="text-sm text-espresso/50">Publish a product first.</p>}
          </div>
        </Section>
      </div>
    </AdminPage>
  );
}

// ------------------------------------------------------------------ settings
export function SettingsAdmin() {
  const { general, refresh } = useStore();
  const run = useAction();
  const [form, setForm] = useState<GeneralSettings>(general);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(general), [general]);

  type TextKey = 'business_name' | 'tagline' | 'phone' | 'whatsapp' | 'email' | 'address' | 'facebook' | 'instagram' | 'currency';
  const text = (k: TextKey) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value })) });
  const ship = (k: 'inside' | 'outside' | 'free_over') => ({
    value: form.shipping[k] ?? '', onChange: (e: { target: { value: string } }) =>
      setForm(f => ({ ...f, shipping: { ...f.shipping, [k]: e.target.value === '' ? (k === 'free_over' ? null : 0) : Number(e.target.value) } })),
  });
  const pay = <K extends keyof GeneralSettings['payment']>(k: K, v: GeneralSettings['payment'][K]) => setForm(f => ({ ...f, payment: { ...f.payment, [k]: v } }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await run(async () => { await saveSettings('general', form); await refresh(); }, 'Settings saved');
    setSaving(false);
  };

  return (
    <AdminPage title="Website Settings" text="Business details, delivery charges, payments and SEO.">
      <form onSubmit={save} className="grid gap-6 xl:grid-cols-2">
        <Section title="Business">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name"><input required className="input" {...text('business_name')} /></Field>
            <Field label="Tagline"><input className="input" {...text('tagline')} /></Field>
          </div>
          <div><span className="label">Logo <span className="normal-case tracking-normal text-espresso/40">(optional — the Woodture logo is used by default)</span></span>
            <ImageInput wide value={form.logo_url} onChange={url => setForm(f => ({ ...f, logo_url: url }))} folder="site" /></div>
          <Field label="Currency symbol"><input required maxLength={4} className="input !w-28" {...text('currency')} /></Field>
        </Section>

        <Section title="Contact" text="Only the details you fill in are shown on the website.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact phone"><input className="input" {...text('phone')} /></Field>
            <Field label="WhatsApp number" hint="(with country code, e.g. 8801…)"><input className="input" inputMode="tel" {...text('whatsapp')} /></Field>
          </div>
          <Field label="Email"><input type="email" className="input" {...text('email')} /></Field>
          <Field label="Address"><textarea rows={2} className="input" {...text('address')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Facebook URL"><input type="url" className="input" placeholder="https://facebook.com/…" {...text('facebook')} /></Field>
            <Field label="Instagram URL"><input type="url" className="input" placeholder="https://instagram.com/…" {...text('instagram')} /></Field>
          </div>
        </Section>

        <Section title="Shipping charges" text={`Amounts in ${form.currency}. Enter 0 for free delivery.`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Inside Dhaka"><input type="number" min={0} className="input" {...ship('inside')} /></Field>
            <Field label="Outside Dhaka"><input type="number" min={0} className="input" {...ship('outside')} /></Field>
            <Field label="Free over" hint="(optional)"><input type="number" min={0} className="input" placeholder="Never" {...ship('free_over')} /></Field>
          </div>
        </Section>

        <Section title="Payment configuration">
          <Toggle checked={form.payment.cod_enabled} onChange={v => pay('cod_enabled', v)} label="Cash on Delivery" />
          <Toggle checked={form.payment.manual_enabled} onChange={v => pay('manual_enabled', v)} label="Manual bank / mobile payment" hint="Customer sends money, then enters the transaction ID at checkout" />
          {form.payment.manual_enabled && (
            <Field label="Payment instructions shown at checkout" hint="(your bKash / Nagad / bank account details)">
              <textarea rows={3} className="input" value={form.payment.manual_instructions} onChange={e => pay('manual_instructions', e.target.value)} />
            </Field>
          )}
          <Toggle checked={form.payment.online_enabled} onChange={v => pay('online_enabled', v)} label="Online payment gateway" hint="Turn on only after your merchant account is approved and its keys are set" />
          {form.payment.online_enabled && (
            <>
              <Field label="Gateway">
                <select className="input" value={form.payment.online_provider} onChange={e => pay('online_provider', e.target.value as GeneralSettings['payment']['online_provider'])}>
                  <option value="sslcommerz">SSLCOMMERZ</option><option value="bkash">bKash</option><option value="nagad">Nagad</option>
                </select>
              </Field>
              <Notice>
                {isDemo ? 'Online payment is unavailable in demo mode — connect Supabase first. ' : ''}
                Merchant keys are never stored here. Set them as Supabase Edge Function secrets and deploy the payment functions (see README).
                {form.payment.online_provider !== 'sslcommerz' && ' The bKash and Nagad adapters are prepared but still need your merchant API details to be completed.'}
              </Notice>
            </>
          )}
        </Section>

        <Section title="SEO" text="Default title and description for search engines and link previews.">
          <Field label="Site title"><input maxLength={70} className="input" value={form.seo.title} onChange={e => setForm(f => ({ ...f, seo: { ...f.seo, title: e.target.value } }))} /></Field>
          <Field label="Site description"><textarea rows={2} maxLength={170} className="input" value={form.seo.description} onChange={e => setForm(f => ({ ...f, seo: { ...f.seo, description: e.target.value } }))} /></Field>
        </Section>

        <div className="xl:col-span-2"><button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>
      </form>
    </AdminPage>
  );
}
