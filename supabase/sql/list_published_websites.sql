-- Called only by the authenticated website-publication Edge Function.
-- Return publication names, never an unpublished draft or another owner's site.
create or replace function public.sgc_list_website_publications(p_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.website_id,'businessName',coalesce(nullif(p.snapshot->>'business_name',''),p.slug),
  'slug',p.slug,'publishedAt',p.published_at,
  'available',sgc_private.website_subscription_active(p.user_id),
  'url','https://'||p.slug||'.sgcnetwork.co.za'
 ) order by p.published_at desc),'[]'::jsonb)
 from sgc_private.website_publications p
 where p.user_id=p_user and p_user is not null and p.unpublished_at is null;
$$;
revoke all on function public.sgc_list_website_publications(uuid) from public,anon,authenticated;
grant execute on function public.sgc_list_website_publications(uuid) to service_role;
