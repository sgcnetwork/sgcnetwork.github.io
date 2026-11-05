begin;
alter table public.fpg_v74_agents add column bridge_version text not null default '1';
alter table public.fpg_v74_jobs drop constraint fpg_v74_jobs_scope_check;
alter table public.fpg_v74_jobs add constraint fpg_v74_jobs_scope_check check(scope in ('sales_all','sales_month','settlement_all','settlement_month','yesterday','month','status','consol','source_sync'));
create function fpg_private.v74_job_complete(jid uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and fpg_private.v74_read() and exists(select 1 from public.fpg_v74_jobs where id=jid and status='complete')$$;
revoke all on function fpg_private.v74_job_complete(uuid) from public,anon;grant execute on function fpg_private.v74_job_complete(uuid) to authenticated;
drop policy fpg_v74_artifacts_read on public.fpg_v74_artifacts;
create policy fpg_v74_artifacts_read on public.fpg_v74_artifacts for select to authenticated using((select fpg_private.v74_read()) and status='published' and fpg_private.v74_job_complete(job_id));
create table public.fpg_v74_source_snapshots(id uuid primary key default gen_random_uuid(),job_id uuid not null references public.fpg_v74_jobs(id),period text,status text not null default 'staging' check(status in ('staging','published')),manifest jsonb not null default '{}',sales_rows bigint not null default 0,settlement_rows bigint not null default 0,created_at timestamptz not null default now(),published_at timestamptz);
create index fpg_v74_source_snapshots_jobs on public.fpg_v74_source_snapshots(job_id);
create table public.fpg_v74_source_records(id uuid primary key default gen_random_uuid(),snapshot_id uuid not null references public.fpg_v74_source_snapshots(id),kind text not null check(kind in ('sales','settlements')),row_no bigint not null,trade_date date,seg text,store_name text,tender text,terminal_no text,reference text,amount numeric(38,10),payload jsonb not null,unique(snapshot_id,kind,row_no));
create index fpg_v74_source_lookup on public.fpg_v74_source_records(snapshot_id,kind,seg,trade_date,tender,row_no);
create index fpg_v74_source_paging on public.fpg_v74_source_records(snapshot_id,kind,row_no);
create table public.fpg_v74_record_notes(id uuid primary key default gen_random_uuid(),record_id uuid not null references public.fpg_v74_source_records(id),actor uuid not null references auth.users(id),state text not null check(state in ('Open','Investigating','Escalated','Review closed')),category text not null,note text not null,assigned_to text,due_date date,created_at timestamptz not null default now());
create index fpg_v74_record_notes_record on public.fpg_v74_record_notes(record_id,created_at);
do $$declare t text;begin foreach t in array array['fpg_v74_source_snapshots','fpg_v74_source_records','fpg_v74_record_notes'] loop
execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy fpg_v74_source_snapshots_read on public.fpg_v74_source_snapshots for select to authenticated using((select fpg_private.v74_read()) and status='published');
create policy fpg_v74_source_records_read on public.fpg_v74_source_records for select to authenticated using((select fpg_private.v74_read()) and exists(select 1 from public.fpg_v74_source_snapshots s where s.id=snapshot_id and s.status='published'));
create policy fpg_v74_record_notes_read on public.fpg_v74_record_notes for select to authenticated using((select fpg_private.v74_read()) and exists(select 1 from public.fpg_v74_source_records r where r.id=record_id));
create function fpg_private.v74_data(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare act text:=p->>'action';u uuid:=auth.uid();wid uuid:=nullif(p->>'worker_id','')::uuid;j public.fpg_v74_jobs;s public.fpg_v74_source_snapshots;r public.fpg_v74_source_records;items jsonb;n bigint;total bigint;filtered bigint;start_row integer:=greatest(0,coalesce((p->>'offset')::integer,0));search_term text:=coalesce(p->>'search','');note_id uuid;k text:=coalesce(p->>'kind','sales');begin
if u is null or not coalesce(fpg_private.v74_read(),false) then raise exception 'Finance data access required';end if;
if act='queue' then
 with latest as (select distinct on(record_id) * from public.fpg_v74_record_notes order by record_id,created_at desc,id desc) select coalesce(jsonb_agg(to_jsonb(q)),'[]') into items from (select noteq.*,rec.kind,rec.seg,rec.store_name,rec.trade_date,rec.tender,rec.reference,rec.payload->>'Amount' source_amount from latest noteq join public.fpg_v74_source_records rec on rec.id=noteq.record_id join public.fpg_v74_source_snapshots snap on snap.id=rec.snapshot_id where snap.status='published' and noteq.state<>'Review closed' order by noteq.due_date nulls last,noteq.created_at desc limit 100 offset start_row) q;
 return jsonb_build_object('rows',items,'offset',start_row);
elsif act='query' then
 select * into s from public.fpg_v74_source_snapshots where id=(p->>'snapshot_id')::uuid and status='published';if not found then raise exception 'Published source snapshot not found';end if;
 if k not in ('sales','settlements') then raise exception 'Choose sales or settlements';end if;
 select count(*) into total from public.fpg_v74_source_records where snapshot_id=s.id and kind=k;
 select count(*) into filtered from public.fpg_v74_source_records where snapshot_id=s.id and kind=k and (nullif(p->>'seg','') is null or seg=p->>'seg') and (nullif(p->>'date','') is null or trade_date=(p->>'date')::date) and (nullif(p->>'tender','') is null or tender=p->>'tender') and (search_term='' or payload::text ilike '%'||search_term||'%');
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into items from (select * from public.fpg_v74_source_records where snapshot_id=s.id and kind=k and (nullif(p->>'seg','') is null or seg=p->>'seg') and (nullif(p->>'date','') is null or trade_date=(p->>'date')::date) and (nullif(p->>'tender','') is null or tender=p->>'tender') and (search_term='' or payload::text ilike '%'||search_term||'%') order by row_no limit 100 offset start_row) t;
 return jsonb_build_object('rows',items,'total',total,'filtered',filtered,'offset',start_row);
elsif act in ('record','note') then
 select * into r from public.fpg_v74_source_records where id=(p->>'record_id')::uuid and exists(select 1 from public.fpg_v74_source_snapshots snapcheck where snapcheck.id=snapshot_id and snapcheck.status='published');if not found then raise exception 'Source record not found';end if;
 if act='note' then
  if coalesce(fpg_private.role(),'') not in ('admin','controller','accountant') then raise exception 'Controller write access required';end if;
  if length(trim(coalesce(p->>'note','')))<5 or length(trim(coalesce(p->>'category','')))=0 then raise exception 'Investigation category and note required';end if;
  if p->>'state'='Escalated' and length(trim(coalesce(p->>'assigned_to','')))=0 then raise exception 'Escalation owner required';end if;
  insert into public.fpg_v74_record_notes(record_id,actor,state,category,note,assigned_to,due_date) values(r.id,u,p->>'state',p->>'category',p->>'note',nullif(p->>'assigned_to',''),nullif(p->>'due_date','')::date) returning id into note_id;
  insert into public.fpg_notifications(store,audience,title,body,dedupe) values(case when exists(select 1 from public.fpg_stores where code=r.seg) then r.seg else null end,'controller','SQL source investigation · '||(p->>'state'),coalesce(r.store_name,r.seg,'Unmapped store')||' · Assigned: '||coalesce(nullif(p->>'assigned_to',''),'Unassigned')||' · Due: '||coalesce(p->>'due_date','—')||' · '||(p->>'note'),'sql-source-note:'||note_id); 
 end if;
 select coalesce(jsonb_agg(to_jsonb(ev) order by ev.created_at desc),'[]') into items from public.fpg_v74_record_notes ev where ev.record_id=r.id;
 return jsonb_build_object('record',to_jsonb(r),'notes',items);
end if;
if not coalesce(fpg_private.v74_owner(),false) then raise exception 'Source sync is restricted to netsgcwork@gmail.com';end if;
select * into j from public.fpg_v74_jobs where id=(p->>'job_id')::uuid and worker_id=wid and status in ('running','publishing') for update;
if not found or not exists(select 1 from public.fpg_v74_agents where id=wid and user_id=u) then raise exception 'Source worker ownership required';end if;
if j.cancel_requested then raise exception 'Source sync cancelled';end if;
if act='begin' then
 if (p->'manifest'->>'engine_sha256') is distinct from 'c85ee6d8d9e5e2ec472b46dbd92d03ffb371e08cf3fdbb97e4833c7b2c1f7ef1' then raise exception 'Original engine fingerprint required';end if;
 insert into public.fpg_v74_source_snapshots(job_id,period,manifest) values(j.id,p->'manifest'->>'period',p->'manifest') returning * into s;return to_jsonb(s);
end if;
select * into s from public.fpg_v74_source_snapshots where id=(p->>'snapshot_id')::uuid and job_id=j.id and status='staging' for update;if not found then raise exception 'Staging source snapshot required';end if;
if act='rows' then
 if k not in ('sales','settlements') or jsonb_typeof(p->'rows') is distinct from 'array' or jsonb_array_length(p->'rows') not between 1 and 1000 then raise exception 'Send 1–1000 original source rows';end if;
 insert into public.fpg_v74_source_records(snapshot_id,kind,row_no,trade_date,seg,store_name,tender,terminal_no,reference,amount,payload)
 select s.id,k,(x->>'row_no')::bigint,nullif(x->'payload'->>'ReconDate','')::date,x->'payload'->>'SEG',coalesce(nullif(x->'payload'->>'_StoreName',''),x->'payload'->>'SourceStore',x->'payload'->>'SEG'),x->'payload'->>'FinalTender',coalesce(nullif(x->'payload'->>'TerminalNo',''),x->'payload'->>'MerchantNo'),coalesce(nullif(x->'payload'->>'ReceiptNumber',''),x->'payload'->>'Reference',x->'payload'->>'RowHash'),nullif(x->'payload'->>'Amount','')::numeric,x->'payload' from jsonb_array_elements(p->'rows') x;
 update public.fpg_v74_jobs set heartbeat_at=now() where id=j.id;update public.fpg_v74_agents set heartbeat_at=now() where id=wid;
 return jsonb_build_object('saved',jsonb_array_length(p->'rows'));
elsif act='publish' then
 select count(*) into n from public.fpg_v74_source_records where snapshot_id=s.id and kind='sales';select count(*) into total from public.fpg_v74_source_records where snapshot_id=s.id and kind='settlements';
 if (s.manifest->>'sales_rows')::bigint is distinct from n or (s.manifest->>'settlement_rows')::bigint is distinct from total then raise exception 'Source counts do not match the SQL extraction';end if;
 update public.fpg_v74_source_snapshots set status='published',sales_rows=n,settlement_rows=total,published_at=now() where id=s.id;
 insert into public.fpg_stores(code,name) select seg,min(store_name) from public.fpg_v74_source_records where snapshot_id=s.id and nullif(trim(seg),'') is not null and nullif(trim(store_name),'') is not null group by seg on conflict(code) do update set name=excluded.name;
 return jsonb_build_object('published',true,'sales_rows',n,'settlement_rows',total);
end if;raise exception 'Unknown source action';end $$;
revoke all on function fpg_private.v74_data(jsonb) from public,anon;grant execute on function fpg_private.v74_data(jsonb) to authenticated;
create function public.fpg_v74_data(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select fpg_private.v74_data(p)$$;
revoke all on function public.fpg_v74_data(jsonb) from public,anon;grant execute on function public.fpg_v74_data(jsonb) to authenticated;
do $$declare d text;begin
select pg_get_functiondef('fpg_private.v74(jsonb)'::regprocedure) into d;
d:=replace(d,'engine_sha256,message) values(wid,u,p->>''name'',p->>''engine_sha256'',coalesce(p->>''message'',''''))','engine_sha256,message,bridge_version) values(wid,u,p->>''name'',p->>''engine_sha256'',coalesce(p->>''message'',''''),coalesce(p->>''bridge_version'',''1''))');
d:=replace(d,'heartbeat_at=now(),message=excluded.message;','heartbeat_at=now(),message=excluded.message,bridge_version=excluded.bridge_version;');
d:=replace(d,'scope_name:=p->>''scope'';','scope_name:=p->>''scope'';'||E'\n if scope_name=''source_sync'' and not exists(select 1 from public.fpg_v74_agents where user_id=u and bridge_version=''2'' and heartbeat_at>now()-interval ''60 seconds'') then raise exception ''Start the updated Windows bridge to pull SQL records'';end if;');
d:=replace(d,'if not exists(select 1 from public.fpg_v74_artifacts where job_id=j.id and status=''published'') or exists(select 1 from public.fpg_v74_artifacts where job_id=j.id and status<>''published'') then raise exception ''Output publication is incomplete'';end if;', 'if j.scope=''source_sync'' then if not exists(select 1 from public.fpg_v74_source_snapshots where job_id=j.id and status=''published'') then raise exception ''SQL source publication is incomplete'';end if;else if not exists(select 1 from public.fpg_v74_artifacts where job_id=j.id and status=''published'') or exists(select 1 from public.fpg_v74_artifacts where job_id=j.id and status<>''published'') then raise exception ''Output publication is incomplete'';end if;end if;');
execute d;end $$;
commit;
