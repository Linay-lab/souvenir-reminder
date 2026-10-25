-- Stage 4: private photo storage for shopping items.
-- Execute after 20261025_shopping_item_photos.sql in the same Supabase project.
-- File key: <auth.uid()>/<trip_id>/<item_id>/<random-filename>.
-- Existing trips, shopping items and budgets are not modified.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shopping-item-photos', 'shopping-item-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "shopping photos read own" on storage.objects;
create policy "shopping photos read own" on storage.objects for select to authenticated
using (
  bucket_id = 'shopping-item-photos'
  and split_part(storage.objects.name, '/', 1) = auth.uid()::text
  and exists (
    select 1 from public.shopping_items i
    join public.trips t on t.id = i.trip_id
    where i.id::text = split_part(storage.objects.name, '/', 3)
      and i.trip_id::text = split_part(storage.objects.name, '/', 2)
      and t.owner_id = auth.uid()
  )
);

drop policy if exists "shopping photos upload own" on storage.objects;
create policy "shopping photos upload own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'shopping-item-photos'
  and split_part(storage.objects.name, '/', 1) = auth.uid()::text
  and exists (
    select 1 from public.shopping_items i
    join public.trips t on t.id = i.trip_id
    where i.id::text = split_part(storage.objects.name, '/', 3)
      and i.trip_id::text = split_part(storage.objects.name, '/', 2)
      and t.owner_id = auth.uid()
  )
);

drop policy if exists "shopping photos delete own" on storage.objects;
create policy "shopping photos delete own" on storage.objects for delete to authenticated
using (
  bucket_id = 'shopping-item-photos'
  and split_part(storage.objects.name, '/', 1) = auth.uid()::text
  and exists (
    select 1 from public.shopping_items i
    join public.trips t on t.id = i.trip_id
    where i.id::text = split_part(storage.objects.name, '/', 3)
      and i.trip_id::text = split_part(storage.objects.name, '/', 2)
      and t.owner_id = auth.uid()
  )
);
