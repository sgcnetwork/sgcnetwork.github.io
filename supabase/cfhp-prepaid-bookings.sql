alter table public.cfhp_bookings
 add column if not exists payment_method text not null default 'eft',
 add column if not exists payment_status text not null default 'unpaid',
 add column if not exists hold_expires_at timestamptz not null default (now()+interval '30 minutes'),
 add column if not exists payment_verified_at timestamptz,
 add column if not exists payment_verified_by uuid references auth.users(id),
 add column if not exists payment_note text,
 add column if not exists accepted_at timestamptz,
 add column if not exists accepted_by uuid references auth.users(id),
 add column if not exists checkout_started_at timestamptz,
 add column if not exists stitch_checkout_url text,
 add column if not exists last_error text;
update public.cfhp_bookings set payment_status='paid',payment_verified_at=created_at,accepted_at=created_at where status='confirmed';
alter table public.cfhp_bookings drop constraint if exists cfhp_bookings_status_check;
alter table public.cfhp_bookings add constraint cfhp_bookings_status_check check(status in ('awaiting_payment','awaiting_acceptance','pending_calendar','confirmed','payment_review','expired','failed','cancelled'));
alter table public.cfhp_bookings alter column status set default 'awaiting_payment';
update public.cfhp_bookings set status='awaiting_payment' where status='pending_calendar' and payment_status='unpaid';
alter table public.cfhp_bookings add constraint cfhp_payment_method_check check(payment_method in ('eft','stitch'));
alter table public.cfhp_bookings add constraint cfhp_payment_status_check check(payment_status in ('unpaid','paid'));
alter table public.cfhp_bookings add constraint cfhp_paid_before_acceptance check(status not in ('awaiting_acceptance','pending_calendar','confirmed') or payment_status='paid');
create table public.cfhp_payment_audit (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.cfhp_bookings(id),
 actor uuid references auth.users(id),action text not null,amount_zar numeric not null,note text not null,created_at timestamptz not null default now());
alter table public.cfhp_payment_audit enable row level security;
revoke all on public.cfhp_payment_audit from public,anon,authenticated;
grant select,insert on public.cfhp_payment_audit to service_role;
create or replace function public.cfhp_reserve(p_data jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare existing public.cfhp_bookings; result public.cfhp_bookings;
begin
 perform pg_advisory_xact_lock(hashtext('cfhp_calendar_reservation'));
 select * into existing from public.cfhp_bookings where id=(p_data->>'id')::uuid;
 if found then
  if existing.guest_token_hash is distinct from p_data->>'guest_token_hash' or existing.customer_email is distinct from p_data->>'customer_email' then raise exception 'Booking reference unavailable'; end if;
  return to_jsonb(existing);
 end if;
 if length(coalesce(p_data->>'guest_token_hash',''))<>64 or length(coalesce(p_data->>'customer_email',''))<3 or p_data->>'payment_method' not in ('eft','stitch') then raise exception 'Enter valid booking details'; end if;
 if exists(select 1 from public.cfhp_bookings where
  (status in ('pending_calendar','confirmed','awaiting_acceptance') or (status='awaiting_payment' and hold_expires_at>now()))
  and starts_at<(p_data->>'ends_at')::timestamptz+interval '10 minutes'
  and ends_at+interval '10 minutes'>(p_data->>'starts_at')::timestamptz) then raise exception 'That appointment is no longer available'; end if;
 if (select count(*) from public.cfhp_bookings where (customer_email=p_data->>'customer_email' or phone=p_data->>'phone') and created_at>now()-interval '1 hour')>=4 then raise exception 'Too many bookings. Please contact the business'; end if;
 insert into public.cfhp_bookings(id,customer_email,guest_token_hash,service_name,duration_minutes,amount_zar,customer_name,phone,starts_at,ends_at,payment_method,status)
 values((p_data->>'id')::uuid,p_data->>'customer_email',p_data->>'guest_token_hash',p_data->>'service_name',(p_data->>'duration_minutes')::int,(p_data->>'amount_zar')::numeric,p_data->>'customer_name',p_data->>'phone',(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,p_data->>'payment_method','awaiting_payment') returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function public.cfhp_reserve(jsonb) from public,anon,authenticated;
grant execute on function public.cfhp_reserve(jsonb) to service_role;

create or replace function public.cfhp_record_payment(p_id uuid,p_actor uuid,p_method text,p_amount numeric,p_note text,p_accept boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.cfhp_bookings; conflicting boolean; was_paid boolean;
begin
 perform pg_advisory_xact_lock(hashtext('cfhp_calendar_reservation'));
 select * into b from public.cfhp_bookings where id=p_id for update;
 if not found then raise exception 'Booking not found'; end if;
 if p_amount is distinct from b.amount_zar or p_method is distinct from b.payment_method then raise exception 'Payment details do not match this booking'; end if;
 if length(trim(coalesce(p_note,'')))<4 then raise exception 'Enter the bank or payment reference'; end if;
 if p_accept and p_actor is null then raise exception 'Admin approval required'; end if;
 if p_method='eft' and p_actor is null then raise exception 'Admin must verify bank payment'; end if;
 if p_method='stitch' and p_actor is not null and b.payment_status<>'paid' then raise exception 'Stitch payment has not been verified'; end if;
 if b.status='confirmed' then return to_jsonb(b); end if;
 if b.status in ('cancelled','failed') then raise exception 'This booking cannot be accepted'; end if;
 was_paid:=b.payment_status='paid';
 if was_paid and not p_accept then return to_jsonb(b); end if;
 select exists(select 1 from public.cfhp_bookings x where x.id<>p_id and
  (x.status in ('pending_calendar','confirmed','awaiting_acceptance') or (x.status='awaiting_payment' and x.hold_expires_at>now()))
  and x.starts_at<b.ends_at+interval '10 minutes' and x.ends_at+interval '10 minutes'>b.starts_at) into conflicting;
 update public.cfhp_bookings set payment_status='paid',payment_verified_at=coalesce(payment_verified_at,now()),
 payment_verified_by=coalesce(payment_verified_by,p_actor),payment_note=case when was_paid then payment_note else p_note end,
 status=case when conflicting or starts_at<=now() then 'payment_review' when p_accept then 'pending_calendar' else 'awaiting_acceptance' end,
 accepted_at=case when p_accept and not conflicting and starts_at>now() then coalesce(accepted_at,now()) else accepted_at end,
 accepted_by=case when p_accept and not conflicting and starts_at>now() then coalesce(accepted_by,p_actor) else accepted_by end,
 last_error=case when conflicting then 'Payment received, but the appointment conflicts with another booking. Arrange a new time or refund.' when starts_at<=now() then 'Payment received after the appointment time. Arrange a new time or refund.' else null end
 where id=p_id returning * into b;
 if not was_paid or p_accept then
 insert into public.cfhp_payment_audit(booking_id,actor,action,amount_zar,note) values(p_id,p_actor,case when p_accept then 'payment_verified_and_acceptance_requested' else 'stitch_payment_verified' end,p_amount,p_note);
 end if;
 return to_jsonb(b);
end $$;
revoke all on function public.cfhp_record_payment(uuid,uuid,text,numeric,text,boolean) from public,anon,authenticated;
grant execute on function public.cfhp_record_payment(uuid,uuid,text,numeric,text,boolean) to service_role;

create or replace function public.cfhp_stitch_payment_recorded() returns trigger language plpgsql security invoker set search_path='' as $$
declare bid uuid; b public.cfhp_bookings;
begin
 if new.status='paid' and new.merchant_reference like 'C-%' and new.product_id like 'cfhp-booking:%' then
 bid:=substring(new.product_id from 14)::uuid;
 select * into b from public.cfhp_bookings where id=bid;
 if not found or new.merchant_reference<>'C-'||bid::text or b.payment_method<>'stitch' or b.amount_zar<>new.amount_zar or new.stitch_payment_id is null then raise exception 'CFHP payment does not match booking'; end if;
 perform public.cfhp_record_payment(bid,null,'stitch',new.amount_zar,'Stitch '||new.merchant_reference,false);
 end if;
 return new;
end $$;
revoke all on function public.cfhp_stitch_payment_recorded() from public,anon,authenticated;
create trigger cfhp_stitch_payment_received after update of status on public.sgc_stitch_transactions for each row execute function public.cfhp_stitch_payment_recorded();
