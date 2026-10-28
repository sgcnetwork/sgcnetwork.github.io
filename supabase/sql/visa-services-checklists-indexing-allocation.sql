-- Uniform document standards, immutable index reviews, and atomic company round-robin allocation.
alter table public.visa_users add column accepting_leads boolean not null default true;
create table public.visa_checklist_templates (
 id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),name text not null,
 service text not null check(service in ('PCC','Visa','Sworn translation','Other')),country text not null default '',visa_type text not null default '',
 required_documents text[] not null check(cardinality(required_documents) between 1 and 25),notes text not null default '',sources text[] not null default '{}',
 version integer not null default 1,active boolean not null default true,updated_at timestamptz not null default now()
);
create table public.visa_field_profiles(id text primary key,name text not null,document_types text[] not null,fields jsonb not null,notes text not null default '',version integer not null default 1,updated_at timestamptz not null default now());
alter table public.visa_cases add column checklist_template_id text references public.visa_checklist_templates(id),add column checklist_version integer,add column country text not null default '',add column visa_type text not null default '',add column intended_entry date,add column source_lead_id text references public.visa_service_records(id);
alter table public.visa_service_records add column assigned_user_id uuid references public.visa_users(user_id),add column source_lead_id text references public.visa_service_records(id);
create index visa_records_assignee_idx on public.visa_service_records(assigned_user_id,kind,created_at desc);
create table sgc_private.visa_allocation_state(company_id text primary key references public.visa_companies(id),sequence bigint not null default 0);
alter table sgc_private.visa_allocation_state enable row level security;
create table public.visa_allocations(id uuid primary key default gen_random_uuid(),company_id text not null references public.visa_companies(id),user_id uuid not null references public.visa_users(user_id),source_kind text not null check(source_kind in ('lead','case')),source_id text not null,sequence bigint not null,method text not null check(method in ('round_robin','manual_override')),reason text,assigned_by uuid references auth.users(id),created_at timestamptz not null default now(),unique(company_id,source_kind,source_id));
create index visa_allocations_company_user_idx on public.visa_allocations(company_id,user_id,sequence desc);
create table public.visa_document_extractions(id uuid primary key default gen_random_uuid(),revision bigint generated always as identity unique,document_id uuid not null references public.visa_documents(id),case_id uuid not null references public.visa_cases(id),company_id text not null references public.visa_companies(id),provider text not null check(provider in ('grok','local_text')),model text,fields jsonb not null default '{}',evidence jsonb not null default '{}',findings jsonb not null default '[]',coverage jsonb not null default '{}',source_sha256 text not null,created_by uuid not null references public.visa_users(user_id),created_at timestamptz not null default now(),check(octet_length(fields::text)<100000 and octet_length(evidence::text)<100000 and octet_length(findings::text)<100000));
create index visa_extractions_document_idx on public.visa_document_extractions(document_id,revision desc);
create table public.visa_document_field_reviews(id uuid primary key default gen_random_uuid(),revision bigint generated always as identity unique,document_id uuid not null references public.visa_documents(id),case_id uuid not null references public.visa_cases(id),company_id text not null references public.visa_companies(id),extraction_id uuid references public.visa_document_extractions(id),fields jsonb not null,status text not null check(status in ('confirmed','needs_correction')),notes text not null default '',flags jsonb not null default '{}',reviewer_id uuid not null references public.visa_users(user_id),reviewer_name text not null,signed_name text not null,created_at timestamptz not null default now(),check(jsonb_typeof(fields)='object' and octet_length(fields::text)<100000));
create index visa_field_reviews_document_idx on public.visa_document_field_reviews(document_id,revision desc);
create table sgc_private.visa_ai_config(id integer primary key default 1 check(id=1),secret_id uuid,model text not null default 'grok-4.3',enabled boolean not null default false,auto_analyse boolean not null default true,daily_limit integer not null default 100 check(daily_limit between 1 and 1000),updated_at timestamptz not null default now());
insert into sgc_private.visa_ai_config(id) values(1);
alter table sgc_private.visa_ai_config enable row level security;
create table sgc_private.visa_ai_usage(id uuid primary key default gen_random_uuid(),user_id uuid not null,company_id text not null,document_id uuid,action text not null,created_at timestamptz not null default now());
create index visa_ai_usage_day_idx on sgc_private.visa_ai_usage(created_at,user_id);
alter table sgc_private.visa_ai_usage enable row level security;

create function sgc_private.visa_doc_key(p_type text) returns text language sql immutable set search_path='' as $$
 select case regexp_replace(lower(p_type),'[^a-z0-9]','','g') when 'id' then 'identity' when 'passport' then 'identity' when 'idpassport' then 'identity' when 'pcccertificate' then 'pcc' when 'flightreservationdummyflights' then 'flights' when 'dummyflights' then 'flights' when 'flightreservation' then 'flights' when 'bankstatement' then 'bankstatements' else regexp_replace(lower(p_type),'[^a-z0-9]','','g') end
$$;
revoke all on function sgc_private.visa_doc_key(text) from public,anon;
grant execute on function sgc_private.visa_doc_key(text) to authenticated,service_role;
create function sgc_private.visa_next_assignee(p_company text,p_kind text,p_source text) returns uuid language plpgsql security definer set search_path='' as $$
 declare result uuid;counter bigint;begin
 if not sgc_private.visa_access(p_company,array['manager','consultant']) then raise exception 'You cannot allocate leads for this company';end if;
 insert into sgc_private.visa_allocation_state(company_id) values(p_company) on conflict do nothing;
 perform 1 from sgc_private.visa_allocation_state where company_id=p_company for update;
 select user_id into result from public.visa_allocations where company_id=p_company and source_kind=p_kind and source_id=p_source;
 if found then return result;end if;
 select u.user_id into result from public.visa_users u join public.visa_user_companies m on m.user_id=u.user_id
 where m.company_id=p_company and u.role='consultant' and u.active and not u.must_change_password and u.accepting_leads
 order by coalesce((select max(a.sequence) from public.visa_allocations a where a.company_id=p_company and a.user_id=u.user_id),0),lower(u.display_name),u.user_id limit 1;
 if result is null then raise exception 'No eligible consultants for this company. Admin must assign active consultants, enable lead allocation and complete their first password change.';end if;
 update sgc_private.visa_allocation_state set sequence=sequence+1 where company_id=p_company returning sequence into counter;
 insert into public.visa_allocations(company_id,user_id,source_kind,source_id,sequence,method,assigned_by) values(p_company,result,p_kind,p_source,counter,'round_robin',auth.uid());
 return result;end $$;
revoke all on function sgc_private.visa_next_assignee(text,text,text) from public,anon,authenticated;
create function sgc_private.visa_allocate_record() returns trigger language plpgsql security definer set search_path='' as $$
 declare lead public.visa_service_records; assigned_name text;begin
 if new.kind not in ('lead','quote') then return new;end if;
 if not sgc_private.visa_record_access(new.brand,new.kind,true) then raise exception 'Record access denied';end if;
 if tg_op='UPDATE' and (new.brand<>old.brand or new.kind<>old.kind) then raise exception 'An existing record cannot be moved to another company or record type';end if;
 if new.kind='lead' then
  if tg_op='INSERT' then new.assigned_user_id=sgc_private.visa_next_assignee(new.brand,'lead',new.id);
  else new.assigned_user_id=old.assigned_user_id;end if;
 else
  if nullif(new.data->>'source_lead_id','') is not null then
   select * into lead from public.visa_service_records r where r.id=new.data->>'source_lead_id' and r.kind='lead' and r.brand=new.brand;
   if not found then raise exception 'Choose a lead from the same company';end if;
   new.source_lead_id=lead.id;new.assigned_user_id=lead.assigned_user_id;
  else new.source_lead_id=null;new.assigned_user_id=null;end if;
 end if;
 if new.assigned_user_id is not null then select display_name into assigned_name from public.visa_users where user_id=new.assigned_user_id;new.data=new.data||jsonb_build_object('owner',assigned_name,'assigned_user_id',new.assigned_user_id);end if;
 return new;end $$;
revoke all on function sgc_private.visa_allocate_record() from public,anon,authenticated;
create trigger visa_record_allocation before insert or update on public.visa_service_records for each row execute function sgc_private.visa_allocate_record();

create or replace function sgc_private.visa_create_case(p_data jsonb) returns public.visa_cases language plpgsql security definer set search_path='' as $$
 declare c public.visa_cases;actor public.visa_users;assignee uuid;co text;docs text[];t public.visa_checklist_templates;cid uuid;svc text;country_name text;category text;lead_id text;lead public.visa_service_records;q public.visa_service_records;counter bigint;begin
 select * into actor from public.visa_users where user_id=auth.uid();co=p_data->>'company_id';
 if not sgc_private.visa_access(co,array['manager','consultant']) then raise exception 'You cannot create clients for this company';end if;
 cid=coalesce(nullif(p_data->>'request_id','')::uuid,gen_random_uuid());
 select * into c from public.visa_cases where id=cid;if found then if c.created_by=actor.user_id and c.company_id=co then return c;else raise exception 'This request reference has already been used';end if;end if;
 svc=case when lower(p_data->>'service')='pcc' then 'PCC' when lower(p_data->>'service')='visa' then 'Visa' when lower(p_data->>'service')='sworn translation' then 'Sworn translation' else 'Other' end;
 country_name=trim(coalesce(p_data->>'country',''));category=trim(coalesce(p_data->>'visa_type',''));
 if svc='Visa' and (length(country_name)<2 or length(category)<2) then raise exception 'Select the visa country and visa category';end if;
 if nullif(p_data->>'checklist_template_id','') is not null then
  select * into t from public.visa_checklist_templates where id=p_data->>'checklist_template_id' and active and service=svc;
 else
  select * into t from public.visa_checklist_templates where active and service=svc and (country='' or lower(country)=lower(country_name)) and (visa_type='' or lower(visa_type)=lower(category)) order by (country<>'') desc,(visa_type<>'') desc,id limit 1;
 end if;
 if t.id is null then raise exception 'Admin must configure a checklist for this service';end if;
 if t.country<>'' and lower(t.country)<>lower(country_name) or t.visa_type<>'' and lower(t.visa_type)<>lower(category) then raise exception 'The selected checklist does not match this visa country/category';end if;
 docs=t.required_documents;
 -- Preserve existing administrator-created custom Other cases; PCC and Visa always use templates.
 if svc='Other' and nullif(p_data->>'checklist_template_id','') is null and actor.role='admin' and p_data?'required_documents' then select array_agg(trim(value)) into docs from jsonb_array_elements_text(p_data->'required_documents') where length(trim(value)) between 1 and 80;end if;
 if coalesce(cardinality(docs),0) not between 1 and 25 then raise exception 'Choose a valid checklist';end if;
 if nullif(p_data->>'quote_id','') is not null then select * into q from public.visa_service_records where id=p_data->>'quote_id' and kind='quote' and brand=co;if not found then raise exception 'Quotation does not belong to this company';end if;end if;
 lead_id=coalesce(nullif(p_data->>'source_lead_id',''),q.source_lead_id);
 if lead_id is not null then select * into lead from public.visa_service_records where id=lead_id and kind='lead' and brand=co;if not found then raise exception 'Lead does not belong to this company';end if;end if;
 if p_data->>'allocation_mode'='manual' then
  if actor.role not in ('admin','manager') or length(trim(coalesce(p_data->>'allocation_reason','')))<10 then raise exception 'Manual assignment requires a manager/admin and an audit reason';end if;
  assignee=nullif(p_data->>'consultant_id','')::uuid;
  if not exists(select 1 from public.visa_users u where u.user_id=assignee and u.active and not u.must_change_password and u.role in ('consultant','manager','admin') and (u.role='admin' or exists(select 1 from public.visa_user_companies m where m.user_id=u.user_id and m.company_id=co))) then raise exception 'Choose an active member of this company';end if;
  insert into sgc_private.visa_allocation_state(company_id) values(co) on conflict do nothing;
  update sgc_private.visa_allocation_state set sequence=sequence+1 where company_id=co returning sequence into counter;
  insert into public.visa_allocations(company_id,user_id,source_kind,source_id,sequence,method,reason,assigned_by) values(co,assignee,'case',cid::text,counter,'manual_override',left(p_data->>'allocation_reason',1000),actor.user_id);
 elsif lead.assigned_user_id is not null and exists(select 1 from public.visa_users u join public.visa_user_companies m on m.user_id=u.user_id where u.user_id=lead.assigned_user_id and u.active and not u.must_change_password and u.role='consultant' and m.company_id=co) then assignee=lead.assigned_user_id;
 else assignee=sgc_private.visa_next_assignee(co,'case',cid::text);end if;
 insert into public.visa_cases(id,reference,company_id,client_name,email,phone,service,required_documents,consultant_id,quote_id,notes,created_by,checklist_template_id,checklist_version,country,visa_type,intended_entry,source_lead_id)
 values(cid,co||'-'||case when svc='PCC' then 'PCC' else 'REF' end||'-'||lpad(nextval('sgc_private.visa_client_reference_seq')::text,6,'0'),co,trim(p_data->>'client_name'),left(coalesce(p_data->>'email',''),200),left(coalesce(p_data->>'phone',''),50),case when svc='Other' then left(coalesce(nullif(p_data->>'service',''),'Other'),200) else svc end,docs,assignee,q.id,left(coalesce(p_data->>'notes',''),10000),actor.user_id,t.id,t.version,country_name,category,nullif(p_data->>'intended_entry','')::date,lead_id) returning * into c;
 insert into public.visa_case_events(case_id,action,to_stage,actor_id,actor_name,actor_role,details) values(c.id,'case_created',c.stage,actor.user_id,actor.display_name,actor.role,jsonb_build_object('required_documents',docs,'checklist_template',t.id,'version',t.version,'consultant_id',assignee,'allocation',case when p_data->>'allocation_mode'='manual' then 'manual_override' when lead.assigned_user_id=assignee then 'inherited_from_lead' else 'round_robin' end,'allocation_reason',p_data->>'allocation_reason'));
 perform sgc_private.visa_notify(c.id,'consultant','New client reference assigned');return c;end $$;

create function sgc_private.visa_review_document(p_document uuid,p_fields jsonb,p_status text,p_signature text,p_notes text,p_flags jsonb default '{}',p_extraction uuid default null) returns public.visa_document_field_reviews language plpgsql security definer set search_path='' as $$
 declare d public.visa_documents;actor public.visa_users;review public.visa_document_field_reviews;f record;profile public.visa_field_profiles;required_field jsonb;begin
 select * into d from public.visa_documents where id=p_document;
 if not found or not sgc_private.visa_case_access(d.case_id,array['manager','consultant','pta']) then raise exception 'You cannot review this client document';end if;
 select * into actor from public.visa_users where user_id=auth.uid();
 if lower(trim(p_signature))<>lower(trim(actor.display_name)) or coalesce((p_flags->>'acknowledged')::boolean,false) is not true then raise exception 'Sign the review with your own name and confirmation';end if;
 if p_status not in ('confirmed','needs_correction') or jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>50000 then raise exception 'Invalid index fields';end if;
 select * into profile from public.visa_field_profiles p where exists(select 1 from unnest(p.document_types) dt where sgc_private.visa_doc_key(dt)=sgc_private.visa_doc_key(d.document_type)) order by p.id limit 1;
 if not found then select * into profile from public.visa_field_profiles where id='general';end if;
 for f in select key,value from jsonb_each_text(p_fields) loop
  if jsonb_typeof(p_fields->f.key) not in ('string','null') then raise exception 'Index values must be text or null';end if;
  if f.key !~ '^[a-z][a-z0-9_]{0,49}$' or length(coalesce(f.value,''))>2000 then raise exception 'Invalid index field name or value';end if;
  if (f.key in ('date_of_birth','issue_date','expiry_date','capture_date','entry_date','return_date','period_start','period_end') or exists(select 1 from jsonb_array_elements(profile.fields) x where x->>'key'=f.key and x->>'type'='date')) and nullif(trim(f.value),'') is not null then
   if f.value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Dates must use YYYY-MM-DD';end if;perform f.value::date;
  end if;
 end loop;
 if p_extraction is not null and not exists(select 1 from public.visa_document_extractions e where e.id=p_extraction and e.document_id=d.id) then raise exception 'Extraction does not belong to this document';end if;
 select * into profile from public.visa_field_profiles p where exists(select 1 from unnest(p.document_types) dt where sgc_private.visa_doc_key(dt)=sgc_private.visa_doc_key(d.document_type)) order by p.id limit 1;
 if not found then select * into profile from public.visa_field_profiles where id='general';end if;
 if p_status='confirmed' then
  for required_field in select value from jsonb_array_elements(coalesce(profile.fields,'[]')) where (value->>'required')::boolean loop
   if nullif(trim(p_fields->>(required_field->>'key')),'') is null then raise exception 'Complete required index field: %',required_field->>'label';end if;
  end loop;
  if sgc_private.visa_doc_key(d.document_type)='identity' and nullif(trim(p_fields->>'id_number'),'') is null and nullif(trim(p_fields->>'passport_number'),'') is null then raise exception 'Record the visible ID number or passport number';end if;
  if sgc_private.visa_doc_key(d.document_type)='sworntranslation' and (coalesce((p_flags->>'qualified_translation_review')::boolean,false) is not true or lower(p_fields->>'translator_signature')<>'yes') then raise exception 'A qualified human review and a visible translator signature are required for confirmation';end if;
 end if;
 if p_status='needs_correction' and length(trim(coalesce(p_notes,'')))<10 then raise exception 'Describe the correction needed';end if;
 insert into public.visa_document_field_reviews(document_id,case_id,company_id,extraction_id,fields,status,notes,flags,reviewer_id,reviewer_name,signed_name)
 values(d.id,d.case_id,d.company_id,p_extraction,p_fields,p_status,left(coalesce(p_notes,''),4000),p_flags||jsonb_build_object('profile_id',coalesce(profile.id,'general'),'profile_version',coalesce(profile.version,1)),actor.user_id,actor.display_name,trim(p_signature)) returning * into review;
 insert into public.visa_case_events(case_id,action,actor_id,actor_name,actor_role,signed_name,details) values(d.case_id,'document_fields_reviewed',actor.user_id,actor.display_name,actor.role,trim(p_signature),jsonb_build_object('document_id',d.id,'document_type',d.document_type,'review_id',review.id,'status',p_status,'notes',left(coalesce(p_notes,''),1000)));
 return review;end $$;
create function public.visa_review_document(p_document uuid,p_fields jsonb,p_status text,p_signature text,p_notes text,p_flags jsonb default '{}',p_extraction uuid default null) returns public.visa_document_field_reviews language sql security invoker set search_path='' as $$select sgc_private.visa_review_document(p_document,p_fields,p_status,p_signature,p_notes,p_flags,p_extraction)$$;

create function sgc_private.visa_save_template(p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
 declare docs text[];begin
 if not sgc_private.visa_is_admin() then raise exception 'Administrator access required';end if;
 select array_agg(trim(value)) into docs from jsonb_array_elements_text(p_data->'required_documents') where length(trim(value)) between 1 and 80;
 if coalesce(cardinality(docs),0) not between 1 and 25 then raise exception 'A checklist needs between 1 and 25 items';end if;
 insert into public.visa_checklist_templates(id,name,service,country,visa_type,required_documents,notes,sources) values(p_data->>'id',left(p_data->>'name',150),p_data->>'service',left(coalesce(p_data->>'country',''),100),left(coalesce(p_data->>'visa_type',''),100),docs,left(coalesce(p_data->>'notes',''),3000),array(select jsonb_array_elements_text(coalesce(p_data->'sources','[]'))))
 on conflict(id) do update set name=excluded.name,country=excluded.country,visa_type=excluded.visa_type,required_documents=excluded.required_documents,notes=excluded.notes,version=public.visa_checklist_templates.version+1,updated_at=now();
 insert into sgc_private.visa_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'checklist_template_saved',p_data->>'id',jsonb_build_object('required_documents',docs));end $$;
create function public.visa_save_template(p_data jsonb) returns void language sql security invoker set search_path='' as $$select sgc_private.visa_save_template(p_data)$$;
create function sgc_private.visa_save_field_profile(p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
 declare f jsonb;begin
 if not sgc_private.visa_is_admin() then raise exception 'Administrator access required';end if;
 if jsonb_typeof(p_data->'fields')<>'array' or jsonb_array_length(p_data->'fields') not between 1 and 50 then raise exception 'Choose 1 to 50 fields';end if;
 for f in select value from jsonb_array_elements(p_data->'fields') loop if f->>'key' !~ '^[a-z][a-z0-9_]{0,49}$' or f->>'type' not in ('text','date') or length(f->>'label') not between 1 and 120 then raise exception 'Invalid field definition';end if;end loop;
 update public.visa_field_profiles set version=version+1,fields=p_data->'fields',notes=left(coalesce(p_data->>'notes',''),3000),updated_at=now() where id=p_data->>'id';
 insert into sgc_private.visa_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'index_fields_updated',p_data->>'id',jsonb_build_object('field_count',jsonb_array_length(p_data->'fields')));end $$;
create function public.visa_save_field_profile(p_data jsonb) returns void language sql security invoker set search_path='' as $$select sgc_private.visa_save_field_profile(p_data)$$;
create function sgc_private.visa_set_availability(p_user uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
 begin if not sgc_private.visa_is_admin() and not exists(select 1 from public.visa_users where user_id=auth.uid() and user_id=p_user and role='consultant' and active and not must_change_password) then raise exception 'You cannot change this user’s allocation availability';end if;
 update public.visa_users set accepting_leads=p_enabled where user_id=p_user;insert into sgc_private.visa_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'allocation_availability',p_user::text,jsonb_build_object('accepting_leads',p_enabled));end $$;
create function public.visa_set_availability(p_user uuid,p_enabled boolean) returns void language sql security invoker set search_path='' as $$select sgc_private.visa_set_availability(p_user,p_enabled)$$;
create function sgc_private.visa_allocation_overview(p_company text) returns table(user_id uuid,display_name text,accepting_leads boolean,ready boolean,assigned_count bigint,last_assigned timestamptz) language sql stable security definer set search_path='' as $$
 select u.user_id,u.display_name,u.accepting_leads,u.active and not u.must_change_password,u2.n,u2.last_date from public.visa_users u join public.visa_user_companies m on m.user_id=u.user_id
 cross join lateral(select count(*) n,max(created_at) last_date from public.visa_allocations a where a.user_id=u.user_id and a.company_id=p_company) u2
 where m.company_id=p_company and u.role='consultant' and sgc_private.visa_access(p_company,array['manager','consultant']) order by lower(u.display_name)
$$;
create function public.visa_allocation_overview(p_company text) returns table(user_id uuid,display_name text,accepting_leads boolean,ready boolean,assigned_count bigint,last_assigned timestamptz) language sql stable security invoker set search_path='' as $$select * from sgc_private.visa_allocation_overview(p_company)$$;
create function sgc_private.visa_ai_set_config(p_actor uuid,p_key text,p_model text,p_enabled boolean,p_auto boolean,p_daily integer) returns void language plpgsql security definer set search_path='' as $$
 declare sid uuid;begin
 if not exists(select 1 from public.visa_users where user_id=p_actor and active and not must_change_password and role='admin') then raise exception 'Administrator access required';end if;
 if p_model !~ '^[a-zA-Z0-9._:-]{1,100}$' then raise exception 'Choose a valid model identifier';end if;
 select secret_id into sid from sgc_private.visa_ai_config where id=1 for update;
 if nullif(trim(p_key),'') is not null then
  if length(p_key) not between 20 and 400 then raise exception 'Invalid API key length';end if;
  if sid is null then sid=vault.create_secret(p_key,'visa_services_grok_key','Visa Services company Grok API key');else perform vault.update_secret(sid,p_key);end if;
 end if;
 if p_enabled and sid is null then raise exception 'Connect an xAI key before enabling Grok';end if;
 update sgc_private.visa_ai_config set secret_id=sid,model=p_model,enabled=p_enabled,auto_analyse=p_auto,daily_limit=p_daily,updated_at=now() where id=1;
 insert into sgc_private.visa_admin_audit(actor_id,action,target_id,details) values(p_actor,'grok_configuration','company-agent',jsonb_build_object('model',p_model,'enabled',p_enabled,'auto_analyse',p_auto,'daily_limit',p_daily));end $$;
create function public.visa_ai_set_config(p_actor uuid,p_key text,p_model text,p_enabled boolean,p_auto boolean,p_daily integer) returns void language sql security invoker set search_path='' as $$select sgc_private.visa_ai_set_config(p_actor,p_key,p_model,p_enabled,p_auto,p_daily)$$;
create function sgc_private.visa_ai_get_config() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('model',c.model,'enabled',c.enabled,'auto_analyse',c.auto_analyse,'daily_limit',c.daily_limit,'configured',c.secret_id is not null,'api_key',(select decrypted_secret from vault.decrypted_secrets where id=c.secret_id)) from sgc_private.visa_ai_config c where c.id=1
$$;
create function public.visa_ai_get_config() returns jsonb language sql security invoker set search_path='' as $$select sgc_private.visa_ai_get_config()$$;
create function sgc_private.visa_agent_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin if not exists(select 1 from public.visa_users where user_id=auth.uid() and active and not must_change_password) then raise exception 'Active team access required';end if;
 return (select jsonb_build_object('configured',secret_id is not null,'model',model,'enabled',enabled,'auto_analyse',auto_analyse,'daily_limit',case when sgc_private.visa_is_admin() then daily_limit else null end) from sgc_private.visa_ai_config where id=1);end $$;
create function public.visa_agent_status() returns jsonb language sql stable security invoker set search_path='' as $$select sgc_private.visa_agent_status()$$;
create function sgc_private.visa_claim_ai_usage(p_actor uuid,p_company text,p_document uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
 declare budget integer;begin
 if not exists(select 1 from public.visa_users u where u.user_id=p_actor and u.active and not u.must_change_password and (u.role='admin' or u.role in ('manager','consultant','pta') and exists(select 1 from public.visa_user_companies m where m.user_id=p_actor and m.company_id=p_company))) then raise exception 'Document processing access denied';end if;
 if p_document is not null and not exists(select 1 from public.visa_documents where id=p_document and company_id=p_company) then raise exception 'Document does not belong to this company';end if;
 if p_action not in ('analyse','chat') then raise exception 'Unknown agent action';end if;
 select daily_limit into budget from sgc_private.visa_ai_config where id=1 and enabled and secret_id is not null for update;
 if not found then raise exception 'Admin must connect and enable the company Grok API key';end if;
 if (select count(*) from sgc_private.visa_ai_usage where created_at>=(now() at time zone 'Africa/Johannesburg')::date at time zone 'Africa/Johannesburg')>=budget then raise exception 'The company daily AI request limit has been reached';end if;
 if exists(select 1 from sgc_private.visa_ai_usage where user_id=p_actor and created_at>now()-interval '8 seconds') then raise exception 'Please wait a few seconds before another agent request';end if;
 if p_document is not null and exists(select 1 from sgc_private.visa_ai_usage where document_id=p_document and action='analyse' and created_at>now()-interval '30 seconds') then raise exception 'This document was analysed recently. Wait 30 seconds before retrying';end if;
 insert into sgc_private.visa_ai_usage(user_id,company_id,document_id,action) values(p_actor,p_company,p_document,p_action);end $$;
create function public.visa_claim_ai_usage(p_actor uuid,p_company text,p_document uuid,p_action text) returns void language sql security invoker set search_path='' as $$select sgc_private.visa_claim_ai_usage(p_actor,p_company,p_document,p_action)$$;
create function sgc_private.visa_store_extraction(p_actor uuid,p_document uuid,p_provider text,p_model text,p_fields jsonb,p_evidence jsonb,p_findings jsonb,p_coverage jsonb,p_hash text) returns public.visa_document_extractions language plpgsql security definer set search_path='' as $$
 declare d public.visa_documents;r public.visa_document_extractions;begin
 select * into d from public.visa_documents where id=p_document;
 if not found or not exists(select 1 from public.visa_users u where u.user_id=p_actor and u.active and not u.must_change_password and (u.role='admin' or u.role in ('manager','consultant','pta') and exists(select 1 from public.visa_user_companies m where m.user_id=u.user_id and m.company_id=d.company_id))) then raise exception 'Document processing access denied';end if;
 if p_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_fields)<>'object' then raise exception 'Invalid extraction source';end if;
 insert into public.visa_document_extractions(document_id,case_id,company_id,provider,model,fields,evidence,findings,coverage,source_sha256,created_by) values(d.id,d.case_id,d.company_id,p_provider,p_model,p_fields,p_evidence,p_findings,p_coverage,p_hash,p_actor) returning * into r;
 insert into public.visa_case_events(case_id,action,actor_id,actor_name,actor_role,details) select d.case_id,'document_indexed',u.user_id,u.display_name,u.role,jsonb_build_object('document_id',d.id,'extraction_id',r.id,'provider',p_provider,'advisory_only',true) from public.visa_users u where u.user_id=p_actor;return r;end $$;
create function public.visa_store_extraction(p_actor uuid,p_document uuid,p_provider text,p_model text,p_fields jsonb,p_evidence jsonb,p_findings jsonb,p_coverage jsonb,p_hash text) returns public.visa_document_extractions language sql security invoker set search_path='' as $$select sgc_private.visa_store_extraction(p_actor,p_document,p_provider,p_model,p_fields,p_evidence,p_findings,p_coverage,p_hash)$$;
create function sgc_private.visa_admin_save_access(p_actor uuid,p_user uuid,p_name text,p_email text,p_role text,p_companies text[],p_active boolean,p_new_password boolean,p_accepting boolean) returns void language plpgsql security definer set search_path='' as $$
 begin perform sgc_private.visa_admin_set_user(p_actor,p_user,p_name,p_email,p_role,p_companies,p_active,p_new_password);update public.visa_users set accepting_leads=p_accepting where user_id=p_user;end $$;
create function public.visa_admin_save_access(p_actor uuid,p_user uuid,p_name text,p_email text,p_role text,p_companies text[],p_active boolean,p_new_password boolean,p_accepting boolean) returns void language sql security invoker set search_path='' as $$select sgc_private.visa_admin_save_access(p_actor,p_user,p_name,p_email,p_role,p_companies,p_active,p_new_password,p_accepting)$$;

alter table public.visa_checklist_templates enable row level security;
alter table public.visa_field_profiles enable row level security;
alter table public.visa_allocations enable row level security;
alter table public.visa_document_extractions enable row level security;
alter table public.visa_document_field_reviews enable row level security;
revoke all on public.visa_checklist_templates,public.visa_field_profiles,public.visa_allocations,public.visa_document_extractions,public.visa_document_field_reviews from public,anon,authenticated;
grant select on public.visa_checklist_templates,public.visa_field_profiles,public.visa_allocations,public.visa_document_extractions,public.visa_document_field_reviews to authenticated;
revoke all on sgc_private.visa_ai_config,sgc_private.visa_ai_usage,sgc_private.visa_allocation_state from public,anon,authenticated;
create policy visa_templates_read on public.visa_checklist_templates for select to authenticated using(exists(select 1 from public.visa_users where user_id=auth.uid() and active and not must_change_password));
create policy visa_field_profiles_read on public.visa_field_profiles for select to authenticated using(exists(select 1 from public.visa_users where user_id=auth.uid() and active and not must_change_password));
create policy visa_allocations_read on public.visa_allocations for select to authenticated using(sgc_private.visa_access(company_id,array['manager','consultant']));
create policy visa_extractions_read on public.visa_document_extractions for select to authenticated using(sgc_private.visa_case_access(case_id,array['manager','consultant','pta','viewer']));
create policy visa_field_reviews_read on public.visa_document_field_reviews for select to authenticated using(sgc_private.visa_case_access(case_id,array['manager','consultant','pta','viewer']));
revoke all on function sgc_private.visa_review_document(uuid,jsonb,text,text,text,jsonb,uuid),public.visa_review_document(uuid,jsonb,text,text,text,jsonb,uuid),sgc_private.visa_save_template(jsonb),public.visa_save_template(jsonb),sgc_private.visa_save_field_profile(jsonb),public.visa_save_field_profile(jsonb),sgc_private.visa_set_availability(uuid,boolean),public.visa_set_availability(uuid,boolean),sgc_private.visa_allocation_overview(text),public.visa_allocation_overview(text),sgc_private.visa_agent_status(),public.visa_agent_status() from public,anon;
grant execute on function sgc_private.visa_review_document(uuid,jsonb,text,text,text,jsonb,uuid),public.visa_review_document(uuid,jsonb,text,text,text,jsonb,uuid),sgc_private.visa_save_template(jsonb),public.visa_save_template(jsonb),sgc_private.visa_save_field_profile(jsonb),public.visa_save_field_profile(jsonb),sgc_private.visa_set_availability(uuid,boolean),public.visa_set_availability(uuid,boolean),sgc_private.visa_allocation_overview(text),public.visa_allocation_overview(text),sgc_private.visa_agent_status(),public.visa_agent_status() to authenticated;
revoke all on function sgc_private.visa_ai_set_config(uuid,text,text,boolean,boolean,integer),public.visa_ai_set_config(uuid,text,text,boolean,boolean,integer),sgc_private.visa_ai_get_config(),public.visa_ai_get_config(),sgc_private.visa_claim_ai_usage(uuid,text,uuid,text),public.visa_claim_ai_usage(uuid,text,uuid,text),sgc_private.visa_store_extraction(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,text),public.visa_store_extraction(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,text),sgc_private.visa_admin_save_access(uuid,uuid,text,text,text,text[],boolean,boolean,boolean),public.visa_admin_save_access(uuid,uuid,text,text,text,text[],boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function sgc_private.visa_ai_set_config(uuid,text,text,boolean,boolean,integer),public.visa_ai_set_config(uuid,text,text,boolean,boolean,integer),sgc_private.visa_ai_get_config(),public.visa_ai_get_config(),sgc_private.visa_claim_ai_usage(uuid,text,uuid,text),public.visa_claim_ai_usage(uuid,text,uuid,text),sgc_private.visa_store_extraction(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,text),public.visa_store_extraction(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,text),sgc_private.visa_admin_save_access(uuid,uuid,text,text,text,text[],boolean,boolean,boolean),public.visa_admin_save_access(uuid,uuid,text,text,text,text[],boolean,boolean,boolean) to service_role;

insert into public.visa_checklist_templates(id,name,service,country,visa_type,required_documents,notes,sources) values('pcc','PCC · Standard document pack','PCC','','',array['ID / Passport','Fingerprints'],'Internal review copies. The original fingerprints must be received for submission.',array[]::text[]);
insert into public.visa_checklist_templates(id,name,service,country,visa_type,required_documents,notes,sources) values('visa-general','Visa · Company baseline','Visa','','',array['Bank statements','Flight reservation / dummy flights','ID / Passport','PCC','Passport photo'],'Company baseline, not a complete official country checklist. Confirm destination, visa category and consulate instructions.',array[]::text[]);
insert into public.visa_checklist_templates(id,name,service,country,visa_type,required_documents,notes,sources) values('visa-saudi-tourist','Saudi Arabia · Tourist eVisa review','Visa','Saudi Arabia','Tourist eVisa',array['Bank statements','Flight reservation / dummy flights','ID / Passport','PCC','Passport photo'],'Company baseline. Tourist eVisa: review passport validity at intended entry, category and photo specifications. Other Saudi categories require separate official instructions.',array['https://visa.visitsaudi.com/Home/TermsConditions','https://visa.visitsaudi.com/Home/PhotoSpecifications']::text[]);
insert into public.visa_checklist_templates(id,name,service,country,visa_type,required_documents,notes,sources) values('sworn-translation','Sworn translation · Source and translation','Sworn translation','','',array['Original document','Sworn translation'],'Compare the complete source and translation. A qualified human must confirm accuracy and the translator''s admission/credentials; visual stamps do not prove authenticity.',array['https://www.justice.gov.za/legislation/rules/Uniform-Rules-of-Court-GG999-GNR48-19650112-SAFLII.pdf']::text[]);
insert into public.visa_checklist_templates(id,name,service,country,visa_type,required_documents,notes,sources) values('other-documents','Other · Document services','Other','','',array['ID / Passport'],'Admin-maintained internal checklist. Select the appropriate additional items before opening the client file.',array[]::text[]);
insert into public.visa_field_profiles(id,name,document_types,fields,notes) values('identity','Identity / passport',array['ID / Passport','ID','Passport'],'[{"key": "full_name", "label": "Full name", "type": "text", "required": true}, {"key": "id_number", "label": "National ID number", "type": "text", "required": false}, {"key": "passport_number", "label": "Passport number", "type": "text", "required": false}, {"key": "date_of_birth", "label": "Date of birth", "type": "date", "required": true}, {"key": "issue_date", "label": "Issue date", "type": "date", "required": false}, {"key": "expiry_date", "label": "Expiry date", "type": "date", "required": false}, {"key": "nationality", "label": "Nationality", "type": "text", "required": false}]'::jsonb,'');
insert into public.visa_field_profiles(id,name,document_types,fields,notes) values('pcc','Police clearance certificate',array['PCC','PCC certificate'],'[{"key": "full_name", "label": "Full name", "type": "text", "required": true}, {"key": "id_number", "label": "National ID number", "type": "text", "required": false}, {"key": "passport_number", "label": "Passport number", "type": "text", "required": false}, {"key": "date_of_birth", "label": "Date of birth", "type": "date", "required": false}, {"key": "certificate_number", "label": "Certificate / enquiry number", "type": "text", "required": false}, {"key": "issue_date", "label": "Certificate issue date", "type": "date", "required": true}, {"key": "issuer", "label": "Issuing authority", "type": "text", "required": false}]'::jsonb,'');
insert into public.visa_field_profiles(id,name,document_types,fields,notes) values('fingerprints','Fingerprint review copy',array['Fingerprints'],'[{"key": "full_name", "label": "Applicant full name", "type": "text", "required": false}, {"key": "id_number", "label": "Written ID number", "type": "text", "required": false}, {"key": "capture_date", "label": "Fingerprint capture date", "type": "date", "required": false}, {"key": "official_signature", "label": "Officer signature visible (yes/no/unclear)", "type": "text", "required": false}]'::jsonb,'No biometric comparison or fingerprint authenticity assessment is performed.');
insert into public.visa_field_profiles(id,name,document_types,fields,notes) values('bank','Bank statement',array['Bank statements'],'[{"key": "full_name", "label": "Account holder name", "type": "text", "required": true}, {"key": "bank_name", "label": "Bank name", "type": "text", "required": true}, {"key": "account_last_four", "label": "Account last four digits only", "type": "text", "required": false}, {"key": "period_start", "label": "Statement period start", "type": "date", "required": true}, {"key": "period_end", "label": "Statement period end", "type": "date", "required": true}, {"key": "currency", "label": "Currency", "type": "text", "required": false}]'::jsonb,'');
insert into public.visa_field_profiles(id,name,document_types,fields,notes) values('flights','Flight reservation',array['Flight reservation / dummy flights','Dummy flights','Flight reservation'],'[{"key": "full_name", "label": "Passenger full name", "type": "text", "required": true}, {"key": "booking_reference", "label": "Booking reference", "type": "text", "required": false}, {"key": "entry_date", "label": "Outbound / arrival date", "type": "date", "required": true}, {"key": "return_date", "label": "Return date", "type": "date", "required": false}, {"key": "destination_country", "label": "Destination", "type": "text", "required": false}]'::jsonb,'A readable reference does not prove a live or paid reservation.');
insert into public.visa_field_profiles(id,name,document_types,fields,notes) values('translation','Sworn translation',array['Sworn translation'],'[{"key": "full_name", "label": "Subject full name", "type": "text", "required": false}, {"key": "id_number", "label": "Translated ID number", "type": "text", "required": false}, {"key": "passport_number", "label": "Translated passport number", "type": "text", "required": false}, {"key": "date_of_birth", "label": "Translated date of birth", "type": "date", "required": false}, {"key": "issue_date", "label": "Translated issue date", "type": "date", "required": false}, {"key": "translator_name", "label": "Translator full name", "type": "text", "required": true}, {"key": "source_language", "label": "Source language", "type": "text", "required": true}, {"key": "target_language", "label": "Target language", "type": "text", "required": true}, {"key": "translator_signature", "label": "Signature visible (yes/no/unclear)", "type": "text", "required": true}, {"key": "translator_stamp", "label": "Stamp / seal visible (yes/no/unclear)", "type": "text", "required": false}, {"key": "certification_statement", "label": "Certification declaration", "type": "text", "required": true}]'::jsonb,'AI comparison is advisory; a person must verify translation accuracy and sworn-translator credentials.');
insert into public.visa_field_profiles(id,name,document_types,fields,notes) values('photo','Passport photograph',array['Passport photo','Passport Photo'],'[{"key": "plain_white_background", "label": "Plain white background (yes/no/unclear)", "type": "text", "required": false}, {"key": "single_person", "label": "Single person visible (yes/no/unclear)", "type": "text", "required": false}, {"key": "front_facing", "label": "Front-facing photograph (yes/no/unclear)", "type": "text", "required": false}]'::jsonb,'Image dimensions and file size are measured separately. No identity or face matching is performed.');
insert into public.visa_field_profiles(id,name,document_types,fields,notes) values('general','General / source document',array['Original document','Completed document','Other','Visa'],'[{"key": "full_name", "label": "Full name", "type": "text", "required": false}, {"key": "id_number", "label": "ID number", "type": "text", "required": false}, {"key": "passport_number", "label": "Passport number", "type": "text", "required": false}, {"key": "date_of_birth", "label": "Date of birth", "type": "date", "required": false}, {"key": "issue_date", "label": "Issue date", "type": "date", "required": false}, {"key": "expiry_date", "label": "Expiry date", "type": "date", "required": false}, {"key": "certificate_number", "label": "Document number", "type": "text", "required": false}, {"key": "visa_category", "label": "Visa category", "type": "text", "required": false}, {"key": "sponsor_name", "label": "Sponsor / inviter", "type": "text", "required": false}]'::jsonb,'');create function sgc_private.visa_doc_reviewed(p_document uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select r.status='confirmed' and coalesce((r.flags->>'profile_version')::integer,0)=coalesce(p.version,(select version from public.visa_field_profiles where id='general'),1)
 from public.visa_documents d left join lateral(select * from public.visa_document_field_reviews where document_id=d.id order by revision desc limit 1) r on true
 left join lateral(select version from public.visa_field_profiles fp where exists(select 1 from unnest(fp.document_types) dt where sgc_private.visa_doc_key(dt)=sgc_private.visa_doc_key(d.document_type)) order by fp.id limit 1) p on true where d.id=p_document),false)
$$;
revoke all on function sgc_private.visa_doc_reviewed(uuid) from public,anon,authenticated;
create function sgc_private.visa_assert_identity_match(p_case uuid) returns void language plpgsql security definer set search_path='' as $$
 declare identity_fields jsonb;pcc_fields jsonb;matched boolean=false;begin
 select r.fields into identity_fields from public.visa_documents d join public.visa_document_field_reviews r on r.document_id=d.id where d.case_id=p_case and sgc_private.visa_doc_key(d.document_type)='identity' and sgc_private.visa_doc_reviewed(d.id) order by r.revision desc limit 1;
 select r.fields into pcc_fields from public.visa_documents d join public.visa_document_field_reviews r on r.document_id=d.id where d.case_id=p_case and sgc_private.visa_doc_key(d.document_type)='pcc' and sgc_private.visa_doc_reviewed(d.id) order by r.revision desc limit 1;
 if identity_fields is null or pcc_fields is null then raise exception 'Review and sign the identity and PCC index fields first';end if;
 if nullif(identity_fields->>'id_number','') is not null and nullif(pcc_fields->>'id_number','') is not null then
  if regexp_replace(upper(identity_fields->>'id_number'),'[^A-Z0-9]','','g')<>regexp_replace(upper(pcc_fields->>'id_number'),'[^A-Z0-9]','','g') then raise exception 'The confirmed ID number does not match the PCC. Correct the source documents or index fields';end if;matched=true;
 end if;
 if nullif(identity_fields->>'passport_number','') is not null and nullif(pcc_fields->>'passport_number','') is not null then
  if regexp_replace(upper(identity_fields->>'passport_number'),'[^A-Z0-9]','','g')<>regexp_replace(upper(pcc_fields->>'passport_number'),'[^A-Z0-9]','','g') then raise exception 'The confirmed passport number does not match the PCC';end if;matched=true;
 end if;
 if not matched then raise exception 'Record a common visible ID or passport number on the identity document and PCC before confirmation';end if;
 if nullif(identity_fields->>'date_of_birth','') is not null and nullif(pcc_fields->>'date_of_birth','') is not null and identity_fields->>'date_of_birth'<>pcc_fields->>'date_of_birth' then raise exception 'The confirmed dates of birth do not match. Dates must be YYYY-MM-DD';end if;
 end $$;
revoke all on function sgc_private.visa_assert_identity_match(uuid) from public,anon,authenticated;


create or replace function sgc_private.visa_sign_step(p_case uuid,p_action text,p_signature text,p_data jsonb default '{}'::jsonb) returns public.visa_cases language plpgsql security definer set search_path='' as $$
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
  if exists(select 1 from unnest(c.required_documents) req where not exists(select 1 from public.visa_documents d where d.case_id=c.id and sgc_private.visa_doc_key(d.document_type)=sgc_private.visa_doc_key(req) and sgc_private.visa_doc_reviewed(d.id))) then raise exception 'Complete every checklist upload and its signed index-field review before signing';end if;
  if exists(select 1 from unnest(c.required_documents) req where sgc_private.visa_doc_key(req)='pcc') then perform sgc_private.visa_assert_identity_match(c.id);end if;
  next_stage='pta_verification';perform sgc_private.visa_notify(c.id,'pta','Verify documents at Pretoria');
 elsif p_action='return_documents' then
  if c.stage not in ('pta_verification','pta_printing','ready_for_submission') or actor.role not in ('admin','pta') or length(trim(coalesce(p_data->>'reason','')))<10 then raise exception 'Pretoria must record a clear correction reason before returning the pack';end if;
  next_stage='awaiting_documents';perform sgc_private.visa_notify(c.id,'consultant','Correct the client document pack');
 elsif p_action='pta_verify' then
  if c.stage<>'pta_verification' or actor.role not in ('admin','pta') then raise exception 'Pretoria verification is required at this step';end if;
  next_stage='pta_printing';update public.visa_cases set originals_received=coalesce((p_data->>'originals_received')::boolean,false) where id=c.id;
 elsif p_action='pta_print' then
  if c.stage<>'pta_printing' or actor.role not in ('admin','pta') or coalesce((p_data->>'printed')::boolean,false) is not true then raise exception 'Pretoria must confirm that the review paperwork was printed';end if;
  next_stage='ready_for_submission';
 elsif p_action='submit' then
  if c.stage<>'ready_for_submission' or actor.role not in ('admin','pta') then raise exception 'Pretoria must sign the actual submission';end if;
  if upper(c.service)='PCC' and not c.originals_received and coalesce((p_data->>'originals_received')::boolean,false) is not true then raise exception 'Confirm physical receipt of the original fingerprints before submitting a PCC';end if;
  if nullif(p_data->>'submitted_on','') is null or (p_data->>'submitted_on')::date>(now() at time zone 'Africa/Johannesburg')::date then raise exception 'Enter the actual submission date, not a future date';end if;
  next_stage='submitted';update public.visa_cases set submitted_on=(p_data->>'submitted_on')::date,originals_received=c.originals_received or coalesce((p_data->>'originals_received')::boolean,false) where id=c.id;
 elsif p_action in ('receive_pcc','receive_document') then
  if c.stage<>'submitted' or actor.role not in ('admin','pta') then raise exception 'Pretoria must record collection after submission';end if;
  if not exists(select 1 from public.visa_documents d where d.case_id=c.id and d.document_type=case when upper(c.service)='PCC' then 'PCC certificate' else 'Completed document' end) then raise exception 'Upload the retrieved certificate or completed document to this client reference';end if;
  next_stage='consultant_confirmation';perform sgc_private.visa_notify(c.id,'consultant',case when upper(c.service)='PCC' then 'Confirm PCC retrieved' else 'Confirm document retrieved' end);
 elsif p_action='manual_saps' then
  if c.stage not in ('submitted','consultant_confirmation') or actor.role not in ('admin','manager','consultant','pta') then raise exception 'SAPS verification is unavailable at this stage';end if;
  if not exists(select 1 from public.visa_documents d where d.case_id=c.id and d.document_type='SAPS status evidence') or length(trim(coalesce(p_data->>'verification_notes','')))<10 then raise exception 'Upload SAPS status evidence and describe the matching finalised result';end if;
  update public.visa_cases set saps_status='manual_verified',saps_checked_at=now(),saps_message='Manually verified by '||actor.display_name,updated_at=now() where id=c.id;
 elsif p_action='confirm_send' then
  if c.stage<>'consultant_confirmation' or actor.role not in ('admin','manager','consultant') or (actor.role='consultant' and c.consultant_id<>actor.user_id) then raise exception 'The assigned consultant must confirm retrieval';end if;
  if upper(c.service)='PCC' and c.saps_status not in ('finalised','manual_verified') then raise exception 'Confirm a matching SAPS finalised result before sending';end if;
  if upper(c.service)='PCC' then perform sgc_private.visa_assert_identity_match(c.id);end if;
  next_stage='waybill_booking';perform sgc_private.visa_notify(c.id,'pta','Book waybill to '||c.company_id);
 elsif p_action='record_waybill' then
  if c.stage<>'waybill_booking' or actor.role not in ('admin','pta') then raise exception 'Only Pretoria can record this dispatch';end if;
  select * into dest from public.visa_companies where id=c.company_id;
  if length(trim(dest.delivery_address))<10 or length(trim(dest.delivery_contact))<2 or length(trim(dest.delivery_phone))<7 then raise exception 'Admin must add the company delivery address, contact and phone before booking';end if;
  if coalesce(p_data->>'courier','') not in ('Parcel Perfect','The Courier Guy') or length(trim(coalesce(p_data->>'waybill','')))<3 then raise exception 'Book with a courier and enter the issued waybill';end if;
  charge=coalesce((p_data->>'delivery_amount')::numeric,0);if charge<=0 or charge>100000 then raise exception 'Enter the delivery charge invoiced to this client';end if;
  next_stage='dispatched';update public.visa_cases set courier=p_data->>'courier',waybill=trim(p_data->>'waybill'),delivery_amount=charge where id=c.id;
  details=details||jsonb_build_object('delivery_destination',dest.name,'delivery_address',dest.delivery_address,'invoice_id','delivery-'||c.id);
  insert into public.visa_service_records(id,kind,brand,case_id,data) values('delivery-'||c.id,'invoice',c.company_id,c.id,jsonb_build_object('client',c.client_name,'client_reference',c.reference,'case_id',c.id,'service',c.service||' delivery · '||(p_data->>'courier'),'amount',charge,'status','Unpaid','due',(now() at time zone 'Africa/Johannesburg')::date+7,'waybill',trim(p_data->>'waybill'),'invoice_number','DEL-'||c.reference,'payment','EFT','delivery_destination',dest.name));
  perform sgc_private.visa_notify(c.id,'consultant','Document dispatched · delivery invoice created');
 elsif p_action='delivered' then
  if c.stage<>'dispatched' or actor.role not in ('admin','pta','manager') then raise exception 'Only the delivery team can confirm receipt';end if;
  if nullif(p_data->>'delivered_on','') is null or (p_data->>'delivered_on')::date>(now() at time zone 'Africa/Johannesburg')::date then raise exception 'Enter the actual delivery date';end if;
  next_stage='delivered';update public.visa_cases set delivered_on=(p_data->>'delivered_on')::date where id=c.id;perform sgc_private.visa_notify(c.id,'consultant','Delivery confirmed');
 else raise exception 'Unknown workflow action';end if;
 update public.visa_cases set stage=next_stage,updated_at=now() where id=c.id returning * into c;
 insert into public.visa_case_events(case_id,action,from_stage,to_stage,actor_id,actor_name,actor_role,signed_name,details)
 values(c.id,p_action,previous,next_stage,actor.user_id,actor.display_name,actor.role,trim(p_signature),details||jsonb_build_object('document_versions',doc_ids));
 return c;end $$;
