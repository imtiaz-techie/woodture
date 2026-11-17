import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCatalog, loadSettings } from '../lib/api';
import {
  DEFAULT_GENERAL, DEFAULT_HOMEPAGE, type Category, type GeneralSettings, type HomepageSettings, type Product,
} from '../lib/types';

interface StoreState {
  general: GeneralSettings;
  homepage: HomepageSettings;
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  money: (n: number) => string;
  refresh: () => Promise<void>;
}

const Ctx = createContext<StoreState>(null!);
export const useStore = () => useContext(Ctx);

/** Public storefront data: site settings + the published catalogue, loaded once. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [general, setGeneral] = useState(DEFAULT_GENERAL);
  const [homepage, setHomepage] = useState(DEFAULT_HOMEPAGE);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [settings, catalog] = await Promise.all([loadSettings(), fetchCatalog()]);
      setGeneral(settings.general);
      setHomepage(settings.homepage);
      setProducts(catalog.products);
      setCategories(catalog.categories.filter(c => c.is_active));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the store.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const money = useCallback(
    (n: number) => `${general.currency}${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    [general.currency],
  );

  const value = useMemo(
    () => ({ general, homepage, products, categories, loading, error, money, refresh }),
    [general, homepage, products, categories, loading, error, money, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
