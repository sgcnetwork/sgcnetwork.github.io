create or replace function fpg_private.v74_recon_preview(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.fpg_v74_source_records;a public.fpg_v74_artifacts;sheet jsonb;tn text;prefix text;first_row integer;last_row integer;begin
if auth.uid() is null or not coalesce(fpg_private.v74_read(),false) then raise exception 'Finance access required';end if;
select * into r from public.fpg_v74_source_records where id=(p->>'record_id')::uuid and exists(select 1 from public.fpg_v74_source_snapshots s where s.id=snapshot_id and s.status='published');if not found then raise exception 'Source record not found';end if;
tn:=case when upper(r.tender) in ('CARD','MANUAL CARD') then 'CARD' else upper(r.tender) end;
select aa.* into a from public.fpg_v74_artifacts aa join public.fpg_v74_jobs j on j.id=aa.job_id where aa.kind='daily_recon' and aa.status='published' and j.status='complete' and (j.period=to_char(r.trade_date,'YYYY-MM') or j.scope='yesterday') and exists(select 1 from jsonb_array_elements(aa.metadata->'sheets') sh where upper(sh->>'name')=tn||' RECON BREAKDOWN') order by aa.created_at desc limit 1;
if not found then raise exception 'No original V74 recon workbook is published for this tender and month. Build the daily recon first; source records remain available.';end if;
select sh into sheet from jsonb_array_elements(a.metadata->'sheets') sh where upper(sh->>'name')=tn||' RECON BREAKDOWN';
prefix:=r.seg||' / '||to_char(r.trade_date,'DD/MM/YYYY')||' / SALES vs SETT VARIANCE:';
select rr.row_no into first_row from public.fpg_v74_rows rr where rr.artifact_id=a.id and rr.sheet_no=(sheet->>'index')::integer and exists(select 1 from jsonb_array_elements(rr.cells) c where c->>'c'='1' and left(c->>'v',length(prefix))=prefix) order by row_no limit 1;
if first_row is null then raise exception 'The original V74 workbook has no variance breakdown for this store, date and tender. View its source records or original CONSOL sheets.';end if;
select rr.row_no-1 into last_row from public.fpg_v74_rows rr where rr.artifact_id=a.id and rr.sheet_no=(sheet->>'index')::integer and rr.row_no>first_row and exists(select 1 from jsonb_array_elements(rr.cells) c where c->>'c'='1' and c->>'v' like '% / % / SALES vs SETT VARIANCE:%') order by row_no limit 1;
return jsonb_build_object('artifact_id',a.id,'sheet_no',(sheet->>'index')::integer,'start',first_row,'end',coalesce(last_row,(sheet->>'max_row')::integer),'label',r.seg||' · '||r.trade_date||' · '||tn,'published_at',a.created_at);
end $$;
revoke all on function fpg_private.v74_recon_preview(jsonb) from public,anon;grant execute on function fpg_private.v74_recon_preview(jsonb) to authenticated;
create function public.fpg_v74_recon_preview(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select fpg_private.v74_recon_preview(p)$$;
revoke all on function public.fpg_v74_recon_preview(jsonb) from public,anon;grant execute on function public.fpg_v74_recon_preview(jsonb) to authenticated;
