-- ============================================================
-- C Kitchen by Oliver — Supabase Setup Script
-- Run this ONCE in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/glaolagiflbsoccrnstz/sql/new
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Users (extends auth.users)
create table if not exists public.users (
  id           uuid references auth.users(id) on delete cascade primary key,
  name         text        not null,
  email        text        not null,
  phone        text,
  address      text,
  role         text        not null default 'customer'
                           check (role in ('customer', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Menu Items
create table if not exists public.menu_items (
  id           uuid        primary key default uuid_generate_v4(),
  name         text        not null,
  description  text        not null default '',
  price        numeric(10,2) not null check (price > 0),
  category     text        not null,
  available    boolean     not null default true,
  image_url    text        not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Orders
create table if not exists public.orders (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        references public.users(id) not null,
  user_name    text        not null,
  user_phone   text,
  user_address text,
  items        jsonb       not null default '[]',
  total_amount numeric(10,2) not null check (total_amount > 0),
  notes        text        not null default '',
  status       text        not null default 'Pending'
                           check (status in ('Pending','Accepted','Rejected','Preparing','Delivered')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);


-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.users      enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders     enable row level security;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;


-- ── Users policies ───────────────────────────────────────────────────────────

-- Owner or admin can read
create policy "users_select"
  on public.users for select
  using (auth.uid() = id or public.is_admin());

-- Only owner can insert own row; role must be 'customer'
create policy "users_insert"
  on public.users for insert
  with check (auth.uid() = id and role = 'customer');

-- Owner can update own row but cannot change their role
create policy "users_update"
  on public.users for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.users where id = auth.uid())
  );

-- No deletion
create policy "users_delete"
  on public.users for delete
  using (false);


-- ── Menu Items policies ───────────────────────────────────────────────────────

-- Any authenticated user can read menu items
create policy "menu_items_select"
  on public.menu_items for select
  using (auth.role() = 'authenticated');

-- Only admins can insert
create policy "menu_items_insert"
  on public.menu_items for insert
  with check (public.is_admin());

-- Only admins can update
create policy "menu_items_update"
  on public.menu_items for update
  using (public.is_admin())
  with check (public.is_admin());

-- Only admins can delete
create policy "menu_items_delete"
  on public.menu_items for delete
  using (public.is_admin());


-- ── Orders policies ───────────────────────────────────────────────────────────

-- Owner can create their own order (validated fields)
create policy "orders_insert"
  on public.orders for insert
  with check (
    auth.uid() = user_id
    and status = 'Pending'
    and total_amount > 0
    and jsonb_array_length(items) > 0
  );

-- Owner sees own orders; admin sees all
create policy "orders_select"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

-- Only admin can update (status changes only enforced by app logic)
create policy "orders_update"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

-- No deletion
create policy "orders_delete"
  on public.orders for delete
  using (false);


-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable Realtime on the tables that need live updates
alter publication supabase_realtime add table public.menu_items;
alter publication supabase_realtime add table public.orders;

-- Full replica identity so UPDATE/DELETE payloads include old row data
alter table public.menu_items replica identity full;
alter table public.orders     replica identity full;


-- ─── Storage ──────────────────────────────────────────────────────────────────
-- Create a public bucket for menu item images
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to menu-images
create policy "menu_images_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'menu-images' and public.is_admin());

-- Allow public read of menu images
create policy "menu_images_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

-- Allow admin to delete menu images
create policy "menu_images_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'menu-images' and public.is_admin());


-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Next steps:
-- 1. Visit /admin/seed.html to seed menu items (must be logged in as admin)
-- 2. To make a user an admin, run:
--    update public.users set role = 'admin' where email = 'your@email.com';
