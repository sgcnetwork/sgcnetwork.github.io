create table public.cfhp_bookings (
 id uuid primary key, user_id uuid not null references auth.users(id),
 service_name text not null, duration_minutes int not null check(duration_minutes between 15 and 120), amount_zar numeric not null,
 customer_name text not null check(length(customer_name) between 2 and 100), phone text not null check(length(phone) between 7 and 25),
 starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'pending_calendar' check(status in ('pending_calendar','confirmed','failed','cancelled')),
 event_id text, created_at timestamptz not null default now(), check(ends_at>starts_at)
);
alter table public.cfhp_bookings enable row level security;
revoke all on public.cfhp_bookings from anon, authenticated;
grant select,insert,update on public.cfhp_bookings to service_role;
create index cfhp_bookings_user on public.cfhp_bookings(user_id,created_at);
create or replace function public.cfhp_reserve(p_data jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare existing public.cfhp_bookings; result public.cfhp_bookings;
begin
 perform pg_advisory_xact_lock(hashtext('cfhp_calendar_reservation'));
 select * into existing from public.cfhp_bookings where id=(p_data->>'id')::uuid;
 if found then
  if existing.user_id<>(p_data->>'user_id')::uuid then raise exception 'Booking reference unavailable'; end if;
  return to_jsonb(existing);
 end if;
 if exists(select 1 from public.cfhp_bookings where status in ('pending_calendar','confirmed') and starts_at<(p_data->>'ends_at')::timestamptz and ends_at>(p_data->>'starts_at')::timestamptz) then raise exception 'That appointment is no longer available'; end if;
 if (select count(*) from public.cfhp_bookings where user_id=(p_data->>'user_id')::uuid and created_at>now()-interval '1 hour')>=4 then raise exception 'Too many bookings. Please contact the business'; end if;
 insert into public.cfhp_bookings(id,user_id,service_name,duration_minutes,amount_zar,customer_name,phone,starts_at,ends_at)
 values((p_data->>'id')::uuid,(p_data->>'user_id')::uuid,p_data->>'service_name',(p_data->>'duration_minutes')::int,(p_data->>'amount_zar')::numeric,p_data->>'customer_name',p_data->>'phone',(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz) returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function public.cfhp_reserve(jsonb) from public,anon,authenticated;
grant execute on function public.cfhp_reserve(jsonb) to service_role;
