begin;
create table public.fpg_v74_agents(id uuid primary key,user_id uuid not null references auth.users(id),name text not null,engine_sha256 text not null,heartbeat_at timestamptz not null default now(),message text not null default '');
create table public.fpg_v74_jobs(id uuid primary key default gen_random_uuid(),scope text not null check(scope in ('sales_all','sales_month','settlement_all','settlement_month','yesterday','month','status','consol')),period text check(period is null or period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),status text not null default 'queued' check(status in ('queued','running','publishing','complete','failed','cancelled')),cancel_requested boolean not null default false,created_by uuid not null references auth.users(id),worker_id uuid references public.fpg_v74_agents(id),engine_state jsonb not null default '{}',message text not null default '',created_at timestamptz not null default now(),started_at timestamptz,heartbeat_at timestamptz,finished_at timestamptz);
create index fpg_v74_jobs_status on public.fpg_v74_jobs(status,created_at);
create table public.fpg_v74_artifacts(id uuid primary key default gen_random_uuid(),job_id uuid not null references public.fpg_v74_jobs(id),name text not null,kind text not null,sha256 text not null,size_bytes bigint not null,path text not null unique,status text not null default 'staging' check(status in ('staging','published')),metadata jsonb not null default '{}',expected_rows bigint not null default 0,created_at timestamptz not null default now());
create index fpg_v74_artifacts_jobs on public.fpg_v74_artifacts(job_id);
create table public.fpg_v74_rows(artifact_id uuid not null references public.fpg_v74_artifacts(id),sheet_no integer not null,row_no integer not null,cells jsonb not null,primary key(artifact_id,sheet_no,row_no));
create function fpg_private.v74_read() returns boolean language sql stable security invoker set search_path='' as $$ select coalesce(fpg_private.role(),'') in ('admin','controller','accountant','management') $$;
revoke all on function fpg_private.v74_read() from public,anon;grant execute on function fpg_private.v74_read() to authenticated;
do $$declare t text;begin foreach t in array array['fpg_v74_agents','fpg_v74_jobs','fpg_v74_artifacts','fpg_v74_rows'] loop
execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy fpg_v74_agents_read on public.fpg_v74_agents for select to authenticated using((select fpg_private.v74_read()));
create policy fpg_v74_jobs_read on public.fpg_v74_jobs for select to authenticated using((select fpg_private.v74_read()));
create policy fpg_v74_artifacts_read on public.fpg_v74_artifacts for select to authenticated using((select fpg_private.v74_read()) and status='published' and exists(select 1 from public.fpg_v74_jobs j where j.id=job_id and j.status='complete'));
create policy fpg_v74_rows_read on public.fpg_v74_rows for select to authenticated using((select fpg_private.v74_read()) and exists(select 1 from public.fpg_v74_artifacts a where a.id=artifact_id and a.status='published'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fpg-v74-outputs','fpg-v74-outputs',false,536870912,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','text/plain']) on conflict(id) do nothing;
create policy fpg_v74_upload on storage.objects for insert to authenticated with check(bucket_id='fpg-v74-outputs' and (select fpg_private.role()) in ('admin','controller','accountant') and exists(select 1 from public.fpg_v74_jobs j join public.fpg_v74_agents a on a.id=j.worker_id where j.id::text=(storage.foldername(name))[1] and j.status in ('running','publishing') and a.user_id=(select auth.uid())));
create policy fpg_v74_download on storage.objects for select to authenticated using(bucket_id='fpg-v74-outputs' and (select fpg_private.v74_read()) and exists(select 1 from public.fpg_v74_artifacts a where a.path=name and a.status='published'));
create function fpg_private.v74(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();role_name text:=coalesce(fpg_private.role(),'');act text:=p->>'action';j public.fpg_v74_jobs;a public.fpg_v74_artifacts;x jsonb;rid uuid;wid uuid:=nullif(p->>'worker_id','')::uuid;scope_name text;begin
if u is null or role_name not in ('admin','controller','accountant') then raise exception 'Finance execution access required';end if;
if act='agent' then
 if p->>'engine_sha256'<>'c85ee6d8d9e5e2ec472b46dbd92d03ffb371e08cf3fdbb97e4833c7b2c1f7ef1' then raise exception 'The original V74 engine hash does not match';end if;
 if exists(select 1 from public.fpg_v74_agents where id=wid and user_id<>u) then raise exception 'Worker ownership mismatch';end if;
 insert into public.fpg_v74_agents(id,user_id,name,engine_sha256,message) values(wid,u,p->>'name',p->>'engine_sha256',coalesce(p->>'message','')) on conflict(id) do update set heartbeat_at=now(),message=excluded.message;
 return jsonb_build_object('registered',true);
elsif act='queue' then
 scope_name:=p->>'scope';
 if scope_name in ('month','sales_month','settlement_month') and (p->>'period' is null or p->>'period' !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$') then raise exception 'Selected month required';end if;
 perform pg_advisory_xact_lock(7400511);
 if exists(select 1 from public.fpg_v74_jobs where scope=scope_name and period is not distinct from nullif(p->>'period','') and status in ('queued','running','publishing')) then raise exception 'This command is already queued or running';end if;
 insert into public.fpg_v74_jobs(scope,period,created_by) values(scope_name,nullif(p->>'period',''),u) returning * into j;return to_jsonb(j);
elsif act='cancel' then
 select * into j from public.fpg_v74_jobs where id=(p->>'job_id')::uuid for update;
 if not found or (j.created_by<>u and role_name<>'admin') then raise exception 'Job cancellation access denied';end if;
 if j.status not in ('queued','running','publishing') then raise exception 'Job is already finished';end if;
 update public.fpg_v74_jobs set cancel_requested=true,status=case when status='queued' then 'cancelled' else status end,message=case when status='queued' then 'Cancelled before execution' else 'Cancellation requested; waiting for the local worker' end,finished_at=case when status='queued' then now() else null end where id=j.id returning * into j;return to_jsonb(j);
end if;
if not exists(select 1 from public.fpg_v74_agents where id=wid and user_id=u and engine_sha256='c85ee6d8d9e5e2ec472b46dbd92d03ffb371e08cf3fdbb97e4833c7b2c1f7ef1') then raise exception 'Register the original V74 worker first';end if;
if act='claim' then
 perform pg_advisory_xact_lock(7400511);
 if exists(select 1 from public.fpg_v74_jobs where status in ('running','publishing')) then return null;end if;
 select * into j from public.fpg_v74_jobs where status='queued' order by created_at for update skip locked limit 1;if not found then return null;end if;
 update public.fpg_v74_jobs set status='running',worker_id=wid,started_at=now(),heartbeat_at=now(),message='Starting the unchanged V74 Python command' where id=j.id returning * into j;return to_jsonb(j);
end if;
select * into j from public.fpg_v74_jobs where id=(p->>'job_id')::uuid for update;
if not found or j.worker_id<>wid or j.status not in ('running','publishing') then raise exception 'Worker does not own an active job';end if;
if act='progress' then
 update public.fpg_v74_agents set heartbeat_at=now(),message=left(coalesce(p->>'message','Running V74'),2000) where id=wid;
 update public.fpg_v74_jobs set heartbeat_at=now(),engine_state=coalesce(p->'engine_state',engine_state),message=left(coalesce(p->>'message',message),2000) where id=j.id returning * into j;return to_jsonb(j);
elsif act='artifact' then
 if j.cancel_requested then raise exception 'Cancellation requested';end if;
 if p->>'sha256' !~ '^[a-f0-9]{64}$' or (p->>'size_bytes')::bigint not between 1 and 536870912 or length(coalesce(p->>'name',''))=0 then raise exception 'Invalid original output manifest';end if;
 rid:=gen_random_uuid();insert into public.fpg_v74_artifacts(id,job_id,name,kind,sha256,size_bytes,path) values(rid,j.id,p->>'name',p->>'kind',p->>'sha256',(p->>'size_bytes')::bigint,j.id||'/'||rid||'/'||regexp_replace(p->>'name','[^A-Za-z0-9._-]','_','g')) returning * into a;
 update public.fpg_v74_jobs set status='publishing',heartbeat_at=now() where id=j.id;return to_jsonb(a);
elsif act in ('rows','publish_artifact') then
 select * into a from public.fpg_v74_artifacts where id=(p->>'artifact_id')::uuid and job_id=j.id for update;if not found or a.status<>'staging' then raise exception 'Staging output not found';end if;
 if j.cancel_requested then raise exception 'Cancellation requested';end if;
 if act='rows' then
  if jsonb_array_length(p->'rows') not between 1 and 200 then raise exception 'Send 1–200 original sheet rows';end if;
  for x in select * from jsonb_array_elements(p->'rows') loop
   insert into public.fpg_v74_rows values(a.id,(x->>'sheet_no')::integer,(x->>'row_no')::integer,x->'cells');
  end loop;return jsonb_build_object('saved',true);
 end if;
 if p->>'expected_rows' is null or (p->>'expected_rows')::bigint<0 or jsonb_typeof(p->'metadata') is distinct from 'object' then raise exception 'Original row count and sheet metadata required';end if;
 if not exists(select 1 from storage.objects where bucket_id='fpg-v74-outputs' and name=a.path) then raise exception 'Original output file upload missing';end if;
 if (select count(*) from public.fpg_v74_rows where artifact_id=a.id)<>(p->>'expected_rows')::bigint then raise exception 'Original sheet row count mismatch';end if;
 update public.fpg_v74_artifacts set status='published',metadata=p->'metadata',expected_rows=(p->>'expected_rows')::bigint where id=a.id;return jsonb_build_object('published',true);
elsif act='finish' then
 if p->>'status' not in ('complete','failed','cancelled') then raise exception 'Invalid terminal state';end if;
 if p->>'status'='complete' then
  if j.cancel_requested or (p->'engine_state'->>'STATE') is distinct from 'COMPLETE' or (p->>'exit_code')::integer is distinct from 0 then raise exception 'Original Python must complete successfully before publication';end if;
  if not exists(select 1 from public.fpg_v74_artifacts where job_id=j.id and status='published') or exists(select 1 from public.fpg_v74_artifacts where job_id=j.id and status<>'published') then raise exception 'Output publication is incomplete';end if;
 end if;
 update public.fpg_v74_jobs set status=p->>'status',engine_state=coalesce(p->'engine_state',engine_state),message=left(coalesce(p->>'message',''),2000),finished_at=now(),heartbeat_at=now() where id=j.id returning * into j;return to_jsonb(j);
end if;
raise exception 'Unknown V74 control action';end $$;
revoke all on function fpg_private.v74(jsonb) from public,anon;grant execute on function fpg_private.v74(jsonb) to authenticated;
create function public.fpg_v74(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select fpg_private.v74(p)$$;
revoke all on function public.fpg_v74(jsonb) from public,anon;grant execute on function public.fpg_v74(jsonb) to authenticated;
commit;
