create table public.reseller_stores (
  owner_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  name text not null check (length(trim(name)) between 1 and 100),
  whatsapp text check (whatsapp ~ '^27[1-9][0-9]{8}$')
);

create table public.reseller_products (
  id uuid primary key,
  owner_id uuid not null references public.reseller_stores(owner_id) on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null check (length(description) between 1 and 1500),
  category text not null check (length(category) <= 80),
  colours text[] not null default '{}' check (cardinality(colours) <= 30),
  sizes text[] not null default '{}' check (cardinality(sizes) <= 30),
  delivery text not null check (delivery in ('Delivery and collection','Delivery','Collection')),
  stock integer not null check (stock >= 0),
  image text not null check (length(image) <= 950000 and image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.reseller_prices (
  product_id uuid not null,
  owner_id uuid not null default auth.uid(),
  quantity integer not null check (quantity between 1 and 1000),
  selling_cents integer not null check (selling_cents between 1 and 100000000),
  primary key (product_id, quantity),
  foreign key (product_id, owner_id) references public.reseller_products(id, owner_id) on delete cascade
);

create table public.reseller_costs (
  product_id uuid not null,
  owner_id uuid not null default auth.uid(),
  quantity integer not null,
  supplier_cents integer not null check (supplier_cents between 0 and 100000000),
  primary key (product_id, quantity),
  foreign key (product_id, quantity) references public.reseller_prices(product_id, quantity) on delete cascade,
  foreign key (product_id, owner_id) references public.reseller_products(id, owner_id) on delete cascade
);

create index reseller_products_owner on public.reseller_products(owner_id);
alter table public.reseller_stores enable row level security;
alter table public.reseller_products enable row level security;
alter table public.reseller_prices enable row level security;
alter table public.reseller_costs enable row level security;

revoke all on public.reseller_stores, public.reseller_products, public.reseller_prices, public.reseller_costs from public, anon, authenticated;
grant select on public.reseller_stores, public.reseller_products, public.reseller_prices to anon, authenticated;
grant insert, update, delete on public.reseller_stores, public.reseller_products, public.reseller_prices to authenticated;
grant select, insert, update, delete on public.reseller_costs to authenticated;
create policy stores_read on public.reseller_stores for select to anon, authenticated using (true);
create policy stores_owner on public.reseller_stores for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy products_read on public.reseller_products for select to anon, authenticated using (published);
create policy products_owner on public.reseller_products for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy prices_read on public.reseller_prices for select to anon, authenticated using (exists (select 1 from public.reseller_products p where p.id = product_id and p.published));
create policy prices_owner on public.reseller_prices for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy costs_owner on public.reseller_costs for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create function public.reseller_save_product(product jsonb, prices jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  listing_id uuid := (product->>'id')::uuid;
  price jsonb;
begin
  if auth.uid() is null or jsonb_typeof(prices) is distinct from 'array' then
    raise exception 'Sign in and provide selling prices';
  end if;
  if jsonb_array_length(prices) not between 1 and 20 then
    raise exception 'Provide between 1 and 20 selling prices';
  end if;
  insert into public.reseller_products as p
    (id, name, description, category, colours, sizes, delivery, stock, image, published)
  values (listing_id, product->>'name', product->>'description', product->>'category',
    array(select jsonb_array_elements_text(product->'colours')),
    array(select jsonb_array_elements_text(product->'sizes')),
    product->>'delivery', (product->>'stock')::integer, product->>'image',
    (product->>'published')::boolean)
  on conflict (id) do update set name = excluded.name, description = excluded.description,
    category = excluded.category, colours = excluded.colours, sizes = excluded.sizes,
    delivery = excluded.delivery, stock = excluded.stock, image = excluded.image, published = excluded.published
  where p.owner_id = auth.uid();
  if not found then raise exception 'Listing is unavailable'; end if;
  delete from public.reseller_prices rp where rp.product_id = listing_id;
  for price in select jsonb_array_elements(prices) loop
    insert into public.reseller_prices (product_id, quantity, selling_cents)
      values (listing_id, (price->>'quantity')::integer, (price->>'selling_cents')::integer);
    if price->>'supplier_cents' is not null then
      insert into public.reseller_costs (product_id, quantity, supplier_cents)
        values (listing_id, (price->>'quantity')::integer, (price->>'supplier_cents')::integer);
    end if;
  end loop;
  return listing_id;
end;
$$;
revoke all on function public.reseller_save_product(jsonb,jsonb) from public, anon;
grant execute on function public.reseller_save_product(jsonb,jsonb) to authenticated;

create table public.reseller_import_pilot (
  id boolean primary key check (id),
  requests integer not null check (requests between 0 and 3)
);
alter table public.reseller_import_pilot enable row level security;
revoke all on public.reseller_import_pilot from public, anon, authenticated;
insert into public.reseller_import_pilot values (true, 0);
create function public.reseller_take_import_slot() returns boolean
language sql security invoker set search_path = '' as $$
  with slot as (
    update public.reseller_import_pilot set requests = requests + 1 where id and requests < 3
    returning 1
  ) select exists (select 1 from slot);
$$;
revoke all on function public.reseller_take_import_slot() from public, anon, authenticated;
grant execute on function public.reseller_take_import_slot() to service_role;
grant select, update on public.reseller_import_pilot to service_role;
