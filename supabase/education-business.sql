create table if not exists public.sgc_education_records (
 id uuid primary key default gen_random_uuid(),
 website_id uuid not null references public.sgc_student_websites(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_key uuid not null,
 kind text not null check(kind in ('order','booking','enrolment','membership','event','contact','newsletter','catering')),
 status text not null default 'Received' check(status in ('Pending','Received','Active','Paused','Confirmed','Processing','Ready','Completed','Cancelled')),
 fields jsonb not null default '{}'::jsonb,
 data jsonb not null default '{}'::jsonb,
 ip_hash text,
 created_at timestamptz not null default now(),
 unique(website_id,request_key)
);
alter table public.sgc_education_records enable row level security;
revoke all on public.sgc_education_records from public,anon,authenticated;
grant all on public.sgc_education_records to service_role;
create index if not exists sgc_education_owner_time on public.sgc_education_records(owner_id,created_at desc);
create index if not exists sgc_education_rate on public.sgc_education_records(website_id,ip_hash,created_at);
create policy education_no_direct_access on public.sgc_education_records as restrictive for all to anon,authenticated using(false) with check(false);
create or replace function public.sgc_education_publication_context(p_slug text) returns jsonb language sql stable set search_path='' as $f$
 select jsonb_build_object('website_id',p.website_id,'owner_id',p.user_id,'snapshot',p.snapshot)
 from sgc_private.website_publications p
 where p.slug=p_slug and p.unpublished_at is null and sgc_private.website_subscription_active(p.user_id)
 and p.snapshot->'preferences'->>'activeStudio'='education';
$f$;
revoke all on function public.sgc_education_publication_context(text) from public,anon,authenticated;
grant execute on function public.sgc_education_publication_context(text) to service_role;
-- Retain teaching content in the private publication. Strip it from every public resolution.
create or replace function sgc_private.education_studio_public(d jsonb) returns jsonb language sql immutable set search_path='' as $f$
 select jsonb_set(jsonb_set(d,'{courses}',coalesce((select jsonb_agg(jsonb_set(c,'{lessons}',coalesce((select jsonb_agg(jsonb_build_object('id',l->'id','title',l->'title','module',l->'module','duration',l->'duration')) from jsonb_array_elements(coalesce(c->'lessons','[]'::jsonb)) l),'[]'::jsonb))) from jsonb_array_elements(coalesce(d->'courses','[]'::jsonb)) c),'[]'::jsonb)),'{items}',coalesce((select jsonb_agg(i-'resource') from jsonb_array_elements(coalesce(d->'items','[]'::jsonb)) i),'[]'::jsonb));
$f$;
revoke all on function sgc_private.education_studio_public(jsonb) from public,anon,authenticated;
grant execute on function sgc_private.education_studio_public(jsonb) to service_role;
do $f$ declare definition text; begin
 select pg_get_functiondef('sgc_private.website_snapshot(public.sgc_student_websites)'::regprocedure) into definition;
 if position('''educationStudio''' in definition)=0 then
  definition:=replace(definition,'''creativeStudio'']','''creativeStudio'',''educationStudio'']');
  if position('''educationStudio''' in definition)=0 then raise exception 'Snapshot allowlist did not match'; end if;
  execute definition;
 end if;
end;$f$;
create or replace function public.sgc_resolve_published_website(p_slug text) returns jsonb language sql stable set search_path='' as $f$
 select case when jsonb_typeof(snapshot->'preferences'->'educationStudio')='object' then jsonb_set(snapshot,'{preferences,educationStudio}',sgc_private.education_studio_public(snapshot->'preferences'->'educationStudio')) else snapshot end
 from sgc_private.website_publications
 where slug=p_slug and unpublished_at is null and sgc_private.website_subscription_active(user_id);
$f$;
revoke all on function public.sgc_resolve_published_website(text) from public,anon,authenticated;
grant execute on function public.sgc_resolve_published_website(text) to service_role;
-- Teaching videos and paid workbooks stay in an owner-managed private bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sgc-education-content','sgc-education-content',false,104857600,array['application/pdf','video/mp4','video/webm']) on conflict(id) do nothing;
create policy education_content_owner_insert on storage.objects for insert to authenticated with check(bucket_id='sgc-education-content' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy education_content_owner_select on storage.objects for select to authenticated using(bucket_id='sgc-education-content' and (storage.foldername(name))[1]=(select auth.uid())::text);
