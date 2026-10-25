-- Run once in Supabase SQL Editor before enabling per-trip shopping budgets.
-- Independent budget per currency; never converts or combines currencies.
create table if not exists public.trip_budgets (
  trip_id uuid not null references public.trips(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric(14,2) not null check (amount >= 0 and amount <= 999999999999),
  updated_at timestamptz not null default now(),
  primary key (trip_id, currency)
);
alter table public.trip_budgets enable row level security;

drop policy if exists "trip budgets owner select" on public.trip_budgets;
create policy "trip budgets owner select" on public.trip_budgets for select to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

drop policy if exists "trip budgets owner insert" on public.trip_budgets;
create policy "trip budgets owner insert" on public.trip_budgets for insert to authenticated
with check (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

drop policy if exists "trip budgets owner update" on public.trip_budgets;
create policy "trip budgets owner update" on public.trip_budgets for update to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

drop policy if exists "trip budgets owner delete" on public.trip_budgets;
create policy "trip budgets owner delete" on public.trip_budgets for delete to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
