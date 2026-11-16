create table public.babm_journal_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 surah_number integer not null check (surah_number between 1 and 114),
 content text not null check (char_length(content) between 1 and 50000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,surah_number)
);
alter table public.babm_journal_entries enable row level security;
revoke all on public.babm_journal_entries from anon;
grant select,insert,update,delete on public.babm_journal_entries to authenticated;
create policy babm_read_own on public.babm_journal_entries for select to authenticated using ((select auth.uid())=user_id);
create policy babm_insert_own on public.babm_journal_entries for insert to authenticated with check ((select auth.uid())=user_id);
create policy babm_update_own on public.babm_journal_entries for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy babm_delete_own on public.babm_journal_entries for delete to authenticated using ((select auth.uid())=user_id);
create function public.babm_set_journal_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$begin NEW.updated_at=now(); return NEW; end;$$;
revoke all on function public.babm_set_journal_updated_at() from public,anon,authenticated;
create trigger babm_journal_updated_at before update on public.babm_journal_entries for each row execute function public.babm_set_journal_updated_at();