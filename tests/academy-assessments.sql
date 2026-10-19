-- Run after academy-release.sql within the same rolled-back transaction.
update public.memberships set current_period_end=now()+interval '1 month' where user_id=current_setting('sgc.test_user')::uuid and membership_type='build';
do $$ declare activity uuid; reviewer uuid;begin
 insert into public.sgc_studio_academy_activities(title,lesson_id,instructions,maximum_points) values('QA Practical',current_setting('sgc.test_l1')::uuid,'Apply what you learned',10) returning id into activity;
 perform set_config('sgc.test_activity',activity::text,true);select user_id into reviewer from public.sgc_extra_admins limit 1;if reviewer is null then raise exception 'An existing administrator is required for the review test';end if;perform set_config('sgc.test_reviewer',reviewer::text,true);
end;$$;
select set_config('request.jwt.claim.sub',current_setting('sgc.test_user'),true);
set local role authenticated;
do $$ declare denied boolean:=false;begin
 perform public.sgc_submit_activity(current_setting('sgc.test_activity')::uuid,'My practical implementation');
 if not exists(select 1 from public.sgc_studio_activity_submissions where activity_id=current_setting('sgc.test_activity')::uuid and user_id=auth.uid() and review_status='submitted') then raise exception 'Submission not saved';end if;
 begin update public.sgc_studio_activity_submissions set points=10 where activity_id=current_setting('sgc.test_activity')::uuid;exception when others then denied:=true;end;if not denied then raise exception 'Student changed own grade';end if;
 denied:=false;begin perform public.sgc_review_activity(current_setting('sgc.test_activity')::uuid,auth.uid(),'reviewed','Fake review',10);exception when others then denied:=true;end;if not denied then raise exception 'Student invoked admin review';end if;
 denied:=false;begin perform public.sgc_submit_activity(current_setting('sgc.test_activity')::uuid,'My work','someone-else/private.pdf','Wrong attachment');exception when others then denied:=true;end;if not denied then raise exception 'Foreign attachment was accepted';end if;
end;$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('sgc.test_reviewer'),true);
set local role authenticated;
select public.sgc_review_activity(current_setting('sgc.test_activity')::uuid,current_setting('sgc.test_user')::uuid,'reviewed','Good implementation',7);
reset role;
select set_config('request.jwt.claim.sub',current_setting('sgc.test_user'),true);
set local role authenticated;
do $$begin if not exists(select 1 from public.sgc_studio_activity_submissions where activity_id=current_setting('sgc.test_activity')::uuid and feedback='Good implementation' and points=7 and review_status='reviewed') then raise exception 'Student cannot see saved feedback';end if;perform public.sgc_submit_activity(current_setting('sgc.test_activity')::uuid,'My revised practical implementation');if not exists(select 1 from public.sgc_studio_activity_submissions where activity_id=current_setting('sgc.test_activity')::uuid and feedback is null and points is null and review_status='submitted') then raise exception 'Resubmission retained old grade';end if;end;$$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin if exists(select 1 from public.sgc_studio_activity_submissions where activity_id=current_setting('sgc.test_activity')::uuid) then raise exception 'Another student saw a private submission';end if;end;$$;
reset role;
select 'Practical submission, grade protection, review, resubmission and owner privacy passed' as result;
