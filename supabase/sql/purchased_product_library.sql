-- Verified product purchases retain their downloads even if the product is later archived.
create or replace function public.sgc_product_access(p_product uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.sgc_products p where p.id=p_product and (
   public.sgc_extra_is_admin() or public.sgc_extra_is_demo()
   or exists(select 1 from public.sgc_stitch_transactions t where t.user_id=auth.uid() and t.product_id=p.id::text and t.status='paid' and t.paid_at is not null and t.paid_at<=now() and (t.billing is distinct from 'monthly' or t.paid_at+interval '1 month'>now()))
   or (p.active and public.sgc_extra_has_product(p.access_level))
   or exists(select 1 from public.sgc_bookings b where b.product_id=p.id and b.user_id=auth.uid() and b.payment_status in ('paid','manual_paid') and b.status in ('confirmed','cancelled'))
  )
 );
$$;
revoke all on function public.sgc_product_access(uuid) from public,anon;
grant execute on function public.sgc_product_access(uuid) to authenticated,service_role;
