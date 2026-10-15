-- Verified-payment entitlements. Preserve existing orders and customer records.
create schema if not exists sgc_private;
grant usage on schema sgc_private to service_role;
alter table public.sgc_stitch_transactions add column if not exists entitlement_key text;
create table if not exists sgc_private.payment_activations (
 transaction_id uuid primary key references public.sgc_stitch_transactions(id),
 user_id uuid not null references auth.users(id),
 entitlement text not null,
 starts_at timestamptz not null,
 ends_at timestamptz,
 result jsonb not null,
 applied_at timestamptz not null default now()
);
alter table sgc_private.payment_activations enable row level security;
revoke all on sgc_private.payment_activations from public,anon,authenticated;
grant select,insert on sgc_private.payment_activations to service_role;

-- The next section is inserted from the recorded original function.
CREATE OR REPLACE FUNCTION sgc_private.activate_legacy_membership(p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 t public.sgc_stitch_transactions%rowtype;
 p public.sgc_named_membership_plans%rowtype;
 tier text; f text; grant_id uuid; member_id uuid; start_time timestamptz; end_time timestamptz; grant_reason text;
begin
 select * into t from public.sgc_stitch_transactions where id=p_transaction_id for update;
 if not found or t.status<>'paid' or t.user_id is null or t.paid_at is null then
  raise exception 'A verified paid checkout is required';
 end if;
 start_time:=t.paid_at;
 end_time:=case when t.billing='monthly' then start_time+interval '1 month' else null end;
 grant_reason:='stitch-membership:'||t.id::text;
 if t.merchant_reference like 'M-%' then
  select * into p from public.sgc_named_membership_plans where id::text=t.product_id;
  if not found then raise exception 'Purchased membership not found'; end if;
  for f in select jsonb_array_elements_text(p.features) loop
   if not exists(select 1 from public.sgc_named_membership_features where key=f) then
    raise exception 'Unknown membership feature';
   end if;
   select id into grant_id from public.sgc_access_grants
    where user_id=t.user_id and access_level='feature:'||f and reason=grant_reason limit 1;
   if grant_id is null then
    insert into public.sgc_access_grants(user_id,access_level,starts_at,ends_at,active,reason)
     values(t.user_id,'feature:'||f,start_time,end_time,true,grant_reason);
   else
    update public.sgc_access_grants set starts_at=start_time,ends_at=end_time,active=true where id=grant_id;
   end if;
  end loop;
  return jsonb_build_object('membershipActivated',true,'name',p.name,'features',p.features);
 end if;
 if t.merchant_reference like 'S-%' then tier:='start';
 elsif t.merchant_reference like 'B-%' then tier:='build';
 elsif t.merchant_reference like 'X-%' then
  select access_level into tier from public.sgc_products where id::text=t.product_id;
 end if;
 if tier is null or tier not in ('start','build') then
  return jsonb_build_object('membershipActivated',false);
 end if;
 select id into member_id from public.memberships where user_id=t.user_id and membership_type::text=tier order by created_at desc limit 1;
 if member_id is null then
  insert into public.memberships(user_id,membership_type,status,price_zar,started_at,current_period_end)
   values(t.user_id,tier::public.membership_type,'active',t.amount_zar,start_time,end_time);
 else
  update public.memberships set status='active',price_zar=t.amount_zar,
   started_at=least(started_at,start_time),
   current_period_end=case when t.billing='once' then null when current_period_end is null then end_time else greatest(current_period_end,end_time) end,
   updated_at=now() where id=member_id;
 end if;
 return jsonb_build_object('membershipActivated',true,'name',case when tier='start' then 'SGC Start' else 'SGC Build' end);
end;
$function$;
revoke all on function sgc_private.activate_legacy_membership(uuid) from public,anon,authenticated;
grant execute on function sgc_private.activate_legacy_membership(uuid) to service_role;


create or replace function public.sgc_activate_paid_membership(p_transaction_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 t public.sgc_stitch_transactions%rowtype;
 previous sgc_private.payment_activations%rowtype;
 tier text; result jsonb; member_id uuid; period_start timestamptz; period_end timestamptz; existing_end timestamptz;
begin
 select * into t from public.sgc_stitch_transactions where id=p_transaction_id for update;
 if not found or t.status<>'paid' or t.user_id is null or t.paid_at is null then
  raise exception 'A verified paid checkout is required';
 end if;
 -- Serialise all entitlements for a buyer, including concurrent renewal events.
 perform pg_advisory_xact_lock(hashtextextended(t.user_id::text,89150));
 select * into previous from sgc_private.payment_activations where transaction_id=t.id;
 if found then return previous.result || jsonb_build_object('alreadyApplied',true); end if;
 tier:=t.entitlement_key;
 if tier is null then
  if t.merchant_reference like 'S-%' then tier:='start';
  elsif t.merchant_reference like 'B-%' then tier:='build';
  elsif t.merchant_reference like 'W-%' then tier:='website_builder';
  elsif t.merchant_reference like 'X-%' then
   select access_level into tier from public.sgc_products where id::text=t.product_id;
  end if;
 end if;
 if tier in ('build','website_builder') and not (
  exists(select 1 from public.sgc_demo_entitlements where user_id=t.user_id)
  or exists(select 1 from public.sgc_stitch_transactions entry
   left join public.sgc_products p on p.id::text=entry.product_id
   where entry.user_id=t.user_id and entry.status='paid' and entry.paid_at is not null
   and entry.billing='once' and entry.amount_zar>=150
   and (entry.entitlement_key='start' or entry.product_id in ('start','sgc-start-foundations') or p.access_level='start'))
 ) then raise exception 'Purchase the R150 once-off membership first'; end if;
 period_start:=t.paid_at;
 if tier in ('build','website_builder') then
  if t.billing<>'monthly' or t.amount_zar<=0 then raise exception 'Invalid monthly entitlement checkout'; end if;
  if tier='build' then
   select id,current_period_end into member_id,existing_end from public.memberships
    where user_id=t.user_id and membership_type::text='build' order by created_at desc limit 1 for update;
  else
   select current_period_end into existing_end from public.sgc_website_subscriptions where user_id=t.user_id for update;
  end if;
  period_start:=greatest(t.paid_at,coalesce(existing_end,t.paid_at));
  period_end:=period_start+interval '1 month';
  if tier='build' then
   if member_id is null then
    insert into public.memberships(user_id,membership_type,status,price_zar,started_at,current_period_end)
    values(t.user_id,'build','active',t.amount_zar,t.paid_at,period_end);
   else
    update public.memberships set status='active',price_zar=t.amount_zar,
     started_at=least(coalesce(started_at,t.paid_at),t.paid_at),current_period_end=period_end,updated_at=now() where id=member_id;
   end if;
   result:=jsonb_build_object('membershipActivated',true,'entitlement','build','name','Academy Full Access','currentPeriodEnd',period_end);
  else
   insert into public.sgc_website_subscriptions(user_id,status,current_period_end,provider_reference)
   values(t.user_id,'active',period_end,t.merchant_reference)
   on conflict(user_id) do update set status='active',current_period_end=excluded.current_period_end,
    provider_reference=excluded.provider_reference,updated_at=now();
   result:=jsonb_build_object('membershipActivated',false,'websiteBuilderActivated',true,'entitlement','website_builder','currentPeriodEnd',period_end);
  end if;
 elsif tier='start' or t.merchant_reference like 'M-%' then
  result:=sgc_private.activate_legacy_membership(t.id);
 else
  return jsonb_build_object('membershipActivated',false);
 end if;
 insert into sgc_private.payment_activations(transaction_id,user_id,entitlement,starts_at,ends_at,result)
 values(t.id,t.user_id,coalesce(tier,'named_membership'),period_start,period_end,result);
 return result;
end $$;
revoke all on function public.sgc_activate_paid_membership(uuid) from public,anon,authenticated;
grant execute on function public.sgc_activate_paid_membership(uuid) to service_role;

-- Paid status and access activation commit together; retries cannot add extra months.
create or replace function sgc_private.activate_verified_checkout()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='paid' and new.paid_at is not null and new.user_id is not null then
  perform public.sgc_activate_paid_membership(new.id);
 end if;
 return new;
end $$;
revoke all on function sgc_private.activate_verified_checkout() from public,anon,authenticated;
grant execute on function sgc_private.activate_verified_checkout() to service_role;
drop trigger if exists sgc_activate_verified_checkout on public.sgc_stitch_transactions;
create trigger sgc_activate_verified_checkout after insert or update of status,paid_at on public.sgc_stitch_transactions
for each row execute function sgc_private.activate_verified_checkout();

create or replace function public.sgc_builder_access()
returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and (
 exists(select 1 from public.sgc_demo_entitlements where user_id=auth.uid())
 or (public.sgc_start_purchased() and exists(select 1 from public.sgc_website_subscriptions
 where user_id=auth.uid() and status='active' and current_period_end>now()))
 );
$$;
revoke all on function public.sgc_builder_access() from public,anon;
grant execute on function public.sgc_builder_access() to authenticated,service_role;
alter policy "Insert subscribed website" on public.sgc_student_websites
with check(user_id=auth.uid() and public.sgc_builder_access());
alter policy "Update subscribed website" on public.sgc_student_websites
using(user_id=auth.uid() and public.sgc_builder_access())
with check(user_id=auth.uid() and public.sgc_builder_access());

-- Stable catalogue identities: keep the existing Academy product and add builder once.
update public.sgc_products set name='Academy Full Access',price_zar=450,billing='monthly',
 description='Premium Academy courses and learning materials. Requires SGC Membership. Access activates after verified payment for one month.'
where access_level='build' and slug=(select slug from public.sgc_products where access_level='build' and active and deleted_at is null order by created_at limit 1);
insert into public.sgc_products(name,slug,description,price_zar,billing,access_level,active)
values('Website Builder','sgc-website-builder','Website Builder access for one month after verified payment. Requires the R150 once-off membership; Academy Full Access is optional. Public website publishing is still being completed.',199,'monthly','website_builder',true)
on conflict(slug) do update set name=excluded.name,price_zar=199,billing='monthly',access_level='website_builder';
insert into public.sgc_product_settings(product_id,category,product_type)
select id,'addons','digital' from public.sgc_products where slug='sgc-website-builder'
on conflict(product_id) do nothing;
notify pgrst,'reload schema';

create or replace function public.sgc_checkout_membership_allowed(p_user uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.sgc_demo_entitlements where user_id=p_user)
 or exists(select 1 from public.sgc_stitch_transactions t
 left join public.sgc_products p on p.id::text=t.product_id
 where t.user_id=p_user and t.status='paid' and t.paid_at is not null
 and t.billing='once' and t.amount_zar>=150
 and (t.entitlement_key='start' or t.product_id in ('start','sgc-start-foundations') or p.access_level='start'));
$$;
revoke all on function public.sgc_checkout_membership_allowed(uuid) from public,anon,authenticated;
grant execute on function public.sgc_checkout_membership_allowed(uuid) to service_role;
CREATE OR REPLACE FUNCTION public.sgc_start_purchased()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select auth.uid() is not null and (public.sgc_extra_is_admin() or public.sgc_extra_is_demo() or exists(
select 1 from public.sgc_stitch_transactions t left join public.sgc_products p on p.id::text=t.product_id
where t.user_id=auth.uid() and t.status='paid' and t.paid_at is not null
and t.billing='once' and t.amount_zar>=150
and (t.entitlement_key='start' or t.product_id in ('start','sgc-start-foundations') or p.access_level='start')));
$function$;
