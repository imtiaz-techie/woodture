import { PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Empty, Modal, PageHeader, PageLoader } from '../components/ui';
import { useStore } from '../context/Store';
import { useSeo } from '../lib/seo';
import type { Product } from '../lib/types';
import { cx, unitPrice } from '../lib/utils';

const PAGE = 12;
const SORTS: Record<string, string> = {
  newest: 'Newest', 'price-asc': 'Price: low to high', 'price-desc': 'Price: high to low', bestselling: 'Bestselling',
};

export default function Shop({ preset }: { preset?: 'new' }) {
  const { products, categories, loading, general } = useStore();
  const [params, setParams] = useSearchParams();
  const [shown, setShown] = useState(PAGE);
  const [drawer, setDrawer] = useState(false);

  const q = params.get('q')?.trim() ?? '';
  const category = params.get('category') ?? '';
  const filter = preset ?? params.get('filter') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const min = params.get('min') ?? '';
  const max = params.get('max') ?? '';
  const activeCat = categories.find(c => c.slug === category);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace: true });
  };
  useEffect(() => setShown(PAGE), [q, category, filter, sort, min, max]);

  const results = useMemo(() => {
    const term = q.toLowerCase();
    const list = products.filter((p: Product) => {
      if (activeCat && p.category_id !== activeCat.id) return false;
      if (category && !activeCat) return false;
      if (filter === 'featured' && !p.is_featured) return false;
      if (filter === 'new' && !p.is_new_arrival) return false;
      if (min && unitPrice(p) < Number(min)) return false;
      if (max && unitPrice(p) > Number(max)) return false;
      if (term) {
        const hay = `${p.name} ${p.category?.name ?? ''} ${p.short_description ?? ''} ${p.material ?? ''} ${p.sku ?? ''}`.toLowerCase();
        if (!term.split(/\s+/).every(w => hay.includes(w))) return false;
      }
      return true;
    });
    const newest = (a: Product, b: Product) => +new Date(b.published_at ?? b.created_at) - +new Date(a.published_at ?? a.created_at);
    return list.sort((a, b) =>
      sort === 'price-asc' ? unitPrice(a) - unitPrice(b)
        : sort === 'price-desc' ? unitPrice(b) - unitPrice(a)
          : sort === 'bestselling' ? b.sales_count - a.sales_count || Number(b.is_bestseller) - Number(a.is_bestseller)
            : newest(a, b));
  }, [products, q, activeCat, category, filter, sort, min, max]);

  const title = preset === 'new' ? 'New Arrivals' : q ? `Results for “${q}”` : activeCat?.name ?? 'All Products';
  useSeo(title, activeCat?.description);
  const hasFilters = !!(q || category || (!preset && filter) || min || max);

  const pill = (active: boolean) => cx('block w-full rounded-lg px-3 py-2 text-left text-sm transition', active ? 'bg-walnut text-ivory' : 'text-espresso/70 hover:bg-cream');
  const filters = (
    <div className="space-y-8">
      <div>
        <h3 className="label">Collection</h3>
        <div className="space-y-1">
          <button className={pill(!category)} onClick={() => set({ category: '' })}>All collections</button>
          {categories.map(c => <button key={c.id} className={pill(category === c.slug)} onClick={() => set({ category: c.slug })}>{c.name}</button>)}
        </div>
      </div>
      {!preset && (
        <div>
          <h3 className="label">Show</h3>
          <div className="space-y-1">
            <button className={pill(!filter)} onClick={() => set({ filter: '' })}>Everything</button>
            <button className={pill(filter === 'featured')} onClick={() => set({ filter: 'featured' })}>Featured</button>
            <button className={pill(filter === 'new')} onClick={() => set({ filter: 'new' })}>New arrivals</button>
          </div>
        </div>
      )}
      <div>
        <h3 className="label">Price range ({general.currency})</h3>
        <div className="flex items-center gap-2">
          <input type="number" min={0} inputMode="numeric" placeholder="Min" aria-label="Minimum price" value={min} onChange={e => set({ min: e.target.value })} className="input !py-2.5" />
          <span className="text-espresso/40">—</span>
          <input type="number" min={0} inputMode="numeric" placeholder="Max" aria-label="Maximum price" value={max} onChange={e => set({ max: e.target.value })} className="input !py-2.5" />
        </div>
      </div>
      {hasFilters && (
        <button onClick={() => setParams(sort !== 'newest' ? { sort } : {}, { replace: true })} className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-wood hover:text-walnut">
          <X size={14} />Clear filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <PageHeader eyebrow={preset === 'new' ? 'Just Landed' : 'Shop'} title={title}
        text={preset === 'new' ? 'The latest sculptures to leave our workshop.' : activeCat?.description ?? (q ? undefined : 'Every piece handcrafted, every movement considered.')} />
      <div className="container-x py-10 sm:py-14">
        <div className="mb-8 flex items-center justify-between gap-4">
          <p className="text-sm text-espresso/55">{loading ? '' : `${results.length} ${results.length === 1 ? 'piece' : 'pieces'}`}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawer(true)} className="flex items-center gap-2 rounded-full border border-walnut/20 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-walnut lg:hidden">
              <SlidersHorizontal size={14} />Filters
            </button>
            <label className="sr-only" htmlFor="sort">Sort by</label>
            <select id="sort" value={sort} onChange={e => set({ sort: e.target.value === 'newest' ? '' : e.target.value })}
              className="rounded-full border border-walnut/20 bg-white px-4 py-2.5 text-xs font-medium text-walnut focus:outline-none focus:ring-2 focus:ring-wood/20">
              {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-12 lg:grid-cols-[230px_1fr]">
          <aside className="hidden lg:block"><div className="sticky top-28">{filters}</div></aside>
          <div>
            {loading ? <PageLoader /> : results.length ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3">
                  {results.slice(0, shown).map(p => <ProductCard key={p.id} product={p} />)}
                </div>
                {shown < results.length && (
                  <div className="mt-14 text-center">
                    <button className="btn-outline" onClick={() => setShown(s => s + PAGE)}>Load more</button>
                    <p className="mt-3 text-xs text-espresso/45">Showing {Math.min(shown, results.length)} of {results.length}</p>
                  </div>
                )}
              </>
            ) : (
              <Empty icon={<PackageSearch size={26} />} title={products.length ? 'Nothing matches yet' : 'New pieces are on the way'}
                text={products.length ? 'Try a different search or clear your filters.' : 'Our collection is being prepared. Please check back soon.'}
                action={hasFilters ? <Link to="/shop" className="btn-outline btn-sm">View all products</Link> : undefined} />
            )}
          </div>
        </div>
      </div>
      <Modal open={drawer} onClose={() => setDrawer(false)} title="Filters">
        <div className="p-7">
          <h2 className="mb-6 text-2xl text-walnut">Filters</h2>
          {filters}
          <button className="btn-primary mt-8 w-full" onClick={() => setDrawer(false)}>Show {results.length} results</button>
        </div>
      </Modal>
    </>
  );
}

