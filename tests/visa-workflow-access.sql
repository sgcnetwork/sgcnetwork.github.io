-- End-to-end workflow and company-isolation checks. Every fixture is rolled back.
begin;
select set_config('visa.test_consultant',(select id::text from auth.users where not exists(select 1 from public.visa_users v where v.user_id=auth.users.id) order by created_at limit 1 offset 0),true);
select set_config('visa.test_pta',(select id::text from auth.users where not exists(select 1 from public.visa_users v where v.user_id=auth.users.id) order by created_at limit 1 offset 1),true);
select set_config('visa.test_other',(select id::text from auth.users where not exists(select 1 from public.visa_users v where v.user_id=auth.users.id) order by created_at limit 1 offset 2),true);
insert into public.visa_users(user_id,display_name,email,role) values
 (current_setting('visa.test_consultant')::uuid,'QA Consultant','qa-consultant@example.invalid','consultant'),
 (current_setting('visa.test_pta')::uuid,'QA Pretoria','qa-pta@example.invalid','pta'),
 (current_setting('visa.test_other')::uuid,'QA Other Company','qa-other@example.invalid','consultant');
insert into public.visa_user_companies(user_id,company_id) values
 (current_setting('visa.test_consultant')::uuid,'GVM'),(current_setting('visa.test_pta')::uuid,'GVM'),(current_setting('visa.test_other')::uuid,'GVS');
update public.visa_companies set delivery_address='1 Test Street, Pretoria, 0001',delivery_contact='QA Office',delivery_phone='0100000000' where id='GVM';
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('visa.test_consultant'),true);
select set_config('visa.test_case',(public.visa_create_case('{"company_id":"GVM","client_name":"QA Workflow Client","service":"PCC","required_documents":["ID","Fingerprints"]}')).id::text,true);
do $$ declare cid uuid=current_setting('visa.test_case')::uuid;begin
 if exists(select 1 from public.visa_companies where id='GVS') then raise exception 'Company visibility leaked';end if;
 begin perform public.visa_create_case('{"company_id":"GVS","client_name":"Forbidden Client"}');raise exception 'Cross-company creation allowed';exception when raise_exception then if sqlerrm='Cross-company creation allowed' then raise;end if;end;
 begin perform public.visa_sign_step(cid,'consultant_verify','QA Consultant','{"acknowledged":true}');raise exception 'Missing documents accepted';exception when raise_exception then if sqlerrm='Missing documents accepted' then raise;end if;end;
 begin perform public.visa_sign_step(cid,'consultant_verify','Someone Else','{"acknowledged":true}');raise exception 'Forged signature accepted';exception when raise_exception then if sqlerrm='Forged signature accepted' then raise;end if;end;
 end $$;
-- Simulate actual private object metadata; no identity files or external uploads are used.
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('visa-service-documents','GVM/'||current_setting('visa.test_case')||'/11111111-1111-4111-8111-111111111111/id.pdf',current_setting('visa.test_consultant')::uuid::text,'{"size":100,"mimetype":"application/pdf"}'),
 ('visa-service-documents','GVM/'||current_setting('visa.test_case')||'/22222222-2222-4222-8222-222222222222/fingerprints.pdf',current_setting('visa.test_consultant')::uuid::text,'{"size":100,"mimetype":"application/pdf"}');
select public.visa_add_document(jsonb_build_object('id','11111111-1111-4111-8111-111111111111','case_id',current_setting('visa.test_case'),'storage_key','GVM/'||current_setting('visa.test_case')||'/11111111-1111-4111-8111-111111111111/id.pdf','file_name','id.pdf','document_type','ID','content_type','application/pdf','file_size',100));
select public.visa_add_document(jsonb_build_object('id','22222222-2222-4222-8222-222222222222','case_id',current_setting('visa.test_case'),'storage_key','GVM/'||current_setting('visa.test_case')||'/22222222-2222-4222-8222-222222222222/fingerprints.pdf','file_name','fingerprints.pdf','document_type','Fingerprints','content_type','application/pdf','file_size',100));
do $$ begin if not exists(select 1 from public.visa_search_documents('QA Workflow Client','GVM',0)) then raise exception 'Client document search failed';end if;end $$;
select public.visa_review_document('11111111-1111-4111-8111-111111111111','{"full_name":"QA Workflow Client","id_number":"9001010000000","date_of_birth":"1990-01-01"}','confirmed','QA Consultant','QA fixture','{"acknowledged":true,"all_pages_reviewed":true}');
select public.visa_review_document('22222222-2222-4222-8222-222222222222','{}','confirmed','QA Consultant','QA fixture','{"acknowledged":true,"all_pages_reviewed":true}');
select public.visa_sign_step(current_setting('visa.test_case')::uuid,'consultant_verify','QA Consultant','{"acknowledged":true}');
select set_config('request.jwt.claim.sub',current_setting('visa.test_other'),true);
do $$ begin
 if exists(select 1 from public.visa_cases where id=current_setting('visa.test_case')::uuid) or exists(select 1 from public.visa_documents where case_id=current_setting('visa.test_case')::uuid) or exists(select 1 from storage.objects where name like 'GVM/'||current_setting('visa.test_case')||'/%') or exists(select 1 from public.visa_search_documents('QA Workflow Client',null,0)) then raise exception 'Cross-company client data leaked';end if;
 begin perform public.visa_sign_step(current_setting('visa.test_case')::uuid,'pta_verify','QA Other Company','{"acknowledged":true}');raise exception 'Cross-company signing allowed';exception when raise_exception then if sqlerrm='Cross-company signing allowed' then raise;end if;end;
 end $$;
select set_config('request.jwt.claim.sub',current_setting('visa.test_pta'),true);
do $$ begin
 if not exists(select 1 from public.visa_notifications where case_id=current_setting('visa.test_case')::uuid and title='Verify documents at Pretoria') then raise exception 'Pretoria notification missing';end if;
 end $$;
select public.visa_sign_step(current_setting('visa.test_case')::uuid,'pta_verify','QA Pretoria','{"acknowledged":true,"originals_received":false}');
select public.visa_sign_step(current_setting('visa.test_case')::uuid,'pta_print','QA Pretoria','{"acknowledged":true,"printed":true}');
do $$ begin
 begin perform public.visa_sign_step(current_setting('visa.test_case')::uuid,'submit','QA Pretoria',jsonb_build_object('acknowledged',true,'submitted_on',current_date));raise exception 'Fingerprint copies accepted for submission';exception when raise_exception then if sqlerrm='Fingerprint copies accepted for submission' then raise;end if;end;
 end $$;
select public.visa_sign_step(current_setting('visa.test_case')::uuid,'submit','QA Pretoria',jsonb_build_object('acknowledged',true,'submitted_on',current_date,'originals_received',true));
insert into storage.objects(bucket_id,name,owner_id,metadata) values('visa-service-documents','GVM/'||current_setting('visa.test_case')||'/33333333-3333-4333-8333-333333333333/pcc.pdf',current_setting('visa.test_pta')::uuid::text,'{"size":100,"mimetype":"application/pdf"}');
select public.visa_add_document(jsonb_build_object('id','33333333-3333-4333-8333-333333333333','case_id',current_setting('visa.test_case'),'storage_key','GVM/'||current_setting('visa.test_case')||'/33333333-3333-4333-8333-333333333333/pcc.pdf','file_name','pcc.pdf','document_type','PCC certificate','content_type','application/pdf','file_size',100));
select public.visa_review_document('33333333-3333-4333-8333-333333333333','{"full_name":"QA Workflow Client","id_number":"9001010000000","date_of_birth":"1990-01-01","issue_date":"2026-10-28"}','confirmed','QA Pretoria','QA fixture','{"acknowledged":true,"all_pages_reviewed":true}');
select public.visa_sign_step(current_setting('visa.test_case')::uuid,'receive_pcc','QA Pretoria','{"acknowledged":true}');
select set_config('request.jwt.claim.sub',current_setting('visa.test_consultant'),true);
do $$ begin
 if not exists(select 1 from public.visa_notifications where case_id=current_setting('visa.test_case')::uuid and title='Confirm PCC retrieved') then raise exception 'Consultant retrieval notification missing';end if;
 begin perform public.visa_sign_step(current_setting('visa.test_case')::uuid,'confirm_send','QA Consultant','{"acknowledged":true}');raise exception 'Unverified SAPS result accepted';exception when raise_exception then if sqlerrm='Unverified SAPS result accepted' then raise;end if;end;
 begin update public.visa_cases set saps_status='finalised' where id=current_setting('visa.test_case')::uuid;raise exception 'Client bypassed workflow RPC';exception when insufficient_privilege then null;end;
 end $$;
reset role;
select public.visa_record_saps_result(current_setting('visa.test_case')::uuid,'finalised','QA fixture only; no SAPS request was sent',current_date);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('visa.test_consultant'),true);
select public.visa_sign_step(current_setting('visa.test_case')::uuid,'confirm_send','QA Consultant','{"acknowledged":true}');
select set_config('request.jwt.claim.sub',current_setting('visa.test_pta'),true);
do $$ begin if not exists(select 1 from public.visa_notifications where case_id=current_setting('visa.test_case')::uuid and title='Book waybill to GVM') then raise exception 'Waybill notification missing';end if;end $$;
select public.visa_sign_step(current_setting('visa.test_case')::uuid,'record_waybill','QA Pretoria','{"acknowledged":true,"courier":"Parcel Perfect","waybill":"QA-ROLLBACK-001","delivery_amount":150}');
do $$ begin
 begin perform public.visa_sign_step(current_setting('visa.test_case')::uuid,'record_waybill','QA Pretoria','{"acknowledged":true,"courier":"Parcel Perfect","waybill":"QA-DUPLICATE","delivery_amount":150}');raise exception 'Duplicate delivery invoice allowed';exception when raise_exception then if sqlerrm='Duplicate delivery invoice allowed' then raise;end if;end;
 begin update public.visa_case_events set signed_name='Forged';raise exception 'Signature history editable';exception when insufficient_privilege then null;end;
 end $$;
reset role;
do $$ begin
 if (select count(*) from public.visa_service_records where case_id=current_setting('visa.test_case')::uuid and kind='invoice')<>1 then raise exception 'Delivery invoice is not unique';end if;
 if not exists(select 1 from public.visa_service_records where case_id=current_setting('visa.test_case')::uuid and (data->>'amount')::numeric=150 and data->>'client_reference' like 'GVM-PCC-%' and brand='GVM') then raise exception 'Delivery invoice missing client reference or charge';end if;
 update public.visa_users set active=false where user_id=current_setting('visa.test_consultant')::uuid;
 end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('visa.test_consultant'),true);
do $$ begin if exists(select 1 from public.visa_cases where id=current_setting('visa.test_case')::uuid) or exists(select 1 from public.visa_notifications) then raise exception 'Suspended account retained data access';end if;end $$;
reset role;
select jsonb_build_object('signed_workflow','passed','company_and_document_isolation','passed','original_fingerprints_gate','passed','notifications','passed','SAPS_completion_gate','passed','unique_delivery_invoice','passed','immutable_audit','passed','suspended_account_denied','passed') as verification;
rollback;
