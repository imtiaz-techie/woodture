import { useEffect } from 'react';
import { useStore } from '../context/Store';

function setMeta(selector: string, attr: string, key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Per-page <title>, description and Open Graph tags. */
export function useSeo(title?: string | null, description?: string | null, image?: string | null) {
  const { general } = useStore();
  useEffect(() => {
    const name = general.business_name || 'Woodture';
    const fullTitle = title ? `${title} — ${name}` : general.seo.title;
    const desc = description || general.seo.description;
    document.title = fullTitle;
    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    const img = image || '/brand/cover.jpg';
    setMeta('meta[property="og:image"]', 'property', 'og:image', img.startsWith('/') ? window.location.origin + img : img);
  }, [title, description, image, general]);
}

/** Injects schema.org JSON-LD (used on product pages) and removes it on leave. */
export function useJsonLd(data: Record<string, unknown> | null) {
  const json = data ? JSON.stringify(data) : '';
  useEffect(() => {
    if (!json) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.text = json;
    document.head.appendChild(el);
    return () => el.remove();
  }, [json]);
}
