create table public.sgc_community_members (
user_id uuid not null references auth.users(id) on delete cascade,
group_id uuid not null references public.sgc_groups(id) on delete cascade,
joined_at timestamptz not null default now(),
primary key(user_id,group_id));
alter table public.sgc_community_members enable row level security;
grant select,insert on public.sgc_community_members to authenticated;
create policy community_members_read on public.sgc_community_members for select to authenticated using ((select auth.uid())=user_id);
create policy community_members_join on public.sgc_community_members for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.sgc_groups g where g.id=group_id and g.active));
create or replace function public.sgc_group_allowed(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and (public.sgc_extra_is_admin() or exists(select 1 from public.sgc_groups g join public.sgc_community_members m on m.group_id=g.id where g.id=p_group and g.active and m.user_id=auth.uid()));
$$;
create or replace function public.sgc_community_spaces() returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('joined',exists(select 1 from public.sgc_community_members m where m.group_id=g.id and m.user_id=auth.uid())) order by g.name),'[]'::jsonb) from public.sgc_groups g where g.active and auth.uid() is not null;
$$;
create or replace function public.sgc_join_community(p_group uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
if auth.uid() is null then raise exception 'Sign in required'; end if;
if not exists(select 1 from public.sgc_groups where id=p_group and active) then raise exception 'Community unavailable'; end if;
insert into public.sgc_community_members(user_id,group_id) values(auth.uid(),p_group) on conflict do nothing;
return jsonb_build_object('joined',true);
end;$$;
revoke all on function public.sgc_community_spaces(),public.sgc_join_community(uuid) from public,anon;
grant execute on function public.sgc_community_spaces(),public.sgc_join_community(uuid) to authenticated;

revoke all on public.sgc_community_members from anon,authenticated;
grant select on public.sgc_community_members to authenticated;
drop policy community_members_join on public.sgc_community_members;
