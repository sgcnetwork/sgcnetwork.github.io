-- Connect existing practical activities to student submissions and administrator reviews.
alter table public.sgc_studio_academy_activities add column if not exists active boolean not null default true;
create table if not exists public.sgc_studio_activity_submissions (
 activity_id uuid not null references public.sgc_studio_academy_activities(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 answer text not null default '', attachment_path text, attachment_name text,
 submitted_at timestamptz not null default now(), review_status text not null default 'submitted' check(review_status in ('submitted','reviewed','revision_requested')),
 feedback text, points integer check(points>=0), reviewed_at timestamptz,
 primary key(activity_id,user_id)
);
create index if not exists sgc_activity_submissions_user on public.sgc_studio_activity_submissions(user_id,submitted_at desc);
alter table public.sgc_studio_activity_submissions enable row level security;
revoke all on public.sgc_studio_activity_submissions from public,anon,authenticated;
grant select on public.sgc_studio_activity_submissions to authenticated;
grant insert(activity_id,user_id,answer,attachment_path,attachment_name),update(answer,attachment_path,attachment_name) on public.sgc_studio_activity_submissions to authenticated;
grant all on public.sgc_studio_activity_submissions to service_role;
create policy activity_submissions_read on public.sgc_studio_activity_submissions for select to authenticated using(user_id=(select auth.uid()) or public.sgc_extra_is_admin());
create policy activity_submissions_insert on public.sgc_studio_activity_submissions for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.sgc_studio_academy_activities a where a.id=activity_id and a.active and public.sgc_extra_student_can_read(a.lesson_id)));
create policy activity_submissions_update on public.sgc_studio_activity_submissions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.sgc_studio_academy_activities a where a.id=activity_id and a.active and public.sgc_extra_student_can_read(a.lesson_id)));
create policy academy_activities_student_read on public.sgc_studio_academy_activities for select to authenticated using(public.sgc_extra_is_admin() or (active and public.sgc_extra_student_can_read(lesson_id)));
create policy academy_activities_admin_manage on public.sgc_studio_academy_activities for all to authenticated using(public.sgc_extra_is_admin()) with check(public.sgc_extra_is_admin());

create or replace function sgc_private.prepare_activity_submission()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.sgc_extra_is_admin() then
  if length(trim(new.answer))<10 and nullif(new.attachment_path,'') is null then raise exception 'Write at least 10 characters or attach your work';end if;
  if length(new.answer)>50000 then raise exception 'Keep your submission below 50000 characters';end if;
  if nullif(new.attachment_path,'') is not null then
   if split_part(new.attachment_path,'/',1) is distinct from auth.uid()::text or split_part(new.attachment_path,'/',2) is distinct from new.activity_id::text or not exists(select 1 from storage.objects where bucket_id='sgc-academy-submissions' and name=new.attachment_path) then raise exception 'Upload your own assessment file first';end if;
  end if;
  new.submitted_at:=now();new.review_status:='submitted';new.feedback:=null;new.points:=null;new.reviewed_at:=null;
 end if;
 return new;
end;$$;
revoke all on function sgc_private.prepare_activity_submission() from public,anon,authenticated;
create trigger sgc_prepare_activity_submission before insert or update on public.sgc_studio_activity_submissions for each row execute function sgc_private.prepare_activity_submission();

create or replace function public.sgc_submit_activity(p_activity uuid,p_answer text,p_attachment_path text default null,p_attachment_name text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to submit your work';end if;
 insert into public.sgc_studio_activity_submissions(activity_id,user_id,answer,attachment_path,attachment_name) values(p_activity,auth.uid(),coalesce(p_answer,''),nullif(p_attachment_path,''),left(p_attachment_name,200))
 on conflict(activity_id,user_id) do update set answer=excluded.answer,attachment_path=excluded.attachment_path,attachment_name=excluded.attachment_name;
end;$$;
revoke all on function public.sgc_submit_activity(uuid,text,text,text) from public,anon;
grant execute on function public.sgc_submit_activity(uuid,text,text,text) to authenticated;

create or replace function sgc_private.review_activity(p_activity uuid,p_user uuid,p_status text,p_feedback text,p_points integer)
returns void language plpgsql security definer set search_path='' as $$
declare maximum integer;
begin
 if auth.uid() is null or not public.sgc_extra_is_admin() then raise exception 'Administrator access required';end if;
 if p_status not in ('reviewed','revision_requested') or length(coalesce(p_feedback,''))>10000 then raise exception 'Choose a valid review status and feedback';end if;
 select maximum_points into maximum from public.sgc_studio_academy_activities where id=p_activity;
 if p_points is not null and (p_points<0 or p_points>coalesce(maximum,100)) then raise exception 'Points must be within the assessment maximum';end if;
 update public.sgc_studio_activity_submissions set review_status=p_status,feedback=p_feedback,points=p_points,reviewed_at=now() where activity_id=p_activity and user_id=p_user;
 if not found then raise exception 'Submission not found';end if;
end;$$;
revoke all on function sgc_private.review_activity(uuid,uuid,text,text,integer) from public,anon;
grant execute on function sgc_private.review_activity(uuid,uuid,text,text,integer) to authenticated;
create or replace function public.sgc_review_activity(p_activity uuid,p_user uuid,p_status text,p_feedback text,p_points integer default null)
returns void language sql security invoker set search_path='' as $$select sgc_private.review_activity(p_activity,p_user,p_status,p_feedback,p_points);$$;
revoke all on function public.sgc_review_activity(uuid,uuid,text,text,integer) from public,anon;
grant execute on function public.sgc_review_activity(uuid,uuid,text,text,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sgc-academy-submissions','sgc-academy-submissions',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg','application/zip','application/x-zip-compressed']) on conflict(id) do nothing;
create policy academy_submission_upload on storage.objects for insert to authenticated with check(bucket_id='sgc-academy-submissions' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.sgc_studio_academy_activities a where a.id::text=(storage.foldername(name))[2] and a.active and public.sgc_extra_student_can_read(a.lesson_id)));
create policy academy_submission_read on storage.objects for select to authenticated using(bucket_id='sgc-academy-submissions' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.sgc_extra_is_admin()));
create policy academy_submission_admin_delete on storage.objects for delete to authenticated using(bucket_id='sgc-academy-submissions' and public.sgc_extra_is_admin());
