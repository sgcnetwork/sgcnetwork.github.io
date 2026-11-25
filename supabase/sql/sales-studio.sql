create schema if not exists sales_private;
revoke all on schema sales_private from public;
grant usage on schema sales_private to authenticated;

create table public.sales_team (
 id uuid primary key references auth.users(id), name text not null,
 sender text unique check(sender ~ '^[A-Za-z0-9._%+-]+@sgcnetwork[.]co[.]za$'),
 role text not null default 'consultant' check(role in ('admin','consultant')), active boolean not null default true, check (role='admin' or sender is not null)
);
create function sales_private.sales_role() returns text language sql stable security definer set search_path='' as
$$ select role from public.sales_team where id=(select auth.uid()) and active $$;
revoke all on function sales_private.sales_role() from public;
grant execute on function sales_private.sales_role() to authenticated;

create table public.sales_products (
 id text primary key, name text not null, price text not null, pitch text not null,
 industries text not null, features text not null, preview text not null, image text not null
);
create table public.sales_leads (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 assignee uuid references public.sales_team(id), name text not null check(length(trim(name)) between 1 and 240),
 contact text, industry text, location text, email text, phone text, whatsapp text, website text, social text,
 source text not null check(length(trim(source)) > 0), lawful_basis text, notes text, follow_up date,
 product text references public.sales_products(id), discovery jsonb not null default '{}',
 stage text not null default 'New lead' check(stage in ('New lead','Contact attempted','Contacted','Interested','Discovery completed','Preview requested','Preview in development','Preview sent','Follow-up','Proposal sent','Customer accepted','Awaiting payment','Payment confirmed','Closed successfully','Not interested','Do not contact')),
 opted_out boolean not null default false
);
create unique index sales_business_unique on public.sales_leads (lower(regexp_replace(trim(name),'[^[:alnum:]]','','g')));
create unique index sales_email_unique on public.sales_leads (lower(trim(email))) where nullif(trim(email),'') is not null;
create unique index sales_website_unique on public.sales_leads (lower(regexp_replace(trim(website),'^(https?://)?(www[.])?|/.*$','','gi'))) where nullif(trim(website),'') is not null;
create table public.sales_preferences (
 id bigint generated always as identity primary key, lead uuid not null references public.sales_leads(id),
 channel text not null check(channel in ('email','whatsapp','telephone')),
 permission text not null check(permission in ('granted','withdrawn','declined')),
 evidence text not null check(length(trim(evidence)) > 0), method text not null check(length(trim(method)) > 0),
 recorded_at timestamptz not null default now(), actor uuid not null default auth.uid()
);
create table public.sales_activity (
 id bigint generated always as identity primary key, lead uuid not null references public.sales_leads(id),
 channel text not null check(channel in ('call','email','whatsapp','system')),
 status text not null, detail text not null, recorded_at timestamptz not null default now(), actor uuid not null default auth.uid()
);
create table public.sales_previews (
 id uuid primary key default gen_random_uuid(), lead uuid not null references public.sales_leads(id),
 author uuid not null default auth.uid(), product text not null references public.sales_products(id), brief jsonb not null,
 requested_at timestamptz not null default now(), due date not null default (current_date+5),
 stage text not null default 'Requested' check(stage in ('Requested','Awaiting review','Approved','In development','Ready for review','Ready to send','Sent to customer','Revision requested','Accepted','Declined')),
 url text check(url ~ '^https://([a-z0-9-]+[.])*sgcnetwork[.]co[.]za(/[^[:space:]]*)?$')
);
create table public.sales_commissions (
 id uuid primary key default gen_random_uuid(), consultant uuid not null references public.sales_team(id),
 lead uuid not null references public.sales_leads(id), verified_reference text not null unique,
 amount_cents integer not null, paid_at timestamptz not null,
 status text not null default 'Pending' check(status in ('Pending','Approved','Paid','Reversed'))
);
create table public.sales_audit (
 id bigint generated always as identity primary key, actor uuid, entity text not null, record_id text not null,
 operation text not null, occurred_at timestamptz not null default now()
);
create function sales_private.audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.sales_audit(actor,entity,record_id,operation) values (auth.uid(),tg_table_name,new.id::text,tg_op);
 return new;
end $$;
revoke all on function sales_private.audit() from public;
create function sales_private.guard_lead() returns trigger language plpgsql set search_path='' as $$
begin
 if old.assignee is distinct from new.assignee and coalesce(sales_private.sales_role(),'') <> 'admin' then
  raise exception 'Only administrators can assign leads';
 end if;
 if old.opted_out or new.stage='Do not contact' then
  new.opted_out=true;
  new.stage='Do not contact';
 end if;
 if new.stage is distinct from old.stage and new.stage='Preview sent' and not exists(select 1 from public.sales_previews where lead=new.id and stage in ('Sent to customer','Accepted') and url is not null) then
  raise exception 'Record confirmed preview delivery first';
 end if;
 if new.stage is distinct from old.stage and new.stage in ('Payment confirmed','Closed successfully') and not exists(select 1 from public.sales_payments where lead=new.id and status='Verified') then
  raise exception 'This stage requires a verified workflow event';
 end if;
 return new;
end $$;
create trigger sales_guard_lead before update on public.sales_leads for each row execute function sales_private.guard_lead();
do $$ declare t text;
begin
 foreach t in array array['team','products','leads','preferences','activity','previews','commissions','audit'] loop
  execute format('alter table public.sales_%I enable row level security',t);
  execute format('revoke all on public.sales_%I from anon,authenticated',t);
  execute format('grant select on public.sales_%I to authenticated',t);
  if t <> 'audit' then
   execute format('create trigger sales_audit_change after insert or update on public.sales_%I for each row execute function sales_private.audit()',t);
  end if;
 end loop;
end $$;

create policy sales_team_read on public.sales_team for select to authenticated using ((select sales_private.sales_role())='admin' or (active and id=(select auth.uid())));
create policy sales_team_manage on public.sales_team for update to authenticated using ((select sales_private.sales_role())='admin') with check ((select sales_private.sales_role())='admin');
grant update(name,sender,active) on public.sales_team to authenticated;

create policy sales_products_read on public.sales_products for select to authenticated using ((select sales_private.sales_role()) is not null);
create policy sales_products_edit on public.sales_products for update to authenticated using ((select sales_private.sales_role())='admin') with check ((select sales_private.sales_role())='admin');
grant update(name,price,pitch,industries,features,preview,image) on public.sales_products to authenticated;

create policy sales_leads_read on public.sales_leads for select to authenticated using ((select sales_private.sales_role())='admin' or ((select sales_private.sales_role())='consultant' and assignee=(select auth.uid())));
create policy sales_leads_admin_insert on public.sales_leads for insert to authenticated with check ((select sales_private.sales_role())='admin' and stage='New lead' and not opted_out);
create policy sales_leads_edit on public.sales_leads for update to authenticated
 using ((select sales_private.sales_role())='admin' or ((select sales_private.sales_role())='consultant' and assignee=(select auth.uid())))
 with check ((select sales_private.sales_role())='admin' or ((select sales_private.sales_role())='consultant' and assignee=(select auth.uid())));
grant insert(name,contact,industry,location,email,phone,whatsapp,website,social,source,assignee),
 update(assignee,contact,industry,location,email,phone,whatsapp,website,social,source,lawful_basis,notes,follow_up,product,discovery,stage) on public.sales_leads to authenticated;

do $$ declare t text;
begin
 foreach t in array array['preferences','activity','previews'] loop
  execute format('create policy sales_related_read on public.sales_%I for select to authenticated using (exists(select 1 from public.sales_leads l where l.id=lead))',t);
 end loop;
end $$;
create policy sales_preferences_insert on public.sales_preferences for insert to authenticated with check (actor=(select auth.uid()) and exists(select 1 from public.sales_leads l where l.id=lead and not l.opted_out));
create policy sales_activity_insert on public.sales_activity for insert to authenticated with check (actor=(select auth.uid()) and channel in ('call','email','whatsapp') and status in ('Prepared','Opened','Outcome recorded') and exists(select 1 from public.sales_leads l where l.id=lead and not l.opted_out));
create policy sales_preview_insert on public.sales_previews for insert to authenticated with check (author=(select auth.uid()) and stage='Requested' and exists(select 1 from public.sales_leads l where l.id=lead and not l.opted_out));
create policy sales_preview_admin_update on public.sales_previews for update to authenticated using ((select sales_private.sales_role())='admin') with check ((select sales_private.sales_role())='admin');
create policy sales_commission_read on public.sales_commissions for select to authenticated using ((select sales_private.sales_role())='admin' or ((select sales_private.sales_role())='consultant' and consultant=(select auth.uid())));
create policy sales_audit_read on public.sales_audit for select to authenticated using ((select sales_private.sales_role())='admin');
grant insert(lead,channel,permission,evidence,method) on public.sales_preferences to authenticated;
grant insert(lead,channel,status,detail) on public.sales_activity to authenticated;
grant insert(lead,product,brief), update(stage,url,due) on public.sales_previews to authenticated;
insert into public.sales_products values
('web','Professional websites','R350 / month','Give customers a place to discover your business and get in touch.','Local services, retailers','Mobile layout, enquiries, service pages','/apple-thu-studio/','/assets/businesspro-hero.webp'),
('store','E-commerce and online stores','R750 / month','Turn product enquiries into online orders.','Retail, food, fashion','Product catalogue, cart, checkout','/ready-made-businesses/fashion/','/ready-made-businesses/assets/fashion-editorial.webp'),
('booking','Online booking systems','R750 / month','Let customers choose a service and book a visit.','Salons, clinics, coaching','Service menu, availability, booking requests','/glow-and-glam-salon/','/assets/beauty-studio-reference.webp'),
('pay','Online payment integration','Custom quote','Make it easier for customers to pay online.','Retail, food, services','Hosted checkout, payment references','/rashids-fast-food-and-take-away/','/ready-made-businesses/assets/coffee-products.webp'),
('auto','Business automation','Custom quote','Reduce repetitive admin and handoffs.','Services, retailers','Notifications, task routing, workflow design','/portfolio/','/assets/businesspro-hero.webp'),
('finance','Financial and accounting systems','Custom quote','Track sales and reconcile business activity.','Retail, finance teams','Reconciliation, variance tracking, reporting','/portfolio/','/assets/businesspro-hero.webp'),
('dash','Business management dashboards','Custom quote','Run daily operations from one workspace.','Services, retail','Activity, roles, operational reports','/portfolio/','/ready-made-businesses/assets/electronics-products.webp'),
('student','Student and teacher management','Custom quote','Give teachers and students their own workspaces.','Schools, learning centres','Enrolments, class schedules, payment tracking','/anwaar/','/assets/academy-learning-pastel.png'),
('edu','Educational platforms','Custom quote','Deliver structured lessons and track progress.','Educators, training providers','Course content, progress, assessments','/education-coaching-studio.html','/assets/academy-learning-pastel.png'),
('builder','Website Builder','R199 / month','Build and manage a site with SGC templates.','Small businesses, creators','Templates, publishing, editing','/website-builder.html','/assets/beauty-studio-reference.webp'),
('academy','SGC Network Academy','R900 / month in existing sales catalogue','Learn how to plan and run your business.','New entrepreneurs','Lessons, exercises, business setup','/academy.html','/assets/academy-learning-pastel.png'),
('ready','Ready-made businesses','From R1,500 / month','Start with a store concept designed for your market.','New retailers','Store concepts, product layouts, branding','/ready-made-businesses/','/ready-made-businesses/assets/fashion-hero.webp'),
('kits','Business kits','See current shop pricing','Use templates and resources to launch faster.','Small businesses','Downloadable templates and resources','/shop.html','/assets/business-kits-cover.png'),
('custom','Custom business systems','Custom quote','Build a system around the way your business works.','Specialist services, operations teams','Discovery, custom workflows, dashboards','/portfolio/','/ready-made-businesses/assets/electronics-hero.webp');

-- Bootstrap with the same administrator authorization used by the existing SGC admin portal.
insert into public.sales_team(id,name,sender,role)
select p.id,'SGC Administrator',case when u.email ~ '^[A-Za-z0-9._%+-]+@sgcnetwork[.]co[.]za$' then u.email end,'admin'
from public.profiles p join auth.users u on u.id=p.id where p.role='admin' and u.email_confirmed_at is not null;

create table public.sales_terms (
 id uuid primary key references public.sales_leads(id), consultant uuid not null references public.sales_team(id),
 package text not null check(length(trim(package))>0), frequency text not null check(frequency in ('Monthly','Once-off')),
 amount_cents integer not null check(amount_cents>0), joining_cents integer not null check(joining_cents>=0),
 agreed_terms text not null check(length(trim(agreed_terms))>0),
 reference uuid not null default gen_random_uuid() unique,
 first_bps integer not null check(first_bps between 0 and 10000),
 repeat_bps integer not null check(repeat_bps between 0 and 10000),
 project_bps integer not null check(project_bps between 0 and 10000)
);
create table public.sales_rates (
 id integer primary key check(id=1), first_bps integer not null check(first_bps between 0 and 10000),
 repeat_bps integer not null check(repeat_bps between 0 and 10000),
 project_bps integer not null check(project_bps between 0 and 10000)
);
insert into public.sales_rates values (1,3000,1000,2000);
create table public.sales_payments (
 id uuid primary key default gen_random_uuid(), lead uuid not null references public.sales_terms(id),
 reference text not null unique check(length(trim(reference))>0), amount_cents integer not null check(amount_cents>0),
 verified_at timestamptz not null default now(),
 evidence text not null check(length(trim(evidence))>0),
 cycle integer not null check(cycle>0), status text not null default 'Verified' check(status in ('Verified','Refunded','Charged back'))
);
create unique index sales_verified_cycle on public.sales_payments(lead,cycle) where status='Verified';
alter table public.sales_terms enable row level security;
alter table public.sales_rates enable row level security;
alter table public.sales_payments enable row level security;
revoke all on public.sales_terms,public.sales_rates,public.sales_payments from anon,authenticated;
grant select on public.sales_terms,public.sales_payments,public.sales_rates to authenticated;
grant update(first_bps,repeat_bps,project_bps) on public.sales_rates to authenticated;
grant update(status) on public.sales_commissions to authenticated;
create policy sales_terms_read on public.sales_terms for select to authenticated using (exists(select 1 from public.sales_leads where id=sales_terms.id));
create policy sales_rates_admin on public.sales_rates for all to authenticated using ((select sales_private.sales_role())='admin') with check ((select sales_private.sales_role())='admin');
create policy sales_payments_read on public.sales_payments for select to authenticated using ((select sales_private.sales_role())='admin');
create policy sales_commission_payout on public.sales_commissions for update to authenticated using ((select sales_private.sales_role())='admin') with check ((select sales_private.sales_role())='admin');

create function sales_private.lock_commission() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status=new.status or (old.status='Pending' and new.status='Approved') or (old.status='Approved' and new.status='Paid') or (new.status='Reversed' and current_user in ('postgres','service_role')) then return new; end if;
 raise exception 'Approve pending commission before recording payout';
end $$;
create trigger sales_lock_commission before update on public.sales_commissions for each row execute function sales_private.lock_commission();

create function sales_private.capture_terms(lead_id uuid, package_name text, billing text, amount integer, joining integer, terms text)
returns public.sales_terms language plpgsql security definer set search_path='' as $$
declare l public.sales_leads; r public.sales_rates; saved public.sales_terms;
begin
 select * into l from public.sales_leads where id=lead_id for update;
 if sales_private.sales_role() is null or not (sales_private.sales_role()='admin' or l.assignee=auth.uid()) or l.assignee is null or l.opted_out or l.stage not in ('Customer accepted','Awaiting payment') then
  raise exception 'An assigned lead must be marked Customer accepted';
 end if;
 select * into strict r from public.sales_rates where id=1;
 insert into public.sales_terms(id,consultant,package,frequency,amount_cents,joining_cents,agreed_terms,first_bps,repeat_bps,project_bps)
 values (l.id,l.assignee,package_name,billing,amount,joining,terms,r.first_bps,r.repeat_bps,r.project_bps) returning * into saved;
 update public.sales_leads set stage='Awaiting payment' where id=l.id;
 return saved;
end $$;
create function public.sales_capture_terms(lead_id uuid, package_name text, billing text, amount integer, joining integer, terms text)
returns public.sales_terms language sql set search_path='' as
$$ select sales_private.capture_terms(lead_id,package_name,billing,amount,joining,terms) $$;
revoke all on function public.sales_capture_terms(uuid,text,text,integer,integer,text),sales_private.capture_terms(uuid,text,text,integer,integer,text) from public;
grant execute on function public.sales_capture_terms(uuid,text,text,integer,integer,text),sales_private.capture_terms(uuid,text,text,integer,integer,text) to authenticated;

create function sales_private.verify_payment(lead_id uuid, provider_reference text, amount integer, installment integer, evidence_text text)
returns void language plpgsql security definer set search_path='' as $$
declare t public.sales_terms; bps integer;
begin
 if sales_private.sales_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 select * into strict t from public.sales_terms where id=lead_id for update;
 if amount <> t.amount_cents or (t.frequency='Once-off' and installment<>1) or installment<1 then raise exception 'Payment does not match the agreed terms'; end if;
 insert into public.sales_payments(lead,reference,amount_cents,cycle,evidence) values(t.id,trim(provider_reference),amount,installment,evidence_text);
 bps=case when t.frequency='Once-off' then t.project_bps when installment=1 then t.first_bps when installment<=12 then t.repeat_bps else 0 end;
 if bps>0 then
  insert into public.sales_commissions(consultant,lead,verified_reference,amount_cents,paid_at) values(t.consultant,t.id,trim(provider_reference),round(amount::numeric*bps/10000),now());
 end if;
 update public.sales_leads set stage='Payment confirmed' where id=t.id and stage='Awaiting payment';
end $$;
create function public.sales_verify_payment(lead_id uuid, provider_reference text, amount integer, installment integer, evidence_text text)
returns void language sql set search_path='' as
$$ select sales_private.verify_payment(lead_id,provider_reference,amount,installment,evidence_text) $$;
revoke all on function public.sales_verify_payment(uuid,text,integer,integer,text),sales_private.verify_payment(uuid,text,integer,integer,text) from public;
grant execute on function public.sales_verify_payment(uuid,text,integer,integer,text),sales_private.verify_payment(uuid,text,integer,integer,text) to authenticated;

create function sales_private.reverse_payment(provider_reference text, reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if sales_private.sales_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 update public.sales_payments set status=reason where reference=provider_reference and status='Verified' and reason in ('Refunded','Charged back');
 if not found then raise exception 'No matching verified payment'; end if;
 update public.sales_commissions set status='Reversed' where verified_reference=provider_reference;
end $$;
create function public.sales_reverse_payment(provider_reference text, reason text)
returns void language sql set search_path='' as
$$ select sales_private.reverse_payment(provider_reference,reason) $$;
revoke all on function public.sales_reverse_payment(text,text),sales_private.reverse_payment(text,text) from public;
grant execute on function public.sales_reverse_payment(text,text),sales_private.reverse_payment(text,text) to authenticated;

-- The trigger can inspect verified payments while consultants can only read their commissions.
alter function sales_private.guard_lead() security definer;
revoke all on function sales_private.guard_lead() from public;
do $$ declare t text;
begin
 foreach t in array array['terms','rates','payments'] loop
  execute format('create trigger sales_audit_change after insert or update on public.sales_%I for each row execute function sales_private.audit()',t);
 end loop;
end $$;

create function sales_private.enrol_consultant(work_email text, display_name text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if sales_private.sales_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 select id into strict uid from auth.users where lower(email)=lower(trim(work_email)) and email_confirmed_at is not null and not is_anonymous;
 insert into public.sales_team(id,name,sender) values (uid,display_name,lower(trim(work_email)));
exception when no_data_found then raise exception 'Create and confirm the consultant’s work account in Supabase Auth first';
end $$;
create function public.sales_enrol_consultant(work_email text, display_name text)
returns void language sql set search_path='' as
$$ select sales_private.enrol_consultant(work_email,display_name) $$;
revoke all on function public.sales_enrol_consultant(text,text),sales_private.enrol_consultant(text,text) from public;
grant execute on function public.sales_enrol_consultant(text,text),sales_private.enrol_consultant(text,text) to authenticated;

create table public.sales_outreach_settings (
 id integer primary key check(id=1),
 review_reference text,
 enabled boolean not null default false,
 bcc text check(bcc ~ '^[A-Za-z0-9._%+-]+@sgcnetwork[.]co[.]za$'),
 check(not enabled or nullif(trim(review_reference),'') is not null and review_reference is not null)
);
insert into public.sales_outreach_settings(id) values(1);
alter table public.sales_outreach_settings enable row level security;
revoke all on public.sales_outreach_settings from anon,authenticated;
grant select(id,enabled,bcc) on public.sales_outreach_settings to authenticated;
create policy sales_outreach_settings_read on public.sales_outreach_settings for select to authenticated using ((select sales_private.sales_role()) is not null);

create function public.sales_outreach_allowed(lead_id uuid, contact_channel text)
returns boolean language sql stable set search_path='' as $$
 select coalesce(
  (select enabled from public.sales_outreach_settings where id=1)
  and exists(select 1 from public.sales_leads l where l.id=lead_id and not l.opted_out)
  and (select permission from public.sales_preferences where lead=lead_id and channel=contact_channel order by id desc limit 1)='granted',
 false)
$$;
revoke all on function public.sales_outreach_allowed(uuid,text) from public;
grant execute on function public.sales_outreach_allowed(uuid,text) to authenticated;
grant insert on public.sales_activity to service_role;

alter policy sales_activity_insert on public.sales_activity with check (
 actor=(select auth.uid()) and exists(select 1 from public.sales_leads l where l.id=lead and not l.opted_out)
 and (status='Prepared' and channel in ('email','whatsapp')
      or status='Opened' and channel='whatsapp' and public.sales_outreach_allowed(lead,channel)
      or status='Outcome recorded' and channel='call')
);

create unique index sales_phone_unique on public.sales_leads ((regexp_replace(phone,'[^0-9]','','g'))) where phone ~ '[0-9]';
create unique index sales_whatsapp_unique on public.sales_leads ((regexp_replace(whatsapp,'[^0-9]','','g'))) where whatsapp ~ '[0-9]';

create function sales_private.mark_preview_requested() returns trigger language plpgsql set search_path='' as $$
begin
 update public.sales_leads set stage='Preview requested' where id=new.lead and stage in ('Interested','Discovery completed');
 return new;
end $$;
create trigger sales_mark_preview_requested after insert on public.sales_previews for each row execute function sales_private.mark_preview_requested();
