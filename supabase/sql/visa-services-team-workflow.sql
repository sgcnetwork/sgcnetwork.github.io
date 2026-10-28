-- Visa Services: company-scoped teams, client references and signed PCC handovers.
create table public.visa_companies (
 id text primary key check(id ~ '^[A-Za-z][A-Za-z0-9_-]{1,24}$'),
 name text not null check(length(name) between 1 and 150),
 delivery_address text not null default '', delivery_contact text not null default '',
 delivery_phone text not null default '', active boolean not null default true,
 created_at timestamptz not null default now()
);
insert into public.visa_companies(id,name) values ('GVM','GVM'),('GVS','GVS'),('VL','VL'),('GovDocs','GovDocs');
create table public.visa_users (
 user_id uuid primary key references auth.users(id), display_name text not null check(length(display_name) between 2 and 120),
 email text not null unique, role text not null check(role in ('admin','manager','consultant','pta','finance','viewer')),
 active boolean not null default true, must_change_password boolean not null default false,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
insert into public.visa_users(user_id,display_name,email,role)
 select id,'Riefa',email,'admin' from auth.users where id='df627f92-e256-47eb-8a92-590ee9cf7d59';
create table public.visa_user_companies (
 user_id uuid not null references public.visa_users(user_id), company_id text not null references public.visa_companies(id),
 primary key(user_id,company_id)
);
create index visa_memberships_company_idx on public.visa_user_companies(company_id,user_id);
create sequence sgc_private.visa_client_reference_seq;
create table public.visa_cases (
 id uuid primary key default gen_random_uuid(), reference text not null unique,
 company_id text not null references public.visa_companies(id),
 client_name text not null check(length(client_name) between 2 and 200), email text not null default '',phone text not null default '',
 service text not null default 'PCC', required_documents text[] not null default array['ID','Fingerprints'],
 consultant_id uuid not null references public.visa_users(user_id), quote_id text references public.visa_service_records(id),
 stage text not null default 'awaiting_documents' check(stage in ('awaiting_documents','pta_verification','pta_printing','ready_for_submission','submitted','consultant_confirmation','waybill_booking','dispatched','delivered')),
 originals_received boolean not null default false, submitted_on date,
 saps_reference text, saps_identity text,
 saps_status text not null default 'not_checked' check(saps_status in ('not_checked','pending','finalised','not_found','unavailable','manual_verified')),
 saps_checked_at timestamptz,saps_finalised_on date,saps_message text,
 courier text check(courier in ('Parcel Perfect','The Courier Guy')),waybill text,delivery_amount numeric(12,2),delivered_on date,
 notes text not null default '', created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(saps_reference is null or saps_reference ~ '^[0-9]{6,20}$'),
 check(saps_identity is null or saps_identity ~ '^([0-9]{8}|[0-9]{13})$')
);
create index visa_cases_company_stage_idx on public.visa_cases(company_id,stage,created_at desc);
alter table public.visa_cases add constraint visa_cases_company_unique unique(id,company_id);
create index visa_cases_consultant_idx on public.visa_cases(consultant_id,stage);
create table public.visa_documents (
 id uuid primary key,case_id uuid not null references public.visa_cases(id),company_id text not null references public.visa_companies(id),
 file_name text not null,storage_key text not null unique,document_type text not null,
 content_type text not null,file_size integer not null check(file_size between 1 and 10485760),
 uploaded_by uuid not null references public.visa_users(user_id),uploaded_by_name text not null,created_at timestamptz not null default now()
);
create index visa_documents_case_idx on public.visa_documents(case_id,created_at desc);
create index visa_documents_company_idx on public.visa_documents(company_id,created_at desc);
create table public.visa_case_events (
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.visa_cases(id),
 action text not null,from_stage text,to_stage text,actor_id uuid references public.visa_users(user_id),
 actor_name text not null,actor_role text not null,signed_name text,
 details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index visa_case_events_case_idx on public.visa_case_events(case_id,created_at);
create table public.visa_notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.visa_users(user_id),
 case_id uuid not null references public.visa_cases(id),title text not null,body text not null,
 read_at timestamptz,created_at timestamptz not null default now()
);
create index visa_notifications_user_idx on public.visa_notifications(user_id,created_at desc);
create table sgc_private.visa_admin_audit (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,action text not null,target_id text not null,
 details jsonb not null,created_at timestamptz not null default now()
);
alter table sgc_private.visa_admin_audit enable row level security;
create table sgc_private.visa_saps_jobs (
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.visa_cases(id),token_hash text not null,
 created_at timestamptz not null default now(),claimed_at timestamptz
);
create index visa_saps_jobs_case_idx on sgc_private.visa_saps_jobs(case_id,created_at desc);
alter table sgc_private.visa_saps_jobs enable row level security;

create function sgc_private.visa_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.visa_users u where u.user_id=(select auth.uid()) and u.active and not u.must_change_password and u.role='admin');
$$;
create function sgc_private.visa_access(p_company text,p_roles text[] default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.visa_users u where u.user_id=(select auth.uid()) and u.active and not u.must_change_password and
 (u.role='admin' or ((p_roles is null or u.role=any(p_roles)) and exists(select 1 from public.visa_user_companies m join public.visa_companies co on co.id=m.company_id where m.user_id=u.user_id and co.id=p_company and co.active))));
$$;
create function sgc_private.visa_case_access(p_case uuid,p_roles text[] default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.visa_cases c where c.id=p_case and sgc_private.visa_access(c.company_id,p_roles));
$$;
create function sgc_private.visa_record_access(p_company text,p_kind text,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select sgc_private.visa_access(p_company,case when p_kind in ('invoice','expense') then array['manager','finance'] when p_write then array['manager','consultant'] else array['manager','consultant','pta','viewer'] end);
$$;
revoke all on function sgc_private.visa_is_admin(),sgc_private.visa_access(text,text[]),sgc_private.visa_case_access(uuid,text[]),sgc_private.visa_record_access(text,text,boolean) from public,anon;
grant usage on schema sgc_private to authenticated;
grant execute on function sgc_private.visa_is_admin(),sgc_private.visa_access(text,text[]),sgc_private.visa_case_access(uuid,text[]),sgc_private.visa_record_access(text,text,boolean) to authenticated;

alter table public.visa_companies enable row level security;
alter table public.visa_users enable row level security;
alter table public.visa_user_companies enable row level security;
alter table public.visa_cases enable row level security;
alter table public.visa_documents enable row level security;
alter table public.visa_case_events enable row level security;
alter table public.visa_notifications enable row level security;
revoke all on public.visa_companies,public.visa_users,public.visa_user_companies,public.visa_cases,public.visa_documents,public.visa_case_events,public.visa_notifications from public,anon,authenticated;
grant select on public.visa_companies,public.visa_users,public.visa_user_companies,public.visa_cases,public.visa_documents,public.visa_case_events,public.visa_notifications to authenticated;
create policy visa_companies_read on public.visa_companies for select to authenticated using(sgc_private.visa_access(id));
create policy visa_users_read on public.visa_users for select to authenticated using(user_id=(select auth.uid()) or sgc_private.visa_is_admin());
create policy visa_membership_read on public.visa_user_companies for select to authenticated using(user_id=(select auth.uid()) or sgc_private.visa_is_admin());
create policy visa_cases_read on public.visa_cases for select to authenticated using(sgc_private.visa_access(company_id,array['manager','consultant','pta','viewer']));
create policy visa_docs_read on public.visa_documents for select to authenticated using(sgc_private.visa_case_access(case_id,array['manager','consultant','pta','viewer']));
create policy visa_events_read on public.visa_case_events for select to authenticated using(sgc_private.visa_case_access(case_id,array['manager','consultant','pta','viewer']));
create policy visa_notifications_read on public.visa_notifications for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.visa_users u where u.user_id=(select auth.uid()) and u.active));
-- Replace owner-only policies; suspended users lose access immediately, including existing sessions.
drop policy visa_owner_select on public.visa_service_records;
drop policy visa_owner_insert on public.visa_service_records;
drop policy visa_owner_update on public.visa_service_records;
alter table public.visa_service_records drop constraint visa_service_records_brand_check;
alter table public.visa_service_records add constraint visa_records_company_fkey foreign key(brand) references public.visa_companies(id);
alter table public.visa_service_records add column case_id uuid references public.visa_cases(id);
alter table public.visa_service_records add constraint visa_record_case_company_fkey foreign key(case_id,brand) references public.visa_cases(id,company_id);
create index visa_records_case_idx on public.visa_service_records(case_id) where case_id is not null;
create policy visa_team_records_read on public.visa_service_records for select to authenticated using(sgc_private.visa_record_access(brand,kind,false));
create policy visa_team_records_insert on public.visa_service_records for insert to authenticated with check(sgc_private.visa_record_access(brand,kind,true) and case_id is null);
create policy visa_team_records_update on public.visa_service_records for update to authenticated using(sgc_private.visa_record_access(brand,kind,true)) with check(sgc_private.visa_record_access(brand,kind,true));
-- Immutable file objects: each replacement is a new version under the same client reference.
drop policy visa_documents_owner_read on storage.objects;
drop policy visa_documents_owner_insert on storage.objects;
drop policy visa_documents_owner_delete on storage.objects;
create policy visa_case_files_read on storage.objects for select to authenticated using(bucket_id='visa-service-documents' and exists(select 1 from public.visa_documents d where d.storage_key=name and sgc_private.visa_case_access(d.case_id,array['manager','consultant','pta','viewer'])));
create policy visa_case_files_upload on storage.objects for insert to authenticated with check(bucket_id='visa-service-documents' and exists(select 1 from public.visa_cases c where c.id::text=(storage.foldername(name))[2] and c.company_id=(storage.foldername(name))[1] and sgc_private.visa_access(c.company_id,array['manager','consultant','pta'])));
create policy visa_orphan_files_delete on storage.objects for delete to authenticated using(bucket_id='visa-service-documents' and owner_id=(select auth.uid())::text and not exists(select 1 from public.visa_documents d where d.storage_key=name));

create function sgc_private.visa_notify(p_case uuid,p_target text,p_title text) returns void language plpgsql security definer set search_path='' as $$
 declare c public.visa_cases; begin
 select * into c from public.visa_cases where id=p_case;
 insert into public.visa_notifications(user_id,case_id,title,body)
 select u.user_id,c.id,p_title,c.reference||' · '||co.name from public.visa_users u cross join public.visa_companies co
 where co.id=c.company_id and u.active and not u.must_change_password and (u.role='admin' or
 (p_target='consultant' and u.user_id=c.consultant_id and exists(select 1 from public.visa_user_companies m where m.user_id=u.user_id and m.company_id=c.company_id)) or
 (p_target='pta' and u.role='pta' and exists(select 1 from public.visa_user_companies m where m.user_id=u.user_id and m.company_id=c.company_id)));
 end $$;
revoke all on function sgc_private.visa_notify(uuid,text,text) from public,anon,authenticated;

create function public.visa_team(p_company text) returns table(user_id uuid,display_name text,role text) language sql stable security definer set search_path='' as $$
 select u.user_id,u.display_name,u.role from public.visa_users u where sgc_private.visa_access(p_company,array['manager','consultant','pta','viewer']) and u.active and u.role in ('consultant','manager','admin') and (u.role='admin' or exists(select 1 from public.visa_user_companies m where m.user_id=u.user_id and m.company_id=p_company)) order by u.display_name;
$$;
create function public.visa_create_case(p_data jsonb) returns public.visa_cases language plpgsql security definer set search_path='' as $$
 declare c public.visa_cases; actor public.visa_users; assignee uuid; co text; docs text[]; begin
 select * into actor from public.visa_users where user_id=auth.uid();co=p_data->>'company_id';
 if not sgc_private.visa_access(co,array['manager','consultant']) then raise exception 'You cannot create clients for this company';end if;
 assignee=coalesce(nullif(p_data->>'consultant_id','')::uuid,actor.user_id);
 if actor.role='consultant' and assignee<>actor.user_id then raise exception 'Consultants can only assign clients to themselves';end if;
 if not exists(select 1 from public.visa_users u where u.user_id=assignee and u.active and u.role in ('admin','manager','consultant') and (u.role='admin' or exists(select 1 from public.visa_user_companies m where m.user_id=u.user_id and m.company_id=co))) then raise exception 'Select an active consultant assigned to this company';end if;
 select array_agg(trim(value)) into docs from jsonb_array_elements_text(coalesce(p_data->'required_documents','["ID","Fingerprints"]'::jsonb)) where length(trim(value)) between 1 and 80;
 if cardinality(docs) is null or cardinality(docs)>15 then raise exception 'Choose between 1 and 15 required document types';end if;
 if nullif(p_data->>'quote_id','') is not null and not exists(select 1 from public.visa_service_records r where r.id=p_data->>'quote_id' and r.kind='quote' and r.brand=co) then raise exception 'Quotation does not belong to this company';end if;
 insert into public.visa_cases(reference,company_id,client_name,email,phone,service,required_documents,consultant_id,quote_id,notes,created_by)
 values(co||'-'||case when upper(coalesce(p_data->>'service','PCC'))='PCC' then 'PCC' else 'REF' end||'-'||lpad(nextval('sgc_private.visa_client_reference_seq')::text,6,'0'),co,trim(p_data->>'client_name'),left(coalesce(p_data->>'email',''),200),left(coalesce(p_data->>'phone',''),50),left(coalesce(nullif(p_data->>'service',''),'PCC'),200),docs,assignee,nullif(p_data->>'quote_id',''),left(coalesce(p_data->>'notes',''),10000),actor.user_id) returning * into c;
 insert into public.visa_case_events(case_id,action,to_stage,actor_id,actor_name,actor_role,details) values(c.id,'case_created',c.stage,actor.user_id,actor.display_name,actor.role,jsonb_build_object('required_documents',docs,'consultant_id',assignee));
 return c; end $$;
create function public.visa_add_document(p_data jsonb) returns public.visa_documents language plpgsql security definer set search_path='' as $$
 declare c public.visa_cases; actor public.visa_users; d public.visa_documents; object_key text;doc_id uuid; begin
 select * into c from public.visa_cases where id=(p_data->>'case_id')::uuid;
 if not found or not sgc_private.visa_access(c.company_id,array['manager','consultant','pta']) then raise exception 'This client file is not available for upload';end if;
 select * into actor from public.visa_users where user_id=auth.uid();object_key=p_data->>'storage_key';doc_id=(p_data->>'id')::uuid;
 if object_key not like c.company_id||'/'||c.id::text||'/'||doc_id::text||'/%' or not exists(select 1 from storage.objects o where o.bucket_id='visa-service-documents' and o.name=object_key) then raise exception 'Upload the file to this client reference first';end if;
 if length(trim(p_data->>'document_type')) not between 1 and 80 then raise exception 'A document type is required';end if;
 insert into public.visa_documents(id,case_id,company_id,file_name,storage_key,document_type,content_type,file_size,uploaded_by,uploaded_by_name)
 values(doc_id,c.id,c.company_id,left(p_data->>'file_name',240),object_key,trim(p_data->>'document_type'),p_data->>'content_type',(p_data->>'file_size')::integer,actor.user_id,actor.display_name) returning * into d;
 insert into public.visa_case_events(case_id,action,from_stage,to_stage,actor_id,actor_name,actor_role,details) values(c.id,'document_uploaded',c.stage,c.stage,actor.user_id,actor.display_name,actor.role,jsonb_build_object('document_id',d.id,'document_type',d.document_type,'file_name',d.file_name));
 update public.visa_cases set updated_at=now() where id=c.id;
 return d;end $$;
create function public.visa_save_saps_numbers(p_case uuid,p_reference text,p_identity text) returns void language plpgsql security definer set search_path='' as $$
 declare c public.visa_cases; begin
 select * into c from public.visa_cases where id=p_case for update;
 if not found or not sgc_private.visa_access(c.company_id,array['manager','consultant','pta']) then raise exception 'Case is not available';end if;
 if c.stage in ('waybill_booking','dispatched','delivered') then raise exception 'This case is already confirmed for dispatch';end if;
 if p_reference !~ '^[0-9]{6,20}$' or p_identity !~ '^([0-9]{8}|[0-9]{13})$' then raise exception 'Enter a numeric SAPS enquiry number and an 8-digit DOB or 13-digit ID';end if;
 update public.visa_cases set saps_reference=p_reference,saps_identity=p_identity,saps_status='not_checked',saps_checked_at=null,saps_message=null,saps_finalised_on=null,updated_at=now() where id=p_case;
 insert into public.visa_case_events(case_id,action,actor_id,actor_name,actor_role,details) select p_case,'saps_numbers_updated',u.user_id,u.display_name,u.role,'{"sensitive_numbers":"stored in the restricted client record"}'::jsonb from public.visa_users u where u.user_id=auth.uid();
 end $$;

create function public.visa_sign_step(p_case uuid,p_action text,p_signature text,p_data jsonb default '{}'::jsonb) returns public.visa_cases language plpgsql security definer set search_path='' as $$
 declare c public.visa_cases; actor public.visa_users; previous text; next_stage text; doc_ids jsonb; dest public.visa_companies; charge numeric; details jsonb; begin
 select * into c from public.visa_cases where id=p_case for update;
 if not found or not sgc_private.visa_access(c.company_id,array['manager','consultant','pta']) then raise exception 'You do not have access to sign this case';end if;
 select * into actor from public.visa_users where user_id=auth.uid();
 if lower(trim(p_signature))<>lower(trim(actor.display_name)) or coalesce((p_data->>'acknowledged')::boolean,false) is not true then raise exception 'Type your own full name and confirm the sign-off declaration';end if;
 if octet_length(p_data::text)>20000 then raise exception 'Sign-off details are too long';end if;
 previous=c.stage;next_stage=c.stage;details=p_data-'saps_identity'-'saps_reference';
 select coalesce(jsonb_agg(id),'[]'::jsonb) into doc_ids from public.visa_documents where case_id=c.id;
 if p_action='consultant_verify' then
  if c.stage<>'awaiting_documents' or actor.role not in ('admin','manager','consultant') or (actor.role='consultant' and c.consultant_id<>actor.user_id) then raise exception 'The assigned consultant must verify this document pack';end if;
  if exists(select 1 from unnest(c.required_documents) req where not exists(select 1 from public.visa_documents d where d.case_id=c.id and lower(d.document_type)=lower(req))) then raise exception 'Upload every required document before signing';end if;
  next_stage='pta_verification';perform sgc_private.visa_notify(c.id,'pta','Verify documents at Pretoria');
 elsif p_action='pta_verify' then
  if c.stage<>'pta_verification' or actor.role not in ('admin','pta') then raise exception 'Pretoria verification is required at this step';end if;
  next_stage='pta_printing';update public.visa_cases set originals_received=coalesce((p_data->>'originals_received')::boolean,false) where id=c.id;
 elsif p_action='pta_print' then
  if c.stage<>'pta_printing' or actor.role not in ('admin','pta') or coalesce((p_data->>'printed')::boolean,false) is not true then raise exception 'Pretoria must confirm that the review paperwork was printed';end if;
  next_stage='ready_for_submission';
 elsif p_action='submit' then
  if c.stage<>'ready_for_submission' or actor.role not in ('admin','pta') then raise exception 'Pretoria must sign the actual submission';end if;
  if upper(c.service)='PCC' and not c.originals_received and coalesce((p_data->>'originals_received')::boolean,false) is not true then raise exception 'Confirm physical receipt of the original fingerprints before submitting a PCC';end if;
  if nullif(p_data->>'submitted_on','') is null or (p_data->>'submitted_on')::date>current_date then raise exception 'Enter the actual submission date, not a future date';end if;
  next_stage='submitted';update public.visa_cases set submitted_on=(p_data->>'submitted_on')::date,originals_received=c.originals_received or coalesce((p_data->>'originals_received')::boolean,false) where id=c.id;
 elsif p_action='receive_pcc' then
  if c.stage<>'submitted' or actor.role not in ('admin','pta') then raise exception 'Pretoria must record collection after submission';end if;
  if not exists(select 1 from public.visa_documents d where d.case_id=c.id and d.document_type='PCC certificate') then raise exception 'Upload the retrieved PCC certificate to this client reference';end if;
  next_stage='consultant_confirmation';perform sgc_private.visa_notify(c.id,'consultant','Confirm PCC retrieved');
 elsif p_action='manual_saps' then
  if c.stage not in ('submitted','consultant_confirmation') or actor.role not in ('admin','manager','consultant','pta') then raise exception 'SAPS verification is unavailable at this stage';end if;
  if not exists(select 1 from public.visa_documents d where d.case_id=c.id and d.document_type='SAPS status evidence') or length(trim(coalesce(p_data->>'verification_notes','')))<10 then raise exception 'Upload SAPS status evidence and describe the matching finalised result';end if;
  update public.visa_cases set saps_status='manual_verified',saps_checked_at=now(),saps_message='Manually verified by '||actor.display_name,updated_at=now() where id=c.id;
 elsif p_action='confirm_send' then
  if c.stage<>'consultant_confirmation' or actor.role not in ('admin','manager','consultant') or (actor.role='consultant' and c.consultant_id<>actor.user_id) then raise exception 'The assigned consultant must confirm retrieval';end if;
  if c.saps_status not in ('finalised','manual_verified') then raise exception 'Confirm a matching SAPS finalised result before sending';end if;
  next_stage='waybill_booking';perform sgc_private.visa_notify(c.id,'pta','Book waybill to '||c.company_id);
 elsif p_action='record_waybill' then
  if c.stage<>'waybill_booking' or actor.role not in ('admin','pta') then raise exception 'Only Pretoria can record this dispatch';end if;
  select * into dest from public.visa_companies where id=c.company_id;
  if length(trim(dest.delivery_address))<10 or length(trim(dest.delivery_contact))<2 or length(trim(dest.delivery_phone))<7 then raise exception 'Admin must add the company delivery address, contact and phone before booking';end if;
  if coalesce(p_data->>'courier','') not in ('Parcel Perfect','The Courier Guy') or length(trim(coalesce(p_data->>'waybill','')))<3 then raise exception 'Book with a courier and enter the issued waybill';end if;
  charge=coalesce((p_data->>'delivery_amount')::numeric,0);if charge<=0 or charge>100000 then raise exception 'Enter the delivery charge invoiced to this client';end if;
  next_stage='dispatched';update public.visa_cases set courier=p_data->>'courier',waybill=trim(p_data->>'waybill'),delivery_amount=charge where id=c.id;
  details=details||jsonb_build_object('delivery_destination',dest.name,'delivery_address',dest.delivery_address,'invoice_id','delivery-'||c.id);
  insert into public.visa_service_records(id,kind,brand,case_id,data) values('delivery-'||c.id,'invoice',c.company_id,c.id,jsonb_build_object('client',c.client_name,'client_reference',c.reference,'case_id',c.id,'service','PCC delivery · '||(p_data->>'courier'),'amount',charge,'status','Unpaid','due',current_date+7,'waybill',trim(p_data->>'waybill'),'invoice_number','DEL-'||c.reference,'payment','EFT','delivery_destination',dest.name));
  perform sgc_private.visa_notify(c.id,'consultant','PCC dispatched · delivery invoice created');
 elsif p_action='delivered' then
  if c.stage<>'dispatched' or actor.role not in ('admin','pta','manager') then raise exception 'Only the delivery team can confirm receipt';end if;
  if nullif(p_data->>'delivered_on','') is null or (p_data->>'delivered_on')::date>current_date then raise exception 'Enter the actual delivery date';end if;
  next_stage='delivered';update public.visa_cases set delivered_on=(p_data->>'delivered_on')::date where id=c.id;perform sgc_private.visa_notify(c.id,'consultant','Delivery confirmed');
 else raise exception 'Unknown workflow action';end if;
 update public.visa_cases set stage=next_stage,updated_at=now() where id=c.id returning * into c;
 insert into public.visa_case_events(case_id,action,from_stage,to_stage,actor_id,actor_name,actor_role,signed_name,details)
 values(c.id,p_action,previous,next_stage,actor.user_id,actor.display_name,actor.role,trim(p_signature),details||jsonb_build_object('document_versions',doc_ids));
 return c;end $$;
create function public.visa_mark_notification(p_id uuid) returns void language sql security definer set search_path='' as $$
 update public.visa_notifications set read_at=now() where id=p_id and user_id=auth.uid();
$$;
-- Provisioning is server-only: the Edge Function verifies the caller before these RPCs.
create function public.visa_auth_user_lookup(p_email text) returns uuid language sql security definer set search_path='' as $$
 select id from auth.users where lower(email)=lower(trim(p_email)) limit 1;
$$;
create function public.visa_admin_set_user(p_actor uuid,p_user uuid,p_name text,p_email text,p_role text,p_companies text[],p_active boolean,p_new_password boolean default false) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not exists(select 1 from public.visa_users where user_id=p_actor and active and not must_change_password and role='admin') then raise exception 'Administrator access required';end if;
 if p_role not in ('admin','manager','consultant','pta','finance','viewer') or length(trim(p_name)) not between 2 and 120 then raise exception 'Choose a valid role and full name';end if;
 if p_user='df627f92-e256-47eb-8a92-590ee9cf7d59' and (p_role<>'admin' or not p_active) then raise exception 'The primary owner must remain an active administrator';end if;
 if p_role<>'admin' and coalesce(cardinality(p_companies),0)=0 then raise exception 'Assign at least one company';end if;
 if exists(select 1 from unnest(p_companies) co where not exists(select 1 from public.visa_companies c where c.id=co and c.active)) then raise exception 'Choose existing active companies';end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=lower(trim(p_email))) then raise exception 'Account email does not match';end if;
 insert into public.visa_users(user_id,display_name,email,role,active,must_change_password,created_by) values(p_user,trim(p_name),lower(trim(p_email)),p_role,p_active,p_new_password,p_actor)
 on conflict(user_id) do update set display_name=excluded.display_name,email=excluded.email,role=excluded.role,active=excluded.active;
 delete from public.visa_user_companies where user_id=p_user;
 insert into public.visa_user_companies(user_id,company_id) select p_user,co from (select distinct unnest(p_companies) co) x;
 insert into sgc_private.visa_admin_audit(actor_id,action,target_id,details) values(p_actor,'user_access_updated',p_user::text,jsonb_build_object('role',p_role,'companies',p_companies,'active',p_active));
 end $$;
create function public.visa_password_gate_clear(p_user uuid) returns void language sql security definer set search_path='' as $$
 update public.visa_users set must_change_password=false where user_id=p_user;
$$;
create function public.visa_save_company(p_data jsonb) returns public.visa_companies language plpgsql security definer set search_path='' as $$
 declare co public.visa_companies;begin
 if not sgc_private.visa_is_admin() then raise exception 'Administrator access required';end if;
 insert into public.visa_companies(id,name,delivery_address,delivery_contact,delivery_phone,active)
 values(p_data->>'id',trim(p_data->>'name'),left(coalesce(p_data->>'delivery_address',''),1000),left(coalesce(p_data->>'delivery_contact',''),150),left(coalesce(p_data->>'delivery_phone',''),50),true)
 on conflict(id) do update set name=excluded.name,delivery_address=excluded.delivery_address,delivery_contact=excluded.delivery_contact,delivery_phone=excluded.delivery_phone returning * into co;
 insert into sgc_private.visa_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'company_saved',co.id,jsonb_build_object('name',co.name));return co;
 end $$;
create function public.visa_record_saps_result(p_case uuid,p_status text,p_message text,p_finalised date default null) returns void language plpgsql security definer set search_path='' as $$
 declare c public.visa_cases;begin
 select * into c from public.visa_cases where id=p_case for update;
 if not found then raise exception 'Case not found';end if;
 if p_status not in ('pending','finalised','not_found','unavailable') then raise exception 'Unknown SAPS result';end if;
 -- Never overwrite a human-confirmed result or a completed dispatch with a transient failure.
 if c.saps_status='manual_verified' or c.stage in ('waybill_booking','dispatched','delivered') then return;end if;
 update public.visa_cases set saps_status=case when c.saps_status='finalised' and p_status='unavailable' then c.saps_status else p_status end,saps_checked_at=now(),saps_finalised_on=coalesce(p_finalised,c.saps_finalised_on),saps_message=left(p_message,600),updated_at=now() where id=p_case;
 insert into public.visa_case_events(case_id,action,from_stage,to_stage,actor_name,actor_role,details) values(c.id,'saps_check',c.stage,c.stage,'SAPS status checker','system',jsonb_build_object('status',p_status,'message',left(p_message,600),'source','SAPS public enquiry','finalised_on',p_finalised));
 if p_status='finalised' and c.saps_status<>'finalised' then perform sgc_private.visa_notify(c.id,'consultant','SAPS reports PCC finalised');end if;
 end $$;
create function public.visa_claim_saps_job(p_id uuid,p_token text) returns uuid language plpgsql security definer set search_path='' as $$
 declare cid uuid;begin
 update sgc_private.visa_saps_jobs set claimed_at=now() where id=p_id and claimed_at is null and created_at>now()-interval '15 minutes' and token_hash=encode(extensions.digest(p_token,'sha256'),'hex') returning case_id into cid;return cid;
 end $$;
create function sgc_private.visa_schedule_saps_checks() returns void language plpgsql security definer set search_path='' as $$
 declare c record;secret_token text;jid uuid;begin
 for c in select id from public.visa_cases where stage in ('submitted','consultant_confirmation') and saps_reference is not null and saps_identity is not null and saps_status not in ('finalised','manual_verified') and (saps_checked_at is null or saps_checked_at<now()-interval '5 hours') limit 80 loop
  if not exists(select 1 from sgc_private.visa_saps_jobs where case_id=c.id and created_at>now()-interval '5 hours') then
   secret_token=encode(extensions.gen_random_bytes(32),'hex');
   insert into sgc_private.visa_saps_jobs(case_id,token_hash) values(c.id,encode(extensions.digest(secret_token,'sha256'),'hex')) returning id into jid;
   perform net.http_post(url:='https://bxpexanyoyubxeqqlggh.supabase.co/functions/v1/visa-operations',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('action','scheduled_saps','job_id',jid,'job_token',secret_token),timeout_milliseconds:=30000);
  end if;
 end loop;
 delete from sgc_private.visa_saps_jobs where created_at<now()-interval '7 days';
 end $$;
revoke all on function sgc_private.visa_schedule_saps_checks() from public,anon,authenticated;
revoke all on function public.visa_auth_user_lookup(text),public.visa_admin_set_user(uuid,uuid,text,text,text,text[],boolean,boolean),public.visa_password_gate_clear(uuid),public.visa_record_saps_result(uuid,text,text,date),public.visa_claim_saps_job(uuid,text) from public,anon,authenticated;
grant execute on function public.visa_auth_user_lookup(text),public.visa_admin_set_user(uuid,uuid,text,text,text,text[],boolean,boolean),public.visa_password_gate_clear(uuid),public.visa_record_saps_result(uuid,text,text,date),public.visa_claim_saps_job(uuid,text) to service_role;
revoke all on function public.visa_team(text),public.visa_create_case(jsonb),public.visa_add_document(jsonb),public.visa_save_saps_numbers(uuid,text,text),public.visa_sign_step(uuid,text,text,jsonb),public.visa_mark_notification(uuid),public.visa_save_company(jsonb) from public,anon;
grant execute on function public.visa_team(text),public.visa_create_case(jsonb),public.visa_add_document(jsonb),public.visa_save_saps_numbers(uuid,text,text),public.visa_sign_step(uuid,text,text,jsonb),public.visa_mark_notification(uuid),public.visa_save_company(jsonb) to authenticated;
select cron.schedule('visa-pcc-status-checks','0 */6 * * *','select sgc_private.visa_schedule_saps_checks()');
