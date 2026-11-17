// Domain-level data access. Pages talk to this file, never to a backend directly
// (admin CRUD screens use `db` for simple single-table edits).
import { db } from './backend';
import {
  DEFAULT_GENERAL, DEFAULT_HOMEPAGE,
  type Category, type GeneralSettings, type HomepageSettings, type Order, type OrderItem,
  type Payment, type Product, type ProductImage, type Review,
} from './types';
import { prepareImage } from './utils';

// ------------------------------------------------------------------ catalog
export async function fetchCatalog(includeDrafts = false): Promise<{ products: Product[]; categories: Category[] }> {
  const [rows, images, categories] = await Promise.all([
    db.select<Product>('products', { ...(includeDrafts ? {} : { eq: { status: 'published' } }), order: [['created_at', 'desc']] }),
    db.select<ProductImage>('product_images', { order: [['sort_order', 'asc']] }),
    db.select<Category>('categories', { order: [['sort_order', 'asc'], ['name', 'asc']] }),
  ]);
  const byProduct = new Map<string, ProductImage[]>();
  for (const img of images) {
    const list = byProduct.get(img.product_id!) ?? [];
    list.push(img);
    byProduct.set(img.product_id!, list);
  }
  const catById = new Map(categories.map(c => [c.id, c]));
  const products = rows.map(p => ({
    ...p,
    price: Number(p.price),
    discount_price: p.discount_price == null ? null : Number(p.discount_price),
    images: (byProduct.get(p.id) ?? []).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order),
    category: p.category_id ? catById.get(p.category_id) ?? null : null,
  }));
  return { products, categories };
}

export type ProductInput = Omit<Product, 'id' | 'images' | 'category' | 'created_at' | 'updated_at' | 'sales_count' | 'published_at'>;

export async function saveProduct(id: string | null, input: ProductInput, images: ProductImage[]): Promise<string> {
  let productId = id;
  if (productId) await db.update('products', { id: productId }, input);
  else productId = (await db.insert<Product>('products', input))[0].id;
  await db.remove('product_images', { product_id: productId });
  if (images.length) {
    await db.insert('product_images', images.map((img, i) => ({
      product_id: productId!, url: img.url, alt: img.alt ?? input.name, sort_order: i, is_primary: i === 0,
    })));
  }
  return productId!;
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const { blob, ext } = await prepareImage(file);
  return db.upload(blob, folder, ext);
}

export async function uploadVideo(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('video/')) throw new Error('Please choose a video file.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Videos must be under 50 MB. For longer videos, paste a YouTube link instead.');
  return db.upload(file, folder, (file.name.split('.').pop() || 'mp4').toLowerCase());
}

// ----------------------------------------------------------------- settings
export async function loadSettings(): Promise<{ general: GeneralSettings; homepage: HomepageSettings }> {
  const rows = await db.select<{ key: string; value: any }>('website_settings');
  const get = (k: string) => rows.find(r => r.key === k)?.value ?? {};
  const g = get('general');
  return {
    general: {
      ...DEFAULT_GENERAL, ...g,
      shipping: { ...DEFAULT_GENERAL.shipping, ...g.shipping },
      payment: { ...DEFAULT_GENERAL.payment, ...g.payment },
      seo: { ...DEFAULT_GENERAL.seo, ...g.seo },
    },
    homepage: { ...DEFAULT_HOMEPAGE, ...get('homepage') },
  };
}

export const saveSettings = (key: 'general' | 'homepage', value: unknown) =>
  db.upsert('website_settings', { key, value, updated_at: new Date().toISOString() }, 'key');

// ------------------------------------------------------------------- orders
export interface CheckoutPayload {
  items: { product_id: string; quantity: number }[];
  customer_name: string; phone: string; email?: string; address: string; city: string; postal_code?: string;
  delivery_zone: 'inside' | 'outside'; notes?: string; coupon_code?: string;
  payment_method: 'cod' | 'manual' | 'online'; payer_ref?: string; manual_provider?: string;
}

const normalizeOrder = (o: any): Order => ({
  ...o,
  subtotal: Number(o.subtotal), discount: Number(o.discount), shipping: Number(o.shipping), total: Number(o.total),
  items: (o.items ?? []).map((i: any) => ({ ...i, unit_price: Number(i.unit_price), line_total: Number(i.line_total) })),
});

export const placeOrder = async (payload: CheckoutPayload) => normalizeOrder(await db.rpc('place_order', { payload }));

export async function trackOrder(orderNumber: string, phone: string): Promise<Order | null> {
  const o = await db.rpc('track_order', { p_order_number: orderNumber, p_phone: phone });
  return o ? normalizeOrder(o) : null;
}

export const validateCoupon = (code: string, subtotal: number) =>
  db.rpc<{ valid: boolean; code?: string; discount?: number; message: string }>('validate_coupon', { p_code: code, p_subtotal: subtotal });

async function withItems(orders: any[]): Promise<Order[]> {
  if (!orders.length) return [];
  const items = await db.select<OrderItem>('order_items', { in: ['order_id', orders.map(o => o.id)] });
  return orders.map(o => normalizeOrder({ ...o, items: items.filter(i => i.order_id === o.id) }));
}

export const myOrders = async (userId: string) =>
  withItems(await db.select('orders', { eq: { user_id: userId }, order: [['created_at', 'desc']] }));

export const allPayments = () => db.select<Payment>('payments', { order: [['created_at', 'desc']] });

/** Admin: every order with its items and latest payment record. */
export async function allOrders(): Promise<Order[]> {
  const [orders, payments] = await Promise.all([
    db.select('orders', { order: [['created_at', 'desc']] }).then(withItems),
    allPayments(),
  ]);
  return orders.map(o => {
    const p = payments.find(x => x.order_id === o.id);
    return { ...o, payment: p ? { provider: p.provider, status: p.status, payer_ref: p.payer_ref } : null };
  });
}

/** Starts a hosted gateway session via the payment-init Edge Function. */
export const startOnlinePayment = (orderNumber: string, phone: string) =>
  db.invoke<{ url: string }>('payment-init', { order_number: orderNumber, phone });

// ------------------------------------------------------------------ reviews
export const approvedReviews = (productId?: string) =>
  db.select<Review>('reviews', { eq: { status: 'approved', ...(productId ? { product_id: productId } : {}) }, order: [['created_at', 'desc']] });

/** A customer may review a product once it has been delivered to them. */
export async function reviewEligibility(userId: string, productId: string): Promise<'ok' | 'not_purchased' | 'already'> {
  const mine = await db.select<Review>('reviews', { eq: { user_id: userId, product_id: productId } });
  if (mine.length) return 'already';
  const delivered = await db.select('orders', { eq: { user_id: userId, status: 'delivered' } });
  if (!delivered.length) return 'not_purchased';
  const items = await db.select<OrderItem>('order_items', { in: ['order_id', delivered.map(o => o.id)] });
  return items.some(i => i.product_id === productId) ? 'ok' : 'not_purchased';
}

// ------------------------------------------------- per-account cart/wishlist
async function ownerRow(table: 'carts' | 'wishlists', userId: string): Promise<string> {
  const found = await db.select(table, { eq: { user_id: userId } });
  if (found[0]) return found[0].id;
  return (await db.insert<{ id: string; user_id: string }>(table, { user_id: userId }))[0].id;
}

export async function loadUserCart(userId: string): Promise<{ product_id: string; quantity: number }[]> {
  const cartId = await ownerRow('carts', userId);
  return (await db.select('cart_items', { eq: { cart_id: cartId } })).map(r => ({ product_id: r.product_id, quantity: r.quantity }));
}

export async function saveUserCart(userId: string, items: { product_id: string; quantity: number }[]): Promise<void> {
  const cartId = await ownerRow('carts', userId);
  await db.remove('cart_items', { cart_id: cartId });
  if (items.length) await db.insert('cart_items', items.map(i => ({ cart_id: cartId, ...i })));
}

export async function loadUserWishlist(userId: string): Promise<string[]> {
  const id = await ownerRow('wishlists', userId);
  return (await db.select('wishlist_items', { eq: { wishlist_id: id } })).map(r => r.product_id);
}

export async function saveUserWishlist(userId: string, productIds: string[]): Promise<void> {
  const id = await ownerRow('wishlists', userId);
  await db.remove('wishlist_items', { wishlist_id: id });
  if (productIds.length) await db.insert('wishlist_items', productIds.map(product_id => ({ wishlist_id: id, product_id })));
}
