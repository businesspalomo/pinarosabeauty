create extension if not exists pgcrypto;

do $$ begin
  create type order_status as enum ('DRAFT','PENDING_CONFIRMATION','CONFIRMED','PICKING','READY','DISPATCHED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_type as enum ('RECEIPT','RESERVATION','RESERVATION_RELEASE','SALE','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT','RETURN');
exception when duplicate_object then null; end $$;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null default 'OPERATOR' check (role in ('ADMIN','OPERATOR','VIEWER')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id),
  name text not null,
  example text,
  active boolean not null default true,
  unique(brand_id, name)
);

create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  name text not null,
  example text,
  active boolean not null default true,
  unique(category_id, name)
);

create table if not exists product_lines (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  subcategory_id uuid references subcategories(id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(category_id, subcategory_id, name)
);
create index if not exists idx_product_lines_category on product_lines(category_id);
create index if not exists idx_product_lines_subcategory on product_lines(subcategory_id);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  category_id uuid references categories(id),
  subcategory_id uuid references subcategories(id),
  line text,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_id, name, line)
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  shade_name text,
  shade_code text,
  presentation text,
  size_value numeric(12,3),
  size_unit text,
  internal_sku text not null unique,
  cost_ars numeric(14,2),
  wholesale_price numeric(14,2) not null default 0,
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists barcodes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  barcode text not null unique,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_barcodes_barcode on barcodes(barcode);
create index if not exists idx_variants_sku on product_variants(internal_sku);
create index if not exists idx_variants_product on product_variants(product_id);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true
);

create table if not exists inventory_balance (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  location_id uuid not null references locations(id),
  physical_quantity integer not null default 0 check (physical_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now(),
  unique(variant_id, location_id),
  check (reserved_quantity <= physical_quantity)
);
create index if not exists idx_inventory_variant_location on inventory_balance(variant_id, location_id);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text,
  phone text,
  email text,
  instagram text,
  address text,
  city text,
  province text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_name on customers using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(business_name,'')));

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references customers(id),
  status order_status not null default 'DRAFT',
  channel text,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_status_created on orders(status, created_at desc);
create index if not exists idx_orders_customer_created on orders(customer_id, created_at desc);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  unique(order_id, variant_id)
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  location_id uuid not null references locations(id),
  quantity integer not null check (quantity > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RELEASED','CONSUMED')),
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists idx_reservations_order_active on reservations(order_id, status);

create table if not exists receiving_sessions (
  id uuid primary key default gen_random_uuid(),
  reference text,
  supplier text,
  status text not null default 'OPEN' check (status in ('OPEN','COMPLETED','CANCELLED')),
  user_id uuid references app_users(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists receiving_items (
  id uuid primary key default gen_random_uuid(),
  receiving_session_id uuid not null references receiving_sessions(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  location_id uuid not null references locations(id),
  quantity integer not null default 1 check (quantity > 0),
  updated_at timestamptz not null default now(),
  unique(receiving_session_id, variant_id, location_id)
);

create table if not exists picking_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  user_id uuid references app_users(id),
  status text not null default 'OPEN' check (status in ('OPEN','COMPLETED','CANCELLED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists picking_scans (
  id uuid primary key default gen_random_uuid(),
  picking_session_id uuid not null references picking_sessions(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  barcode text not null,
  quantity integer not null default 1 check (quantity > 0),
  user_id uuid references app_users(id),
  scanned_at timestamptz not null default now()
);
create index if not exists idx_picking_scans_session_time on picking_scans(picking_session_id, scanned_at desc);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id),
  location_id uuid not null references locations(id),
  movement_type movement_type not null,
  quantity integer not null,
  stock_before integer not null,
  stock_after integer not null,
  reserved_before integer not null default 0,
  reserved_after integer not null default 0,
  reference_type text,
  reference_id uuid,
  user_id uuid references app_users(id),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_movements_variant_created on stock_movements(variant_id, created_at desc);
create index if not exists idx_stock_movements_created on stock_movements(created_at desc);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on audit_log(entity_type, entity_id, created_at desc);

create sequence if not exists order_number_seq start with 1;
