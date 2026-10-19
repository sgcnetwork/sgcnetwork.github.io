-- Run in a transaction and ROLLBACK all fixtures.
do $$ declare buyer uuid; product uuid;begin
 select p.id into buyer from public.profiles p where not exists(select 1 from public.sgc_extra_admins a where a.user_id=p.id) and not exists(select 1 from public.sgc_demo_entitlements d where d.user_id=p.id) and not exists(select 1 from public.sgc_stitch_transactions t where t.user_id=p.id and t.status='paid') limit 1;
 select id into product from public.sgc_products where access_level is null and active limit 1;
 if buyer is null or product is null then raise exception 'Eligible QA profile/product required';end if;
 perform set_config('request.jwt.claim.sub',buyer::text,true);
 if public.sgc_product_access(product) then raise exception 'Unpurchased product accessible';end if;
 insert into public.sgc_stitch_transactions(merchant_reference,user_id,product_id,product_name,amount_zar,billing,status,paid_at) values('K-DOWNLOAD-QA-'||gen_random_uuid(),buyer,product::text,'QA Kit',499,'once','paid',now());
 if not public.sgc_product_access(product) then raise exception 'Verified purchase did not unlock product';end if;
 update public.sgc_products set active=false where id=product;
 if not public.sgc_product_access(product) then raise exception 'Archiving removed purchased access';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if public.sgc_product_access(product) then raise exception 'Another customer accessed purchase';end if;
end;$$;
select 'Verified purchase, archive preservation and customer isolation passed' as result;
