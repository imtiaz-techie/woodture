-- ============================================================================
-- WOODTURE — database schema, security policies and server-side order logic.
-- Run once in Supabase Dashboard > SQL Editor (or `supabase db push`).
--
-- INVENTORY POLICY
--   * Stock is RESERVED (deducted) the moment an order is placed, inside one
--     transaction with row locks, so two customers can never buy the last unit.
--   * Stock is RESTORED automatically when an order becomes Cancelled or Returned.
--   * Cancelled / Returned orders are final and cannot be re-opened.
--   * A product's sales count increases when its order is marked Delivered.
--   * Every stock movement is written to inventory_transactions.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers may edit their own profile but can never promote themselves.
-- (auth.uid() is null in the SQL editor, which is how the first admin is created.)
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Not allowed to change role';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- -------------------------------------------------------------- categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_featured boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category_id uuid references public.categories (id) on delete set null,
  short_description text,
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  discount_price numeric(12, 2) check (discount_price is null or (discount_price >= 0 and discount_price < price)),
  video_url text,
  material text,
  dimensions text,
  weight text,
  movement text,
  sku text unique,
  stock int not null default 0 check (stock >= 0),
  is_available boolean not null default true,
  is_featured boolean not null default false,
  is_new_arrival boolean not null default false,
  is_bestseller boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  seo_title text,
  seo_description text,
  sales_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_status_idx on public.products (status, published_at desc);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);

-- --------------------------------------------------- inventory transactions
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  change int not null,
  stock_after int not null,
  reason text not null default 'manual' check (reason in ('initial', 'manual', 'order', 'cancel', 'return')),
  order_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists inventory_tx_product_idx on public.inventory_transactions (product_id, created_at desc);

-- One logging path for every stock change, whoever makes it.
create or replace function public.log_stock_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reason text := coalesce(nullif(current_setting('app.stock_reason', true), ''), 'manual');
  v_order text := nullif(current_setting('app.order_id', true), '');
begin
  if tg_op = 'INSERT' then
    if new.stock > 0 then
      insert into public.inventory_transactions (product_id, change, stock_after, reason, created_by)
      values (new.id, new.stock, new.stock, 'initial', auth.uid());
    end if;
  elsif new.stock is distinct from old.stock then
    insert into public.inventory_transactions (product_id, change, stock_after, reason, order_id, created_by)
    values (new.id, new.stock - old.stock, new.stock, v_reason, v_order::uuid, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists products_log_stock on public.products;
create trigger products_log_stock after insert or update on public.products
  for each row execute function public.log_stock_change();

create or replace function public.touch_product() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before insert or update on public.products
  for each row execute function public.touch_product();

-- ----------------------------------------------------- carts and wishlists
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity int not null check (quantity > 0),
  unique (cart_id, product_id)
);
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (wishlist_id, product_id)
);

-- --------------------------------------------------------------- addresses
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  address text not null,
  city text not null,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);

-- ----------------------------------------------------------------- coupons
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  type text not null check (type in ('percent', 'fixed')),
  value numeric(12, 2) not null check (value > 0),
  min_order numeric(12, 2) not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit int,
  used_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text,
  address text not null,
  city text not null,
  postal_code text,
  delivery_zone text not null default 'outside' check (delivery_zone in ('inside', 'outside')),
  notes text,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  coupon_code text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  payment_method text not null default 'cod' check (payment_method in ('cod', 'manual', 'online')),
  internal_notes text,
  stock_restored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_image text,
  sku text,
  unit_price numeric(12, 2) not null,
  quantity int not null check (quantity > 0),
  line_total numeric(12, 2) not null
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method text not null,
  provider text,
  amount numeric(12, 2) not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  transaction_ref text,
  payer_ref text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments (order_id);
-- Duplicate-payment guard: one gateway transaction can only ever be recorded once.
create unique index if not exists payments_provider_ref_uniq
  on public.payments (provider, transaction_ref) where transaction_ref is not null;

-- Order status side effects: restore stock, count sales, mirror payment status.
create or replace function public.on_order_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if old.status in ('cancelled', 'returned') then
      raise exception 'A % order is final and cannot be re-opened', old.status;
    end if;
    if new.status in ('cancelled', 'returned') and not old.stock_restored then
      perform set_config('app.stock_reason', case when new.status = 'cancelled' then 'cancel' else 'return' end, true);
      perform set_config('app.order_id', new.id::text, true);
      for r in select product_id, quantity from public.order_items
               where order_id = new.id and product_id is not null order by product_id loop
        update public.products set stock = stock + r.quantity where id = r.product_id;
      end loop;
      perform set_config('app.stock_reason', '', true);
      perform set_config('app.order_id', '', true);
      new.stock_restored := true;
    end if;
    if new.status = 'delivered' then
      update public.products p set sales_count = p.sales_count + i.quantity
      from public.order_items i where i.order_id = new.id and i.product_id = p.id;
    elsif old.status = 'delivered' then
      update public.products p set sales_count = greatest(0, p.sales_count - i.quantity)
      from public.order_items i where i.order_id = new.id and i.product_id = p.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_on_change on public.orders;
create trigger orders_on_change before update on public.orders
  for each row execute function public.on_order_change();

create or replace function public.sync_payment_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status is distinct from old.payment_status then
    update public.payments set status = new.payment_status, updated_at = now()
    where id = (select id from public.payments where order_id = new.id order by created_at desc limit 1)
      and status is distinct from new.payment_status;
  end if;
  return null;
end $$;

drop trigger if exists orders_sync_payment on public.orders;
create trigger orders_sync_payment after update on public.orders
  for each row execute function public.sync_payment_status();

-- ----------------------------------------------------------------- reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  body text not null,
  image_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews (product_id, status);

create or replace function public.has_purchased(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o join public.order_items i on i.order_id = o.id
    where o.user_id = auth.uid() and o.status = 'delivered' and i.product_id = p_product
  );
$$;

-- ----------------------------------------------- gallery, inquiries, settings
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'image' check (type in ('image', 'video')),
  url text not null,
  caption text,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contact' check (kind in ('contact', 'newsletter')),
  name text,
  email text,
  phone text,
  subject text,
  message text,
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now(),
  check (char_length(coalesce(message, '')) <= 5000)
);

create table if not exists public.website_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- SERVER-SIDE BUSINESS LOGIC
-- ============================================================================

-- Works out a coupon's discount. Never trusts amounts sent by the browser.
create or replace function public.coupon_discount(p_code text, p_subtotal numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.coupons%rowtype; d numeric;
begin
  select * into c from public.coupons where code = upper(trim(coalesce(p_code, '')));
  if not found or not c.is_active then return jsonb_build_object('valid', false, 'message', 'This code is not valid.'); end if;
  if c.starts_at is not null and now() < c.starts_at then return jsonb_build_object('valid', false, 'message', 'This code is not active yet.'); end if;
  if c.expires_at is not null and now() > c.expires_at then return jsonb_build_object('valid', false, 'message', 'This code has expired.'); end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then return jsonb_build_object('valid', false, 'message', 'This code has reached its usage limit.'); end if;
  if p_subtotal < c.min_order then
    return jsonb_build_object('valid', false, 'message', 'Minimum order for this code is ' || trim(to_char(c.min_order, 'FM999999990.##')) || '.');
  end if;
  d := case when c.type = 'percent' then round(p_subtotal * c.value / 100, 2) else c.value end;
  d := least(d, p_subtotal);
  return jsonb_build_object('valid', true, 'code', c.code, 'discount', d, 'message', 'Code applied.');
end $$;

create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.coupon_discount(p_code, p_subtotal);
$$;

create or replace function public.order_json(p_order public.orders) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p_order) - 'internal_notes' - 'stock_restored' - 'user_id' || jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.product_name) from public.order_items i where i.order_id = p_order.id), '[]'::jsonb),
    'payment', (select jsonb_build_object('provider', p.provider, 'status', p.status, 'payer_ref', p.payer_ref)
                from public.payments p where p.order_id = p_order.id order by p.created_at desc limit 1)
  );
$$;

-- Checkout. Prices, stock, coupon and shipping are all recomputed here.
create or replace function public.place_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb; v_prod public.products%rowtype; v_qty int; v_price numeric; v_img text;
  v_subtotal numeric := 0; v_discount numeric := 0; v_shipping numeric := 0; v_total numeric;
  v_order public.orders%rowtype; v_id uuid := gen_random_uuid(); v_number text;
  v_settings jsonb; v_pay jsonb; v_coupon jsonb; v_code text := nullif(upper(trim(coalesce(payload ->> 'coupon_code', ''))), '');
  v_method text := coalesce(payload ->> 'payment_method', 'cod');
  v_zone text := coalesce(payload ->> 'delivery_zone', 'outside');
  v_name text := trim(coalesce(payload ->> 'customer_name', ''));
  v_phone text := trim(coalesce(payload ->> 'phone', ''));
  v_address text := trim(coalesce(payload ->> 'address', ''));
  v_city text := trim(coalesce(payload ->> 'city', ''));
  v_free numeric;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Please enter your full name.'; end if;
  if v_phone !~ '^\+?[0-9 ()-]{6,20}$' then raise exception 'Please enter a valid phone number.'; end if;
  if char_length(v_address) < 5 or char_length(v_address) > 500 then raise exception 'Please enter your delivery address.'; end if;
  if char_length(v_city) < 2 or char_length(v_city) > 120 then raise exception 'Please enter your city or district.'; end if;
  if v_zone not in ('inside', 'outside') then raise exception 'Invalid delivery area.'; end if;
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if jsonb_array_length(payload -> 'items') > 100 then raise exception 'Too many items.'; end if;

  select value into v_settings from public.website_settings where key = 'general';
  v_pay := coalesce(v_settings -> 'payment', '{}'::jsonb);
  if v_method = 'cod' and not coalesce((v_pay ->> 'cod_enabled')::boolean, true) then raise exception 'Cash on delivery is unavailable.'; end if;
  if v_method = 'manual' and not coalesce((v_pay ->> 'manual_enabled')::boolean, false) then raise exception 'This payment method is unavailable.'; end if;
  if v_method = 'online' and not coalesce((v_pay ->> 'online_enabled')::boolean, false) then raise exception 'Online payment is unavailable.'; end if;
  if v_method not in ('cod', 'manual', 'online') then raise exception 'Invalid payment method.'; end if;
  if v_method = 'manual' and char_length(trim(coalesce(payload ->> 'payer_ref', ''))) < 4 then
    raise exception 'Please enter your payment transaction ID.';
  end if;

  -- gen_random_uuid() is built into PostgreSQL 13+, so no extension schema is needed.
  v_number := 'WT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (id, order_number, user_id, customer_name, phone, email, address, city, postal_code,
                             delivery_zone, notes, payment_method, payment_status)
  values (v_id, v_number, auth.uid(), v_name, v_phone, nullif(trim(coalesce(payload ->> 'email', '')), ''),
          v_address, v_city, nullif(trim(coalesce(payload ->> 'postal_code', '')), ''), v_zone,
          nullif(left(trim(coalesce(payload ->> 'notes', '')), 1000), ''), v_method,
          case when v_method = 'cod' then 'unpaid' else 'pending' end);

  perform set_config('app.stock_reason', 'order', true);
  perform set_config('app.order_id', v_id::text, true);

  -- Lock rows in a stable order so concurrent checkouts cannot deadlock or oversell.
  for v_item in select value from jsonb_array_elements(payload -> 'items') order by value ->> 'product_id' loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 999 then raise exception 'Invalid quantity.'; end if;
    select * into v_prod from public.products
      where id = (v_item ->> 'product_id')::uuid and status = 'published' for update;
    if not found then raise exception 'A product in your cart is no longer available.'; end if;
    if not v_prod.is_available or v_prod.stock < 1 then raise exception '"%" is out of stock.', v_prod.name; end if;
    if v_prod.stock < v_qty then raise exception 'Only % left of "%".', v_prod.stock, v_prod.name; end if;
    v_price := coalesce(v_prod.discount_price, v_prod.price);
    select url into v_img from public.product_images where product_id = v_prod.id
      order by is_primary desc, sort_order limit 1;
    insert into public.order_items (order_id, product_id, product_name, product_image, sku, unit_price, quantity, line_total)
    values (v_id, v_prod.id, v_prod.name, v_img, v_prod.sku, v_price, v_qty, v_price * v_qty);
    update public.products set stock = stock - v_qty where id = v_prod.id;
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  perform set_config('app.stock_reason', '', true);
  perform set_config('app.order_id', '', true);

  if v_code is not null then
    perform 1 from public.coupons where code = v_code for update;
    v_coupon := public.coupon_discount(v_code, v_subtotal);
    if not (v_coupon ->> 'valid')::boolean then raise exception '%', v_coupon ->> 'message'; end if;
    v_discount := (v_coupon ->> 'discount')::numeric;
    update public.coupons set used_count = used_count + 1 where code = v_code;
  end if;

  v_shipping := coalesce((v_settings -> 'shipping' ->> (case when v_zone = 'inside' then 'inside' else 'outside' end))::numeric, 0);
  v_free := nullif(v_settings -> 'shipping' ->> 'free_over', '')::numeric;
  if v_free is not null and v_free > 0 and v_subtotal - v_discount >= v_free then v_shipping := 0; end if;
  v_total := v_subtotal - v_discount + v_shipping;

  update public.orders set subtotal = v_subtotal, discount = v_discount, shipping = v_shipping,
         total = v_total, coupon_code = v_code where id = v_id returning * into v_order;

  insert into public.payments (order_id, method, provider, amount, status, payer_ref)
  values (v_id, v_method,
          case v_method when 'cod' then 'cod' when 'manual' then coalesce(nullif(payload ->> 'manual_provider', ''), 'manual')
               else coalesce(v_pay ->> 'online_provider', 'sslcommerz') end,
          v_total, case when v_method = 'cod' then 'unpaid' else 'pending' end,
          nullif(trim(coalesce(payload ->> 'payer_ref', '')), ''));

  if auth.uid() is not null then
    delete from public.cart_items where cart_id in (select id from public.carts where user_id = auth.uid());
  end if;

  return public.order_json(v_order);
end $$;

-- Guest order tracking: needs the order number AND the phone used at checkout.
create or replace function public.track_order(p_order_number text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders
  where order_number = upper(trim(p_order_number))
    and regexp_replace(phone, '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
    and char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6;
  if not found then return null; end if;
  return public.order_json(o);
end $$;

revoke all on function public.coupon_discount(text, numeric) from public, anon, authenticated;
revoke all on function public.order_json(public.orders) from public, anon, authenticated;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.has_purchased(uuid) to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.addresses enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.gallery_items enable row level security;
alter table public.inquiries enable row level security;
alter table public.website_settings enable row level security;

-- Re-runnable: drop every policy on our tables first.
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy categories_read on public.categories for select using (is_active or public.is_admin());
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select using (status = 'published' or public.is_admin());
create policy products_admin on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy product_images_read on public.product_images for select using (true);
create policy product_images_admin on public.product_images for all using (public.is_admin()) with check (public.is_admin());

create policy inventory_admin on public.inventory_transactions for select using (public.is_admin());

create policy carts_own on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

create policy wishlists_own on public.wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wishlist_items_own on public.wishlist_items for all
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));

create policy addresses_own on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- Orders are only ever created through place_order(); customers can read their own.
create policy orders_read on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy order_items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy payments_read on public.payments for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy payments_admin_update on public.payments for update using (public.is_admin()) with check (public.is_admin());

create policy reviews_read on public.reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert
  with check (user_id = auth.uid() and status = 'pending' and public.has_purchased(product_id));
create policy reviews_admin_update on public.reviews for update using (public.is_admin()) with check (public.is_admin());
create policy reviews_admin_delete on public.reviews for delete using (public.is_admin());

create policy gallery_read on public.gallery_items for select using (is_published or public.is_admin());
create policy gallery_admin on public.gallery_items for all using (public.is_admin()) with check (public.is_admin());

create policy inquiries_insert on public.inquiries for insert with check (status = 'new');
create policy inquiries_admin_read on public.inquiries for select using (public.is_admin());
create policy inquiries_admin_update on public.inquiries for update using (public.is_admin()) with check (public.is_admin());
create policy inquiries_admin_delete on public.inquiries for delete using (public.is_admin());

create policy settings_read on public.website_settings for select using (true);
create policy settings_admin on public.website_settings for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- STORAGE  (public "media" bucket: product photos, gallery, review photos)
-- ============================================================================
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists media_read on storage.objects;
drop policy if exists media_admin_write on storage.objects;
drop policy if exists media_admin_update on storage.objects;
drop policy if exists media_admin_delete on storage.objects;
drop policy if exists media_review_upload on storage.objects;

create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_admin_write on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
create policy media_admin_update on storage.objects for update using (bucket_id = 'media' and public.is_admin());
create policy media_admin_delete on storage.objects for delete using (bucket_id = 'media' and public.is_admin());
-- Signed-in customers may add a photo to their own review folder only.
create policy media_review_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'reviews'
              and (storage.foldername(name))[2] = auth.uid()::text);

-- ============================================================================
-- STARTER CONTENT (categories + settings only — no products, no fake reviews)
-- ============================================================================
insert into public.categories (name, slug, description, sort_order) values
  ('Kinetic Flying Birds', 'kinetic-flying-birds', 'Wings that rise and fall with a gentle, lifelike rhythm.', 1),
  ('Wooden Dragon Sculptures', 'wooden-dragon-sculptures', 'Mythical forms brought to life through carved wood and motion.', 2),
  ('Mechanical Animal Sculptures', 'mechanical-animal-sculptures', 'Creatures of land and sea, moving through hand-built mechanisms.', 3),
  ('Wooden Automata', 'wooden-automata', 'Playful mechanical characters with a story in every turn.', 4),
  ('Creative Wooden Decorations', 'creative-wooden-decorations', 'Artful accents that bring natural warmth to any space.', 5),
  ('Custom Wooden Art', 'custom-wooden-art', 'One-of-a-kind pieces created around your idea.', 6)
on conflict (slug) do nothing;

insert into public.website_settings (key, value) values
  ('general', '{
    "business_name": "Woodture", "tagline": "Kinetic Wood Art", "logo_url": "",
    "phone": "", "whatsapp": "", "email": "", "address": "", "facebook": "", "instagram": "",
    "currency": "৳",
    "shipping": {"inside": 0, "outside": 0, "free_over": null},
    "payment": {"cod_enabled": true, "manual_enabled": false, "manual_instructions": "",
                "online_enabled": false, "online_provider": "sslcommerz"},
    "seo": {"title": "Woodture — Kinetic Wood Art",
            "description": "Handcrafted kinetic wooden sculptures where creativity, craftsmanship, and movement come together."}
  }'::jsonb),
  ('homepage', '{}'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- AFTER RUNNING THIS FILE: create your account on the website, then make it admin:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
