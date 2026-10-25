create table if not exists public.sgc_business_contacts (
 company text not null, client_name text not null, email text not null, phone text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(company,email));
alter table public.sgc_business_contacts enable row level security;
revoke all on public.sgc_business_contacts from public,anon,authenticated;
grant select,insert,update on public.sgc_business_contacts to service_role;
create or replace function public.cfhp_capture_contact() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.customer_email is not null then
 insert into public.sgc_business_contacts(company,client_name,email,phone)
 values('CFHP',new.customer_name,lower(trim(new.customer_email)),new.phone)
 on conflict(company,email) do update set client_name=excluded.client_name,phone=excluded.phone,updated_at=now();
 end if;
 return new;
end $$;
revoke all on function public.cfhp_capture_contact() from public,anon,authenticated;
drop trigger if exists cfhp_contact_capture on public.cfhp_bookings;
create trigger cfhp_contact_capture after insert or update of customer_name,customer_email,phone on public.cfhp_bookings for each row execute function public.cfhp_capture_contact();
insert into public.sgc_business_contacts(company,client_name,email,phone)
select distinct on (lower(trim(customer_email))) 'CFHP',customer_name,lower(trim(customer_email)),phone
from public.cfhp_bookings where customer_email is not null order by lower(trim(customer_email)),created_at desc
on conflict(company,email) do update set client_name=excluded.client_name,phone=excluded.phone,updated_at=now();
