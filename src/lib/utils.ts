import type { Product } from './types';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function formatDate(iso?: string | null, withTime = false): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const unitPrice = (p: Pick<Product, 'price' | 'discount_price'>) => Number(p.discount_price ?? p.price);
export const inStock = (p: Pick<Product, 'stock' | 'is_available'>) => p.is_available && p.stock > 0;
export const primaryImage = (p: Pick<Product, 'images'>) => p.images[0]?.url ?? '';

export function discountPercent(p: Pick<Product, 'price' | 'discount_price'>): number {
  if (p.discount_price == null || !(p.price > 0)) return 0;
  return Math.round((1 - p.discount_price / p.price) * 100);
}

/** wa.me link, or null until the owner sets a WhatsApp number in Website Settings. */
export function whatsappLink(number: string, message: string): string | null {
  const digits = (number ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const productInquiry = (name: string) =>
  `Hello Woodture! I am interested in ${name}. Could you please share more information about this product?`;

export function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export const isVideoFile = (url: string) => /^data:video\//.test(url) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

/** Downscale + re-encode photos in the browser before upload (fast pages, small storage). */
export async function prepareImage(file: File, maxSide = 1800): Promise<{ blob: Blob; ext: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return { blob: file, ext: file.type === 'image/gif' ? 'gif' : 'svg' };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', 0.86));
  if (!blob) throw new Error('Could not process image.');
  return { blob, ext: 'webp' };
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}
