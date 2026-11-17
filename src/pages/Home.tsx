import { motion } from 'framer-motion';
import { ArrowRight, Cog, Hand, PlayCircle, TreePine } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import ProductCard, { ProductImagePlaceholder } from '../components/ProductCard';
import { Reveal, SectionHeading, Stars } from '../components/ui';
import { useStore } from '../context/Store';
import { approvedReviews } from '../lib/api';
import { db } from '../lib/backend';
import { useSeo } from '../lib/seo';
import type { Category, GalleryItem, Product, Review } from '../lib/types';
import { errorMessage, formatDate, primaryImage } from '../lib/utils';

const ease = [0.22, 1, 0.36, 1] as const;

function Hero() {
  const { homepage, general } = useStore();
  return (
    <section className="relative overflow-hidden">
      <div className="container-x pb-10 pt-12 text-center sm:pb-14 sm:pt-20">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="eyebrow flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-gold" />{general.tagline}<span className="h-px w-10 bg-gold" />
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease }}
          className="mx-auto mt-6 max-w-4xl text-[2.6rem] leading-[1.08] text-walnut sm:text-6xl lg:text-7xl">
          {homepage.hero_heading}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.25, ease }}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-espresso/65 sm:text-lg">
          {homepage.hero_description}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4, ease }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/shop" className="btn-primary w-full sm:w-auto">Explore Collection <ArrowRight size={15} /></Link>
          <Link to="/about" className="btn-outline w-full sm:w-auto">Discover Our Story</Link>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, delay: 0.3, ease }}
        className="mx-auto max-w-[1800px] px-0 sm:px-6 lg:px-8">
        <div className="overflow-hidden bg-cream sm:rounded-[2rem]">
          <img src={homepage.hero_image || '/brand/cover.jpg'} alt="Woodture kinetic wooden sculptures in warm natural light"
            className="h-[300px] w-full object-cover sm:h-auto sm:max-h-[640px]" />
        </div>
      </motion.div>
    </section>
  );
}

function Intro() {
  const { homepage } = useStore();
  const pillars = [
    { icon: <TreePine size={22} />, title: 'Natural wood', text: 'Chosen for grain, warmth and character.' },
    { icon: <Hand size={22} />, title: 'Made by hand', text: 'Shaped, sanded and finished piece by piece.' },
    { icon: <Cog size={22} />, title: 'Alive with motion', text: 'Mechanisms tuned for a calm, flowing rhythm.' },
  ];
  return (
    <section className="container-x py-20 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <Reveal>
          <p className="eyebrow mb-4 flex items-center gap-3"><span className="h-px w-8 bg-gold" />Our Philosophy</p>
          <h2 className="text-4xl leading-tight text-walnut sm:text-5xl">{homepage.intro_heading}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-[17px] leading-[1.85] text-espresso/70">{homepage.intro_text}</p>
          <Link to="/about" className="link-underline mt-6 inline-flex items-center gap-2 text-[12.5px] font-medium uppercase tracking-[0.16em] text-wood">
            Read our story <ArrowRight size={14} />
          </Link>
        </Reveal>
      </div>
      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-walnut/10 bg-walnut/10 sm:grid-cols-3">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08} className="bg-ivory p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cream text-wood">{p.icon}</div>
            <h3 className="text-xl text-walnut">{p.title}</h3>
            <p className="mt-1.5 text-sm text-espresso/60">{p.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function CollectionCard({ category, products, index = 0 }: { category: Category; products: Product[]; index?: number }) {
  const inCat = products.filter(p => p.category_id === category.id);
  const img = category.image_url || (inCat[0] && primaryImage(inCat[0]));
  return (
    <Reveal delay={(index % 3) * 0.08}>
      <Link to={`/shop?category=${category.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-cream">
        {img ? <img src={img} alt={category.name} loading="lazy" className="h-full w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-[1.06]" /> : <ProductImagePlaceholder />}
        <div className="absolute inset-0 bg-gradient-to-t from-espresso/75 via-espresso/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-ivory">
          <p className="text-[10.5px] uppercase tracking-luxe text-cream/75">{inCat.length} {inCat.length === 1 ? 'piece' : 'pieces'}</p>
          <h3 className="mt-1 text-2xl leading-snug">{category.name}</h3>
          <span className="mt-3 inline-flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.16em] text-cream/90 transition group-hover:gap-3">
            Explore <ArrowRight size={14} />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

function ProductRow({ eyebrow, title, items, to }: { eyebrow: string; title: string; items: Product[]; to: string }) {
  if (!items.length) return null;
  return (
    <section className="container-x py-14 sm:py-20">
      <SectionHeading align="left" eyebrow={eyebrow} title={title}
        action={<Link to={to} className="link-underline inline-flex shrink-0 items-center gap-2 self-start text-[12.5px] font-medium uppercase tracking-[0.16em] text-wood sm:self-auto">View all <ArrowRight size={14} /></Link>} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
        {items.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function Craftsmanship() {
  const { homepage } = useStore();
  const steps = [
    ['01', 'Sketch the motion', 'Every piece starts with a study of how it should move.'],
    ['02', 'Shape the wood', 'Forms are cut, carved and sanded by hand until they feel right.'],
    ['03', 'Tune the mechanism', 'Weights, lines and joints are balanced for smooth, lasting movement.'],
  ];
  return (
    <section className="bg-espresso py-20 text-cream sm:py-28">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal className="relative">
          <div className="overflow-hidden rounded-2xl">
            <img src={homepage.craft_image || '/samples/manta.jpg'} alt="Kinetic wooden sculpture detail" loading="lazy" className="aspect-[5/4] w-full object-cover" />
          </div>
          <div className="absolute -bottom-5 -right-3 hidden rounded-2xl bg-gold px-6 py-5 text-espresso shadow-lift sm:block">
            <p className="font-display text-2xl leading-none">Handcrafted</p>
            <p className="mt-1 text-[10.5px] uppercase tracking-luxe">piece by piece</p>
          </div>
        </Reveal>
        <div>
          <Reveal>
            <p className="mb-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-luxe text-gold"><span className="h-px w-8 bg-gold" />Craftsmanship</p>
            <h2 className="text-4xl leading-tight text-ivory sm:text-5xl">{homepage.craft_heading}</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-cream/65">{homepage.craft_text}</p>
          </Reveal>
          <div className="mt-10 space-y-6">
            {steps.map(([n, title, text], i) => (
              <Reveal key={n} delay={i * 0.08} className="flex gap-5 border-t border-cream/10 pt-6">
                <span className="font-display text-2xl text-gold">{n}</span>
                <div>
                  <h3 className="text-xl text-ivory">{title}</h3>
                  <p className="mt-1 text-sm text-cream/55">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GalleryPreview() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  useEffect(() => {
    db.select<GalleryItem>('gallery_items', { eq: { is_published: true }, order: [['sort_order', 'asc']], limit: 5 }).then(setItems).catch(() => undefined);
  }, []);
  if (items.length < 3) return null;
  return (
    <section className="container-x py-20 sm:py-28">
      <SectionHeading eyebrow="Gallery" title="Art in motion" text="Glimpses of our sculptures, in the workshop and at home." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
        {items.map((g, i) => (
          <Reveal key={g.id} delay={i * 0.05} className={i === 0 ? 'col-span-2 lg:row-span-2' : ''}>
            <Link to="/gallery" className="group relative block h-full overflow-hidden rounded-2xl bg-cream">
              {g.type === 'video'
                ? <video src={g.url} muted playsInline preload="metadata" className="aspect-square h-full w-full object-cover" />
                : <img src={g.url} alt={g.caption ?? 'Woodture gallery'} loading="lazy" className="aspect-square h-full w-full object-cover transition duration-[1200ms] group-hover:scale-105" />}
              {g.type === 'video' && <PlayCircle className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-ivory drop-shadow" />}
            </Link>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 text-center"><Link to="/gallery" className="btn-outline">View Gallery</Link></div>
    </section>
  );
}

function Testimonials() {
  const { products } = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => { approvedReviews().then(r => setReviews(r.slice(0, 3))).catch(() => undefined); }, []);
  if (!reviews.length) return null; // only real, approved customer reviews are ever shown
  return (
    <section className="bg-cream/60 py-20 sm:py-28">
      <div className="container-x">
        <SectionHeading eyebrow="Testimonials" title="Words from our customers" />
        <div className="grid gap-6 md:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.id} delay={i * 0.08} className="card flex flex-col p-8">
              <Stars value={r.rating} size={16} />
              <p className="mt-5 flex-1 font-display text-lg italic leading-relaxed text-walnut">“{r.body}”</p>
              <div className="mt-6 border-t border-walnut/10 pt-4 text-sm">
                <p className="font-medium text-walnut">{r.customer_name}</p>
                <p className="text-xs text-espresso/50">{products.find(p => p.id === r.product_id)?.name} · {formatDate(r.created_at)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('busy'); setError('');
    try {
      await db.insert('inquiries', { kind: 'newsletter', email: email.trim(), status: 'new' }, false);
      setState('done');
    } catch (err) { setError(errorMessage(err)); setState('idle'); }
  };
  return (
    <section className="container-x py-20 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow mb-4">Newsletter</p>
        <h2 className="text-3xl text-walnut sm:text-4xl">Be first to see new creations</h2>
        <p className="mt-3 text-[15px] text-espresso/60">Occasional notes on new arrivals and workshop stories. Unsubscribe anytime.</p>
        {state === 'done' ? (
          <p className="mt-8 font-display text-xl text-wood">Thank you — you’re on the list.</p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" aria-label="Email address" className="input !rounded-full !px-6" />
            <button className="btn-primary shrink-0" disabled={state === 'busy'}>Subscribe</button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-0 pb-0 sm:px-6 sm:pb-8 lg:px-8">
      <div className="relative mx-auto max-w-[1800px] overflow-hidden bg-walnut sm:rounded-[2rem]">
        <img src="/brand/bird.png" alt="" className="pointer-events-none absolute -right-10 top-1/2 w-[420px] -translate-y-1/2 opacity-[0.13] sm:right-10" />
        <Reveal className="relative px-6 py-20 text-center sm:py-28">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-luxe text-gold">Woodture</p>
          <h2 className="text-4xl text-ivory sm:text-6xl">Bring Art Into Motion.</h2>
          <Link to="/shop" className="btn-light mt-9">Explore Our Collection <ArrowRight size={15} /></Link>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const { products, categories } = useStore();
  useSeo();
  const featuredCats = categories.filter(c => c.is_featured);
  const byNewest = (a: Product, b: Product) => +new Date(b.published_at ?? b.created_at) - +new Date(a.published_at ?? a.created_at);
  const newArrivals = products.filter(p => p.is_new_arrival).sort(byNewest);
  const bestsellers = products.filter(p => p.is_bestseller || p.sales_count > 0).sort((a, b) => b.sales_count - a.sales_count);
  const featured = products.filter(p => p.is_featured);

  return (
    <>
      <Hero />
      <Intro />
      {featuredCats.length > 0 && (
        <section className="bg-cream/60 py-20 sm:py-28">
          <div className="container-x">
            <SectionHeading eyebrow="Collections" title="Explore by collection" text="From birds in flight to mythical dragons — find the movement that speaks to you." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {featuredCats.map((c, i) => <CollectionCard key={c.id} category={c} products={products} index={i} />)}
            </div>
          </div>
        </section>
      )}
      <ProductRow eyebrow="Just Landed" title="New Arrivals" items={newArrivals} to="/new-arrivals" />
      <ProductRow eyebrow="Most Loved" title="Bestselling Pieces" items={bestsellers} to="/shop?sort=bestselling" />
      <Craftsmanship />
      <ProductRow eyebrow="Curated" title="Featured Sculptures" items={featured} to="/shop?filter=featured" />
      <GalleryPreview />
      <Testimonials />
      <Newsletter />
      <FinalCta />
    </>
  );
}
