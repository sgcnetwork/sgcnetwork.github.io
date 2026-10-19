-- Extend the existing order system; paid access is never granted by this checkout.
alter table public.sgc_builder_orders add column if not exists checkout_key uuid;
alter table public.sgc_builder_orders add column if not exists customer_phone text;
alter table public.sgc_builder_orders add column if not exists delivery_address text;
alter table public.sgc_builder_orders add column if not exists payment_status text not null default 'pending';
create unique index if not exists sgc_builder_orders_checkout_key on public.sgc_builder_orders(website_id,checkout_key) where checkout_key is not null;
alter table public.sgc_builder_order_items add column if not exists product_id text;
alter table public.sgc_builder_order_items add column if not exists variant_snapshot jsonb;
-- Owners may update only fulfilment status. Payment fields are server-owned.
revoke insert,update,delete,truncate,references,trigger on public.sgc_builder_orders from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.sgc_builder_order_items from anon,authenticated;

create or replace function sgc_private.website_inventory_change(p_website uuid,p_product text,p_variant jsonb,p_delta integer)
returns void language plpgsql security invoker set search_path='' as $$
declare d public.sgc_student_websites; pub sgc_private.website_publications; doc jsonb; products jsonb; item jsonb; v jsonb; pos integer; vi integer; n integer; target text[]; prefs jsonb;
begin
 select * into d from public.sgc_student_websites where id=p_website for update;
 select * into pub from sgc_private.website_publications where website_id=p_website for update;
 -- Apply the same sale/restock to published availability and the private draft inventory.
 for n in 1..2 loop
  doc:=case when n=1 then pub.snapshot else d.builder_preferences end;
  products:=coalesce(doc->case when n=1 then 'products' else 'productItems' end,'[]'::jsonb);
  select value,(ordinality-1)::integer into item,pos from jsonb_array_elements(products) with ordinality where value->>'id'=p_product limit 1;
  if item is null or coalesce(item->>'trackStock','false')<>'true' then continue; end if;
  if p_variant is not null then
   select value,(ordinality-1)::integer into v,vi from jsonb_array_elements(coalesce(item->'variants','[]'::jsonb)) with ordinality
   where (jsonb_typeof(p_variant->'attributes')='object' and p_variant->'attributes'<>'{}'::jsonb and value->'attributes'=p_variant->'attributes') or ((jsonb_typeof(p_variant->'attributes') is distinct from 'object' or p_variant->'attributes'='{}'::jsonb) and value->>'label'=p_variant->>'label') limit 1;
   if v is null then continue; end if;
   if nullif(v->>'stock','') is not null then target:=array[pos::text,'variants',vi::text,'stock'];products:=jsonb_set(products,target,to_jsonb(greatest(0,(v->>'stock')::integer+p_delta)),true);
   else target:=array[pos::text,'stock'];products:=jsonb_set(products,target,to_jsonb(greatest(0,coalesce(nullif(item->>'stock','')::integer,0)+p_delta)),true);end if;
  else
   target:=array[pos::text,'stock'];products:=jsonb_set(products,target,to_jsonb(greatest(0,coalesce(nullif(item->>'stock','')::integer,0)+p_delta)),true);
  end if;
  if n=1 then update sgc_private.website_publications set snapshot=jsonb_set(pub.snapshot,'{products}',products) where website_id=p_website;
  else prefs:=jsonb_set(d.builder_preferences,'{productItems}',products);update public.sgc_student_websites set builder_preferences=prefs,updated_at=clock_timestamp() where id=p_website;end if;
 end loop;
end;$$;
revoke all on function sgc_private.website_inventory_change(uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function sgc_private.website_inventory_change(uuid,text,jsonb,integer) to service_role;

create or replace function public.sgc_builder_create_order(p_slug text,p_key uuid,p_items jsonb,p_customer jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pub sgc_private.website_publications; existing public.sgc_builder_orders; order_id uuid:=gen_random_uuid(); order_no text; line jsonb; product jsonb; variant jsonb; variants jsonb; qty integer; vi integer; unit numeric; total numeric:=0; owner uuid; seen text[]:='{}'; line_key text; name text; email text; phone text; address text;
begin
 if p_key is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'Add between 1 and 50 products to your cart'; end if;
 if jsonb_typeof(p_customer) is distinct from 'object' then raise exception 'Enter your customer details';end if;
 name:=trim(p_customer->>'name');email:=lower(trim(p_customer->>'email'));phone:=trim(p_customer->>'phone');address:=trim(p_customer->>'address');
 if coalesce(length(name),0)<2 or length(name)>120 or coalesce(email,'')!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(email)>254 or coalesce(length(phone),0)>50 or coalesce(length(address),0)>2000 then raise exception 'Enter a valid name, email and contact details';end if;
 select user_id into owner from sgc_private.website_publications where slug=p_slug;
 if owner is null then raise exception 'This website is unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,19901));
 perform 1 from public.sgc_student_websites where user_id=owner for update;
 select * into pub from sgc_private.website_publications where slug=p_slug and unpublished_at is null for update;
 if not found or not sgc_private.website_subscription_active(owner) then raise exception 'This website is unavailable';end if;
 select * into existing from public.sgc_builder_orders where website_id=pub.website_id and checkout_key=p_key;
 if found then return jsonb_build_object('id',existing.id,'orderNumber',existing.order_number,'total',existing.total_zar,'status',existing.status,'paymentStatus',existing.payment_status);end if;
 if (select count(*) from public.sgc_builder_orders where website_id=pub.website_id and customer_email=email and created_at>now()-interval '10 minutes')>=5 then raise exception 'Please wait a few minutes before placing another order';end if;
 order_no:='SGC-'||upper(left(replace(order_id::text,'-',''),12));
 insert into public.sgc_builder_orders(id,website_id,checkout_key,order_number,customer_name,customer_email,customer_phone,delivery_address,status,payment_status)
 values(order_id,pub.website_id,p_key,order_no,name,email,phone,address,'Open','pending');
 for line in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(line) is distinct from 'object' or coalesce(line->>'quantity','')!~ '^[0-9]{1,4}$' then raise exception 'Enter a valid product quantity';end if;
  qty:=(line->>'quantity')::integer;if qty<1 or qty>999 then raise exception 'Quantity must be between 1 and 999';end if;
  select * into pub from sgc_private.website_publications where website_id=pub.website_id;
  select value into product from jsonb_array_elements(pub.snapshot->'products') where value->>'id'=line->>'productId' limit 1;
  if product is null then raise exception 'A product is no longer available. Refresh your cart';end if;
  variants:=coalesce(product->'variants','[]'::jsonb);variant:=null;vi:=-1;
  if jsonb_array_length(variants)>0 then
   if coalesce(line->>'variantIndex','')!~ '^[0-9]{1,4}$' then raise exception 'Choose a product option';end if;
   vi:=(line->>'variantIndex')::integer;variant:=variants->vi;if variant is null then raise exception 'This product option is unavailable';end if;
   if line->>'variantLabel' is not null and line->>'variantLabel' is distinct from variant->>'label' then raise exception 'This product option changed. Refresh your cart';end if;
   if jsonb_typeof(line->'variantAttributes')='object' and line->'variantAttributes' is distinct from variant->'attributes' then raise exception 'This product option changed. Refresh your cart';end if;
  end if;
  line_key:=(product->>'id')||':'||vi;if line_key=any(seen) then raise exception 'Combine duplicate cart lines before checkout';end if;seen:=array_append(seen,line_key);
  unit:=coalesce(nullif(variant->>'price','')::numeric,case when product->>'onSale'='true' then nullif(product->>'salePrice','')::numeric end,nullif(product->>'price','')::numeric);
  if unit is null or unit<0 or unit>10000000 then raise exception 'Contact the store to confirm this product price';end if;unit:=round(unit,2);
  if product->>'trackStock'='true' and qty>coalesce(nullif(variant->>'stock','')::integer,nullif(product->>'stock','')::integer,0) then raise exception 'There is not enough stock for this product option';end if;
  total:=total+unit*qty;
  insert into public.sgc_builder_order_items(order_id,product_id,product_name,variant_snapshot,quantity,unit_price_zar) values(order_id,product->>'id',product->>'name',variant,qty,unit);
  if product->>'trackStock'='true' then perform sgc_private.website_inventory_change(pub.website_id,product->>'id',variant,-qty);end if;
 end loop;
 update public.sgc_builder_orders set total_zar=total where id=order_id;
 return jsonb_build_object('id',order_id,'orderNumber',order_no,'total',total,'status','Open','paymentStatus','pending');
end;$$;
revoke all on function public.sgc_builder_create_order(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sgc_builder_create_order(text,uuid,jsonb,jsonb) to service_role;

create or replace function public.sgc_builder_order_status(p_user uuid,p_order uuid,p_status text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.sgc_builder_orders; owner uuid; line public.sgc_builder_order_items;
begin
 if p_status not in ('Open','Completed','Cancelled') then raise exception 'Choose a valid order status';end if;
 select s.user_id into owner from public.sgc_builder_orders x join public.sgc_student_websites s on s.id=x.website_id where x.id=p_order;
 if owner is null or owner is distinct from p_user then raise exception 'Order not found';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,19901));
 perform 1 from public.sgc_student_websites where user_id=owner for update;
 select * into o from public.sgc_builder_orders where id=p_order for update;
 if o.status=p_status then return jsonb_build_object('id',o.id,'status',o.status);end if;
 if o.status<>'Open' then raise exception 'Completed or cancelled orders cannot be reopened';end if;
 if p_status='Cancelled' then for line in select * from public.sgc_builder_order_items where order_id=o.id loop
  perform sgc_private.website_inventory_change(o.website_id,line.product_id,line.variant_snapshot,line.quantity);
 end loop;end if;
 update public.sgc_builder_orders set status=p_status where id=o.id;
 return jsonb_build_object('id',o.id,'status',p_status);
end;$$;
revoke all on function public.sgc_builder_order_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.sgc_builder_order_status(uuid,uuid,text) to service_role;

-- A random checkout key grants access only to a minimal receipt, never customer details.
create or replace function public.sgc_builder_order_receipt(p_slug text,p_key uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',o.id,'orderNumber',o.order_number,'total',o.total_zar,'status',o.status,'paymentStatus',o.payment_status,
 'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.product_name,'quantity',i.quantity,'unitPrice',i.unit_price_zar,'variant',i.variant_snapshot->>'label')) from public.sgc_builder_order_items i where i.order_id=o.id),'[]'::jsonb))
 from public.sgc_builder_orders o join public.sgc_student_websites s on s.id=o.website_id where s.slug=p_slug and o.checkout_key=p_key;
$$;
revoke all on function public.sgc_builder_order_receipt(text,uuid) from public,anon,authenticated;
grant execute on function public.sgc_builder_order_receipt(text,uuid) to service_role;
