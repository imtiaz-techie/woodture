import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Heart, ImagePlus, MessageCircle, Minus, PackageX, Plus, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ProductCard, { ProductImagePlaceholder } from '../components/ProductCard';
import { Empty, Field, Notice, PageLoader, Price, Reveal, Stars } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { approvedReviews, reviewEligibility, uploadImage } from '../lib/api';
import { db } from '../lib/backend';
import { useJsonLd, useSeo } from '../lib/seo';
import type { Product, Review } from '../lib/types';
import { cx, discountPercent, errorMessage, formatDate, inStock, isVideoFile, productInquiry, unitPrice, whatsappLink, youtubeEmbed } from '../lib/utils';

export function VideoPlayer({ url, className }: { url: string; className?: string }) {
  const yt = youtubeEmbed(url);
  if (yt) return <iframe src={yt} title="Product video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen className={cx('aspect-video w-full rounded-2xl', className)} />;
  if (isVideoFile(url)) return <video src={url} controls playsInline preload="metadata" className={cx('w-full rounded-2xl bg-espresso', className)} />;
  return <a href={url} target="_blank" rel="noreferrer" className="btn-outline btn-sm">Watch the video</a>;
}

function ReviewForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const { user, profile } = useAuth();
  const [state, setState] = useState<'checking' | 'ok' | 'not_purchased' | 'already' | 'sent'>('checking');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    reviewEligibility(user.id, product.id).then(setState).catch(() => setState('not_purchased'));
  }, [user, product.id]);

  if (!user) return <p className="text-sm text-espresso/60"><Link to="/login" className="text-wood underline">Sign in</Link> to review a piece you have purchased.</p>;
  if (state === 'checking') return null;
  if (state === 'not_purchased') return <p className="text-sm text-espresso/60">Reviews can be written once this piece has been delivered to you.</p>;
  if (state === 'already') return <p className="text-sm text-espresso/60">You have already reviewed this piece. Thank you!</p>;
  if (state === 'sent') return <Notice tone="ok">Thank you! Your review will appear once it has been approved.</Notice>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const image_url = file ? await uploadImage(file, `reviews/${user.id}`) : null;
      await db.insert('reviews', {
        product_id: product.id, user_id: user.id, customer_name: profile?.full_name || 'Woodture customer',
        rating, body: body.trim(), image_url, status: 'pending',
      });
      setState('sent'); onDone();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h3 className="text-xl text-walnut">Write a review</h3>
      <div><span className="label">Your rating</span><Stars value={rating} size={24} onChange={setRating} /></div>
      <Field label="Your review">
        <textarea required minLength={10} maxLength={1500} rows={4} value={body} onChange={e => setBody(e.target.value)} className="input" placeholder="How does it look and move in your space?" />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-wood">
        <ImagePlus size={16} />{file ? file.name : 'Add a photo (optional)'}
        <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Submit review'}</button>
    </form>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const { products, loading, general, money } = useStore();
  const { addToCart, toggleWishlist, wishlist, markViewed, recent, lines } = useShop();
  const navigate = useNavigate();
  const product = products.find(p => p.slug === slug);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => { setActive(0); setQty(1); }, [slug]);
  useEffect(() => {
    if (!product) return;
    markViewed(product.id);
    approvedReviews(product.id).then(setReviews).catch(() => setReviews([]));
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const related = useMemo(() => !product ? [] : products.filter(p => p.id !== product.id && p.category_id === product.category_id)
    .concat(products.filter(p => p.id !== product.id && p.category_id !== product.category_id)).slice(0, 4), [product, products]);
  const recentProducts = useMemo(() => recent.filter(id => id !== product?.id).map(id => products.find(p => p.id === id))
    .filter((p): p is Product => !!p).slice(0, 4), [recent, products, product]);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  useSeo(product ? product.seo_title || product.name : 'Product', product?.seo_description || product?.short_description, product?.images[0]?.url);
  useJsonLd(product ? {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.sku ?? undefined,
    description: product.short_description ?? undefined, image: product.images.map(i => i.url),
    offers: { '@type': 'Offer', price: unitPrice(product), priceCurrency: 'BDT', availability: `https://schema.org/${inStock(product) ? 'InStock' : 'OutOfStock'}` },
    ...(reviews.length ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avg.toFixed(1), reviewCount: reviews.length } } : {}),
  } : null);

  if (loading) return <PageLoader />;
  if (!product) return <Empty icon={<PackageX size={26} />} title="Piece not found" text="This sculpture may have been sold or moved." action={<Link to="/shop" className="btn-primary btn-sm">Browse the shop</Link>} />;

  const available = inStock(product);
  const inCart = lines.find(l => l.product.id === product.id)?.quantity ?? 0;
  const maxQty = Math.max(1, product.stock - inCart);
  const wished = wishlist.includes(product.id);
  const off = discountPercent(product);
  const wa = whatsappLink(general.whatsapp, productInquiry(product.name));
  const specs = [
    ['Material', product.material], ['Dimensions', product.dimensions], ['Weight', product.weight], ['SKU', product.sku],
  ].filter(([, v]) => v) as [string, string][];
  const image = product.images[active] ?? product.images[0];

  return (
    <div className="container-x py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-espresso/50">
        <Link to="/" className="hover:text-walnut">Home</Link><ChevronRight size={12} />
        <Link to="/shop" className="hover:text-walnut">Shop</Link>
        {product.category && <><ChevronRight size={12} /><Link to={`/shop?category=${product.category.slug}`} className="hover:text-walnut">{product.category.name}</Link></>}
        <ChevronRight size={12} /><span className="text-walnut">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-cream">
            <AnimatePresence mode="wait">
              {image ? (
                <motion.img key={image.url} src={image.url} alt={image.alt || product.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="h-full w-full object-cover" />
              ) : <ProductImagePlaceholder />}
            </AnimatePresence>
            {off > 0 && <span className="absolute left-4 top-4 rounded-full bg-walnut px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ivory">Save {off}%</span>}
          </div>
          {product.images.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button key={img.url + i} onClick={() => setActive(i)} aria-label={`View image ${i + 1}`}
                  className={cx('h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition', i === active ? 'border-wood' : 'border-transparent opacity-70 hover:opacity-100')}>
                  <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {product.category && <Link to={`/shop?category=${product.category.slug}`} className="eyebrow hover:text-walnut">{product.category.name}</Link>}
          <h1 className="mt-3 text-4xl leading-[1.1] text-walnut sm:text-5xl">{product.name}</h1>
          {reviews.length > 0 && (
            <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-espresso/60">
              <Stars value={avg} /> {avg.toFixed(1)} · {reviews.length} review{reviews.length > 1 ? 's' : ''}
            </a>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Price price={product.price} discount={product.discount_price} className="text-2xl" />
            {off > 0 && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-wood">You save {money(product.price - product.discount_price!)}</span>}
          </div>
          {product.short_description && <p className="mt-6 text-[15.5px] leading-relaxed text-espresso/70">{product.short_description}</p>}

          <p className={cx('mt-6 flex items-center gap-2 text-sm', available ? 'text-emerald-800' : 'text-espresso/50')}>
            <span className={cx('h-2 w-2 rounded-full', available ? 'bg-emerald-600' : 'bg-espresso/30')} />
            {available ? (product.stock <= 5 ? `In stock — only ${product.stock} left` : 'In stock') : 'Out of stock'}
          </p>

          {available && (
            <div className="mt-6 flex items-center gap-4">
              <span className="label !mb-0">Quantity</span>
              <div className="flex items-center rounded-full border border-walnut/20">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity" className="flex h-11 w-11 items-center justify-center text-walnut disabled:opacity-30" disabled={qty <= 1}><Minus size={15} /></button>
                <span className="w-8 text-center text-sm font-medium" aria-live="polite">{qty}</span>
                <button onClick={() => setQty(q => Math.min(maxQty, q + 1))} aria-label="Increase quantity" className="flex h-11 w-11 items-center justify-center text-walnut disabled:opacity-30" disabled={qty >= maxQty}><Plus size={15} /></button>
              </div>
            </div>
          )}

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button className="btn-primary" disabled={!available} onClick={() => addToCart(product, qty)}><ShoppingBag size={16} />Add to cart</button>
            <button className="btn-outline" disabled={!available} onClick={() => { if (inCart >= product.stock || addToCart(product, qty)) navigate('/checkout'); }}>Buy now</button>
            <button onClick={() => toggleWishlist(product)} aria-pressed={wished}
              className={cx('btn border border-walnut/15 !normal-case !tracking-normal', wished ? 'text-red-700' : 'text-walnut hover:bg-cream', !wa && 'sm:col-span-2')}>
              <Heart size={16} className={wished ? 'fill-current' : ''} />{wished ? 'Saved to wishlist' : 'Add to wishlist'}
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="btn border border-[#1FAF57]/40 !normal-case !tracking-normal text-[#157a3c] hover:bg-[#1FAF57]/10">
                <MessageCircle size={16} />Ask on WhatsApp
              </a>
            )}
          </div>

          <div className="mt-8 grid gap-3 rounded-2xl bg-cream/60 p-5 text-sm text-espresso/70 sm:grid-cols-2">
            <p className="flex items-center gap-3"><Truck size={18} className="shrink-0 text-wood" />Carefully packed &amp; delivered</p>
            <p className="flex items-center gap-3"><ShieldCheck size={18} className="shrink-0 text-wood" />Handcrafted from natural wood</p>
          </div>

          {product.description && (
            <section className="mt-10 border-t border-walnut/10 pt-8">
              <h2 className="text-2xl text-walnut">About this piece</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-espresso/70">
                {product.description.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
              </div>
            </section>
          )}
          {product.movement && (
            <section className="mt-8 border-t border-walnut/10 pt-8">
              <h2 className="text-2xl text-walnut">The movement</h2>
              <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-espresso/70">{product.movement}</p>
            </section>
          )}
          {specs.length > 0 && (
            <section className="mt-8 border-t border-walnut/10 pt-8">
              <h2 className="text-2xl text-walnut">Details</h2>
              <dl className="mt-4 divide-y divide-walnut/10 text-sm">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 py-3"><dt className="text-espresso/55">{k}</dt><dd className="text-right text-walnut">{v}</dd></div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>

      {product.video_url && (
        <Reveal className="mx-auto mt-20 max-w-4xl">
          <p className="eyebrow mb-3 text-center">See it move</p>
          <h2 className="mb-8 text-center text-3xl text-walnut sm:text-4xl">In motion</h2>
          <VideoPlayer url={product.video_url} />
        </Reveal>
      )}

      <section id="reviews" className="mt-20 scroll-mt-28 border-t border-walnut/10 pt-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-3xl text-walnut">Customer reviews</h2>
            {reviews.length > 0
              ? <p className="mt-3 flex items-center gap-3 text-sm text-espresso/60"><Stars value={avg} size={18} />{avg.toFixed(1)} out of 5 · {reviews.length} verified review{reviews.length > 1 ? 's' : ''}</p>
              : <p className="mt-3 text-sm text-espresso/60">No reviews yet for this piece.</p>}
            <div className="mt-6"><ReviewForm product={product} onDone={() => undefined} /></div>
          </div>
          <div className="space-y-5">
            {reviews.map(r => (
              <article key={r.id} className="card p-6">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="font-medium text-walnut">{r.customer_name}</p><p className="text-xs text-espresso/45">Verified purchase · {formatDate(r.created_at)}</p></div>
                  <Stars value={r.rating} />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-espresso/75">{r.body}</p>
                {r.image_url && <img src={r.image_url} alt="Customer photo" loading="lazy" className="mt-4 h-32 w-32 rounded-xl object-cover" />}
              </article>
            ))}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-10 text-3xl text-walnut sm:text-4xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">{related.map(p => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
      {recentProducts.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-10 text-3xl text-walnut sm:text-4xl">Recently viewed</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">{recentProducts.map(p => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
