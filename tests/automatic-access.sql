-- Run in one transaction after the proposed DDL, then ROLLBACK.
do $$
declare
 buyer uuid;
 entry_id uuid; builder_id uuid; academy_id uuid; renewal_id uuid;
 first_end timestamptz; after_end timestamptz; academy_end timestamptz; refused boolean:=false;
begin
 select p.id into buyer from public.profiles p
 where not exists(select 1 from public.sgc_extra_admins a where a.user_id=p.id)
 and not exists(select 1 from public.sgc_demo_entitlements d where d.user_id=p.id)
 and not exists(select 1 from public.sgc_stitch_transactions t where t.user_id=p.id and t.status='paid')
 and not exists(select 1 from public.memberships m where m.user_id=p.id)
 and not exists(select 1 from public.sgc_website_subscriptions s where s.user_id=p.id)
 limit 1;
 if buyer is null then raise exception 'An unused non-admin test account is required'; end if;
 if has_function_privilege('authenticated','public.sgc_activate_paid_membership(uuid)','EXECUTE')
 or has_function_privilege('anon','public.sgc_activate_paid_membership(uuid)','EXECUTE') then
 raise exception 'Clients must not activate payments'; end if;
 insert into public.sgc_stitch_transactions(merchant_reference,user_id,product_id,entitlement_key,amount_zar,billing)
 values('W-AUTO_TEST_BEFORE_ENTRY',buyer,'website-builder','website_builder',199,'monthly') returning id into builder_id;
 begin
  update public.sgc_stitch_transactions set status='paid',paid_at=now() where id=builder_id;
 exception when others then
  if sqlerrm<>'Purchase the R150 once-off membership first' then raise; end if;
  refused:=true;
 end;
 if not refused then raise exception 'Builder unlocked without entry payment'; end if;
 if exists(select 1 from public.sgc_stitch_transactions where id=builder_id and status='paid') then raise exception 'Failed activation must rollback paid status'; end if;
 insert into public.sgc_stitch_transactions(merchant_reference,user_id,product_id,entitlement_key,amount_zar,billing)
 values('S-AUTO_TEST_ENTRY',buyer,'sgc-start-foundations','start',150,'once') returning id into entry_id;
 update public.sgc_stitch_transactions set status='paid',paid_at=now() where id=entry_id;
 perform set_config('request.jwt.claim.sub',buyer::text,true);
 if not public.sgc_start_purchased() then raise exception 'R150 not activated'; end if;
 if public.sgc_builder_access() then raise exception 'Entry alone unlocked builder'; end if;
 update public.sgc_stitch_transactions set status='paid',paid_at=now() where id=builder_id;
 if not public.sgc_builder_access() then raise exception 'R199 builder not activated'; end if;
 if exists(select 1 from public.memberships where user_id=buyer and membership_type='build') then raise exception 'Builder must not activate Academy premium'; end if;
 select current_period_end into first_end from public.sgc_website_subscriptions where user_id=buyer;
 perform public.sgc_activate_paid_membership(builder_id);
 update public.sgc_stitch_transactions set status='paid' where id=builder_id;
 select current_period_end into after_end from public.sgc_website_subscriptions where user_id=buyer;
 if after_end<>first_end then raise exception 'Duplicate webhook extended access'; end if;
 insert into public.sgc_stitch_transactions(merchant_reference,user_id,product_id,entitlement_key,amount_zar,billing)
 values('B-AUTO_TEST_ACADEMY',buyer,'sgc-build-lab','build',450,'monthly') returning id into academy_id;
 update public.sgc_stitch_transactions set status='paid',paid_at=now() where id=academy_id;
 select current_period_end into academy_end from public.memberships where user_id=buyer and membership_type='build';
 if academy_end is null or academy_end<=now() then raise exception 'R450 Academy not activated'; end if;
 if (select current_period_end from public.sgc_website_subscriptions where user_id=buyer)<>first_end then raise exception 'Academy changed builder period'; end if;
 insert into public.sgc_stitch_transactions(merchant_reference,user_id,product_id,entitlement_key,amount_zar,billing)
 values('W-AUTO_TEST_RENEWAL',buyer,'website-builder','website_builder',199,'monthly') returning id into renewal_id;
 update public.sgc_stitch_transactions set status='paid',paid_at=now() where id=renewal_id;
 select current_period_end into after_end from public.sgc_website_subscriptions where user_id=buyer;
 if after_end<>first_end+interval '1 month' then raise exception 'Renewal did not extend exactly one month'; end if;
 perform public.sgc_activate_paid_membership(renewal_id);
 if (select current_period_end from public.sgc_website_subscriptions where user_id=buyer)<>after_end then raise exception 'Repeated renewal extended again'; end if;
 update public.sgc_website_subscriptions set current_period_end=now()-interval '1 second' where user_id=buyer;
 if public.sgc_builder_access() then raise exception 'Expired builder remains unlocked'; end if;
 if (select current_period_end from public.memberships where user_id=buyer and membership_type='build')<>academy_end then raise exception 'Builder expiry changed Academy'; end if;
 if (select count(*) from sgc_private.payment_activations where user_id=buyer)<>4 then raise exception 'Incorrect activation ledger count'; end if;
end $$;
select 'automatic access, prerequisites, isolation, replay, renewal and expiry assertions passed' as verification;
