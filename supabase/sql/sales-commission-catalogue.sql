create policy sales_rates_consultant_read on public.sales_rates
for select to authenticated using ((select sales_private.sales_role())='consultant');
