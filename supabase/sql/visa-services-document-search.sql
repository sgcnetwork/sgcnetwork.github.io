-- Search the authorised document register on the server, including older client references.
create function public.visa_search_documents(p_query text default '',p_company text default null,p_offset integer default 0)
returns table(id uuid,case_id uuid,company_id text,file_name text,storage_key text,document_type text,content_type text,file_size integer,uploaded_by uuid,uploaded_by_name text,created_at timestamptz,client_name text,client_reference text)
language sql stable security invoker set search_path='' as $$
 select d.id,d.case_id,d.company_id,d.file_name,d.storage_key,d.document_type,d.content_type,d.file_size,d.uploaded_by,d.uploaded_by_name,d.created_at,c.client_name,c.reference
 from public.visa_documents d join public.visa_cases c on c.id=d.case_id
 where (p_company is null or d.company_id=p_company) and (coalesce(trim(p_query),'')='' or concat_ws(' ',d.file_name,d.document_type,d.company_id,c.client_name,c.reference) ilike '%'||left(p_query,200)||'%')
 order by d.created_at desc,d.id limit 60 offset greatest(0,least(coalesce(p_offset,0),100000));
$$;
revoke all on function public.visa_search_documents(text,text,integer) from public,anon;
grant execute on function public.visa_search_documents(text,text,integer) to authenticated;
