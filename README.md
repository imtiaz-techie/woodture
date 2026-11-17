# Woodture — Kinetic Wood Art

E-commerce website and store-management dashboard for Woodture.

- **Storefront:** home, about, collections, shop, product pages, new arrivals, cart, checkout, account, order tracking, wishlist, gallery, contact, policies.
- **Admin dashboard** (`/admin/login`): products, categories, orders, customers, inventory, payments, coupons, reviews, gallery, messages, homepage content, website settings.
- **Stack:** React + TypeScript + Tailwind CSS + Framer Motion + Lucide, on Supabase (PostgreSQL, Auth, Storage, Edge Functions).

## 1. Run it on your computer

```bash
npm install
npm run dev
```

Open http://localhost:5173.

Without Supabase keys the site runs in **demo mode**: sample products, and everything you change is saved only in that browser. Demo admin login: `admin@woodture.demo` / `woodture-admin`. Demo mode is for trying the site — it is not a real store.

## 2. Go live with Supabase

1. Create a project at https://supabase.com.
2. Open **SQL Editor**, paste the whole of `supabase/migrations/0001_woodture_schema.sql`, and run it. This creates the tables, security rules, storage bucket, the six starter categories and default settings.
3. Copy `.env.example` to `.env` and fill in the two values from **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   Only the *anon* key goes here. Never put the service-role key in this file.
4. Restart `npm run dev`, open the site and **create your account** at `/register`.
5. Make that account the admin — in the SQL Editor run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
6. Sign in at `/admin/login`.
7. In **Authentication → URL Configuration** set the Site URL to your real domain (needed for the confirmation and password-reset emails).

### First things to set in the dashboard

| Where | What |
|---|---|
| Website Settings → Contact | Phone, **WhatsApp number**, email, address, Facebook / Instagram links. WhatsApp buttons appear once the number is saved. |
| Website Settings → Shipping | Delivery charges (they start at 0 = free). |
| Website Settings → Payment | Cash on Delivery is on. Turn on manual bKash / Nagad / bank payment and enter your account details if you want it. |
| Products → Add new product | Your real products, photos and prices. |

## 3. Adding a product (no code)

1. Log into `/admin/login`.
2. **Products → Add new product**.
3. Upload photos (drag to reorder — the first is the primary image).
4. Enter name, description, price, stock; pick a category.
5. Click **Publish**.

It appears on the website straight away, in its category and in any section you switched on (Featured, New arrival, Bestseller).

## 4. How stock works

- Stock is **reserved the moment an order is placed**. The check and the deduction happen in one database transaction with row locks, so the last unit cannot be sold twice.
- Stock is **returned automatically** when an order is set to Cancelled or Returned. Those two statuses are final.
- A product's sales count goes up when its order is marked Delivered.
- Every change is listed under **Inventory → Inventory history**.

## 5. Online payment (optional)

Online payment stays off until you have an approved merchant account. SSLCOMMERZ is fully wired; the bKash and Nagad options are prepared in the settings and in `supabase/functions/payment-init`, but their API calls still have to be added once you have merchant credentials.

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set SSLCOMMERZ_STORE_ID=xxx SSLCOMMERZ_STORE_PASSWORD=xxx
supabase secrets set SSLCOMMERZ_SANDBOX=true          # change to false for real payments
supabase secrets set SITE_URL=https://your-domain.com

supabase functions deploy payment-init
supabase functions deploy payment-callback
```

Then switch on **Website Settings → Payment → Online payment gateway**.

Payments are verified on the server against the gateway's validation API and the order's own total before an order is marked paid. Merchant keys live only in Supabase secrets.

## 6. Publish the website

```bash
npm run build
```

Upload the `dist` folder to any static host (Vercel, Netlify, Cloudflare Pages). Add the two `VITE_SUPABASE_*` values as environment variables on the host. Page-refresh routing is already configured for Netlify (`public/_redirects`) and Vercel (`vercel.json`).

## Project layout

```
src/
  lib/         data layer (backend.ts picks Supabase or demo mode), api.ts, types
  context/     Auth, Store (settings + catalogue), Shop (cart, wishlist)
  components/  layout, product card, order view, shared UI
  pages/       public website
  admin/       dashboard
supabase/
  migrations/  database schema, security policies, checkout logic
  functions/   payment gateway (server side)
```

## Before launch

- Read and adjust the three policy pages (`src/pages/Content.tsx`, `Policy`) so they match how you actually deliver and handle returns.
- The About page process text and homepage copy are editable under **Homepage Management**.
