-- Additive objects only. No changes to existing SGC tables or policies.
create table if not exists public.sgc_extra_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.sgc_extra_members(user_id uuid primary key references auth.users(id) on delete cascade,joined_at date not null default current_date,active boolean not null default false);
create table if not exists public.sgc_extra_lessons(id uuid primary key default gen_random_uuid(),module_no int not null check(module_no between 1 and 12),position int not null check(position>0),title text not null,body text not null,prompt text not null default '',published boolean not null default false);
create table if not exists public.sgc_extra_resources(id uuid primary key default gen_random_uuid(),lesson_id uuid not null references public.sgc_extra_lessons(id) on delete cascade,title text not null,path text not null unique,kind text not null check(kind in ('video','download','admin')));
create table if not exists public.sgc_extra_responses(user_id uuid not null references auth.users(id) on delete cascade,lesson_id uuid not null references public.sgc_extra_lessons(id) on delete cascade,answer text not null,completed boolean not null default false,updated_at timestamptz not null default now(),primary key(user_id,lesson_id));
create or replace function public.sgc_extra_is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.sgc_extra_admins where user_id=auth.uid()) $$;
create or replace function public.sgc_extra_can_read(lesson uuid) returns boolean language sql stable security definer set search_path=public as $$
select public.sgc_extra_is_admin() or exists(
select 1 from public.sgc_extra_lessons l join public.sgc_extra_members m on m.user_id=auth.uid()
where l.id=lesson and l.published and m.active and m.joined_at<=current_date
and l.module_no <= least(12,2*(1+greatest(0,extract(year from age(current_date,m.joined_at))::int*12+extract(month from age(current_date,m.joined_at))::int)))) $$;
revoke all on function public.sgc_extra_is_admin() from public;
revoke all on function public.sgc_extra_can_read(uuid) from public;
grant execute on function public.sgc_extra_is_admin(), public.sgc_extra_can_read(uuid) to authenticated;
alter table public.sgc_extra_admins enable row level security;
alter table public.sgc_extra_members enable row level security;
alter table public.sgc_extra_lessons enable row level security;
alter table public.sgc_extra_resources enable row level security;
alter table public.sgc_extra_responses enable row level security;
-- Drop/recreate policies on these new tables only, for repeatable installation.
drop policy if exists sgc_extra_admin_read on public.sgc_extra_admins;
create policy sgc_extra_admin_read on public.sgc_extra_admins for select to authenticated using(user_id=auth.uid());
drop policy if exists sgc_extra_members_read on public.sgc_extra_members;
create policy sgc_extra_members_read on public.sgc_extra_members for select to authenticated using(user_id=auth.uid() or public.sgc_extra_is_admin());
drop policy if exists sgc_extra_members_write on public.sgc_extra_members;
create policy sgc_extra_members_write on public.sgc_extra_members for all to authenticated using(public.sgc_extra_is_admin()) with check(public.sgc_extra_is_admin());
drop policy if exists sgc_extra_lessons_read on public.sgc_extra_lessons;
create policy sgc_extra_lessons_read on public.sgc_extra_lessons for select to authenticated using(public.sgc_extra_can_read(id));
drop policy if exists sgc_extra_lessons_write on public.sgc_extra_lessons;
create policy sgc_extra_lessons_write on public.sgc_extra_lessons for all to authenticated using(public.sgc_extra_is_admin()) with check(public.sgc_extra_is_admin());
drop policy if exists sgc_extra_resources_read on public.sgc_extra_resources;
create policy sgc_extra_resources_read on public.sgc_extra_resources for select to authenticated using(public.sgc_extra_is_admin() or (kind<>'admin' and public.sgc_extra_can_read(lesson_id)));
drop policy if exists sgc_extra_resources_write on public.sgc_extra_resources;
create policy sgc_extra_resources_write on public.sgc_extra_resources for all to authenticated using(public.sgc_extra_is_admin()) with check(public.sgc_extra_is_admin());
drop policy if exists sgc_extra_responses_read on public.sgc_extra_responses;
create policy sgc_extra_responses_read on public.sgc_extra_responses for select to authenticated using(public.sgc_extra_is_admin() or (user_id=auth.uid() and public.sgc_extra_can_read(lesson_id)));
drop policy if exists sgc_extra_responses_write on public.sgc_extra_responses;
create policy sgc_extra_responses_write on public.sgc_extra_responses for all to authenticated using(public.sgc_extra_is_admin() or (user_id=auth.uid() and public.sgc_extra_can_read(lesson_id))) with check(public.sgc_extra_is_admin() or (user_id=auth.uid() and public.sgc_extra_can_read(lesson_id)));
grant select on public.sgc_extra_admins to authenticated;
grant select,insert,update,delete on public.sgc_extra_members,public.sgc_extra_lessons,public.sgc_extra_resources,public.sgc_extra_responses to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('sgc-academy-extra','sgc-academy-extra',false,52428800,array['application/pdf','video/mp4']) on conflict(id) do nothing;
drop policy if exists sgc_extra_storage_read on storage.objects;
create policy sgc_extra_storage_read on storage.objects for select to authenticated using(bucket_id='sgc-academy-extra' and (public.sgc_extra_is_admin() or exists(select 1 from public.sgc_extra_resources r where r.path=name and r.kind<>'admin' and public.sgc_extra_can_read(r.lesson_id))));
drop policy if exists sgc_extra_storage_insert on storage.objects;
create policy sgc_extra_storage_insert on storage.objects for insert to authenticated with check(bucket_id='sgc-academy-extra' and public.sgc_extra_is_admin());
drop policy if exists sgc_extra_storage_delete on storage.objects;
create policy sgc_extra_storage_delete on storage.objects for delete to authenticated using(bucket_id='sgc-academy-extra' and public.sgc_extra_is_admin());
