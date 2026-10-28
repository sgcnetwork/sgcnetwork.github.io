create table public.visa_service_records (
 id text primary key check(length(id) between 1 and 100),
 kind text not null check(kind in ('lead','quote','invoice','expense','document')),
 brand text not null check(brand in ('GVM','GVS','VL','GovDocs')),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=100000),
 created_at timestamptz not null default now(),
 constraint visa_record_amount check (coalesce((data->>'amount')::numeric,0)>=0)
);
create index visa_service_brand_created_idx on public.visa_service_records(brand,created_at desc);
alter table public.visa_service_records enable row level security;
revoke all on public.visa_service_records from anon,authenticated;
grant select,insert,update on public.visa_service_records to authenticated;
create policy visa_owner_select on public.visa_service_records for select to authenticated using ((select auth.uid())='df627f92-e256-47eb-8a92-590ee9cf7d59'::uuid);
create policy visa_owner_insert on public.visa_service_records for insert to authenticated with check ((select auth.uid())='df627f92-e256-47eb-8a92-590ee9cf7d59'::uuid);
create policy visa_owner_update on public.visa_service_records for update to authenticated using ((select auth.uid())='df627f92-e256-47eb-8a92-590ee9cf7d59'::uuid) with check ((select auth.uid())='df627f92-e256-47eb-8a92-590ee9cf7d59'::uuid);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('visa-service-documents','visa-service-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy visa_documents_owner_read on storage.objects for select to authenticated using (bucket_id='visa-service-documents' and (select auth.uid())='df627f92-e256-47eb-8a92-590ee9cf7d59'::uuid);
create policy visa_documents_owner_insert on storage.objects for insert to authenticated with check (bucket_id='visa-service-documents' and (select auth.uid())='df627f92-e256-47eb-8a92-590ee9cf7d59'::uuid and (storage.foldername(name))[1] in ('GVM','GVS','VL','GovDocs'));
create policy visa_documents_owner_delete on storage.objects for delete to authenticated using (bucket_id='visa-service-documents' and (select auth.uid())='df627f92-e256-47eb-8a92-590ee9cf7d59'::uuid);
