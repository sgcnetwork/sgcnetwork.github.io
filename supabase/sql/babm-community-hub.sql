
create table public.babm_community_profiles (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 display_name text not null check(char_length(trim(display_name)) between 2 and 50),
 created_at timestamptz not null default now()
);
create table public.babm_community_moderators (
 user_id uuid primary key references auth.users(id) on delete cascade
);
insert into public.babm_community_moderators(user_id) select id from auth.users where lower(email)='netsgcwork@gmail.com' on conflict do nothing;
create table public.babm_community_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(trim(name)) between 3 and 70),
 description text not null default '' check(char_length(description)<=500),
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create table public.babm_community_memberships (
 group_id uuid not null references public.babm_community_groups(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create index babm_memberships_user on public.babm_community_memberships(user_id,group_id);
create table public.babm_community_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null default auth.uid() references public.babm_community_profiles(user_id) on delete cascade,
 group_id uuid references public.babm_community_groups(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 5000),
 image_path text check(image_path is null or char_length(image_path)<=250),
 created_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index babm_posts_feed on public.babm_community_posts(created_at desc,id desc) where deleted_at is null;
create index babm_posts_group on public.babm_community_posts(group_id,created_at desc,id desc) where deleted_at is null;
create index babm_posts_author on public.babm_community_posts(author_id);
create table public.babm_community_likes (
 post_id uuid not null references public.babm_community_posts(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 primary key(post_id,user_id)
);
create index babm_likes_user on public.babm_community_likes(user_id);
create table public.babm_community_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.babm_community_posts(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.babm_community_profiles(user_id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index babm_comments_post on public.babm_community_comments(post_id,created_at) where deleted_at is null;
create index babm_comments_author on public.babm_community_comments(author_id);
create table public.babm_community_reports (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.babm_community_posts(id) on delete cascade,
 reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 reason text not null check(char_length(trim(reason)) between 3 and 1000),
 created_at timestamptz not null default now(),
 unique(post_id,reporter_id)
);
create index babm_reports_reporter on public.babm_community_reports(reporter_id);
alter table public.babm_community_profiles enable row level security;
alter table public.babm_community_moderators enable row level security;
alter table public.babm_community_groups enable row level security;
alter table public.babm_community_memberships enable row level security;
alter table public.babm_community_posts enable row level security;
alter table public.babm_community_likes enable row level security;
alter table public.babm_community_comments enable row level security;
alter table public.babm_community_reports enable row level security;
revoke all on public.babm_community_profiles,public.babm_community_moderators,public.babm_community_groups,public.babm_community_memberships,public.babm_community_posts,public.babm_community_likes,public.babm_community_comments,public.babm_community_reports from anon,authenticated;
grant select,insert on public.babm_community_profiles to authenticated;
grant update(display_name) on public.babm_community_profiles to authenticated;
grant select on public.babm_community_moderators to authenticated;
grant select,insert on public.babm_community_groups to authenticated;
grant select,insert,delete on public.babm_community_memberships to authenticated;
grant select,insert on public.babm_community_posts to authenticated;
grant update(body,deleted_at) on public.babm_community_posts to authenticated;
grant select,insert,delete on public.babm_community_likes to authenticated;
grant select,insert on public.babm_community_comments to authenticated;
grant update(body,deleted_at) on public.babm_community_comments to authenticated;
grant select,insert on public.babm_community_reports to authenticated;
create policy babm_profiles_read on public.babm_community_profiles for select to authenticated using(true);
create policy babm_profiles_create on public.babm_community_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy babm_profiles_edit on public.babm_community_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy babm_mods_self on public.babm_community_moderators for select to authenticated using(user_id=(select auth.uid()));
create policy babm_groups_read on public.babm_community_groups for select to authenticated using(true);
create policy babm_groups_create on public.babm_community_groups for insert to authenticated with check(created_by=(select auth.uid()));
create policy babm_memberships_read on public.babm_community_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy babm_memberships_join on public.babm_community_memberships for insert to authenticated with check(user_id=(select auth.uid()));
create policy babm_memberships_leave on public.babm_community_memberships for delete to authenticated using(user_id=(select auth.uid()));
create policy babm_posts_read on public.babm_community_posts for select to authenticated using(deleted_at is null);
create policy babm_posts_create on public.babm_community_posts for insert to authenticated with check(author_id=(select auth.uid()) and deleted_at is null and (image_path is null or split_part(image_path,'/',1)=(select auth.uid())::text) and (group_id is null or exists(select 1 from public.babm_community_memberships m where m.group_id=babm_community_posts.group_id and m.user_id=(select auth.uid()))));
create policy babm_posts_edit on public.babm_community_posts for update to authenticated using(author_id=(select auth.uid()) or exists(select 1 from public.babm_community_moderators m where m.user_id=(select auth.uid()))) with check(author_id=(select auth.uid()) or exists(select 1 from public.babm_community_moderators m where m.user_id=(select auth.uid())));
create policy babm_likes_read on public.babm_community_likes for select to authenticated using(exists(select 1 from public.babm_community_posts p where p.id=post_id));
create policy babm_likes_create on public.babm_community_likes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.babm_community_posts p where p.id=post_id));
create policy babm_likes_remove on public.babm_community_likes for delete to authenticated using(user_id=(select auth.uid()));
create policy babm_comments_read on public.babm_community_comments for select to authenticated using(deleted_at is null and exists(select 1 from public.babm_community_posts p where p.id=post_id));
create policy babm_comments_create on public.babm_community_comments for insert to authenticated with check(author_id=(select auth.uid()) and deleted_at is null and exists(select 1 from public.babm_community_posts p where p.id=post_id));
create policy babm_comments_edit on public.babm_community_comments for update to authenticated using(author_id=(select auth.uid()) or exists(select 1 from public.babm_community_moderators m where m.user_id=(select auth.uid()))) with check(author_id=(select auth.uid()) or exists(select 1 from public.babm_community_moderators m where m.user_id=(select auth.uid())));
create policy babm_reports_read on public.babm_community_reports for select to authenticated using(reporter_id=(select auth.uid()) or exists(select 1 from public.babm_community_moderators m where m.user_id=(select auth.uid())));
create policy babm_reports_create on public.babm_community_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and exists(select 1 from public.babm_community_posts p where p.id=post_id));
insert into public.babm_community_groups(name,description,created_by) values
 ('Quran & Reflections','Share reflections, reading goals, and questions to take to a qualified teacher.',null),
 ('Becoming a Better Muslimah','Small steps, renewed intentions, and encouragement along the way.',null),
 ('Dua & Support','A gentle space to ask for duas and offer kindness.',null),
 ('Everyday Muslimah','Faith, routines, work, and everyday life.',null);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('babm-community-images','babm-community-images',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy babm_images_read on storage.objects for select to authenticated using(bucket_id='babm-community-images');
create policy babm_images_upload on storage.objects for insert to authenticated with check(bucket_id='babm-community-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy babm_images_remove on storage.objects for delete to authenticated using(bucket_id='babm-community-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

alter policy babm_posts_read on public.babm_community_posts using(deleted_at is null or author_id=(select auth.uid()) or exists(select 1 from public.babm_community_moderators m where m.user_id=(select auth.uid())));
alter policy babm_comments_read on public.babm_community_comments using((deleted_at is null or author_id=(select auth.uid()) or exists(select 1 from public.babm_community_moderators m where m.user_id=(select auth.uid()))) and exists(select 1 from public.babm_community_posts p where p.id=post_id and p.deleted_at is null));
alter policy babm_likes_create on public.babm_community_likes with check(user_id=(select auth.uid()) and exists(select 1 from public.babm_community_posts p where p.id=post_id and p.deleted_at is null));
alter policy babm_comments_create on public.babm_community_comments with check(author_id=(select auth.uid()) and deleted_at is null and exists(select 1 from public.babm_community_posts p where p.id=post_id and p.deleted_at is null));
alter policy babm_reports_create on public.babm_community_reports with check(reporter_id=(select auth.uid()) and exists(select 1 from public.babm_community_posts p where p.id=post_id and p.deleted_at is null));