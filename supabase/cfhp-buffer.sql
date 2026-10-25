alter table public.cfhp_bookings alter column user_id drop not null;
alter table public.cfhp_bookings add column if not exists customer_email text;
alter table public.cfhp_bookings add column if not exists guest_token_hash text;
create or replace function public.cfhp_reserve(p_data jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare existing public.cfhp_bookings; result public.cfhp_bookings;
begin
 perform pg_advisory_xact_lock(hashtext('cfhp_calendar_reservation'));
 select * into existing from public.cfhp_bookings where id=(p_data->>'id')::uuid;
 if found then
  if existing.guest_token_hash is distinct from p_data->>'guest_token_hash' or existing.customer_email is distinct from p_data->>'customer_email' then raise exception 'Booking reference unavailable'; end if;
  return to_jsonb(existing);
 end if;
 if length(coalesce(p_data->>'guest_token_hash',''))<>64 or length(coalesce(p_data->>'customer_email',''))<3 then raise exception 'Enter valid booking details'; end if;
 if exists(select 1 from public.cfhp_bookings where status in ('pending_calendar','confirmed') and starts_at<(p_data->>'ends_at')::timestamptz + interval '10 minutes' and ends_at + interval '10 minutes'>(p_data->>'starts_at')::timestamptz) then raise exception 'That appointment is no longer available'; end if;
 if (select count(*) from public.cfhp_bookings where (customer_email=p_data->>'customer_email' or phone=p_data->>'phone') and created_at>now()-interval '1 hour')>=4 then raise exception 'Too many bookings. Please contact the business'; end if;
 insert into public.cfhp_bookings(id,user_id,customer_email,guest_token_hash,service_name,duration_minutes,amount_zar,customer_name,phone,starts_at,ends_at)
 values((p_data->>'id')::uuid,null,p_data->>'customer_email',p_data->>'guest_token_hash',p_data->>'service_name',(p_data->>'duration_minutes')::int,(p_data->>'amount_zar')::numeric,p_data->>'customer_name',p_data->>'phone',(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz) returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function public.cfhp_reserve(jsonb) from public,anon,authenticated;
grant execute on function public.cfhp_reserve(jsonb) to service_role;
