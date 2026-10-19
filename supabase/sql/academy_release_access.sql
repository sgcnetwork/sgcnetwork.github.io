-- One authenticated access summary drives the dashboard and the lesson policies.
create or replace function sgc_private.academy_access_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare joined timestamptz; expires timestamptz; today date:=timezone('Africa/Johannesburg',now())::date; start_date date; months integer; unlocked integer; demo boolean;
begin
 if auth.uid() is null then return jsonb_build_object('entry',false,'active',false,'modulesUnlocked',0,'demo',false);end if;
 demo:=public.sgc_extra_is_demo() or public.sgc_extra_is_admin();
 if demo then return jsonb_build_object('entry',true,'active',true,'modulesUnlocked',12,'demo',true);end if;
 if not public.sgc_start_purchased() or exists(select 1 from public.sgc_extra_members where user_id=auth.uid() and not active) then return jsonb_build_object('entry',public.sgc_start_purchased(),'active',false,'modulesUnlocked',0,'demo',false);end if;
 select min(s.started_at),case when bool_or(s.ends_at is null) then null else max(s.ends_at) end into joined,expires from (
  select m.started_at,m.current_period_end as ends_at from public.memberships m
  where m.user_id=auth.uid() and m.membership_type::text='build' and m.status::text='active' and m.started_at<=now() and (m.current_period_end is null or m.current_period_end>now())
  union all
  select g.starts_at,g.ends_at from public.sgc_access_grants g where g.user_id=auth.uid() and g.active and g.starts_at<=now() and (g.ends_at is null or g.ends_at>now()) and g.access_level in ('build','feature:recorded_lessons','feature:business_classes')
 ) s;
 if joined is null then return jsonb_build_object('entry',true,'active',false,'modulesUnlocked',0,'demo',false);end if;
 start_date:=timezone('Africa/Johannesburg',joined)::date;
 months:=(extract(year from today)::integer-extract(year from start_date)::integer)*12+extract(month from today)::integer-extract(month from start_date)::integer;
 if start_date+make_interval(months=>months)>today then months:=months-1;end if;
 unlocked:=least(12,2*(1+greatest(0,months)));
 return jsonb_build_object('entry',true,'active',true,'modulesUnlocked',unlocked,'demo',false,'startedAt',joined,'expiresAt',expires,'nextUnlockAt',case when unlocked<12 then start_date+make_interval(months=>greatest(0,months)+1) else null end);
end;$$;
revoke all on function sgc_private.academy_access_summary() from public,anon;
grant usage on schema sgc_private to authenticated;
grant execute on function sgc_private.academy_access_summary() to authenticated,service_role;
create or replace function public.sgc_academy_access() returns jsonb language sql stable security invoker set search_path='' as $$select sgc_private.academy_access_summary();$$;
revoke all on function public.sgc_academy_access() from public,anon;
grant execute on function public.sgc_academy_access() to authenticated,service_role;

-- Preserve the existing privileged policy helper, limiting it to the caller's access.
create or replace function public.sgc_extra_student_can_read(lesson uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.sgc_extra_lessons l where l.id=lesson and l.published and public.sgc_start_purchased()
  and (public.sgc_extra_is_demo() or public.sgc_extra_is_admin() or (
   public.sgc_extra_has_product(l.access_level)
   and not exists(select 1 from public.sgc_extra_members m where m.user_id=auth.uid() and not m.active)
   and (l.access_level like 'kit:%' or ((public.sgc_academy_access()->>'active')::boolean and l.module_no<=(public.sgc_academy_access()->>'modulesUnlocked')::integer))
   and not (l.module_no=any(public.sgc_academy_locked_modules()))
  ))
 );
$$;
revoke all on function public.sgc_extra_student_can_read(uuid) from public,anon;
grant execute on function public.sgc_extra_student_can_read(uuid) to authenticated,service_role;

-- Only the existing verified quiz/completion RPCs or an administrator may change completion.
create or replace function sgc_private.guard_lesson_completion()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('anon','authenticated') and not public.sgc_extra_is_admin() then
  if (tg_op='INSERT' and new.completed) or (tg_op='UPDATE' and new.completed is distinct from old.completed) then raise exception 'Complete the lesson through its quiz or completion action';end if;
 end if;
 return new;
end;$$;
revoke all on function sgc_private.guard_lesson_completion() from public,anon,authenticated;
create or replace trigger sgc_guard_lesson_completion before insert or update on public.sgc_extra_responses for each row execute function sgc_private.guard_lesson_completion();
