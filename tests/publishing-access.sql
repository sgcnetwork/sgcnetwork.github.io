-- Run after proposed schema inside one transaction, then roll back all fixtures.
set local role service_role;
do $$
declare buyer uuid; site_id uuid; s text; result jsonb; before_snapshot jsonb; denied boolean:=false;
begin
 select p.id into buyer from public.profiles p
 where not exists(select 1 from public.sgc_student_websites w where w.user_id=p.id)
 and not exists(select 1 from public.sgc_demo_entitlements d where d.user_id=p.id)
 and not exists(select 1 from public.sgc_website_subscriptions b where b.user_id=p.id)
 limit 1;
 if buyer is null then raise exception 'Unused test profile required'; end if;
 if has_function_privilege('anon','public.sgc_manage_website_publication(uuid,text)','EXECUTE')
 or has_function_privilege('authenticated','public.sgc_manage_website_publication(uuid,text)','EXECUTE')
 or has_function_privilege('anon','public.sgc_resolve_published_website(text)','EXECUTE')
 or has_table_privilege('authenticated','sgc_private.website_publications','SELECT') then raise exception 'Publication data exposed to clients'; end if;
 s:='sgc-test-'||replace(gen_random_uuid()::text,'-','');s:=left(s,40);
 insert into public.sgc_student_websites(user_id,business_name,slug,builder_preferences)
 values(buyer,'Publishing test',s,'{"customCode":"SECRET_NOTES","productItems":[{"name":"Visible","id":"one","active":true,"price":10,"digitalAssets":[{"path":"SECRET_DOWNLOAD"}],"digitalFiles":["SECRET_FILE"],"variants":[{"label":"Small","price":5,"private":"SECRET_VARIANT"}]},{"name":"SECRET_HIDDEN","active":false}],"email":"hello@example.com"}'::jsonb) returning id into site_id;
 begin perform public.sgc_manage_website_publication(buyer,'publish');exception when others then
 if sqlerrm<>'An active Website Builder subscription is required' then raise; end if;denied:=true;end;
 if not denied then raise exception 'Unpaid user published'; end if;
 insert into public.sgc_demo_entitlements(user_id) values(buyer);
 result:=public.sgc_manage_website_publication(buyer,'publish');
 if not (result->>'available')::boolean then raise exception 'Active demo cannot publish'; end if;
 before_snapshot:=public.sgc_resolve_published_website(s);
 if before_snapshot is null or before_snapshot::text like '%SECRET%' then raise exception 'Private fields leaked or publication missing'; end if;
 update public.sgc_student_websites set business_name='Draft changed' where id=site_id;
 if public.sgc_resolve_published_website(s)<>before_snapshot then raise exception 'Draft edit changed live snapshot'; end if;
 perform public.sgc_manage_website_publication(buyer,'publish');
 if public.sgc_resolve_published_website(s)->>'business_name'<>'Draft changed' then raise exception 'Republish failed'; end if;
 delete from public.sgc_demo_entitlements where user_id=buyer;
 if public.sgc_resolve_published_website(s) is not null then raise exception 'Inactive website still public'; end if;
 -- Unpublishing remains available even after access expires.
 perform public.sgc_manage_website_publication(buyer,'unpublish');
 insert into public.sgc_demo_entitlements(user_id) values(buyer);
 if public.sgc_resolve_published_website(s) is not null then raise exception 'Unpublished website reappeared'; end if;
 update public.sgc_student_websites set slug='www' where id=site_id;
 denied:=false;
 begin perform public.sgc_manage_website_publication(buyer,'publish');exception when others then denied:=true;end;
 if not denied then raise exception 'Reserved hostname published'; end if;
 raise notice 'Publishing permissions, private projection, snapshot isolation, republish, expiry and unpublish passed';
end;
$$;
reset role;
