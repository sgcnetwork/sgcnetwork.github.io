
create extension if not exists pg_net;
create extension if not exists pg_cron;
create schema if not exists djp_internal;
revoke all on schema djp_internal from public,anon,authenticated;
alter table public.djp_enquiries add column if not exists enquiry_type text not null default '' check (length(enquiry_type)<=150);
create table public.djp_email_outbox(
 enquiry_id uuid primary key references public.djp_enquiries(id) on delete cascade,
 dispatch_token text not null default (gen_random_uuid()::text || gen_random_uuid()::text),
 status text not null default 'pending' check(status in('pending','sending','sent','failed')),
 attempts integer not null default 0,
 created_at timestamptz not null default now(),
 next_attempt_at timestamptz not null default now(),
 locked_until timestamptz,
 attempt_token uuid,
 sent_at timestamptz,
 provider_id text,
 last_error text
);
alter table public.djp_email_outbox enable row level security;
revoke all on public.djp_email_outbox from public,anon,authenticated;
grant select,update,insert,delete on public.djp_email_outbox to service_role;
create policy djp_mail_service_only on public.djp_email_outbox for all to service_role using(true) with check(true);
create index djp_mail_pending on public.djp_email_outbox(next_attempt_at) where sent_at is null and attempts<12;
create function djp_internal.label_enquiry() returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if nullif(btrim(new.enquiry_type),'') is null then
  new.enquiry_type:=left(coalesce(nullif(substring(new.message from '^I would like assistance with ([^\n]+)\.'),''),new.service),150);
 end if;
 return new;
end;
$fn$;
revoke all on function djp_internal.label_enquiry() from public,anon,authenticated;
create trigger djp_label_enquiry before insert on public.djp_enquiries for each row execute function djp_internal.label_enquiry();
create function djp_internal.dispatch_pending() returns integer language plpgsql security definer set search_path='' as $fn$
declare r record; n integer:=0;
begin
 for r in select enquiry_id,dispatch_token from public.djp_email_outbox
  where sent_at is null and attempts<12 and next_attempt_at<=now()
  and (status='pending' or (status='sending' and locked_until<now()))
  order by created_at limit 10
 loop
  perform net.http_post(
   url:='https://bxpexanyoyubxeqqlggh.supabase.co/functions/v1/djp-enquiry-email',
   body:=jsonb_build_object('id',r.enquiry_id,'token',r.dispatch_token),
   headers:='{"Content-Type":"application/json"}'::jsonb,
   timeout_milliseconds:=20000);
  n:=n+1;
 end loop;
 return n;
end;
$fn$;
revoke all on function djp_internal.dispatch_pending() from public,anon,authenticated;
create function djp_internal.queue_enquiry_email() returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 insert into public.djp_email_outbox(enquiry_id) values(new.id) on conflict do nothing;
 -- The durable outbox survives any asynchronous HTTP failure; cron retries it.
 begin
  perform djp_internal.dispatch_pending();
 exception when others then null;
 end;
 return new;
end;
$fn$;
revoke all on function djp_internal.queue_enquiry_email() from public,anon,authenticated;
create trigger djp_email_after_insert after insert on public.djp_enquiries for each row execute function djp_internal.queue_enquiry_email();
create function public.djp_claim_email(p_id uuid,p_token text) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare j public.djp_email_outbox; e public.djp_enquiries;
begin
 update public.djp_email_outbox set status='sending',attempts=attempts+1,
   locked_until=now()+interval '2 minutes',attempt_token=gen_random_uuid()
 where enquiry_id=p_id and dispatch_token=p_token and sent_at is null
   and attempts<12 and next_attempt_at<=now()
   and (status='pending' or (status='sending' and locked_until<now()))
 returning * into j;
 if not found then return null; end if;
 select * into e from public.djp_enquiries where id=p_id;
 return jsonb_build_object('enquiry',to_jsonb(e),'attempt_token',j.attempt_token,'attempts',j.attempts);
end;
$fn$;
revoke all on function public.djp_claim_email(uuid,text) from public,anon,authenticated;
grant execute on function public.djp_claim_email(uuid,text) to service_role;
select cron.schedule('djp-enquiry-email-retry','* * * * *','select djp_internal.dispatch_pending();');
-- Forward existing inbox entries once as well as all future enquiries.
update public.djp_enquiries set enquiry_type=left(coalesce(nullif(substring(message from '^I would like assistance with ([^\n]+)\.'),''),service),150) where enquiry_type='';
insert into public.djp_email_outbox(enquiry_id) select id from public.djp_enquiries on conflict do nothing;
