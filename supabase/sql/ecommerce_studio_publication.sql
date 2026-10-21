-- Ecommerce uses the existing owner-authorised draft and publication pipeline.
-- Keep unavailable products, hidden pages and private download URLs out of public snapshots.
create or replace function sgc_private.ecommerce_studio_public(s jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(key,case
 when key='products' then coalesce((select jsonb_agg(item - 'downloadUrl' - 'privateFile' - 'costPrice') from jsonb_array_elements(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) item where item->'active' is distinct from 'false'::jsonb),'[]'::jsonb)
 when key='customPages' then coalesce((select jsonb_agg(item) from jsonb_array_elements(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) item where item->'visible' is distinct from 'false'::jsonb),'[]'::jsonb)
 else value end),'{}'::jsonb)
 from jsonb_each(s)
 where key=any(array['version','brand','tagline','logo','favicon','slug','announcement','announcementEnabled','heroTitle','heroSubtitle','heroButton','heroTarget','heroImage','promoTitle','promoText','promoButton','promoTarget','promoImage','newsletterTitle','newsletterText','newsletterButton','newsletterUrl','footer','aboutTitle','about','email','phone','address','instagram','facebook','shippingText','returnsText','checkoutText','addButton','buyButton','checkoutButton','categoriesTitle','featuredTitle','shopTitle','aboutButton','menu','sections','hidden','theme','labels','customPages','categories','products','seoTitle','seoDescription']);
$$;
revoke all on function sgc_private.ecommerce_studio_public(jsonb) from public,anon,authenticated;
grant execute on function sgc_private.ecommerce_studio_public(jsonb) to service_role;

do $patch$
declare definition text;
begin
 select pg_get_functiondef('sgc_private.website_snapshot(public.sgc_student_websites)'::regprocedure) into definition;
 if position('ecommerceStudio' in definition)>0 then return; end if;
 if position('case when key=''businessStudio'' then sgc_private.business_studio_public(value) else value end' in definition)=0 then
  raise exception 'Unexpected snapshot implementation; inspect before extending';
 end if;
 definition:=replace(definition,'case when key=''businessStudio'' then sgc_private.business_studio_public(value) else value end','case when key=''businessStudio'' then sgc_private.business_studio_public(value) when key=''ecommerceStudio'' then sgc_private.ecommerce_studio_public(value) else value end');
 definition:=replace(definition,'''businessStudio'',''activeStudio''','''businessStudio'',''activeStudio'',''ecommerceStudio''');
 execute definition;
end;
$patch$;
