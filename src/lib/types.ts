export interface Category {
  id: string; name: string; slug: string; description?: string | null; image_url?: string | null;
  sort_order: number; is_featured: boolean; is_active: boolean; created_at?: string;
}

export interface ProductImage {
  id?: string; product_id?: string; url: string; alt?: string | null; sort_order: number; is_primary: boolean;
}

export interface Product {
  id: string; name: string; slug: string; category_id: string | null;
  short_description?: string | null; description?: string | null;
  price: number; discount_price: number | null; video_url?: string | null;
  material?: string | null; dimensions?: string | null; weight?: string | null; movement?: string | null;
  sku?: string | null; stock: number; is_available: boolean;
  is_featured: boolean; is_new_arrival: boolean; is_bestseller: boolean;
  status: 'draft' | 'published'; seo_title?: string | null; seo_description?: string | null;
  sales_count: number; published_at?: string | null; created_at: string; updated_at?: string;
  // joined client-side
  images: ProductImage[]; category?: Category | null;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'cod' | 'manual' | 'online';

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
export const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];

export interface OrderItem {
  id: string; order_id: string; product_id: string | null; product_name: string; product_image?: string | null;
  sku?: string | null; unit_price: number; quantity: number; line_total: number;
}

export interface Payment {
  id: string; order_id: string; method: string; provider?: string | null; amount: number; status: PaymentStatus;
  transaction_ref?: string | null; payer_ref?: string | null; created_at: string;
}

export interface Order {
  id: string; order_number: string; user_id?: string | null; customer_name: string; phone: string; email?: string | null;
  address: string; city: string; postal_code?: string | null; delivery_zone: 'inside' | 'outside'; notes?: string | null;
  subtotal: number; discount: number; shipping: number; total: number; coupon_code?: string | null;
  status: OrderStatus; payment_status: PaymentStatus; payment_method: PaymentMethod;
  internal_notes?: string | null; created_at: string; updated_at?: string;
  items: OrderItem[]; payment?: { provider?: string | null; status?: string; payer_ref?: string | null } | null;
}

export interface Profile {
  id: string; full_name?: string | null; phone?: string | null; email?: string | null;
  role: 'customer' | 'admin'; created_at?: string;
}

export interface Address {
  id: string; user_id: string; label?: string | null; full_name: string; phone: string;
  address: string; city: string; postal_code?: string | null; is_default: boolean;
}

export interface Review {
  id: string; product_id: string; user_id: string; customer_name: string; rating: number; body: string;
  image_url?: string | null; status: 'pending' | 'approved' | 'rejected' | 'hidden'; created_at: string;
}

export interface Coupon {
  id: string; code: string; type: 'percent' | 'fixed'; value: number; min_order: number;
  starts_at?: string | null; expires_at?: string | null; usage_limit?: number | null;
  used_count: number; is_active: boolean; created_at?: string;
}

export interface GalleryItem {
  id: string; type: 'image' | 'video'; url: string; caption?: string | null;
  sort_order: number; is_published: boolean; created_at?: string;
}

export interface Inquiry {
  id: string; kind: 'contact' | 'newsletter'; name?: string | null; email?: string | null; phone?: string | null;
  subject?: string | null; message?: string | null; status: 'new' | 'read'; created_at: string;
}

export interface InventoryTx {
  id: string; product_id: string; change: number; stock_after: number;
  reason: 'initial' | 'manual' | 'order' | 'cancel' | 'return'; order_id?: string | null; created_at: string;
}

export interface GeneralSettings {
  business_name: string; tagline: string; logo_url: string;
  phone: string; whatsapp: string; email: string; address: string; facebook: string; instagram: string;
  currency: string;
  shipping: { inside: number; outside: number; free_over: number | null };
  payment: {
    cod_enabled: boolean; manual_enabled: boolean; manual_instructions: string;
    online_enabled: boolean; online_provider: 'sslcommerz' | 'bkash' | 'nagad';
  };
  seo: { title: string; description: string };
}

export interface HomepageSettings {
  banner_enabled: boolean; banner_text: string;
  hero_heading: string; hero_description: string; hero_image: string;
  intro_heading: string; intro_text: string;
  craft_heading: string; craft_text: string; craft_image: string;
  about_text: string; footer_text: string;
}

export const DEFAULT_GENERAL: GeneralSettings = {
  business_name: 'Woodture', tagline: 'Kinetic Wood Art', logo_url: '',
  phone: '', whatsapp: '', email: '', address: '', facebook: '', instagram: '',
  currency: '৳',
  shipping: { inside: 0, outside: 0, free_over: null },
  payment: { cod_enabled: true, manual_enabled: false, manual_instructions: '', online_enabled: false, online_provider: 'sslcommerz' },
  seo: {
    title: 'Woodture — Kinetic Wood Art',
    description: 'Handcrafted kinetic wooden sculptures where creativity, craftsmanship, and movement come together.',
  },
};

export const DEFAULT_HOMEPAGE: HomepageSettings = {
  banner_enabled: false, banner_text: '',
  hero_heading: 'Where Nature Meets Mechanical Art.',
  hero_description: 'Discover the beauty of handcrafted kinetic wooden sculptures, where creativity, craftsmanship, and movement come together.',
  hero_image: '/brand/cover.jpg',
  intro_heading: 'Wood, set in motion.',
  intro_text: 'At Woodture, we believe wood is more than just a material. It is a medium for creativity, imagination, and artistic expression. Each sculpture pairs the natural warmth of timber with a quiet mechanical heartbeat — wings that rise, fins that glide, forms that come alive at the turn of a handle.',
  craft_heading: 'Shaped by hand. Moved by mechanism.',
  craft_text: 'Every Woodture piece begins as a sketch of movement. Wood is selected for its grain and tone, shaped and finished by hand, then joined to a mechanism tuned until the motion feels effortless and alive.',
  craft_image: '',
  about_text: 'At Woodture, we believe wood is more than just a material. It is a medium for creativity, imagination, and artistic expression.\n\nOur kinetic wooden art brings together craftsmanship, natural beauty, and mechanical creativity to transform wood into fascinating artistic creations.\n\nEvery piece represents our appreciation for design, movement, and the beauty of handmade art.',
  footer_text: 'Handcrafted kinetic wooden sculptures — where creativity, craftsmanship, and movement come together.',
};
