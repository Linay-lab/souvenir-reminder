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
create policy "stops_select_own_trip" on public.itinerary_stops for select to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
create policy "stops_insert_own_trip" on public.itinerary_stops for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
create policy "stops_update_own_trip" on public.itinerary_stops for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
create policy "stops_delete_own_trip" on public.itinerary_stops for delete to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
