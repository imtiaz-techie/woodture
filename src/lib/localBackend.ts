// DEMO MODE backend. Keeps everything in this browser (IndexedDB) so the whole
// site, checkout and admin can be tried before Supabase is connected.
// It mirrors the SQL functions/triggers in supabase/migrations. Not for production.
import type { AuthUser, Backend, Query } from './backend';
import { DEFAULT_GENERAL } from './types';

export const DEMO_ADMIN = { email: 'admin@woodture.demo', password: 'woodture-admin' };

type Row = Record<string, any>;
type Data = Record<string, Row[]>;

const DB_NAME = 'woodture-demo';
const SESSION_KEY = 'wt_demo_session';
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(): Promise<Data | undefined> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction('kv').objectStore('kv').get('data');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(data: Data): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(data, 'data');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function hash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function seed(): Promise<Data> {
  const cats = [
    ['Kinetic Flying Birds', 'Wings that rise and fall with a gentle, lifelike rhythm.'],
    ['Wooden Dragon Sculptures', 'Mythical forms brought to life through carved wood and motion.'],
    ['Mechanical Animal Sculptures', 'Creatures of land and sea, moving through hand-built mechanisms.'],
    ['Wooden Automata', 'Playful mechanical characters with a story in every turn.'],
    ['Creative Wooden Decorations', 'Artful accents that bring natural warmth to any space.'],
    ['Custom Wooden Art', 'One-of-a-kind pieces created around your idea.'],
  ].map(([name, description], i) => ({
    id: uid(), name, description, slug: name.toLowerCase().replace(/\s+/g, '-'), image_url: null,
    sort_order: i + 1, is_featured: true, is_active: true, created_at: now(),
  }));

  // Sample products (photos cropped from the brand cover). Names and prices are
  // placeholders for the demo — replace them from the admin dashboard.
  const samples: [string, string, number, number, string, string, Partial<Row>][] = [
    ['Kinetic Manta Ray', 'manta', 2, 6800, 'A graceful manta ray whose wings rise and fall in a slow, calming wave.', 'Suspended weights and fine lines translate a gentle push into a long, flowing wingbeat.', { is_featured: true, is_new_arrival: true, is_bestseller: true }],
    ['Kinetic Wooden Dragon', 'dragon', 1, 7500, 'A winged dragon in dark walnut tones, poised mid-flight on a solid wooden base.', 'Counter-weighted wings beat in rhythm once set in motion.', { is_featured: true, is_bestseller: true }],
    ['Kinetic Flying Bird', 'bird', 0, 4500, 'A hand-shaped bird that glides on balanced wings above a walnut block.', 'Balanced wings swing smoothly up and down with a light touch.', { is_new_arrival: true, is_featured: true }],
    ['The Little Reader Automaton', 'reader', 3, 3200, 'A cheerful wooden character lost in a tiny red book, bobbing on a spring.', 'A spring mount gives the figure a playful nodding motion.', { is_new_arrival: true }],
    ['Wooden Jellyfish', 'jellyfish', 4, 3900, 'A soft-toned jellyfish with flowing carved tentacles that sway like water.', 'Free-hanging tentacles drift and sway when the dome is moved.', { is_featured: true }],
    ['Kinetic Sea Turtle', 'turtle', 2, 5200, 'A sea turtle with a segmented shell, swimming above its wooden base.', 'Linked rods move the flippers in a swimming stroke.', { is_bestseller: true }],
  ];
  const products: Row[] = [];
  const images: Row[] = [];
  const inventory: Row[] = [];
  samples.forEach(([name, img, cat, price, short, movement, flags], i) => {
    const id = uid();
    const created = new Date(Date.now() - i * 86400000).toISOString();
    products.push({
      id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), category_id: cats[cat].id,
      short_description: short, description: `${short}\n\nEach piece is shaped, finished and assembled by hand, so grain and tone vary slightly from one sculpture to the next.`,
      price, discount_price: null, video_url: null, material: 'Natural hardwood', dimensions: null, weight: null,
      movement, sku: `WT-${String(i + 1).padStart(3, '0')}`, stock: 8, is_available: true,
      is_featured: false, is_new_arrival: false, is_bestseller: false, ...flags,
      status: 'published', seo_title: null, seo_description: null, sales_count: 0,
      published_at: created, created_at: created, updated_at: created,
    });
    images.push({ id: uid(), product_id: id, url: `/samples/${img}.jpg`, alt: name, sort_order: 0, is_primary: true, created_at: created });
    inventory.push({ id: uid(), product_id: id, change: 8, stock_after: 8, reason: 'initial', order_id: null, created_at: created });
  });

  const gallery = ['/brand/cover.jpg', '/samples/manta.jpg', '/samples/dragon.jpg', '/samples/jellyfish.jpg', '/samples/turtle.jpg', '/samples/bird.jpg']
    .map((url, i) => ({ id: uid(), type: 'image', url, caption: null, sort_order: i, is_published: true, created_at: now() }));

  const adminId = uid();
  return {
    auth_users: [{ id: adminId, email: DEMO_ADMIN.email, password_hash: await hash(DEMO_ADMIN.password) }],
    profiles: [{ id: adminId, email: DEMO_ADMIN.email, full_name: 'Woodture Admin', phone: '', role: 'admin', created_at: now() }],
    categories: cats, products, product_images: images, inventory_transactions: inventory, gallery_items: gallery,
    website_settings: [{ key: 'general', value: DEFAULT_GENERAL }, { key: 'homepage', value: {} }],
  };
}

export function createLocalBackend(): Backend {
  let data: Data = {};
  const ready: Promise<void> = (async () => {
    try {
      data = (await idbGet()) ?? (await seed());
    } catch {
      data = await seed();
    }
    await idbSet(data).catch(() => undefined);
  })();

  const table = (name: string) => (data[name] ??= []);
  const persist = () => idbSet(data).catch(() => undefined);
  const matches = (row: Row, match: Record<string, unknown>) => Object.entries(match).every(([k, v]) => row[k] === v);
  const listeners = new Set<(u: AuthUser | null, e: string) => void>();
  const sessionUser = (): AuthUser | null => {
    const id = localStorage.getItem(SESSION_KEY);
    const u = id && table('auth_users').find(r => r.id === id);
    return u ? { id: u.id, email: u.email } : null;
  };
  const emit = (event: string) => listeners.forEach(cb => cb(sessionUser(), event));

  const logStock = (product_id: string, change: number, stock_after: number, reason: string, order_id: string | null = null) =>
    table('inventory_transactions').push({ id: uid(), product_id, change, stock_after, reason, order_id, created_at: now() });

  const DEFAULTS: Record<string, Row> = {
    products: { sales_count: 0, stock: 0 },
    coupons: { used_count: 0 },
    reviews: { status: 'pending' },
    inquiries: { status: 'new' },
  };

  function orderJson(o: Row) {
    const { internal_notes, stock_restored, user_id, ...rest } = o;
    const pay = table('payments').filter(p => p.order_id === o.id).pop();
    return {
      ...rest,
      items: table('order_items').filter(i => i.order_id === o.id),
      payment: pay ? { provider: pay.provider, status: pay.status, payer_ref: pay.payer_ref } : null,
    };
  }

  function couponDiscount(code: string, subtotal: number): { valid: boolean; message: string; code?: string; discount?: number } {
    const c = table('coupons').find(r => r.code === (code ?? '').trim().toUpperCase());
    const bad = (message: string) => ({ valid: false, message });
    if (!c || !c.is_active) return bad('This code is not valid.');
    if (c.starts_at && Date.now() < +new Date(c.starts_at)) return bad('This code is not active yet.');
    if (c.expires_at && Date.now() > +new Date(c.expires_at)) return bad('This code has expired.');
    if (c.usage_limit != null && c.used_count >= c.usage_limit) return bad('This code has reached its usage limit.');
    if (subtotal < Number(c.min_order)) return bad(`Minimum order for this code is ${c.min_order}.`);
    const d = Math.min(subtotal, c.type === 'percent' ? Math.round(subtotal * c.value) / 100 : Number(c.value));
    return { valid: true, code: c.code, discount: d, message: 'Code applied.' };
  }

  function placeOrder(p: Row) {
    const req = (v: unknown, min: number, msg: string) => { if (String(v ?? '').trim().length < min) throw new Error(msg); };
    req(p.customer_name, 2, 'Please enter your full name.');
    if (!/^\+?[0-9 ()-]{6,20}$/.test(String(p.phone ?? '').trim())) throw new Error('Please enter a valid phone number.');
    req(p.address, 5, 'Please enter your delivery address.');
    req(p.city, 2, 'Please enter your city or district.');
    if (!Array.isArray(p.items) || !p.items.length) throw new Error('Your cart is empty.');
    const settings = table('website_settings').find(r => r.key === 'general')?.value ?? DEFAULT_GENERAL;
    const pay = settings.payment ?? DEFAULT_GENERAL.payment;
    const method = p.payment_method ?? 'cod';
    if (method === 'cod' && pay.cod_enabled === false) throw new Error('Cash on delivery is unavailable.');
    if (method === 'manual' && !pay.manual_enabled) throw new Error('This payment method is unavailable.');
    if (method === 'online') throw new Error('Online payment is unavailable in demo mode.');
    if (method === 'manual') req(p.payer_ref, 4, 'Please enter your payment transaction ID.');

    // Validate everything first, then write — the local stand-in for a DB transaction.
    const lines = p.items.map((it: Row) => {
      const prod = table('products').find(r => r.id === it.product_id && r.status === 'published');
      const qty = Math.floor(Number(it.quantity));
      if (!prod) throw new Error('A product in your cart is no longer available.');
      if (!(qty >= 1)) throw new Error('Invalid quantity.');
      if (!prod.is_available || prod.stock < 1) throw new Error(`"${prod.name}" is out of stock.`);
      if (prod.stock < qty) throw new Error(`Only ${prod.stock} left of "${prod.name}".`);
      return { prod, qty, price: Number(prod.discount_price ?? prod.price) };
    });
    const subtotal = lines.reduce((s: number, l: Row) => s + l.price * l.qty, 0);
    let discount = 0;
    const code = String(p.coupon_code ?? '').trim().toUpperCase() || null;
    if (code) {
      const c = couponDiscount(code, subtotal);
      if (!c.valid) throw new Error(c.message);
      discount = c.discount!;
      table('coupons').find(r => r.code === code)!.used_count += 1;
    }
    const zone = p.delivery_zone === 'inside' ? 'inside' : 'outside';
    let shipping = Number(settings.shipping?.[zone] ?? 0);
    const free = Number(settings.shipping?.free_over ?? 0);
    if (free > 0 && subtotal - discount >= free) shipping = 0;

    const id = uid();
    const d = new Date();
    const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const order: Row = {
      id, order_number: `WT-${stamp}-${uid().slice(0, 6).toUpperCase()}`, user_id: sessionUser()?.id ?? null,
      customer_name: p.customer_name.trim(), phone: p.phone.trim(), email: p.email?.trim() || null,
      address: p.address.trim(), city: p.city.trim(), postal_code: p.postal_code?.trim() || null, delivery_zone: zone,
      notes: p.notes?.trim() || null, subtotal, discount, shipping, total: subtotal - discount + shipping, coupon_code: code,
      status: 'pending', payment_status: method === 'cod' ? 'unpaid' : 'pending', payment_method: method,
      internal_notes: null, stock_restored: false, created_at: now(), updated_at: now(),
    };
    table('orders').push(order);
    for (const l of lines) {
      const img = table('product_images').filter(i => i.product_id === l.prod.id)
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
      table('order_items').push({
        id: uid(), order_id: id, product_id: l.prod.id, product_name: l.prod.name, product_image: img?.url ?? null,
        sku: l.prod.sku, unit_price: l.price, quantity: l.qty, line_total: l.price * l.qty,
      });
      l.prod.stock -= l.qty;
      logStock(l.prod.id, -l.qty, l.prod.stock, 'order', id);
    }
    table('payments').push({
      id: uid(), order_id: id, method, provider: method === 'manual' ? (p.manual_provider || 'manual') : method,
      amount: order.total, status: order.payment_status, transaction_ref: null, payer_ref: p.payer_ref?.trim() || null, created_at: now(),
    });
    return orderJson(order);
  }

  // Mirror of the on_order_change() trigger.
  function orderSideEffects(old: Row, next: Row) {
    if (next.status !== old.status) {
      if (['cancelled', 'returned'].includes(old.status)) throw new Error(`A ${old.status} order is final and cannot be re-opened`);
      const items = table('order_items').filter(i => i.order_id === old.id && i.product_id);
      const prod = (pid: string) => table('products').find(r => r.id === pid);
      if (['cancelled', 'returned'].includes(next.status) && !old.stock_restored) {
        for (const i of items) {
          const pr = prod(i.product_id);
          if (pr) { pr.stock += i.quantity; logStock(pr.id, i.quantity, pr.stock, next.status === 'cancelled' ? 'cancel' : 'return', old.id); }
        }
        next.stock_restored = true;
      }
      const delta = next.status === 'delivered' ? 1 : old.status === 'delivered' ? -1 : 0;
      if (delta) for (const i of items) { const pr = prod(i.product_id); if (pr) pr.sales_count = Math.max(0, pr.sales_count + delta * i.quantity); }
    }
    if (next.payment_status !== old.payment_status) {
      const pay = table('payments').filter(p => p.order_id === old.id).pop();
      if (pay) pay.status = next.payment_status;
    }
  }

  return {
    mode: 'local',

    async select(name, q: Query = {}) {
      await ready;
      let rows = table(name).filter(r => !q.eq || matches(r, q.eq));
      if (q.in) rows = rows.filter(r => q.in![1].includes(r[q.in![0]]));
      for (const [col, dir] of [...(q.order ?? [])].reverse()) {
        rows = [...rows].sort((a, b) => {
          const x = a[col] ?? '', y = b[col] ?? '';
          return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'asc' ? 1 : -1);
        });
      }
      if (q.limit) rows = rows.slice(0, q.limit);
      return structuredClone(rows) as any[];
    },

    async insert(name, rows) {
      await ready;
      const out: Row[] = [];
      for (const r of (Array.isArray(rows) ? rows : [rows]) as Row[]) {
        const row: Row = { id: uid(), created_at: now(), ...DEFAULTS[name], ...r };
        if (name === 'products') {
          if (table(name).some(p => p.slug === row.slug)) throw new Error('A product with this URL slug already exists.');
          if (row.status === 'published' && !row.published_at) row.published_at = now();
          if (row.stock > 0) logStock(row.id, row.stock, row.stock, 'initial');
        }
        if (name === 'coupons' && table(name).some(c => c.code === row.code)) throw new Error('This coupon code already exists.');
        table(name).push(row);
        out.push(row);
      }
      await persist();
      return structuredClone(out) as any[];
    },

    async update(name, match, patch) {
      await ready;
      const out: Row[] = [];
      for (const row of table(name).filter(r => matches(r, match))) {
        const next: Row = { ...row, ...(patch as Row), updated_at: now() };
        if (name === 'orders') orderSideEffects(row, next);
        if (name === 'products') {
          if (next.stock !== row.stock) logStock(row.id, next.stock - row.stock, next.stock, 'manual');
          if (next.status === 'published' && !next.published_at) next.published_at = now();
        }
        Object.assign(row, next);
        out.push(row);
      }
      await persist();
      return structuredClone(out) as any[];
    },

    async upsert(name, row, onConflict) {
      await ready;
      const r = row as Row;
      const existing = table(name).find(x => x[onConflict] === r[onConflict]);
      if (existing) Object.assign(existing, r);
      else table(name).push({ id: uid(), created_at: now(), ...r });
      await persist();
      return structuredClone([existing ?? r]) as any[];
    },

    async remove(name, match) {
      await ready;
      const gone = table(name).filter(r => matches(r, match));
      data[name] = table(name).filter(r => !matches(r, match));
      for (const g of gone) {
        if (name === 'products') {
          for (const t of ['product_images', 'reviews', 'inventory_transactions', 'cart_items', 'wishlist_items']) {
            data[t] = table(t).filter(r => r.product_id !== g.id);
          }
        }
        if (name === 'categories') table('products').forEach(p => { if (p.category_id === g.id) p.category_id = null; });
      }
      await persist();
    },

    async rpc(fn, args: Row = {}) {
      await ready;
      let result: unknown;
      if (fn === 'place_order') result = placeOrder(args.payload);
      else if (fn === 'validate_coupon') result = couponDiscount(args.p_code, Number(args.p_subtotal));
      else if (fn === 'track_order') {
        const digits = (s: string) => String(s ?? '').replace(/\D/g, '');
        const o = table('orders').find(r => r.order_number === String(args.p_order_number ?? '').trim().toUpperCase()
          && digits(args.p_phone).length >= 6 && digits(r.phone) === digits(args.p_phone));
        result = o ? orderJson(o) : null;
      } else throw new Error(`Unknown function ${fn}`);
      await persist();
      return structuredClone(result) as any;
    },

    async upload(file) {
      if (file.size > 12 * 1024 * 1024) throw new Error('Demo mode stores files in the browser — please keep uploads under 12 MB (or paste a video link instead).');
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
    },

    async invoke() {
      throw new Error('Online payment needs Supabase and a configured payment gateway.');
    },

    auth: {
      async getUser() {
        await ready;
        return sessionUser();
      },
      onChange(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      async signUp(email, password, meta) {
        await ready;
        email = email.trim().toLowerCase();
        if (table('auth_users').some(u => u.email === email)) throw new Error('An account with this email already exists.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const id = uid();
        table('auth_users').push({ id, email, password_hash: await hash(password) });
        table('profiles').push({ id, email, full_name: meta.full_name, phone: meta.phone, role: 'customer', created_at: now() });
        localStorage.setItem(SESSION_KEY, id);
        await persist();
        emit('SIGNED_IN');
        return { needsConfirmation: false };
      },
      async signIn(email, password) {
        await ready;
        const h = await hash(password);
        const u = table('auth_users').find(r => r.email === email.trim().toLowerCase() && r.password_hash === h);
        if (!u) throw new Error('Invalid email or password.');
        localStorage.setItem(SESSION_KEY, u.id);
        emit('SIGNED_IN');
      },
      async signOut() {
        localStorage.removeItem(SESSION_KEY);
        emit('SIGNED_OUT');
      },
      async resetPassword() {
        throw new Error('Password reset emails are sent once Supabase is connected (not available in demo mode).');
      },
      async updatePassword(password) {
        const u = sessionUser();
        if (!u) throw new Error('Please sign in first.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        table('auth_users').find(r => r.id === u.id)!.password_hash = await hash(password);
        await persist();
      },
    },
  };
}
