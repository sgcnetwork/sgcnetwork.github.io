-- Apply once. Populate configuration through an authorised server/admin session; never commit credentials.
create table public.sgc_gateway_secrets (provider text primary key, config jsonb not null);
alter table public.sgc_gateway_secrets enable row level security;
revoke all on public.sgc_gateway_secrets from public,anon,authenticated;
grant select on public.sgc_gateway_secrets to service_role;
alter table public.sgc_stitch_transactions add column payment_provider text not null default 'stitch', add column payfast_payment_id text;
create unique index sgc_payfast_payment_id_unique on public.sgc_stitch_transactions(payfast_payment_id) where payfast_payment_id is not null;
create policy sgc_customer_read_own_checkouts on public.sgc_stitch_transactions for select to authenticated using ((select auth.uid())=user_id);
