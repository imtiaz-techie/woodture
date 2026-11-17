import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Star, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cx } from '../lib/utils';
import { useStore } from '../context/Store';

/** Fade-and-rise when scrolled into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({ eyebrow, title, text, align = 'center', action }: {
  eyebrow?: string; title: string; text?: string; align?: 'center' | 'left'; action?: ReactNode;
}) {
  return (
    <Reveal className={cx('mb-10 flex flex-col gap-4 sm:mb-14', align === 'center' ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between')}>
      <div className={cx(align === 'center' && 'flex flex-col items-center')}>
        {eyebrow && (
          <p className="eyebrow mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-gold" />{eyebrow}{align === 'center' && <span className="h-px w-8 bg-gold" />}
          </p>
        )}
        <h2 className="text-3xl leading-tight text-walnut sm:text-4xl lg:text-[2.75rem]">{title}</h2>
        {text && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-espresso/65">{text}</p>}
      </div>
      {action}
    </Reveal>
  );
}

export function PageHeader({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="border-b border-walnut/10 bg-cream/50">
      <div className="container-x py-12 text-center sm:py-16">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="text-4xl text-walnut sm:text-5xl">{title}</h1>
        {text && <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-espresso/65">{text}</p>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-wood', className)} aria-label="Loading" />;
}

export function PageLoader() {
  return <div className="flex min-h-[50vh] items-center justify-center"><Spinner className="h-7 w-7" /></div>;
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cream text-wood">{icon}</div>}
      <h3 className="text-2xl text-walnut">{title}</h3>
      {text && <p className="mt-2 max-w-sm text-sm leading-relaxed text-espresso/60">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => {
        const star = <Star size={size} className={n <= Math.round(value) ? 'fill-gold text-gold' : 'text-walnut/20'} />;
        return onChange
          ? <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>{star}</button>
          : <span key={n}>{star}</span>;
      })}
    </span>
  );
}

export function Price({ price, discount, className }: { price: number; discount: number | null; className?: string }) {
  const { money } = useStore();
  return (
    <span className={cx('inline-flex items-baseline gap-2', className)}>
      <span className="font-medium text-walnut">{money(discount ?? price)}</span>
      {discount != null && <span className="text-[0.82em] text-espresso/40 line-through">{money(price)}</span>}
    </span>
  );
}

export function Modal({ open, onClose, children, wide, title }: {
  open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-espresso/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            className={cx('relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-ivory shadow-lift sm:rounded-3xl', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-walnut shadow-soft transition hover:bg-walnut hover:text-ivory">
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}{hint && <span className="ml-1.5 normal-case tracking-normal text-espresso/40">{hint}</span>}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  const tones = { info: 'border-gold/40 bg-cream/70 text-walnut', error: 'border-red-200 bg-red-50 text-red-800', ok: 'border-emerald-200 bg-emerald-50 text-emerald-900' };
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm leading-relaxed', tones[tone])}>{children}</div>;
}

const STATUS_TONES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200', confirmed: 'bg-sky-50 text-sky-800 ring-sky-200',
  processing: 'bg-indigo-50 text-indigo-800 ring-indigo-200', shipped: 'bg-violet-50 text-violet-800 ring-violet-200',
  delivered: 'bg-emerald-50 text-emerald-800 ring-emerald-200', cancelled: 'bg-stone-100 text-stone-600 ring-stone-200',
  returned: 'bg-rose-50 text-rose-800 ring-rose-200', unpaid: 'bg-stone-100 text-stone-700 ring-stone-200',
  paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200', failed: 'bg-rose-50 text-rose-800 ring-rose-200',
  refunded: 'bg-violet-50 text-violet-800 ring-violet-200', approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200', hidden: 'bg-stone-100 text-stone-600 ring-stone-200',
  published: 'bg-emerald-50 text-emerald-800 ring-emerald-200', draft: 'bg-stone-100 text-stone-600 ring-stone-200',
  new: 'bg-amber-50 text-amber-800 ring-amber-200', read: 'bg-stone-100 text-stone-600 ring-stone-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ring-1 ring-inset', STATUS_TONES[status] ?? 'bg-cream text-walnut ring-walnut/15')}>
      {status}
    </span>
  );
}
