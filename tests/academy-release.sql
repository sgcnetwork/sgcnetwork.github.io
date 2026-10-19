-- All fixtures are rolled back by the caller.
do $$ declare buyer uuid; l1 uuid; l3 uuid; entry uuid; begin
 select p.id into buyer from public.profiles p where not exists(select 1 from public.sgc_extra_admins a where a.user_id=p.id) and not exists(select 1 from public.sgc_demo_entitlements d where d.user_id=p.id) and not exists(select 1 from public.sgc_stitch_transactions t where t.user_id=p.id and t.status='paid') and not exists(select 1 from public.memberships m where m.user_id=p.id) limit 1;
 if buyer is null then raise exception 'Unused test profile required';end if;
 perform set_config('sgc.test_user',buyer::text,true);perform set_config('request.jwt.claim.sub',buyer::text,true);
 insert into public.sgc_stitch_transactions(merchant_reference,user_id,product_id,entitlement_key,amount_zar,billing,status,paid_at) values('S-QA-'||gen_random_uuid(),buyer,'sgc-start-foundations','start',150,'once','paid',now());
 insert into public.sgc_extra_lessons(module_no,position,title,body,published,access_level) values(1,999,'QA first module','QA lesson notes',true,'build') returning id into l1;
 insert into public.sgc_extra_lessons(module_no,position,title,body,published,access_level) values(3,999,'QA third module','QA lesson notes',true,'build') returning id into l3;
 perform set_config('sgc.test_l1',l1::text,true);perform set_config('sgc.test_l3',l3::text,true);
end;$$;
set local role authenticated;
do $$ declare a jsonb;begin a:=public.sgc_academy_access();if (a->>'entry')::boolean is not true or (a->>'active')::boolean is not false then raise exception 'Entry alone unlocked Academy';end if;end;$$;
reset role;
insert into public.memberships(user_id,membership_type,status,price_zar,started_at,current_period_end) values(current_setting('sgc.test_user')::uuid,'build','active',450,now(),now()+interval '1 month');
set local role authenticated;
do $$ declare a jsonb;denied boolean:=false;begin
 a:=public.sgc_academy_access();if (a->>'modulesUnlocked')::integer<>2 or (a->>'active')::boolean is not true then raise exception 'First two modules not released';end if;
 if not public.sgc_extra_student_can_read(current_setting('sgc.test_l1')::uuid) or public.sgc_extra_student_can_read(current_setting('sgc.test_l3')::uuid) then raise exception 'Module release policy wrong';end if;
 begin insert into public.sgc_extra_responses(user_id,lesson_id,answer,completed) values(auth.uid(),current_setting('sgc.test_l1')::uuid,'Bypass',true);exception when others then denied:=true;end;
 if not denied then raise exception 'Student bypassed completion';end if;
 perform public.sgc_save_notes(current_setting('sgc.test_l1')::uuid,'Saved reflection');
 perform public.sgc_complete_quizless_lesson(current_setting('sgc.test_l1')::uuid);
 if not exists(select 1 from public.sgc_extra_responses where user_id=auth.uid() and lesson_id=current_setting('sgc.test_l1')::uuid and completed and answer='Saved reflection') then raise exception 'Completion or reflection persistence failed';end if;
end;$$;
reset role;
update public.memberships set started_at=now()-interval '1 month' where user_id=current_setting('sgc.test_user')::uuid and membership_type='build';
set local role authenticated;
do $$ begin if (public.sgc_academy_access()->>'modulesUnlocked')::integer<>4 or not public.sgc_extra_student_can_read(current_setting('sgc.test_l3')::uuid) then raise exception 'Second month release failed';end if;end;$$;
reset role;
update public.memberships set current_period_end=now()-interval '1 second' where user_id=current_setting('sgc.test_user')::uuid and membership_type='build';
set local role authenticated;
do $$ begin if (public.sgc_academy_access()->>'active')::boolean or public.sgc_extra_student_can_read(current_setting('sgc.test_l1')::uuid) then raise exception 'Expired student still has lesson access';end if;end;$$;
reset role;
select 'Entry, active subscription, monthly release, RLS, completion guard and notes persistence passed' as result;
