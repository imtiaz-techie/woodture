import { ImagePlus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Notice, Spinner } from '../components/ui';
import { useShop } from '../context/Shop';
import { uploadImage } from '../lib/api';
import { cx, errorMessage } from '../lib/utils';

export function AdminPage({ title, text, action, children }: { title: string; text?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-walnut">{title}</h1>
          {text && <p className="mt-1 text-sm text-espresso/55">{text}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Loads data for an admin screen, with loading / error / reload handling. */
export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try { setData(await fn()); setError(''); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

export function LoadState({ loading, error }: { loading: boolean; error: string }) {
  if (error) return <Notice tone="error">{error}</Notice>;
  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;
  return null;
}

/** Runs an admin action and reports the result as a toast. */
export function useAction() {
  const { toast } = useShop();
  return useCallback(async (fn: () => Promise<unknown>, success?: string) => {
    try { await fn(); if (success) toast(success); return true; }
    catch (e) { toast(errorMessage(e), 'error'); return false; }
  }, [toast]);
}

export function TableCard({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-walnut/10 bg-cream/40 text-[11px] uppercase tracking-wider text-espresso/55">
              {head.map(h => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-walnut/[0.07] [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle">{children}</tbody>
        </table>
      </div>
      {empty && <p className="px-4 py-12 text-center text-sm text-espresso/50">Nothing here yet.</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label?: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-wood' : 'bg-walnut/20')}>
        <span className={cx('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked && 'translate-x-5')} />
      </button>
      {label && <span className="text-sm text-espresso/80">{label}{hint && <span className="block text-xs text-espresso/45">{hint}</span>}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-espresso/40" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input !py-2.5 !pl-10" />
    </div>
  );
}

export function Section({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-7">
      <h2 className="text-xl text-walnut">{title}</h2>
      {text && <p className="mt-1 text-xs text-espresso/50">{text}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/** Single-image picker (hero image, logo, category image…). */
export function ImageInput({ value, onChange, folder, wide }: { value: string; onChange: (url: string) => void; folder: string; wide?: boolean }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useShop();
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadImage(file, folder)); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-4">
      <div className={cx('flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-walnut/10 bg-cream', wide ? 'h-24 w-44' : 'h-24 w-24')}>
        {busy ? <Spinner /> : value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={22} className="text-espresso/30" />}
      </div>
      <div className="flex flex-col items-start gap-2">
        <label className="btn-outline btn-sm cursor-pointer">
          {value ? 'Replace' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {value && <button type="button" onClick={() => onChange('')} className="flex items-center gap-1 text-xs text-espresso/50 hover:text-red-700"><Trash2 size={13} />Remove</button>}
      </div>
    </div>
  );
}

export const iconBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-espresso/55 transition hover:bg-cream hover:text-walnut disabled:opacity-30';
export const selectSm = 'rounded-lg border border-walnut/15 bg-white px-3 py-2 text-xs text-walnut focus:outline-none focus:ring-2 focus:ring-wood/20';
