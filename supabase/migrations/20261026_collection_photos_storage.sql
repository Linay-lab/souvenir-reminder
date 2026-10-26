-- Review and apply in Supabase SQL Editor. This is not applied automatically.
-- Public image URLs are used in the collection UI; avoid private/sensitive photos.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('collection-photos','collection-photos',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "collection_photos_public_read" on storage.objects for select to public
using (bucket_id='collection-photos');
create policy "collection_photos_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id='collection-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "collection_photos_owner_update" on storage.objects for update to authenticated
using (bucket_id='collection-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='collection-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "collection_photos_owner_delete" on storage.objects for delete to authenticated
using (bucket_id='collection-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
