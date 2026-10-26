-- Travel Studio independent personal collection library.
-- Apply manually in Supabase SQL Editor after review; committing this file does not migrate production.
create table if not exists public.saved_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  kind text not null default '商品' check (kind in ('商品','景點','美食','商店','其他')),
  country text not null default '',
  city text not null default '',
  place_name text not null default '',
  source_url text not null default '',
  image_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_collections_user_created_idx on public.saved_collections(user_id,created_at desc);
alter table public.saved_collections enable row level security;
drop policy if exists "collections_select_own" on public.saved_collections;
create policy "collections_select_own" on public.saved_collections for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "collections_insert_own" on public.saved_collections;
create policy "collections_insert_own" on public.saved_collections for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "collections_update_own" on public.saved_collections;
create policy "collections_update_own" on public.saved_collections for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "collections_delete_own" on public.saved_collections;
create policy "collections_delete_own" on public.saved_collections for delete to authenticated using ((select auth.uid())=user_id);
