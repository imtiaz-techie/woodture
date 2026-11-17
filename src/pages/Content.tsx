import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Facebook, Heart, Images, Instagram, Mail, MapPin, MessageCircle, Phone, PlayCircle, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Empty, Field, Notice, PageHeader, PageLoader, Reveal, SectionHeading } from '../components/ui';
import { useShop } from '../context/Shop';
import { useStore } from '../context/Store';
import { db } from '../lib/backend';
import { useSeo } from '../lib/seo';
import type { GalleryItem } from '../lib/types';
import { errorMessage, whatsappLink } from '../lib/utils';
import { CollectionCard } from './Home';
import { VideoPlayer } from './ProductPage';

export function Collections() {
  const { categories, products, loading } = useStore();
  useSeo('Collections', 'Explore Woodture collections of handcrafted kinetic wooden art.');
  return (
    <>
      <PageHeader eyebrow="Collections" title="Our Collections" text="Each collection explores a different kind of movement — find the one that moves you." />
      <div className="container-x py-12 sm:py-16">
        {loading ? <PageLoader /> : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {categories.map((c, i) => <CollectionCard key={c.id} category={c} products={products} index={i} />)}
          </div>
        )}
      </div>
    </>
  );
}

export function Wishlist() {
  const { wishlist } = useShop();
  const { products, loading } = useStore();
  useSeo('Wishlist');
  const items = products.filter(p => wishlist.includes(p.id));
  return (
    <>
      <PageHeader eyebrow="Saved for later" title="Wishlist" />
      <div className="container-x py-12 sm:py-16">
        {loading ? <PageLoader /> : items.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">{items.map(p => <ProductCard key={p.id} product={p} />)}</div>
        ) : (
          <Empty icon={<Heart size={26} />} title="Your wishlist is empty" text="Tap the heart on any piece to save it here." action={<Link to="/shop" className="btn-primary btn-sm">Browse the shop</Link>} />
        )}
      </div>
    </>
  );
}

export function Gallery() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useSeo('Gallery', 'Photos and videos of Woodture kinetic wooden sculptures.');

  useEffect(() => {
    db.select<GalleryItem>('gallery_items', { eq: { is_published: true }, order: [['sort_order', 'asc'], ['created_at', 'desc']] }).then(setItems).catch(() => setItems([]));
  }, []);

  const step = useCallback((d: number) => setOpen(i => (i == null || !items ? i : (i + d + items.length) % items.length)), [items]);
  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, step]);

  const current = open != null && items ? items[open] : null;
  return (
    <>
      <PageHeader eyebrow="Gallery" title="Art in Motion" text="Sculptures, details and moments from the workshop." />
      <div className="container-x py-12 sm:py-16">
        {!items ? <PageLoader /> : !items.length ? (
          <Empty icon={<Images size={26} />} title="Gallery coming soon" text="Photos and videos of our work will appear here." />
        ) : (
          <div className="columns-2 gap-3 sm:gap-5 lg:columns-3">
            {items.map((g, i) => (
              <motion.button key={g.id} onClick={() => setOpen(i)} aria-label={g.caption || `Open gallery item ${i + 1}`}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
                className="group relative mb-3 block w-full overflow-hidden rounded-2xl bg-cream sm:mb-5" style={{ breakInside: 'avoid' }}>
                {g.type === 'video'
                  ? <><video src={g.url} muted playsInline preload="metadata" className="w-full" /><PlayCircle className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-ivory drop-shadow-lg" /></>
                  : <img src={g.url} alt={g.caption ?? ''} loading="lazy" className="w-full transition duration-[1200ms] group-hover:scale-105" />}
                {g.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-espresso/70 to-transparent p-4 pt-10 text-left text-sm text-ivory opacity-0 transition group-hover:opacity-100">{g.caption}</span>}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {current && (
          <motion.div role="dialog" aria-modal="true" aria-label="Gallery viewer" className="fixed inset-0 z-[70] flex items-center justify-center bg-espresso/95 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
            <button aria-label="Close" className="absolute right-4 top-4 rounded-full bg-ivory/10 p-3 text-ivory hover:bg-ivory/20"><X size={22} /></button>
            <button aria-label="Previous" onClick={e => { e.stopPropagation(); step(-1); }} className="absolute left-3 rounded-full bg-ivory/10 p-3 text-ivory hover:bg-ivory/20 sm:left-6"><ChevronLeft size={24} /></button>
            <button aria-label="Next" onClick={e => { e.stopPropagation(); step(1); }} className="absolute right-3 rounded-full bg-ivory/10 p-3 text-ivory hover:bg-ivory/20 sm:right-6"><ChevronRight size={24} /></button>
            <motion.figure key={current.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="max-h-full max-w-5xl" onClick={e => e.stopPropagation()}>
              {current.type === 'video'
                ? <video src={current.url} controls autoPlay playsInline className="max-h-[80vh] rounded-xl" />
                : <img src={current.url} alt={current.caption ?? ''} className="max-h-[80vh] rounded-xl object-contain" />}
              {current.caption && <figcaption className="mt-4 text-center text-sm text-cream/80">{current.caption}</figcaption>}
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function About() {
  const { homepage, products } = useStore();
  useSeo('About Us', 'Woodture transforms wood into kinetic art — craftsmanship, natural beauty and mechanical creativity.');
  const paragraphs = homepage.about_text.split(/\n{2,}/).filter(Boolean);
  const process = [
    ['Imagine', 'An idea begins with movement — the beat of a wing, the drift of a fin — and a sketch of how wood could express it.'],
    ['Select', 'Wood is chosen for its grain, tone and strength, so every piece carries its own natural character.'],
    ['Shape', 'Forms are cut, carved and sanded by hand, then finished to bring out the warmth of the timber.'],
    ['Animate', 'Mechanisms are assembled and balanced until the motion is smooth, quiet and captivating.'],
  ];
  const showcase = products.filter(p => p.is_featured).slice(0, 4);
  const video = products.find(p => p.video_url)?.video_url;
  return (
    <>
      <section className="container-x pb-12 pt-14 text-center sm:pt-20">
        <p className="eyebrow flex items-center justify-center gap-3"><span className="h-px w-10 bg-gold" />Our Story<span className="h-px w-10 bg-gold" /></p>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl leading-[1.1] text-walnut sm:text-6xl">Wood is more than a material.</h1>
      </section>
      <div className="mx-auto max-w-[1800px] sm:px-6 lg:px-8">
        <img src={homepage.hero_image || '/brand/cover.jpg'} alt="Woodture kinetic sculptures" className="h-[280px] w-full object-cover sm:h-auto sm:max-h-[560px] sm:rounded-[2rem]" />
      </div>

      <section className="container-x grid gap-10 py-20 sm:py-28 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <Reveal>
          <p className="eyebrow mb-4 flex items-center gap-3"><span className="h-px w-8 bg-gold" />Philosophy</p>
          <h2 className="text-4xl leading-tight text-walnut">A medium for creativity, imagination and artistic expression.</h2>
          <img src="/brand/logo-full.png" alt="Woodture — Kinetic Wood Art" className="mt-10 hidden w-56 lg:block" />
        </Reveal>
        <Reveal delay={0.1} className="space-y-6">
          {paragraphs.map((p, i) => <p key={i} className={i === 0 ? 'font-display text-2xl leading-relaxed text-walnut' : 'text-[17px] leading-[1.85] text-espresso/70'}>{p}</p>)}
        </Reveal>
      </section>

      <section className="bg-espresso py-20 text-cream sm:py-28">
        <div className="container-x">
          <Reveal className="mb-14 text-center">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-luxe text-gold">Creative Process</p>
            <h2 className="text-4xl text-ivory sm:text-5xl">From timber to motion</h2>
          </Reveal>
          <div className="grid gap-px overflow-hidden rounded-2xl bg-cream/10 sm:grid-cols-2 lg:grid-cols-4">
            {process.map(([title, text], i) => (
              <Reveal key={title} delay={i * 0.08} className="bg-espresso p-8">
                <span className="font-display text-4xl text-gold">0{i + 1}</span>
                <h3 className="mt-4 text-2xl text-ivory">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream/60">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {video && (
        <section className="container-x py-20 sm:py-28">
          <SectionHeading eyebrow="Craftsmanship" title="See the movement" />
          <div className="mx-auto max-w-4xl"><VideoPlayer url={video} /></div>
        </section>
      )}

      {showcase.length > 0 && (
        <section className="container-x py-20 sm:py-28">
          <SectionHeading eyebrow="Showcase" title="Pieces we are proud of" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">{showcase.map(p => <ProductCard key={p.id} product={p} />)}</div>
          <div className="mt-12 text-center"><Link to="/shop" className="btn-primary">Explore the collection</Link></div>
        </section>
      )}
    </>
  );
}

export function Contact() {
  const { general } = useStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');
  useSeo('Contact Us', 'Get in touch with Woodture about our kinetic wooden art or a custom piece.');
  const wa = whatsappLink(general.whatsapp, 'Hello Woodture! I would like to know more about your kinetic wooden art.');
  const bind = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value })) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) { setError('Please add an email or phone number so we can reply.'); return; }
    setState('busy'); setError('');
    try {
      await db.insert('inquiries', { kind: 'contact', ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])), status: 'new' }, false);
      setState('sent');
    } catch (err) { setError(errorMessage(err)); setState('idle'); }
  };

  const rows = [
    general.phone && { icon: <Phone size={18} />, label: 'Phone', text: general.phone, href: `tel:${general.phone.replace(/\s/g, '')}` },
    general.email && { icon: <Mail size={18} />, label: 'Email', text: general.email, href: `mailto:${general.email}` },
    general.address && { icon: <MapPin size={18} />, label: 'Address', text: general.address },
    general.facebook && { icon: <Facebook size={18} />, label: 'Facebook', text: 'Follow us on Facebook', href: general.facebook },
    general.instagram && { icon: <Instagram size={18} />, label: 'Instagram', text: 'Follow us on Instagram', href: general.instagram },
  ].filter(Boolean) as { icon: JSX.Element; label: string; text: string; href?: string }[];

  return (
    <>
      <PageHeader eyebrow="Contact" title="Let’s talk" text="Questions about a piece, an order, or a custom creation? We would love to hear from you." />
      <div className="container-x grid gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <div>
          <h2 className="text-3xl text-walnut">Get in touch</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-espresso/65">Send us a message and we will get back to you as soon as we can.</p>
          <ul className="mt-8 space-y-5">
            {rows.map(r => (
              <li key={r.label} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream text-wood">{r.icon}</span>
                <span><span className="label !mb-0.5">{r.label}</span>
                  {r.href ? <a href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="text-walnut hover:text-wood">{r.text}</a> : <span className="whitespace-pre-line text-walnut">{r.text}</span>}
                </span>
              </li>
            ))}
          </ul>
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn mt-8 bg-[#1FAF57] !normal-case !tracking-normal text-white hover:bg-[#178f46]"><MessageCircle size={17} />Chat on WhatsApp</a>}
        </div>
        <div className="card p-6 sm:p-9">
          {state === 'sent' ? (
            <div className="py-10 text-center">
              <h2 className="text-3xl text-walnut">Thank you</h2>
              <p className="mt-3 text-sm text-espresso/65">Your message has been received. We will be in touch soon.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2"><input required maxLength={120} className="input" {...bind('name')} /></Field>
              <Field label="Email"><input type="email" maxLength={200} className="input" {...bind('email')} /></Field>
              <Field label="Phone"><input type="tel" maxLength={30} className="input" {...bind('phone')} /></Field>
              <Field label="Subject" hint="(optional)" className="sm:col-span-2"><input maxLength={200} className="input" {...bind('subject')} /></Field>
              <Field label="Message" className="sm:col-span-2"><textarea required minLength={5} maxLength={4000} rows={5} className="input" {...bind('message')} /></Field>
              {error && <div className="sm:col-span-2"><Notice tone="error">{error}</Notice></div>}
              <button className="btn-primary sm:col-span-2" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Send message'}</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export function Policy({ kind }: { kind: 'privacy' | 'terms' | 'shipping' }) {
  const { general, money } = useStore();
  const name = general.business_name || 'Woodture';
  const titles = { privacy: 'Privacy Policy', terms: 'Terms & Conditions', shipping: 'Shipping & Returns Policy' };
  useSeo(titles[kind]);
  const { inside, outside, free_over } = general.shipping;
  const contact = <>Please <Link to="/contact" className="text-wood underline">contact us</Link> and we will be glad to help.</>;
  return (
    <>
      <PageHeader eyebrow="Customer Care" title={titles[kind]} />
      <article className="prose-wt container-x max-w-3xl py-12 sm:py-16">
        {kind === 'privacy' && (<>
          <p>{name} respects your privacy. This policy explains what information we collect when you use this website and how we use it.</p>
          <h2>Information we collect</h2>
          <ul>
            <li>Details you give us when ordering or creating an account: name, phone number, email address and delivery address.</li>
            <li>Order history, wishlist and cart contents linked to your account.</li>
            <li>Messages you send through the contact form, and your email if you subscribe to our newsletter.</li>
          </ul>
          <h2>How we use it</h2>
          <ul>
            <li>To process, deliver and support your orders.</li>
            <li>To contact you about an order or reply to your enquiry.</li>
            <li>To send newsletters, only if you subscribed. You can unsubscribe at any time.</li>
          </ul>
          <h2>Payments</h2>
          <p>Online payments are processed by our payment partners. We do not store your card or wallet credentials on this website.</p>
          <h2>Sharing</h2>
          <p>We share your delivery details with delivery partners only as needed to complete your order. We do not sell your personal information.</p>
          <h2>Your choices</h2>
          <p>You can update your profile and saved addresses from your account, or ask us to correct or delete your information. {contact}</p>
        </>)}
        {kind === 'terms' && (<>
          <p>By using this website and placing an order with {name}, you agree to the following terms.</p>
          <h2>Products</h2>
          <p>Every piece is handcrafted from natural wood. Grain, tone and small details vary from piece to piece and may differ slightly from the photographs — this is part of the character of handmade art.</p>
          <h2>Orders &amp; pricing</h2>
          <ul>
            <li>Prices are shown in {general.currency} and may change without notice; the price at the time of your order applies.</li>
            <li>An order is accepted once we confirm it. We may cancel an order if an item is unavailable or a pricing error occurred, and will refund any payment made.</li>
          </ul>
          <h2>Payment</h2>
          <p>We accept the payment methods shown at checkout. Orders paid online or by bank/mobile transfer are processed once payment is verified.</p>
          <h2>Care &amp; use</h2>
          <p>Kinetic sculptures have delicate moving parts. Please handle them gently, keep them dry and away from prolonged direct heat.</p>
          <h2>Intellectual property</h2>
          <p>All designs, photographs and content on this website belong to {name} and may not be reproduced without permission.</p>
          <h2>Questions</h2>
          <p>{contact}</p>
        </>)}
        {kind === 'shipping' && (<>
          <h2 className="!mt-0">Delivery</h2>
          <ul>
            {Number(inside) === Number(outside)
              ? <li>Delivery charge: {Number(inside) > 0 ? money(Number(inside)) : 'free'}.</li>
              : <><li>Inside Dhaka: {Number(inside) > 0 ? money(Number(inside)) : 'free'}.</li><li>Outside Dhaka: {Number(outside) > 0 ? money(Number(outside)) : 'free'}.</li></>}
            {Number(free_over) > 0 && <li>Free delivery on orders over {money(Number(free_over))}.</li>}
            <li>Each piece is carefully packed to protect its moving parts. We will contact you to confirm your order before dispatch.</li>
            <li>You can follow your order any time on the <Link to="/track" className="text-wood underline">order tracking</Link> page.</li>
          </ul>
          <h2>Damaged or incorrect items</h2>
          <p>Please check your parcel on arrival. If a piece arrives damaged or is not what you ordered, contact us promptly with your order number and photos so we can arrange a repair, replacement or refund.</p>
          <h2>Returns</h2>
          <p>If you would like to return a piece, please get in touch before sending it back. Returned items should be unused and in their original packaging. Custom-made pieces cannot be returned unless they arrive damaged or faulty.</p>
          <h2>Cancellations</h2>
          <p>An order can be cancelled before it has been shipped. {contact}</p>
        </>)}
      </article>
    </>
  );
}

export function NotFound() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <img src="/brand/bird.png" alt="" className="h-20 opacity-60" />
      <h1 className="mt-6 text-5xl text-walnut">This page has flown away</h1>
      <p className="mt-3 text-sm text-espresso/60">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}
