begin;
do $$
declare u uuid; t uuid; ref text; tok text; first_end timestamptz; second_end timestamptz; payment1 text; payment2 text; result jsonb;
begin
 select id into u from auth.users order by created_at limit 1;
 if u is null then raise exception 'Test requires an existing auth user'; end if;
 insert into public.sgc_demo_entitlements(user_id) values(u) on conflict do nothing;
 ref:='W-'||gen_random_uuid(); tok:=gen_random_uuid()::text;
 payment1:='test-'||gen_random_uuid(); payment2:='test-'||gen_random_uuid();
 insert into public.sgc_stitch_transactions(merchant_reference,user_id,product_id,product_name,amount_zar,billing,entitlement_key,checkout_url,status,payment_provider,auto_recurring)
 values(ref,u,'website-builder','Subscription rollback test',199,'monthly','website_builder','https://sgcnetwork.co.za/payfast-checkout.html','pending','payfast',true) returning id into t;
 perform public.sgc_apply_payfast_notification(ref,payment1,tok,199,'COMPLETE');
 select current_period_end into first_end from public.sgc_website_subscriptions where user_id=u;
 if first_end is null then raise exception 'Initial payment did not activate access'; end if;
 result:=public.sgc_apply_payfast_notification(ref,payment1,tok,199,'COMPLETE');
 if not (result->>'duplicate')::boolean then raise exception 'Initial duplicate not recognised'; end if;
 perform public.sgc_apply_payfast_notification(ref,payment2,tok,199,'COMPLETE');
 select current_period_end into second_end from public.sgc_website_subscriptions where user_id=u;
 if second_end<>first_end+interval '1 month' then raise exception 'Renewal did not add exactly one month'; end if;
 perform public.sgc_apply_payfast_notification(ref,payment2,tok,199,'COMPLETE');
 if (select current_period_end from public.sgc_website_subscriptions where user_id=u)<>second_end then raise exception 'Duplicate renewal added access twice'; end if;
 perform public.sgc_apply_payfast_notification(ref,'failed-'||gen_random_uuid(),tok,199,'FAILED');
 if (select current_period_end from public.sgc_website_subscriptions where user_id=u)<>second_end then raise exception 'Failed payment extended access'; end if;
 if (select status from public.sgc_payfast_subscriptions where original_transaction_id=t)<>'past_due' then raise exception 'Failure not recorded'; end if;
 begin
  perform public.sgc_apply_payfast_notification(ref,'wrong-'||gen_random_uuid(),tok,1,'COMPLETE');
  raise exception 'Amount mismatch was accepted';
 exception when others then if sqlerrm<>'Amount mismatch' then raise; end if; end;
 begin
  perform public.sgc_apply_payfast_notification(ref,'wrong-token-'||gen_random_uuid(),gen_random_uuid()::text,199,'COMPLETE');
  raise exception 'Wrong token was accepted';
 exception when others then if sqlerrm<>'Subscription token mismatch' then raise; end if; end;
 if (select count(*) from public.sgc_stitch_transactions where payfast_subscription_id=(select id from public.sgc_payfast_subscriptions where original_transaction_id=t))<>2 then raise exception 'Incorrect number of paid cycle records'; end if;
end $$;
rollback;
