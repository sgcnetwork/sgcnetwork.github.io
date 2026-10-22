create table if not exists public.sgc_creative_requests (like public.sgc_food_requests including defaults including constraints including indexes);
alter table public.sgc_creative_requests enable row level security;
revoke all on public.sgc_creative_requests from public,anon,authenticated;
grant all on public.sgc_creative_requests to service_role;
create policy creative_requests_no_direct_access on public.sgc_creative_requests as restrictive for all to anon,authenticated using(false) with check(false);
create or replace function public.sgc_creative_publication_context(p_slug text) returns jsonb language sql stable set search_path='' as $f$
select jsonb_build_object('website_id',p.website_id,'owner_id',p.user_id,'snapshot',p.snapshot)
from sgc_private.website_publications p
where p.slug=p_slug and p.unpublished_at is null and sgc_private.website_subscription_active(p.user_id)
and p.snapshot->'preferences'->>'activeStudio'='creative';$f$;
revoke all on function public.sgc_creative_publication_context(text) from public,anon,authenticated;
grant execute on function public.sgc_creative_publication_context(text) to service_role;
do $f$ declare definition text; begin
select pg_get_functiondef('sgc_private.website_snapshot(public.sgc_student_websites)'::regprocedure) into definition;
if position('''creativeStudio''' in definition)=0 then
definition:=replace(definition,'''fitnessStudio'']','''fitnessStudio'',''creativeStudio'']');
if position('''creativeStudio''' in definition)=0 then raise exception 'Snapshot allowlist did not match'; end if;
execute definition;end if;end;$f$;
