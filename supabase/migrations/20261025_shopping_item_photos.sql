-- Stage 4: per-item photo metadata. Run only after the photo upload UI is ready.
-- This migration does not alter existing shopping items or budgets.
create table if not exists public.shopping_item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.shopping_items(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (storage_path)
);
create index if not exists shopping_item_photos_trip_item_idx on public.shopping_item_photos(trip_id, item_id, sort_order);
alter table public.shopping_item_photos enable row level security;
grant select, insert, update, delete on public.shopping_item_photos to authenticated;
drop policy if exists "photo owner select" on public.shopping_item_photos;
create policy "photo owner select" on public.shopping_item_photos for select to authenticated
using (owner_id = auth.uid() and exists (
  select 1 from public.shopping_items i join public.trips t on t.id = i.trip_id
  where i.id = item_id and i.trip_id = shopping_item_photos.trip_id and t.owner_id = auth.uid()
));
drop policy if exists "photo owner insert" on public.shopping_item_photos;
create policy "photo owner insert" on public.shopping_item_photos for insert to authenticated
with check (owner_id = auth.uid() and exists (
  select 1 from public.shopping_items i join public.trips t on t.id = i.trip_id
  where i.id = item_id and i.trip_id = shopping_item_photos.trip_id and t.owner_id = auth.uid()
));
drop policy if exists "photo owner update" on public.shopping_item_photos;
create policy "photo owner update" on public.shopping_item_photos for update to authenticated
using (owner_id = auth.uid() and exists (
  select 1 from public.shopping_items i join public.trips t on t.id = i.trip_id
  where i.id = item_id and i.trip_id = shopping_item_photos.trip_id and t.owner_id = auth.uid()
))
with check (owner_id = auth.uid() and exists (
  select 1 from public.shopping_items i join public.trips t on t.id = i.trip_id
  where i.id = item_id and i.trip_id = shopping_item_photos.trip_id and t.owner_id = auth.uid()
));
drop policy if exists "photo owner delete" on public.shopping_item_photos;
create policy "photo owner delete" on public.shopping_item_photos for delete to authenticated
using (owner_id = auth.uid() and exists (
  select 1 from public.shopping_items i join public.trips t on t.id = i.trip_id
  where i.id = item_id and i.trip_id = shopping_item_photos.trip_id and t.owner_id = auth.uid()
));
notify pgrst, 'reload schema';
