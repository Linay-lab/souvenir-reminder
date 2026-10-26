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
create policy "expenses_select_owned_trip" on public.trip_expenses for select to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
create policy "expenses_insert_owned_trip" on public.trip_expenses for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
create policy "expenses_update_owned_trip" on public.trip_expenses for update to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid()))) with check (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
create policy "expenses_delete_owned_trip" on public.trip_expenses for delete to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
