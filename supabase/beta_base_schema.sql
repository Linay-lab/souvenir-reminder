-- Travel Studio Beta: baseline for a NEW, EMPTY Supabase public schema only.
-- Never run on production. Verify project name is souvenir-reminder, not souvenir-reminder-prod.
-- Auth users are managed by Supabase Auth; do not create or copy accounts manually.
begin;
create table if not exists public.trips (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null default '我的旅行',
 destination text,
 start_date date,
 end_date date,
 currency text not null default 'TWD',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists trips_owner_created_idx on public.trips(owner_id,created_at);
alter table public.trips enable row level security;
drop policy if exists trips_select_own on public.trips;
create policy trips_select_own on public.trips for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists trips_insert_own on public.trips;
create policy trips_insert_own on public.trips for insert to authenticated with check (owner_id=(select auth.uid()));
drop policy if exists trips_update_own on public.trips;
create policy trips_update_own on public.trips for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
drop policy if exists trips_delete_own on public.trips;
create policy trips_delete_own on public.trips for delete to authenticated using (owner_id=(select auth.uid()));

create table if not exists public.shopping_items (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 name text not null,
 quantity integer not null default 1 check (quantity>0),
 recipient text not null default '自己',
 category text not null default '自用',
 price numeric(14,2) not null default 0 check (price>=0),
 currency text not null default 'TWD',
 place_name text,
 note text,
 bought boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists shopping_items_trip_idx on public.shopping_items(trip_id);
alter table public.shopping_items enable row level security;
drop policy if exists shopping_items_select_own on public.shopping_items;
create policy shopping_items_select_own on public.shopping_items for select to authenticated using (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists shopping_items_insert_own on public.shopping_items;
create policy shopping_items_insert_own on public.shopping_items for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists shopping_items_update_own on public.shopping_items;
create policy shopping_items_update_own on public.shopping_items for update to authenticated using (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid()))) with check (created_by=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists shopping_items_delete_own on public.shopping_items;
create policy shopping_items_delete_own on public.shopping_items for delete to authenticated using (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));

create table if not exists public.trip_budgets (
 trip_id uuid not null references public.trips(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 currency text not null default 'TWD',
 amount numeric(14,2) not null default 0 check (amount>=0),
 created_at timestamptz not null default now(),
 primary key(trip_id,currency)
);
alter table public.trip_budgets enable row level security;
drop policy if exists trip_budgets_select_own on public.trip_budgets;
create policy trip_budgets_select_own on public.trip_budgets for select to authenticated using (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists trip_budgets_insert_own on public.trip_budgets;
create policy trip_budgets_insert_own on public.trip_budgets for insert to authenticated with check (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists trip_budgets_update_own on public.trip_budgets;
create policy trip_budgets_update_own on public.trip_budgets for update to authenticated using (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid()))) with check (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists trip_budgets_delete_own on public.trip_budgets;
create policy trip_budgets_delete_own on public.trip_budgets for delete to authenticated using (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));

create table if not exists public.trip_covers (
 trip_id uuid primary key references public.trips(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null,
 position_x numeric not null default 50,
 position_y numeric not null default 50,
 zoom numeric not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.trip_covers enable row level security;
drop policy if exists trip_covers_select_own on public.trip_covers;
create policy trip_covers_select_own on public.trip_covers for select to authenticated using (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists trip_covers_insert_own on public.trip_covers;
create policy trip_covers_insert_own on public.trip_covers for insert to authenticated with check (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists trip_covers_update_own on public.trip_covers;
create policy trip_covers_update_own on public.trip_covers for update to authenticated using (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid()))) with check (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
drop policy if exists trip_covers_delete_own on public.trip_covers;
create policy trip_covers_delete_own on public.trip_covers for delete to authenticated using (owner_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
commit;

-- Private trip cover bucket; signed URLs are generated by authenticated owners.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('trip-covers','trip-covers',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists trip_covers_storage_select on storage.objects;
create policy trip_covers_storage_select on storage.objects for select to authenticated
using (bucket_id='trip-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists trip_covers_storage_insert on storage.objects;
create policy trip_covers_storage_insert on storage.objects for insert to authenticated
with check (bucket_id='trip-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists trip_covers_storage_update on storage.objects;
create policy trip_covers_storage_update on storage.objects for update to authenticated
using (bucket_id='trip-covers' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='trip-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists trip_covers_storage_delete on storage.objects;
create policy trip_covers_storage_delete on storage.objects for delete to authenticated
using (bucket_id='trip-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
