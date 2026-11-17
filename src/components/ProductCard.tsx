import { motion } from 'framer-motion';
import { Eye, Heart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../context/Shop';
import type { Product } from '../lib/types';
import { cx, discountPercent, inStock, primaryImage } from '../lib/utils';
import { Price } from './ui';

export function ProductImagePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-cream">
      <img src="/brand/bird.png" alt="" className="w-1/3 opacity-25" />
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, wishlist, setQuickView } = useShop();
  const wished = wishlist.includes(product.id);
  const available = inStock(product);
  const off = discountPercent(product);
  const img = primaryImage(product);
  const hover = product.images[1]?.url;

  return (
    <motion.article
      className="group relative flex flex-col"
      initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
        <Link to={`/product/${product.slug}`} aria-label={product.name} className="block h-full w-full">
          {img ? (
            <>
              <img src={img} alt={product.name} loading="lazy" decoding="async"
                className={cx('h-full w-full object-cover transition duration-[900ms] ease-out group-hover:scale-[1.05]', hover && 'group-hover:opacity-0')} />
              {hover && <img src={hover} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-700 group-hover:opacity-100" />}
            </>
          ) : <ProductImagePlaceholder />}
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.is_new_arrival && <span className="rounded-full bg-ivory/95 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-walnut">New</span>}
          {off > 0 && <span className="rounded-full bg-walnut px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ivory">−{off}%</span>}
          {!available && <span className="rounded-full bg-espresso/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ivory">Sold out</span>}
        </div>

        <button
          onClick={() => toggleWishlist(product)} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={wished}
          className={cx('absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ivory/95 shadow-soft transition hover:scale-110', wished ? 'text-red-700' : 'text-walnut')}
        >
          <Heart size={16} className={wished ? 'fill-current' : ''} />
        </button>

        <div className="absolute inset-x-3 bottom-3 flex gap-2 transition duration-300 lg:translate-y-3 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100">
          <button
            onClick={() => addToCart(product)} disabled={!available}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-walnut text-[11px] font-medium uppercase tracking-[0.14em] text-ivory transition hover:bg-espresso disabled:bg-espresso/40"
          >
            <ShoppingBag size={14} className="shrink-0" />
            <span className="truncate"><span className="max-[420px]:hidden">{available ? 'Add to cart' : 'Sold out'}</span><span className="min-[421px]:hidden">{available ? 'Add' : 'Sold out'}</span></span>
          </button>
          <button onClick={() => setQuickView(product)} aria-label={`Quick view ${product.name}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory/95 text-walnut shadow-soft transition hover:bg-white">
            <Eye size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 px-1">
        {product.category && <p className="text-[10.5px] uppercase tracking-[0.18em] text-wood">{product.category.name}</p>}
        <h3 className="mt-1 text-lg leading-snug text-walnut">
          <Link to={`/product/${product.slug}`} className="transition hover:text-wood">{product.name}</Link>
        </h3>
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[15px]">
          <Price price={product.price} discount={product.discount_price} />
          <span className={cx('text-[11px]', available ? 'text-emerald-800/80' : 'text-espresso/45')}>
            {available ? (product.stock <= 3 ? `Only ${product.stock} left` : 'In stock') : 'Out of stock'}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
