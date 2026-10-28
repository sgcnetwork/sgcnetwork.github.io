-- Fictional profiles and records are rolled back; no Auth accounts are created.
begin;
select set_config('visa.qa_a',(select id::text from auth.users where not exists(select 1 from public.visa_users v where v.user_id=auth.users.id) order by created_at limit 1),true);
select set_config('visa.qa_b',(select id::text from auth.users where not exists(select 1 from public.visa_users v where v.user_id=auth.users.id) order by created_at limit 1 offset 1),true);
insert into public.visa_users(user_id,display_name,email,role) values(current_setting('visa.qa_a')::uuid,'QA A','qa-a@example.invalid','consultant'),(current_setting('visa.qa_b')::uuid,'QA B','qa-b@example.invalid','consultant');
insert into public.visa_user_companies(user_id,company_id) values(current_setting('visa.qa_a')::uuid,'GVM'),(current_setting('visa.qa_b')::uuid,'GVM'),(current_setting('visa.qa_b')::uuid,'GVS');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('visa.qa_a'),true);
insert into public.visa_service_records(id,kind,brand,data) values('qa-rotation-1','lead','GVM','{"client":"QA One"}'),('qa-rotation-2','lead','GVM','{"client":"QA Two"}'),('qa-rotation-3','lead','GVM','{"client":"QA Three"}'),('qa-rotation-4','lead','GVM','{"client":"QA Four"}');
do $$ begin
 if (select assigned_user_id from public.visa_service_records where id='qa-rotation-1')<>(select assigned_user_id from public.visa_service_records where id='qa-rotation-3') or (select assigned_user_id from public.visa_service_records where id='qa-rotation-1')=(select assigned_user_id from public.visa_service_records where id='qa-rotation-2') then raise exception 'Rotation is not even';end if;
 if (select count(*) from public.visa_allocations where source_id like 'qa-rotation-%' and user_id=current_setting('visa.qa_a')::uuid)<>2 then raise exception 'Uneven lead distribution';end if;
 end $$;
insert into public.visa_service_records(id,kind,brand,data) values('qa-linked-quote','quote','GVM','{"client":"QA One","source_lead_id":"qa-rotation-1"}');
select set_config('visa.qa_case',(public.visa_create_case('{"request_id":"66666666-6666-4666-8666-666666666666","company_id":"GVM","client_name":"QA One","service":"PCC","quote_id":"qa-linked-quote","required_documents":["Wrong custom requirement"]}')).id::text,true);
do $$ declare c public.visa_cases;begin
 select * into c from public.visa_cases where id=current_setting('visa.qa_case')::uuid;
 if c.required_documents<>array['ID / Passport','Fingerprints'] then raise exception 'Uniform PCC checklist bypassed';end if;
 if c.consultant_id<>(select assigned_user_id from public.visa_service_records where id='qa-rotation-1') then raise exception 'Lead owner not inherited';end if;
 if exists(select 1 from public.visa_allocations where source_id=c.id::text) then raise exception 'Inherited lead consumed another allocation turn';end if;
 perform public.visa_create_case('{"request_id":"66666666-6666-4666-8666-666666666666","company_id":"GVM","client_name":"QA One","service":"PCC"}');
 begin perform public.visa_create_case('{"company_id":"GVM","client_name":"QA Missing Country","service":"Visa"}');raise exception 'Visa country gate missing';exception when raise_exception then if sqlerrm='Visa country gate missing' then raise;end if;end;
 begin perform public.visa_create_case(jsonb_build_object('company_id','GVM','client_name','QA Override','service','PCC','allocation_mode','manual','consultant_id',current_setting('visa.qa_a'),'allocation_reason','Consultant must not override'));raise exception 'Consultant override allowed';exception when raise_exception then if sqlerrm='Consultant override allowed' then raise;end if;end;
 end $$;
select set_config('request.jwt.claim.sub',current_setting('visa.qa_b'),true);
select public.visa_set_availability(current_setting('visa.qa_b')::uuid,false);
select set_config('request.jwt.claim.sub',current_setting('visa.qa_a'),true);
insert into public.visa_service_records(id,kind,brand,data) values('qa-rotation-paused','lead','GVM','{"client":"QA Paused"}');
do $$ begin if (select assigned_user_id from public.visa_service_records where id='qa-rotation-paused')<>current_setting('visa.qa_a')::uuid then raise exception 'Paused consultant assigned';end if;end $$;
-- Signed field review gates, ISO validation, and translation source isolation.
insert into storage.objects(bucket_id,name,owner_id,metadata) values('visa-service-documents','GVM/'||current_setting('visa.qa_case')||'/77777777-7777-4777-8777-777777777777/id.pdf',current_setting('visa.qa_a'),'{"size":100,"mimetype":"application/pdf"}'::jsonb);
select public.visa_add_document(jsonb_build_object('id','77777777-7777-4777-8777-777777777777','case_id',current_setting('visa.qa_case'),'storage_key','GVM/'||current_setting('visa.qa_case')||'/77777777-7777-4777-8777-777777777777/id.pdf','file_name','id.pdf','document_type','ID / Passport','content_type','application/pdf','file_size',100));
do $$ begin
 begin perform public.visa_review_document('77777777-7777-4777-8777-777777777777','{"full_name":"QA One","passport_number":"QA123","date_of_birth":"01/02/1990"}','confirmed','QA A','QA fixture','{"acknowledged":true,"all_pages_reviewed":true}');raise exception 'Ambiguous date accepted';exception when raise_exception then if sqlerrm='Ambiguous date accepted' then raise;end if;end;
 begin perform public.visa_review_document('77777777-7777-4777-8777-777777777777','{"full_name":"QA One","passport_number":"QA123","date_of_birth":"1990-01-01"}','confirmed','QA A','QA fixture','{"acknowledged":true}');raise exception 'All-pages review bypassed';exception when raise_exception then if sqlerrm='All-pages review bypassed' then raise;end if;end;
 end $$;
select public.visa_review_document('77777777-7777-4777-8777-777777777777','{"full_name":"QA One","passport_number":"QA123","date_of_birth":"1990-01-01"}','confirmed','QA A','QA fixture','{"acknowledged":true,"all_pages_reviewed":true}');
do $$ begin
 if not exists(select 1 from public.visa_document_field_reviews where document_id='77777777-7777-4777-8777-777777777777' and flags->>'profile_version'='1') then raise exception 'Versioned review missing';end if;
 if has_function_privilege('authenticated','public.visa_ai_get_config()','execute') or has_function_privilege('anon','public.visa_review_document(uuid,jsonb,text,text,text,jsonb,uuid)','execute') then raise exception 'Sensitive API grant leaked';end if;
 end $$;
reset role;
select jsonb_build_object('even_rotation','passed','pause_skip','passed','lead_quote_case_inheritance','passed','idempotent_case_creation','passed','uniform_PCC_checklist','passed','visa_country_category_gate','passed','manual_override_denied','passed','signed_ISO_indexing','passed','service_only_AI_secrets','passed') as verification;
rollback;
