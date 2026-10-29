create function public.sgc_extra_expenses_total(items jsonb) returns numeric language plpgsql immutable security invoker set search_path = '' as $$
declare item jsonb; total numeric := 0; value numeric;
begin
if jsonb_typeof(items) <> 'array' then raise exception 'Expenses must be a list'; end if;
for item in select * from jsonb_array_elements(items) loop
if jsonb_typeof(item->'label') is distinct from 'string' or length(btrim(item->>'label')) not between 1 and 200 or jsonb_typeof(item->'amount') is distinct from 'number' then raise exception 'Each expense needs a label and amount'; end if;
value := (item->>'amount')::numeric;
if value < 0.01 or value <> round(value,2) then raise exception 'Expense amounts must be positive with at most two decimals'; end if;
total := total + value;
end loop;
return total;
end $$;
alter table public.sgc_financial_receipts add column extra_expenses jsonb not null default '[]'::jsonb;
alter table public.sgc_financial_receipts alter column profit_allocation set expression as (amount - ads_allocation - savings_allocation - tools_allocation - public.sgc_extra_expenses_total(extra_expenses));
alter table public.sgc_financial_receipts drop constraint sgc_financial_allocations_check;
alter table public.sgc_financial_receipts add constraint sgc_financial_allocations_check check (ads_allocation + savings_allocation + tools_allocation + public.sgc_extra_expenses_total(extra_expenses) <= amount);
