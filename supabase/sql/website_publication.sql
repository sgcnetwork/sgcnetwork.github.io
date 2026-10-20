-- Published snapshots are private; only the server can publish or resolve them.
create table if not exists sgc_private.website_publications (
 website_id uuid primary key references public.sgc_student_websites(id) on delete cascade,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 slug text not null unique,
 snapshot jsonb not null,
 published_at timestamptz not null default now(),
 unpublished_at timestamptz
);
alter table sgc_private.website_publications enable row level security;
revoke all on sgc_private.website_publications from public,anon,authenticated;
grant select,insert,update,delete on sgc_private.website_publications to service_role;

create or replace function sgc_private.website_subscription_active(p_user uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.sgc_demo_entitlements where user_id=p_user)
 or (public.sgc_checkout_membership_allowed(p_user) and exists(
 select 1 from public.sgc_website_subscriptions where user_id=p_user
 and status='active' and current_period_end>now()));
$$;
revoke all on function sgc_private.website_subscription_active(uuid) from public,anon,authenticated;
grant execute on function sgc_private.website_subscription_active(uuid) to service_role;

-- Explicit allowlists prevent draft-only notes and protected downloads being published.
create or replace function sgc_private.website_snapshot(p_site public.sgc_student_websites)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'business_name',p_site.business_name,'slug',p_site.slug,'description',p_site.description,
 'font',p_site.font,'primary_color',p_site.primary_color,'accent_color',p_site.accent_color,
 'preferences',coalesce((select jsonb_object_agg(key,value) from jsonb_each(p_site.builder_preferences)
 where key=any(array['logoStyle','logoText','logo','logoSize','logoSpacing','logoColorMode','logoColor',
 'menuPosition','menuSize','menuColorMode','menuColor','menuBackgroundMode','menuBackground',
 'stickyMenu','alwaysCollapsed','hamburgerPosition','hamburgerIcon','showSearch','showCart','favicon','announcementEnabled','announcementText','announcementTextColor','announcementBgMode','announcementBg',
 'contactBarEnabled','siteFont','siteTheme','siteBackground','homeButtonTarget','homeButtonText',
 'themePrimary','themeSecondary','homeMediaUrl','homeMediaType','homeMediaX','homeMediaY',
 'homeBackgroundType','homeBackground','headline','welcome','cta','homeSections','menuEntries',
 'servicesTitle','servicesMenuVisible','servicesMenuLabel','servicesHideEmpty','servicesHomeVisible',
 'servicesDescription','servicesDesktopColumns','servicesMobileColumns','delivery','photos','media','postTitle','postBody','about','team','email','phone',
 'whatsapp','instagram','facebook','footer','seo','beautyStudio'])), '{}'::jsonb),
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

create or replace function public.sgc_manage_website_publication(p_user uuid,p_action text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.sgc_student_websites%rowtype; p sgc_private.website_publications%rowtype;
begin
 if p_user is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,19901));
 if p_action='publish' then
  if not sgc_private.website_subscription_active(p_user) then raise exception 'An active Website Builder subscription is required'; end if;
  select * into d from public.sgc_student_websites where user_id=p_user for update;
  if not found or length(trim(d.business_name))=0 then raise exception 'Save your business name and website address first'; end if;
  if d.slug is null or length(d.slug)<3 or length(d.slug)>40 or d.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  or d.slug=any(array['www','mail','email','send','resend','smtp','imap','pop','api','app','admin','studio',
  'dashboard','academy','community','shop','builder','support','help','status','assets','cdn','ftp','ns1','ns2','sgc','sgcnetwork'])
  then raise exception 'Choose an available website address with 3–40 lowercase letters, numbers or hyphens'; end if;
  if octet_length(d.builder_preferences::text)>2000000 then raise exception 'Website content is too large'; end if;
  insert into sgc_private.website_publications(website_id,user_id,slug,snapshot)
   values(d.id,p_user,d.slug,sgc_private.website_snapshot(d))
   on conflict(website_id) do update set slug=excluded.slug,snapshot=excluded.snapshot,published_at=now(),unpublished_at=null;
 elsif p_action='unpublish' then
  update sgc_private.website_publications set unpublished_at=now() where user_id=p_user and unpublished_at is null;
 elsif p_action<>'status' then raise exception 'Unknown publishing action'; end if;
 select * into p from sgc_private.website_publications where user_id=p_user;
 if not found then return jsonb_build_object('published',false); end if;
 return jsonb_build_object('published',p.unpublished_at is null,'available',p.unpublished_at is null and sgc_private.website_subscription_active(p_user),
 'slug',p.slug,'publishedAt',p.published_at,'url','https://sgcnetwork.co.za/published-site.html?site='||p.slug,
 'subdomainUrl','https://'||p.slug||'.sgcnetwork.co.za');
end;
$$;
revoke all on function public.sgc_manage_website_publication(uuid,text) from public,anon,authenticated;
grant execute on function public.sgc_manage_website_publication(uuid,text) to service_role;

create or replace function public.sgc_resolve_published_website(p_slug text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select snapshot from sgc_private.website_publications
 where slug=p_slug and unpublished_at is null and sgc_private.website_subscription_active(user_id);
$$;
revoke all on function public.sgc_resolve_published_website(text) from public,anon,authenticated;
grant execute on function public.sgc_resolve_published_website(text) to service_role;
