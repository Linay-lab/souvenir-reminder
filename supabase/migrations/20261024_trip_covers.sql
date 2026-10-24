-- Run once in Supabase SQL Editor before testing cloud cover uploads.
create table if not exists public.trip_covers (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  position_x numeric not null default 50 check (position_x between 0 and 100),
  position_y numeric not null default 50 check (position_y between 0 and 100),
  zoom numeric not null default 100 check (zoom between 100 and 250),
  updated_at timestamptz not null default now()
);
alter table public.trip_covers enable row level security;

drop policy if exists "trip cover owner select" on public.trip_covers;
create policy "trip cover owner select" on public.trip_covers for select to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

drop policy if exists "trip cover owner insert" on public.trip_covers;
create policy "trip cover owner insert" on public.trip_covers for insert to authenticated
with check (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  and storage_path like auth.uid()::text || '/' || trip_id::text || '/%');

drop policy if exists "trip cover owner update" on public.trip_covers;
create policy "trip cover owner update" on public.trip_covers for update to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  and storage_path like auth.uid()::text || '/' || trip_id::text || '/%');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-covers', 'trip-covers', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "trip cover storage select" on storage.objects;
create policy "trip cover storage select" on storage.objects for select to authenticated
using (bucket_id = 'trip-covers' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.trips t where t.id::text = (storage.foldername(name))[2] and t.owner_id = auth.uid()));

drop policy if exists "trip cover storage insert" on storage.objects;
create policy "trip cover storage insert" on storage.objects for insert to authenticated
with check (bucket_id = 'trip-covers' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.trips t where t.id::text = (storage.foldername(name))[2] and t.owner_id = auth.uid()));
