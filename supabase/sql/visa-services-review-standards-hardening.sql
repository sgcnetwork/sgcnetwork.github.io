create or replace function sgc_private.visa_review_document(p_document uuid,p_fields jsonb,p_status text,p_signature text,p_notes text,p_flags jsonb default '{}',p_extraction uuid default null) returns public.visa_document_field_reviews language plpgsql security definer set search_path='' as $$
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
 if p_flags->>'source_document_id' is not null and not exists(select 1 from public.visa_documents source where source.id::text=p_flags->>'source_document_id' and source.case_id=d.case_id and source.id<>d.id) then raise exception 'The source document must belong to this same client reference';end if;
 if p_status='confirmed' and sgc_private.visa_doc_key(d.document_type)='sworntranslation' and nullif(p_flags->>'source_document_id','') is null then raise exception 'Link the original document before confirming a translation';end if;
 if p_status='confirmed' and coalesce((p_flags->>'all_pages_reviewed')::boolean,false) is not true then raise exception 'Confirm review of every original page';end if;
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

create or replace function sgc_private.visa_save_template(p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
 declare docs text[];begin
 if not sgc_private.visa_is_admin() then raise exception 'Administrator access required';end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(p_data->'sources','[]')) u where u !~ '^https://') then raise exception 'Source links must use HTTPS';end if;
 select array_agg(trim(value)) into docs from jsonb_array_elements_text(p_data->'required_documents') where length(trim(value)) between 1 and 80;
 if coalesce(cardinality(docs),0) not between 1 and 25 then raise exception 'A checklist needs between 1 and 25 items';end if;
 insert into public.visa_checklist_templates(id,name,service,country,visa_type,required_documents,notes,sources) values(p_data->>'id',left(p_data->>'name',150),p_data->>'service',left(coalesce(p_data->>'country',''),100),left(coalesce(p_data->>'visa_type',''),100),docs,left(coalesce(p_data->>'notes',''),3000),array(select jsonb_array_elements_text(coalesce(p_data->'sources','[]'))))
 on conflict(id) do update set name=excluded.name,service=excluded.service,sources=excluded.sources,country=excluded.country,visa_type=excluded.visa_type,required_documents=excluded.required_documents,notes=excluded.notes,version=public.visa_checklist_templates.version+1,updated_at=now();
 insert into sgc_private.visa_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'checklist_template_saved',p_data->>'id',jsonb_build_object('required_documents',docs));end $$;

create or replace function sgc_private.visa_save_field_profile(p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
 declare f jsonb;begin
 if not sgc_private.visa_is_admin() then raise exception 'Administrator access required';end if;
 if jsonb_typeof(p_data->'fields')<>'array' or jsonb_array_length(p_data->'fields') not between 1 and 50 then raise exception 'Choose 1 to 50 fields';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'fields') x group by x->>'key' having count(*)>1) then raise exception 'Field keys must be unique';end if;
 for f in select value from jsonb_array_elements(p_data->'fields') loop if coalesce(f->>'key','') !~ '^[a-z][a-z0-9_]{0,49}$' or coalesce(f->>'type','') not in ('text','date') or length(coalesce(f->>'label','')) not between 1 and 120 then raise exception 'Invalid field definition';end if;end loop;
 update public.visa_field_profiles set name=left(p_data->>'name',150),version=version+1,fields=p_data->'fields',notes=left(coalesce(p_data->>'notes',''),3000),updated_at=now() where id=p_data->>'id';
 insert into sgc_private.visa_admin_audit(actor_id,action,target_id,details) values(auth.uid(),'index_fields_updated',p_data->>'id',jsonb_build_object('field_count',jsonb_array_length(p_data->'fields')));end $$;
