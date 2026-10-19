-- Retain the existing admin report API and add the platform's live data sources.
create or replace function public.sgc_reports_read(p_source text,p_offset integer default 0,p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path='' as $$
declare allowed constant text[]:=array['sgc_bookings','payments','memberships','sgc_access_grants','lesson_progress','sgc_extra_responses','sgc_quiz_submissions','student_answers','customer_kits','sgc_academy_waitlist','academy_waitlist','sgc_meeting_recordings','sgc_stitch_transactions','sgc_website_subscriptions','sgc_builder_orders','sgc_products','sgc_studio_activity_submissions'];result jsonb;
begin
 if auth.uid() is null or not public.sgc_extra_is_admin() then raise exception 'Admin access required';end if;
 if p_source is null or not(p_source=any(allowed)) then raise exception 'Report source not allowed';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>200 then raise exception 'Invalid pagination';end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from (select * from public.%I order by 1 limit $1 offset $2)t',p_source) into result using p_limit,p_offset;
 return coalesce(result,'[]'::jsonb);
end;$$;
revoke all on function public.sgc_reports_read(text,integer,integer) from public,anon;
grant execute on function public.sgc_reports_read(text,integer,integer) to authenticated;
