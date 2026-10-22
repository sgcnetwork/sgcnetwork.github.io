create table if not exists public.sgc_food_requests (
 id uuid primary key default gen_random_uuid(),
 website_id uuid not null references public.sgc_student_websites(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_key uuid not null,
 kind text not null check (kind in ('order','reservation','catering','contact','newsletter')),
 status text not null default 'Received' check (status in ('Received','Preparing','Ready','Confirmed','Declined','Completed','Cancelled')),
 fields jsonb not null default '{}'::jsonb,
 data jsonb not null default '{}'::jsonb,
 ip_hash text,
 created_at timestamptz not null default now(),
 unique(website_id,request_key)
);
alter table public.sgc_food_requests enable row level security;
revoke all on public.sgc_food_requests from anon, authenticated;
grant all on public.sgc_food_requests to service_role;
create index if not exists sgc_food_requests_owner_time on public.sgc_food_requests(owner_id,created_at desc);
create index if not exists sgc_food_requests_rate on public.sgc_food_requests(website_id,ip_hash,created_at);
create or replace function public.sgc_food_publication_context(p_slug text) returns jsonb language sql stable set search_path='' as $f$
 select jsonb_build_object('website_id',p.website_id,'owner_id',p.user_id,'snapshot',p.snapshot)
 from sgc_private.website_publications p
 where p.slug=p_slug and p.unpublished_at is null and sgc_private.website_subscription_active(p.user_id)
 and p.snapshot->'preferences'->>'activeStudio'='food';
$f$;
revoke all on function public.sgc_food_publication_context(text) from public,anon,authenticated;
grant execute on function public.sgc_food_publication_context(text) to service_role;
do $f$
declare definition text;
begin
 select pg_get_functiondef('sgc_private.website_snapshot(public.sgc_student_websites)'::regprocedure) into definition;
 if position('''foodStudio''' in definition)=0 then
  definition:=replace(definition,'''activeStudio'',''ecommerceStudio'']','''activeStudio'',''ecommerceStudio'',''foodStudio'']');
  if position('''foodStudio''' in definition)=0 then raise exception 'Snapshot allowlist did not match';end if;
  execute definition;
 end if;
end;$f$;

create policy food_requests_no_direct_access on public.sgc_food_requests as restrictive for all to anon, authenticated using (false) with check (false);
