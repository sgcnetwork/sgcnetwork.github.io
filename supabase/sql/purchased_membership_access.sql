
create or replace function public.sgc_activate_paid_membership(p_transaction_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
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
$$;
revoke all on function public.sgc_activate_paid_membership(uuid) from public,anon,authenticated;
grant execute on function public.sgc_activate_paid_membership(uuid) to service_role;

create or replace function public.sgc_my_purchased_memberships()
returns table(name text,billing text,started_at timestamptz,ends_at timestamptz,features jsonb)
language sql stable security definer set search_path='' as $$
 select distinct on(t.product_id) p.name,t.billing,t.paid_at,
  case when t.billing='monthly' then t.paid_at+interval '1 month' else null end,p.features
 from public.sgc_stitch_transactions t join public.sgc_named_membership_plans p on p.id::text=t.product_id
 where auth.uid() is not null and t.user_id=auth.uid() and t.status='paid' and t.merchant_reference like 'M-%'
 and t.paid_at<=now() and (t.billing='once' or t.paid_at+interval '1 month'>now())
 order by t.product_id,t.paid_at desc
$$;
revoke all on function public.sgc_my_purchased_memberships() from public,anon;
grant execute on function public.sgc_my_purchased_memberships() to authenticated;


create or replace function public.sgc_extra_has_product(level text)
returns boolean language sql stable security definer set search_path='' as $$
 select case
  when level like 'feature:%' then public.sgc_feature_allowed(substr(level,9))
  when level='build' then public.sgc_extra_base_has_product(level) or public.sgc_feature_allowed('recorded_lessons')
  when level='start' then public.sgc_extra_base_has_product(level) or public.sgc_feature_allowed('business_classes')
  else public.sgc_extra_base_has_product(level)
 end;
$$;
do $$
declare olddef text; newdef text;
begin
 select pg_get_functiondef('public.sgc_extra_student_can_read(uuid)'::regprocedure) into olddef;
 newdef:=replace(olddef,
  'g.access_level=l.access_level',
  '(g.access_level=l.access_level OR (l.access_level=''build'' AND g.access_level=''feature:recorded_lessons'') OR (l.access_level=''start'' AND g.access_level=''feature:business_classes''))');
 if newdef=olddef then raise exception 'Expected lesson access condition missing';end if;
 execute newdef;
end;
$$;

revoke all on function public.sgc_extra_has_product(text) from public,anon;
revoke all on function public.sgc_extra_student_can_read(uuid) from public,anon;
grant execute on function public.sgc_extra_has_product(text) to authenticated,service_role;
grant execute on function public.sgc_extra_student_can_read(uuid) to authenticated,service_role;