-- Additive migration. Apply only after deployment approval.
-- No existing tables, orders, subscriptions or records are changed.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('sgc-builder-digital','sgc-builder-digital',false,52428800,null)
on conflict(id) do nothing;

create policy "builder digital owner select" on storage.objects
for select to authenticated
using (bucket_id='sgc-builder-digital' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "builder digital entitled owner insert" on storage.objects
for insert to authenticated
with check (bucket_id='sgc-builder-digital' and (storage.foldername(name))[1]=(select auth.uid())::text
and (exists(select 1 from public.sgc_demo_entitlements d where d.user_id=(select auth.uid()))
or exists(select 1 from public.sgc_website_subscriptions s where s.user_id=(select auth.uid()) and s.status='active' and s.current_period_end>now())));

-- Unique upload paths are immutable; replacement creates a new object.
-- Customer download access is intentionally absent until paid-order verification is implemented.
