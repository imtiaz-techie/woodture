import { Heart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../context/Shop';
import type { Product } from '../lib/types';
import { cx, inStock, primaryImage } from '../lib/utils';
import { ProductImagePlaceholder } from './ProductCard';
import { Modal, Price } from './ui';

export default function QuickView({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { addToCart, toggleWishlist, wishlist } = useShop();
  const wished = !!product && wishlist.includes(product.id);
  return (
    <Modal open={!!product} onClose={onClose} wide title={product?.name}>
      {product && (
        <div className="grid sm:grid-cols-2">
          <div className="aspect-square bg-cream sm:aspect-auto sm:min-h-[440px]">
            {primaryImage(product) ? <img src={primaryImage(product)} alt={product.name} className="h-full w-full object-cover" /> : <ProductImagePlaceholder />}
          </div>
          <div className="flex flex-col p-7 sm:p-10">
            {product.category && <p className="eyebrow">{product.category.name}</p>}
            <h2 className="mt-2 text-3xl leading-tight text-walnut">{product.name}</h2>
            <Price price={product.price} discount={product.discount_price} className="mt-3 text-xl" />
            {product.short_description && <p className="mt-5 text-sm leading-relaxed text-espresso/70">{product.short_description}</p>}
            <p className={cx('mt-4 text-xs', inStock(product) ? 'text-emerald-800' : 'text-espresso/50')}>
              {inStock(product) ? `In stock · ${product.stock} available` : 'Currently out of stock'}
            </p>
            <div className="mt-auto flex gap-3 pt-8">
              <button className="btn-primary flex-1" disabled={!inStock(product)} onClick={() => { if (addToCart(product)) onClose(); }}>
                <ShoppingBag size={15} />Add to cart
              </button>
              <button onClick={() => toggleWishlist(product)} aria-label="Toggle wishlist" aria-pressed={wished}
                className={cx('flex h-[50px] w-[50px] items-center justify-center rounded-full border border-walnut/25', wished ? 'text-red-700' : 'text-walnut')}>
                <Heart size={18} className={wished ? 'fill-current' : ''} />
              </button>
            </div>
            <Link to={`/product/${product.slug}`} onClick={onClose} className="mt-5 text-center text-[12px] font-medium uppercase tracking-[0.16em] text-wood hover:text-walnut">
              View full details →
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
