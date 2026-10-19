-- Execute in an explicit BEGIN/ROLLBACK transaction. No fixture survives.
set local role service_role;
do $$
declare buyer uuid; website uuid; slug text; result jsonb; again jsonb; request_key uuid:=gen_random_uuid(); failed boolean; amount numeric;
begin
 select id into buyer from public.profiles p where not exists(select 1 from public.sgc_student_websites w where w.user_id=p.id) and not exists(select 1 from public.sgc_demo_entitlements d where d.user_id=p.id) limit 1;
 if buyer is null then raise exception 'Unused profile needed for rolled-back checkout test';end if;
 slug:='qa-'||left(replace(gen_random_uuid()::text,'-',''),20);
 insert into public.sgc_demo_entitlements(user_id) values(buyer);
 insert into public.sgc_student_websites(user_id,business_name,slug,builder_preferences) values(buyer,'QA Store',slug,'{"productItems":[{"id":"dress","name":"Dress","price":100,"trackStock":true,"stock":10,"variants":[{"label":"Green","attributes":{"Colour":"Green"},"price":125,"stock":3}]},{"id":"bag","name":"Bag","price":50,"trackStock":true,"stock":5}]}') returning id into website;
 perform public.sgc_manage_website_publication(buyer,'publish');
 result:=public.sgc_builder_create_order(slug,request_key,'[{"productId":"dress","variantIndex":0,"quantity":2,"price":1},{"productId":"bag","quantity":1}]','{"name":"QA Customer","email":"qa@example.com"}');
 if (result->>'total')::numeric<>300 or result->>'paymentStatus'<>'pending' then raise exception 'Server price or payment status wrong';end if;
 again:=public.sgc_builder_create_order(slug,request_key,'[{"productId":"dress","variantIndex":0,"quantity":2}]','{"name":"QA Customer","email":"qa@example.com"}');
 if again->>'id'<>result->>'id' or (select count(*) from public.sgc_builder_orders where website_id=website)<>1 then raise exception 'Retry created duplicate order';end if;
 if (select builder_preferences#>>'{productItems,0,variants,0,stock}' from public.sgc_student_websites where id=website)<>'1' then raise exception 'Draft stock not decremented';end if;
 if (public.sgc_resolve_published_website(slug)#>>'{products,0,variants,0,stock}')<>'1' then raise exception 'Published stock not decremented';end if;
 failed:=false;begin perform public.sgc_builder_create_order(slug,gen_random_uuid(),'[{"productId":"dress","variantIndex":0,"quantity":2}]','{"name":"QA Customer","email":"qa@example.com"}');exception when others then failed:=true;end;
 if not failed then raise exception 'Oversold inventory';end if;
 failed:=false;begin perform public.sgc_builder_create_order(slug,gen_random_uuid(),'[{"productId":"dress","quantity":1}]','{"name":"QA Customer","email":"qa@example.com"}');exception when others then failed:=true;end;
 if not failed then raise exception 'Accepted a missing variant';end if;
 failed:=false;begin perform public.sgc_builder_order_status(gen_random_uuid(),(result->>'id')::uuid,'Cancelled');exception when others then failed:=true;end;
 if not failed then raise exception 'Different owner changed order';end if;
 perform public.sgc_builder_order_status(buyer,(result->>'id')::uuid,'Cancelled');
 if (public.sgc_resolve_published_website(slug)#>>'{products,0,variants,0,stock}')<>'3' then raise exception 'Cancellation did not restore stock';end if;
 perform public.sgc_builder_order_status(buyer,(result->>'id')::uuid,'Cancelled');
 if (public.sgc_resolve_published_website(slug)#>>'{products,0,variants,0,stock}')<>'3' then raise exception 'Duplicate cancellation restocked twice';end if;
 if has_function_privilege('anon','public.sgc_builder_create_order(text,uuid,jsonb,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.sgc_builder_order_status(uuid,uuid,text)','EXECUTE') or has_function_privilege('anon','sgc_private.website_inventory_change(uuid,text,jsonb,integer)','EXECUTE') then raise exception 'Privileged checkout function exposed';end if;
 raise notice 'Checkout total, variants, idempotence, stock, ownership and cancellation passed';
end;$$;
reset role;
