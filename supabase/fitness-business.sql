create table if not exists public.sgc_fitness_records (
 id uuid primary key default gen_random_uuid(),website_id uuid not null references public.sgc_student_websites(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,request_key uuid not null,kind text not null check(kind in ('booking','membership','coaching','order','contact','newsletter')),status text not null,fields jsonb not null default '{}'::jsonb,data jsonb not null default '{}'::jsonb,ip_hash text,created_at timestamptz not null default now(),unique(website_id,request_key)
);
alter table public.sgc_fitness_records enable row level security;
revoke all on public.sgc_fitness_records from anon,authenticated;
grant all on public.sgc_fitness_records to service_role;
create policy fitness_no_direct_access on public.sgc_fitness_records as restrictive for all to anon,authenticated using(false) with check(false);
create index if not exists sgc_fitness_owner_time on public.sgc_fitness_records(owner_id,created_at desc);
create index if not exists sgc_fitness_slot on public.sgc_fitness_records(website_id,kind,status,((data->>'classId')),((data->>'date')),((data->>'time')));
create index if not exists sgc_fitness_rate on public.sgc_fitness_records(website_id,ip_hash,created_at);
create or replace function public.sgc_fitness_publication_context(p_slug text) returns jsonb language sql stable set search_path='' as $f$
 select jsonb_build_object('website_id',p.website_id,'owner_id',p.user_id,'snapshot',p.snapshot) from sgc_private.website_publications p where p.slug=p_slug and p.unpublished_at is null and sgc_private.website_subscription_active(p.user_id) and p.snapshot->'preferences'->>'activeStudio'='fitness';
$f$;
revoke all on function public.sgc_fitness_publication_context(text) from public,anon,authenticated;
grant execute on function public.sgc_fitness_publication_context(text) to service_role;
create or replace function public.sgc_fitness_write(p_slug text,p_key uuid,p_kind text,p_fields jsonb,p_data jsonb,p_action text default 'submit',p_member_key uuid default null,p_ip text default null) returns jsonb language plpgsql set search_path='' as $f$
declare context jsonb; existing public.sgc_fitness_records; member public.sgc_fitness_records; saved public.sgc_fitness_records; amount integer; capacity integer; used integer; monthly integer; cycle text:=to_char(now() at time zone 'Africa/Johannesburg','YYYY-MM'); payload jsonb:=p_data; period_start timestamptz; booking_time timestamptz;
begin
 context:=public.sgc_fitness_publication_context(p_slug);if context is null then raise exception 'This studio is unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(context->>'website_id',87231));
 select * into existing from public.sgc_fitness_records where website_id=(context->>'website_id')::uuid and request_key=p_key for update;
 if p_action='submit' and existing.id is not null then return to_jsonb(existing);end if;
 if p_action in ('cancel','reschedule') then
  if existing.id is null or existing.kind<>'booking' or existing.status<>'Confirmed' then raise exception 'This booking cannot be changed';end if;
  booking_time:=(existing.data->>'date'||'T'||(existing.data->>'time')||':00+02:00')::timestamptz;
  if booking_time<now()+make_interval(hours=>coalesce((existing.data->>'cancelHours')::integer,12)) then raise exception 'The cancellation window has closed. Contact the studio';end if;
  if p_action='cancel' then update public.sgc_fitness_records set status='Cancelled' where id=existing.id returning * into saved;return to_jsonb(saved);end if;
 end if;
 if p_kind='booking' then
  capacity:=(payload->>'capacity')::integer;if capacity<1 or capacity>500 then raise exception 'This class is unavailable';end if;
  select count(*) into used from public.sgc_fitness_records where website_id=(context->>'website_id')::uuid and kind='booking' and status in ('Confirmed','Completed') and data->>'classId'=payload->>'classId' and data->>'date'=payload->>'date' and data->>'time'=payload->>'time' and request_key<>p_key;
  if used>=capacity then raise exception 'This class is full. Choose another session';end if;
  if p_member_key is not null then
   select * into member from public.sgc_fitness_records where website_id=(context->>'website_id')::uuid and request_key=p_member_key and kind='membership' and status='Active' for update;
   if member.id is null or coalesce((member.data->>'endsAt')::timestamptz,now())<=now() then raise exception 'This membership is not active. Refresh your member dashboard';end if;
   if coalesce((member.data->>'unlimited')::boolean,false)=false then
    monthly:=coalesce((member.data->>'credits')::integer,0);
    select count(*) into amount from public.sgc_fitness_records where website_id=member.website_id and kind='booking' and status in ('Confirmed','Completed') and data->>'membershipKey'=p_member_key::text and data->>'creditMonth'=cycle and request_key<>p_key;
    if amount>=monthly then raise exception 'No class credits remain for this month. Choose pay per class';end if;
   end if;
   payload:=payload||jsonb_build_object('total',0,'paymentStatus','membership','membershipKey',p_member_key,'creditMonth',cycle);
  else payload:=payload-'membershipKey';end if;
  if p_action='reschedule' then
   payload:=payload||jsonb_build_object('number',existing.data->>'number');
   update public.sgc_fitness_records set fields=p_fields,data=payload where id=existing.id returning * into saved;return to_jsonb(saved);
  end if;
 elsif p_kind='order' then
  -- Serialize stock reservation against every outstanding order for this publication.
  for payload in select jsonb_build_object('productId',line->>'productId','name',min(line->>'name'),'quantity',sum((line->>'quantity')::integer),'stock',min((line->>'stock')::integer),'trackStock',bool_or((line->>'trackStock')::boolean)) from jsonb_array_elements(p_data->'lines') line group by line->>'productId' loop
   if payload->>'trackStock'='true' then
    select coalesce(sum((line->>'quantity')::integer),0) into used from public.sgc_fitness_records r cross join lateral jsonb_array_elements(r.data->'lines') line where r.website_id=(context->>'website_id')::uuid and r.kind='order' and r.status<>'Cancelled' and line->>'productId'=payload->>'productId';
    if used+(payload->>'quantity')::integer>(payload->>'stock')::integer then raise exception 'There is not enough stock for %',payload->>'name';end if;
   end if;
  end loop;
  payload:=p_data;
 end if;
 insert into public.sgc_fitness_records(website_id,owner_id,request_key,kind,status,fields,data,ip_hash) values((context->>'website_id')::uuid,(context->>'owner_id')::uuid,p_key,p_kind,case when p_kind='booking' then 'Confirmed' when p_kind='membership' then 'Pending' else 'Received' end,p_fields,payload,p_ip) returning * into saved;
 return to_jsonb(saved);
end;$f$;
revoke all on function public.sgc_fitness_write(text,uuid,text,jsonb,jsonb,text,uuid,text) from public,anon,authenticated;
grant execute on function public.sgc_fitness_write(text,uuid,text,jsonb,jsonb,text,uuid,text) to service_role;
do $f$ declare definition text;begin
 select pg_get_functiondef('sgc_private.website_snapshot(public.sgc_student_websites)'::regprocedure) into definition;
 if position('''fitnessStudio''' in definition)=0 then definition:=replace(definition,'''activeStudio'',''ecommerceStudio'',''foodStudio'']','''activeStudio'',''ecommerceStudio'',''foodStudio'',''fitnessStudio'']');if position('''fitnessStudio''' in definition)=0 then raise exception 'Snapshot allowlist did not match';end if;execute definition;end if;
end;$f$;
