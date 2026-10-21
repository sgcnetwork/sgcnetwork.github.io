create or replace function sgc_private.business_studio_public(s jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=s; name text; arr jsonb;
begin
 for name in select unnest(array['Blog','Products','Services','Categories']) loop
 select coalesce(jsonb_agg(item),'[]'::jsonb) into arr from jsonb_array_elements(coalesce(s#>array['data',name,'items'],'[]'::jsonb)) item
 where item->'active' is distinct from 'false'::jsonb and (name<>'Blog' or item->>'status' is distinct from 'draft');
 result:=jsonb_set(result,array['data',name,'items'],arr);
 end loop;
 return result;
end;$$;
revoke all on function sgc_private.business_studio_public(jsonb) from public,anon,authenticated;
grant execute on function sgc_private.business_studio_public(jsonb) to service_role;
create or replace function sgc_private.website_snapshot(p_site public.sgc_student_websites)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'business_name',p_site.business_name,'slug',p_site.slug,'description',p_site.description,
 'font',p_site.font,'primary_color',p_site.primary_color,'accent_color',p_site.accent_color,
 'preferences',coalesce((select jsonb_object_agg(key,case when key='businessStudio' then sgc_private.business_studio_public(value) else value end) from jsonb_each(p_site.builder_preferences)
 where key=any(array['logoStyle','logoText','logo','logoSize','logoSpacing','logoColorMode','logoColor',
 'menuPosition','menuSize','menuColorMode','menuColor','menuBackgroundMode','menuBackground',
 'stickyMenu','alwaysCollapsed','hamburgerPosition','hamburgerIcon','showSearch','showCart','favicon','announcementEnabled','announcementText','announcementTextColor','announcementBgMode','announcementBg',
 'contactBarEnabled','siteFont','siteTheme','siteBackground','homeButtonTarget','homeButtonText',
 'themePrimary','themeSecondary','homeMediaUrl','homeMediaType','homeMediaX','homeMediaY',
 'homeBackgroundType','homeBackground','headline','welcome','cta','homeSections','menuEntries',
 'servicesTitle','servicesMenuVisible','servicesMenuLabel','servicesHideEmpty','servicesHomeVisible',
 'servicesDescription','servicesDesktopColumns','servicesMobileColumns','delivery','photos','media','postTitle','postBody','about','team','email','phone',
 'whatsapp','instagram','facebook','footer','seo','beautyStudio','businessStudio','activeStudio'])), '{}'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object(
 'id',item->'id','name',item->'name','description',item->'description',
 'price',item->'price','salePrice',item->'salePrice','onSale',item->'onSale',
 'images',item->'images','categories',item->'categories','seoSlug',item->'seoSlug',
 'trackStock',item->'trackStock','stock',item->'stock','options',item->'options',
 'variants',coalesce((select jsonb_agg(jsonb_build_object('attributes',v->'attributes',
 'label',v->'label','price',v->'price','stock',v->'stock','image',v->'image','images',v->'images','description',v->'description'))
 from jsonb_array_elements(case when jsonb_typeof(item->'variants')='array' then item->'variants' else '[]'::jsonb end) v),'[]'::jsonb)))
 from jsonb_array_elements(case when jsonb_typeof(p_site.builder_preferences->'productItems')='array'
 then p_site.builder_preferences->'productItems' else '[]'::jsonb end) item
 where item->'active' is distinct from 'false'::jsonb),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',item->'id','name',item->'name',
 'description',item->'description','price',item->'price','images',item->'images',
 'seoSlug',item->'seoSlug','actionType',item->'actionType','actionUrl',item->'actionUrl'))
 from jsonb_array_elements(case when jsonb_typeof(p_site.builder_preferences->'serviceItems')='array'
 then p_site.builder_preferences->'serviceItems' else '[]'::jsonb end) item
 where item->'active' is distinct from 'false'::jsonb),'[]'::jsonb));
$$;
revoke all on function sgc_private.website_snapshot(public.sgc_student_websites) from public,anon,authenticated;
grant execute on function sgc_private.website_snapshot(public.sgc_student_websites) to service_role;
