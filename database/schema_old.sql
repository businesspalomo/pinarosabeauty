create extension if not exists pgcrypto;

create type order_status as enum (
  'DRAFT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PICKING',
  'READY',
  'DISPATCHED',
  'CANCELLED'
);

create type movement_type as enum (
  'RECEIPT',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'SALE',
  'ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'RETURN'
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  example text,
  active boolean not null default true
);

create table subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  name text not null,
  example text,
  active boolean not null default true,
  unique(category_id, name)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id),
  category_id uuid references categories(id),
  subcategory_id uuid references subcategories(id),
  name text not null,
  description text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  shade_name text,
  shade_code text,
  internal_sku text not null unique,
  cost_ars numeric(14,2),
  wholesale_price numeric(14,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table barcodes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id),
  barcode text not null unique,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_barcodes_barcode on barcodes(barcode);
create index idx_variants_sku on product_variants(internal_sku);

create table locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true
);

create table inventory_balance (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id),
  location_id uuid not null references locations(id),
  physical_quantity integer not null default 0 check (physical_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now(),
  unique(variant_id, location_id),
  check (reserved_quantity <= physical_quantity)
);

create index idx_inventory_variant_location
  on inventory_balance(variant_id, location_id);

create table customers (
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

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references customers(id),
  status order_status not null default 'DRAFT',
  channel text,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_status_created
  on orders(status, created_at desc);

create index idx_orders_customer_created
  on orders(customer_id, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  subtotal numeric(14,2) not null check (subtotal >= 0)
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  variant_id uuid not null references product_variants(id),
  location_id uuid not null references locations(id),
  quantity integer not null check (quantity > 0),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table receiving_sessions (
  id uuid primary key default gen_random_uuid(),
  reference text,
  supplier text,
  status text not null default 'OPEN',
  user_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table receiving_items (
  id uuid primary key default gen_random_uuid(),
  receiving_session_id uuid not null references receiving_sessions(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  location_id uuid not null references locations(id),
  quantity integer not null default 1 check (quantity > 0)
);

create table picking_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  user_id uuid,
  status text not null default 'OPEN',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table picking_scans (
  id uuid primary key default gen_random_uuid(),
  picking_session_id uuid not null references picking_sessions(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  barcode text not null,
  quantity integer not null default 1 check (quantity > 0),
  user_id uuid,
  scanned_at timestamptz not null default now()
);

create index idx_picking_scans_session_time
  on picking_scans(picking_session_id, scanned_at desc);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id),
  location_id uuid not null references locations(id),
  movement_type movement_type not null,
  quantity integer not null,
  stock_before integer not null,
  stock_after integer not null,
  reference_type text,
  reference_id uuid,
  user_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

create index idx_stock_movements_variant_created
  on stock_movements(variant_id, created_at desc);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index idx_audit_entity
  on audit_log(entity_type, entity_id, created_at desc);
