-- Optional preview-only migration. Apply in Supabase SQL Editor before enabling cover cleanup.
-- Only the owner of an existing trip may delete that trip's private cover files.
drop policy if exists "trip cover storage delete" on storage.objects;
create policy "trip cover storage delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'trip-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(name))[2]
      and t.owner_id = auth.uid()
  )
);
