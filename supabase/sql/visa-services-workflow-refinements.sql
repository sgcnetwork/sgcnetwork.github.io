create or replace function sgc_private.visa_notify(p_case uuid,p_target text,p_title text) returns void language plpgsql security definer set search_path='' as $$
 declare c public.visa_cases; begin
 select * into c from public.visa_cases where id=p_case;
 insert into public.visa_notifications(user_id,case_id,title,body)
 select u.user_id,c.id,p_title,c.reference||' · '||co.name from public.visa_users u cross join public.visa_companies co
 where co.id=c.company_id and u.active and (u.role='admin' or
 (p_target='consultant' and u.user_id=c.consultant_id and exists(select 1 from public.visa_user_companies m where m.user_id=u.user_id and m.company_id=c.company_id)) or
 (p_target='pta' and u.role='pta' and exists(select 1 from public.visa_user_companies m where m.user_id=u.user_id and m.company_id=c.company_id)));
 end $$;

create or replace function public.visa_sign_step(p_case uuid,p_action text,p_signature text,p_data jsonb default '{}'::jsonb) returns public.visa_cases language plpgsql security definer set search_path='' as $$
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

create or replace function sgc_private.visa_schedule_saps_checks() returns void language plpgsql security definer set search_path='' as $$
 declare c record;secret_token text;jid uuid;begin
 for c in select id from public.visa_cases where stage in ('submitted','consultant_confirmation') and saps_reference is not null and saps_identity is not null and saps_status not in ('finalised','manual_verified') and (saps_checked_at is null or saps_checked_at<now()-interval '5 hours') order by saps_checked_at nulls first,created_at limit 80 loop
  if not exists(select 1 from sgc_private.visa_saps_jobs where case_id=c.id and created_at>now()-interval '5 hours') then
   secret_token=encode(extensions.gen_random_bytes(32),'hex');
   insert into sgc_private.visa_saps_jobs(case_id,token_hash) values(c.id,encode(extensions.digest(secret_token,'sha256'),'hex')) returning id into jid;
   perform net.http_post(url:='https://bxpexanyoyubxeqqlggh.supabase.co/functions/v1/visa-operations',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('action','scheduled_saps','job_id',jid,'job_token',secret_token),timeout_milliseconds:=30000);
  end if;
 end loop;
 delete from sgc_private.visa_saps_jobs where created_at<now()-interval '7 days';
 end $$;

-- Revoked companies also disappear from the user's notification inbox.
drop policy visa_notifications_read on public.visa_notifications;
create policy visa_notifications_read on public.visa_notifications for select to authenticated using(user_id=(select auth.uid()) and sgc_private.visa_case_access(case_id,array['manager','consultant','pta','viewer']));
drop policy visa_orphan_files_delete on storage.objects;
create policy visa_orphan_files_delete on storage.objects for delete to authenticated using(bucket_id='visa-service-documents' and owner_id=(select auth.uid())::text and sgc_private.visa_access((storage.foldername(name))[1],array['manager','consultant','pta']) and not exists(select 1 from public.visa_documents d where d.storage_key=name));
