create table public.sgc_payfast_subscriptions (
 id uuid primary key default gen_random_uuid(),
 token text not null unique,
 original_transaction_id uuid not null unique references public.sgc_stitch_transactions(id),
 user_id uuid not null references auth.users(id),
 product_id text not null,
 product_name text not null,
 entitlement_key text,
 amount_zar numeric(12,2) not null check (amount_zar>=5),
 status text not null default 'active' check(status in ('active','past_due','cancelled')),
 last_payment_at timestamptz,
 last_failure_at timestamptz,
 cancelled_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.sgc_payfast_subscriptions enable row level security;
revoke all on public.sgc_payfast_subscriptions from public,anon,authenticated;
grant all on public.sgc_payfast_subscriptions to service_role;
create index sgc_payfast_subscriptions_customer on public.sgc_payfast_subscriptions(user_id,product_id,status);
alter table public.sgc_stitch_transactions add column auto_recurring boolean not null default false,
 add column payfast_subscription_id uuid references public.sgc_payfast_subscriptions(id);

-- Called only by the server after PayFast signature and provider validation.
-- Row locking makes duplicated or simultaneous notifications safe.
create function public.sgc_apply_payfast_notification(
 p_reference text,p_payment_id text,p_token text,p_amount numeric,p_status text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 t public.sgc_stitch_transactions%rowtype;
 s public.sgc_payfast_subscriptions%rowtype;
 existing public.sgc_stitch_transactions%rowtype;
 applied_id uuid;
begin
 if p_payment_id is null or length(p_payment_id)>100 or p_amount is null then raise exception 'Invalid payment'; end if;
 select * into t from public.sgc_stitch_transactions
  where merchant_reference=p_reference and payment_provider='payfast' for update;
 if not found and nullif(p_token,'') is not null then
  select * into s from public.sgc_payfast_subscriptions where token=p_token;
  if found then select * into t from public.sgc_stitch_transactions where id=s.original_transaction_id for update; end if;
 end if;
 if t.id is null then raise exception 'Unknown checkout'; end if;
 if round(p_amount,2)<>t.amount_zar then raise exception 'Amount mismatch'; end if;
 select * into existing from public.sgc_stitch_transactions where payfast_payment_id=p_payment_id;
 if found then
  if existing.id<>t.id and (existing.payfast_subscription_id is null or existing.payfast_subscription_id is distinct from t.payfast_subscription_id) then raise exception 'Payment reference conflict'; end if;
  return jsonb_build_object('duplicate',true,'transactionId',existing.id);
 end if;
 if t.auto_recurring then
  if t.billing<>'monthly' or t.user_id is null or nullif(p_token,'') is null or length(p_token)>100 then raise exception 'Invalid subscription notification'; end if;
  select * into s from public.sgc_payfast_subscriptions where original_transaction_id=t.id for update;
  if found and s.token<>p_token then raise exception 'Subscription token mismatch'; end if;
  if p_status is distinct from 'COMPLETE' then
   if s.id is not null and s.status<>'cancelled' then
    update public.sgc_payfast_subscriptions set status='past_due',last_failure_at=now() where id=s.id;
   end if;
   return jsonb_build_object('paid',false);
  end if;
  if s.id is null then
   insert into public.sgc_payfast_subscriptions(token,original_transaction_id,user_id,product_id,product_name,entitlement_key,amount_zar)
    values(p_token,t.id,t.user_id,t.product_id,t.product_name,t.entitlement_key,t.amount_zar) returning * into s;
  end if;
  if t.status='pending' then
   update public.sgc_stitch_transactions set status='paid',paid_at=now(),updated_at=now(),
    payfast_payment_id=p_payment_id,payfast_subscription_id=s.id where id=t.id;
   applied_id:=t.id;
  elsif t.status='paid' then
   insert into public.sgc_stitch_transactions(merchant_reference,user_id,customer_name,customer_email,product_id,product_name,
    amount_zar,billing,entitlement_key,variant_id,quantity,checkout_url,status,paid_at,payment_provider,payfast_payment_id,auto_recurring,payfast_subscription_id)
   values(split_part(t.merchant_reference,'-',1)||'-'||gen_random_uuid(),t.user_id,t.customer_name,t.customer_email,t.product_id,t.product_name,
    t.amount_zar,t.billing,t.entitlement_key,t.variant_id,t.quantity,t.checkout_url,'paid',now(),'payfast',p_payment_id,true,s.id) returning id into applied_id;
  else raise exception 'Checkout cannot receive payment'; end if;
  update public.sgc_payfast_subscriptions set last_payment_at=now(),status=case when status='cancelled' then status else 'active' end where id=s.id;
 else
  if p_status is distinct from 'COMPLETE' then return jsonb_build_object('paid',false); end if;
  if t.status<>'pending' then raise exception 'Checkout already completed'; end if;
  update public.sgc_stitch_transactions set status='paid',paid_at=now(),updated_at=now(),payfast_payment_id=p_payment_id where id=t.id;
  applied_id:=t.id;
 end if;
 return jsonb_build_object('paid',true,'transactionId',applied_id);
end $$;
revoke all on function public.sgc_apply_payfast_notification(text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.sgc_apply_payfast_notification(text,text,text,numeric,text) to service_role;
