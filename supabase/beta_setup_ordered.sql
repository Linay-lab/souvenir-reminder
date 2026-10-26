-- TRAVEL STUDIO BETA: ordered, non-destructive setup for the verified test Supabase project.
-- IMPORTANT: Review the target project and take a backup before running.
-- Do not run against production without explicit approval.
-- Individual migration files remain the source of truth; this file is a convenience for SQL Editor.

-- ===== 1. 20261026_saved_collections.sql =====
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
drop policy if exists "collections_select_own" on public.saved;
create policy "collections_select_own" on public.saved_collections for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "collections_insert_own" on public.saved;
create policy "collections_insert_own" on public.saved_collections for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "collections_update_own" on public.saved;
create policy "collections_update_own" on public.saved_collections for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "collections_delete_own" on public.saved;
create policy "collections_delete_own" on public.saved_collections for delete to authenticated using ((select auth.uid())=user_id);

-- ===== 2. 20261026_collection_photos_storage.sql =====
-- Review and apply in Supabase SQL Editor. This is not applied automatically.
-- Public image URLs are used in the collection UI; avoid private/sensitive photos.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('collection-photos','collection-photos',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "collection_photos_public_read" on storage.objects;
create policy "collection_photos_public_read" on storage.objects for select to public
using (bucket_id='collection-photos');
drop policy if exists "collection_photos_owner_insert" on storage.objects;
create policy "collection_photos_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id='collection-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "collection_photos_owner_update" on storage.objects;
create policy "collection_photos_owner_update" on storage.objects for update to authenticated
using (bucket_id='collection-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='collection-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "collection_photos_owner_delete" on storage.objects;
create policy "collection_photos_owner_delete" on storage.objects for delete to authenticated
using (bucket_id='collection-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- ===== 3. 20261026_itinerary_stops.sql =====
-- Travel Studio itinerary stops, apply manually after review.
create table if not exists public.itinerary_stops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  visit_date date not null,
  visit_time time without time zone,
  title text not null check (char_length(trim(title)) between 1 and 200),
  place_name text not null default '',
  address text not null default '',
  notes text not null default '',
  source_collection_id uuid references public.saved_collections(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists itinerary_stops_trip_date_idx on public.itinerary_stops(trip_id,visit_date,sort_order);
alter table public.itinerary_stops enable row level security;
drop policy if exists "stops_select_own_trip" on public.itinerary;
create policy "stops_select_own_trip" on public.itinerary_stops for select to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists "stops_insert_own_trip" on public.itinerary;
create policy "stops_insert_own_trip" on public.itinerary_stops for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists "stops_update_own_trip" on public.itinerary;
create policy "stops_update_own_trip" on public.itinerary_stops for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists "stops_delete_own_trip" on public.itinerary;
create policy "stops_delete_own_trip" on public.itinerary_stops for delete to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));

-- ===== 4. 20261026_trip_expenses.sql =====
-- Apply in Supabase SQL Editor after review; does not modify existing trip_budgets.
create table if not exists public.trip_expenses (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 expense_date date not null,
 title text not null check (char_length(trim(title)) between 1 and 200),
 category text not null default '其他' check (category in ('交通','住宿','餐飲','購物','門票','其他')),
 amount numeric(14,2) not null check (amount >= 0),
 currency text not null default 'TWD' check (char_length(currency)=3),
 notes text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists trip_expenses_trip_date_idx on public.trip_expenses(trip_id,expense_date desc);
alter table public.trip_expenses enable row level security;
drop policy if exists "expenses_select_owned_trip" on public.trip;
create policy "expenses_select_owned_trip" on public.trip_expenses for select to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists "expenses_insert_owned_trip" on public.trip;
create policy "expenses_insert_owned_trip" on public.trip_expenses for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists "expenses_update_owned_trip" on public.trip;
create policy "expenses_update_owned_trip" on public.trip_expenses for update to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid()))) with check (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists "expenses_delete_owned_trip" on public.trip;
create policy "expenses_delete_owned_trip" on public.trip_expenses for delete to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));

-- ===== 5. 20261026_beta_feedback.sql =====
-- Beta feedback, authenticated testers only. Apply to the confirmed test Supabase project.
-- No access to other users' feedback from the client.
create table if not exists public.beta_feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 area text not null check (area in ('首頁','收藏庫','我的旅行','購物清單','每日行程','旅行錢包','帳號登入','其他')),
 feedback_type text not null check (feedback_type in ('問題回報','功能建議','使用感想')),
 rating integer check (rating between 1 and 5),
 message text not null check (char_length(trim(message)) between 10 and 2000),
 page_path text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists beta_feedback_created_idx on public.beta_feedback(created_at desc);
alter table public.beta_feedback enable row level security;
drop policy if exists "beta_feedback_insert_own" on public.beta_feedback;
create policy "beta_feedback_insert_own" on public.beta_feedback
for insert to authenticated with check (user_id=(select auth.uid()));
-- No SELECT/UPDATE/DELETE policy: feedback is read by the project owner using Supabase dashboard.
