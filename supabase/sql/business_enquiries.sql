create table if not exists public.sgc_business_enquiries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 website_slug text not null,
 fields jsonb not null check (jsonb_typeof(fields)='object' and octet_length(fields::text)<=16000),
 fingerprint text not null,
 created_at timestamptz not null default now()
);
alter table public.sgc_business_enquiries enable row level security;
revoke all on public.sgc_business_enquiries from public,anon,authenticated;
grant select,delete on public.sgc_business_enquiries to authenticated;
grant all on public.sgc_business_enquiries to service_role;
create policy "Business owners read their enquiries" on public.sgc_business_enquiries for select to authenticated using(user_id=(select auth.uid()));
create policy "Business owners delete their enquiries" on public.sgc_business_enquiries for delete to authenticated using(user_id=(select auth.uid()));
create index if not exists sgc_business_enquiries_owner_date on public.sgc_business_enquiries(user_id,created_at desc);
create index if not exists sgc_business_enquiries_rate on public.sgc_business_enquiries(website_slug,fingerprint,created_at desc);
