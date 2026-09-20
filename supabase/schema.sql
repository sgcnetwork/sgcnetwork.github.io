create extension if not exists pgcrypto;

create type public.membership_type as enum ('start','build');
create type public.kit_status as enum ('pending','active','complete');
create type public.payment_status as enum ('pending','paid','failed','refunded');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership membership_type not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  next_payment_at timestamptz
);

create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null,
  description text,
  active boolean not null default true
);

create table if not exists public.customer_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kit_id uuid not null references public.kits(id),
  total numeric(10,2) not null,
  paid numeric(10,2) not null default 0,
  status kit_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique(user_id,kit_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_kit_id uuid references public.customer_kits(id) on delete set null,
  membership_id uuid references public.memberships(id) on delete set null,
  reference text unique,
  amount numeric(10,2) not null,
  currency text not null default 'ZAR',
  status payment_status not null default 'pending',
  payment_type text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  access_level text not null default 'start',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  body text,
  video_url text,
  position integer not null default 0,
  published boolean not null default false
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique(user_id,lesson_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.kits enable row level security;
alter table public.customer_kits enable row level security;
alter table public.payments enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;

create policy "profiles own" on public.profiles for select using (auth.uid()=id);
create policy "profiles update own" on public.profiles for update using (auth.uid()=id);
create policy "memberships own" on public.memberships for select using (auth.uid()=user_id);
create policy "kits public" on public.kits for select using (active=true);
create policy "customer kits own" on public.customer_kits for select using (auth.uid()=user_id);
create policy "payments own" on public.payments for select using (auth.uid()=user_id);
create policy "courses published" on public.courses for select using (published=true);
create policy "lessons published" on public.lessons for select using (published=true and exists(select 1 from public.courses c where c.id=course_id and c.published=true));
create policy "progress own" on public.lesson_progress for select using (auth.uid()=user_id);
create policy "progress insert own" on public.lesson_progress for insert with check (auth.uid()=user_id);
create policy "progress update own" on public.lesson_progress for update using (auth.uid()=user_id);
create policy "community read" on public.community_posts for select using (true);
create policy "community own insert" on public.community_posts for insert with check (auth.uid()=user_id);
create policy "community own update" on public.community_posts for update using (auth.uid()=user_id);
create policy "comments read" on public.community_comments for select using (true);
create policy "comments own insert" on public.community_comments for insert with check (auth.uid()=user_id);
