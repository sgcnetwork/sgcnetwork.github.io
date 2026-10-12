create or replace function public.sgc_start_purchased() returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and (public.sgc_extra_is_admin() or public.sgc_extra_is_demo() or exists(
select 1 from public.sgc_stitch_transactions t left join public.sgc_products p on p.id::text=t.product_id
where t.user_id=auth.uid() and t.status='paid' and t.paid_at is not null
and t.billing='once' and t.amount_zar>=150
and (t.product_id='start' or p.access_level='start')));
$$;
revoke all on function public.sgc_start_purchased() from public,anon;
grant execute on function public.sgc_start_purchased() to authenticated,service_role;
CREATE OR REPLACE FUNCTION public.sgc_extra_student_can_read(lesson uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM public.sgc_extra_lessons l
  WHERE l.id=lesson AND l.published AND public.sgc_start_purchased()
  AND (
   public.sgc_extra_is_demo()
   OR (
    (public.sgc_extra_has_product(l.access_level) OR (l.access_level IN ('start','build') AND public.sgc_start_purchased()))
    AND NOT EXISTS(
     SELECT 1 FROM public.sgc_extra_members x
     WHERE x.user_id=auth.uid() AND NOT x.active
    )
    AND (
     l.access_level LIKE 'kit:%'
     OR l.module_no<=LEAST(
      12,
      2*(1+COALESCE((
       SELECT max(GREATEST(
        0,
        extract(year FROM age(current_date,d.start_date))::int*12+
        extract(month FROM age(current_date,d.start_date))::int
       ))
       FROM (
        SELECT COALESCE(
         (SELECT joined_at FROM public.sgc_extra_members WHERE user_id=auth.uid()),
         m.started_at::date
        ) start_date
        FROM public.memberships m
        WHERE m.user_id=auth.uid()
        AND m.status::text='active'
        AND m.started_at<=now()
        AND (m.current_period_end IS NULL OR m.current_period_end>now())
        AND (
         (l.access_level='start' AND m.membership_type::text IN('start','build'))
         OR (l.access_level='build' AND m.membership_type::text='build')
         OR (
          l.access_level LIKE 'feature:%'
          AND public.sgc_feature_allowed(substr(l.access_level,9))
         )
        )
        UNION ALL
        SELECT COALESCE(
         (SELECT joined_at FROM public.sgc_extra_members WHERE user_id=auth.uid()),
         g.starts_at::date
        )
        FROM public.sgc_access_grants g
        WHERE g.user_id=auth.uid()
        AND g.active
        AND g.starts_at<=now()
        AND (g.ends_at IS NULL OR g.ends_at>now())
        AND (
         (g.access_level=l.access_level OR (l.access_level='build' AND g.access_level='feature:recorded_lessons') OR (l.access_level='start' AND g.access_level='feature:business_classes'))
         OR (l.access_level='start' AND g.access_level='build')
         OR (l.access_level LIKE 'feature:%' AND g.access_level IN('start','build'))
        )
       UNION ALL
 SELECT t.paid_at::date FROM public.sgc_stitch_transactions t
 LEFT JOIN public.sgc_products p ON p.id::text=t.product_id
 WHERE t.user_id=auth.uid() AND t.status='paid' AND t.billing='once' AND t.amount_zar>=150
 AND (t.product_id='start' OR p.access_level='start')
 AND l.access_level IN ('start','build')
 ) d
      ),0))
     )
    )
   )
  )
 );
$function$;

CREATE OR REPLACE FUNCTION public.sgc_extra_course_can_read(course uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.sgc_extra_is_admin()
    or exists (
      select 1
      from public.courses c
      where c.id = course
        and c.status::text = 'published' and public.sgc_start_purchased()
        and (
          public.sgc_extra_is_demo()
          or exists (
            select 1
            from public.memberships m
            where m.user_id = auth.uid()
              and m.status::text = 'active'
              and m.started_at <= now()
              and (
                m.current_period_end is null
                or m.current_period_end > now()
              )
              and (
                (
                  c.membership_required::text = 'start'
                  and m.membership_type::text in ('start', 'build')
                )
                or (
                  c.membership_required::text = 'build'
                  and m.membership_type::text = 'build'
                )
              )
              and greatest(
                1,
                coalesce(c.unlock_month, 1)
              ) <= 1 + greatest(
                0,
                extract(
                  year from age(current_date, m.started_at::date)
                )::int * 12
                + extract(
                  month from age(current_date, m.started_at::date)
                )::int
              )
          )
        )
    )
$function$;
;