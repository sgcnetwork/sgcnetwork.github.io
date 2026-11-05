begin;
insert into auth.users(id,email) values('22220000-0000-4000-8000-000000000002','qa-fpg-other-admin@example.invalid');
insert into public.fpg_members(user_id,role,display_name) values('22220000-0000-4000-8000-000000000002','admin','QA other admin');
select set_config('request.jwt.claim.sub','df627f92-e256-47eb-8a92-590ee9cf7d59',true),set_config('request.jwt.claims','{"sub":"df627f92-e256-47eb-8a92-590ee9cf7d59","role":"authenticated"}',true);
set local role authenticated;
select public.fpg_v74('{"action":"agent","worker_id":"22220000-0000-4000-8000-000000000001","name":"QA source worker","bridge_version":"2","engine_sha256":"c85ee6d8d9e5e2ec472b46dbd92d03ffb371e08cf3fdbb97e4833c7b2c1f7ef1"}');
reset role;
insert into public.fpg_v74_jobs(id,scope,period,status,created_by,worker_id) values('22220000-0000-4000-8000-000000000003','source_sync','2026-11','running','df627f92-e256-47eb-8a92-590ee9cf7d59','22220000-0000-4000-8000-000000000001');
set local role authenticated;
do $$declare s jsonb;r jsonb;blocked boolean:=false;begin
s:=public.fpg_v74_data('{"action":"begin","job_id":"22220000-0000-4000-8000-000000000003","worker_id":"22220000-0000-4000-8000-000000000001","manifest":{"engine_sha256":"c85ee6d8d9e5e2ec472b46dbd92d03ffb371e08cf3fdbb97e4833c7b2c1f7ef1","period":"2026-11","sales_rows":1,"settlement_rows":1}}');perform set_config('fpg.qa_snapshot',s->>'id',true);
if exists(select 1 from public.fpg_v74_source_snapshots where id=(s->>'id')::uuid) then raise exception 'Staging data is visible';end if;
begin perform public.fpg_v74_data(jsonb_build_object('action','publish','job_id','22220000-0000-4000-8000-000000000003','worker_id','22220000-0000-4000-8000-000000000001','snapshot_id',s->>'id'));exception when others then blocked:=sqlerrm='Source counts do not match the SQL extraction';end;if not blocked then raise exception 'Incomplete source snapshot was allowed';end if;
perform public.fpg_v74_data(jsonb_build_object('action','rows','job_id','22220000-0000-4000-8000-000000000003','worker_id','22220000-0000-4000-8000-000000000001','snapshot_id',s->>'id','kind','sales','rows','[{"row_no":1,"payload":{"SEG":"__QA_SOURCE","ReconDate":"2026-11-03","Amount":"49.90","FinalTender":"KIOSK","ReceiptNumber":"REC-123","_StoreName":"QA source store"}}]'::jsonb));
perform public.fpg_v74_data(jsonb_build_object('action','rows','job_id','22220000-0000-4000-8000-000000000003','worker_id','22220000-0000-4000-8000-000000000001','snapshot_id',s->>'id','kind','settlements','rows','[{"row_no":1,"payload":{"SEG":"__QA_SOURCE","ReconDate":"2026-11-03","Amount":"49.90","FinalTender":"KIOSK","TerminalNo":"000123","_StoreName":"QA source store"}}]'::jsonb));
perform public.fpg_v74_data(jsonb_build_object('action','publish','job_id','22220000-0000-4000-8000-000000000003','worker_id','22220000-0000-4000-8000-000000000001','snapshot_id',s->>'id'));
r:=public.fpg_v74_data(jsonb_build_object('action','query','snapshot_id',s->>'id','kind','settlements','search','000123'));if (r->>'filtered')::integer<>1 or r->'rows'->0->'payload'->>'Amount'<>'49.90' then raise exception 'Original source search / amount changed';end if;
perform set_config('fpg.qa_record',r->'rows'->0->>'id',true);
end $$;
reset role;
select set_config('request.jwt.claim.sub','22220000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"22220000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$declare blocked boolean:=false;r jsonb;begin
if exists(select 1 from public.fpg_v74_jobs) then raise exception 'Non-owner can read Python control jobs';end if;
begin perform public.fpg_v74('{"action":"queue","scope":"status"}');exception when others then blocked:=sqlerrm='Python controls are restricted to netsgcwork@gmail.com';end;if not blocked then raise exception 'Non-owner admin can execute Python';end if;
r:=public.fpg_v74_data(jsonb_build_object('action','query','snapshot_id',current_setting('fpg.qa_snapshot'),'kind','settlements','search','000123'));if (r->>'filtered')::integer<>1 then raise exception 'Read-only Finance data access failed';end if;
r:=public.fpg_v74_data(jsonb_build_object('action','note','record_id',current_setting('fpg.qa_record'),'state','Escalated','category','Settlement query','note','QA terminal reference requires investigation','assigned_to','QA Controller'));if jsonb_array_length(r->'notes')<>1 then raise exception 'Source investigation audit not saved';end if;
r:=public.fpg_v74_data('{"action":"queue"}');if not exists(select 1 from jsonb_array_elements(r->'rows') row where row->>'record_id'=current_setting('fpg.qa_record')) then raise exception 'Source review absent from controller queue';end if;
end $$;
reset role;
insert into public.fpg_v74_jobs(id,scope,period,status,created_by) values('22220000-0000-4000-8000-000000000004','month','2026-11','complete','df627f92-e256-47eb-8a92-590ee9cf7d59');
insert into public.fpg_v74_artifacts(id,job_id,name,kind,sha256,size_bytes,path,status,metadata) values('22220000-0000-4000-8000-000000000005','22220000-0000-4000-8000-000000000004','QA-Recon.xlsx','daily_recon',repeat('a',64),10,'QA/QA-Recon.xlsx','published','{"sheets":[{"index":0,"name":"KIOSK RECON BREAKDOWN","max_row":4}]}');
insert into public.fpg_v74_rows(artifact_id,sheet_no,row_no,cells) values
('22220000-0000-4000-8000-000000000005',0,1,'[{"c":1,"v":"__QA_SOURCE / 03/11/2026 / SALES vs SETT VARIANCE: 0.00","t":"s","s":0}]'),
('22220000-0000-4000-8000-000000000005',0,2,'[{"c":21,"v":"-49.9","t":"n","s":0}]'),
('22220000-0000-4000-8000-000000000005',0,3,'[{"c":38,"v":"VOUCHER","t":"s","s":0}]'),
('22220000-0000-4000-8000-000000000005',0,4,'[{"c":1,"v":"OTHER / 03/11/2026 / SALES vs SETT VARIANCE: 10.00","t":"s","s":0}]');
set local role authenticated;
do $$declare p jsonb;begin
p:=public.fpg_v74_recon_preview(jsonb_build_object('record_id',current_setting('fpg.qa_record')));
if (p->>'start')::integer<>1 or (p->>'end')::integer<>3 then raise exception 'Original store-day preview range mismatch';end if;
if not exists(select 1 from public.fpg_v74_artifacts where id='22220000-0000-4000-8000-000000000005') then raise exception 'Non-owner Finance reader cannot preview original outputs';end if;
end $$;
reset role;select 'PASS: owner-only Python controls, non-owner Finance data browsing, immutable original amounts, terminal search, staged count checks and investigation audit' result;rollback;
