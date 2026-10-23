-- The public form explicitly includes its UUID and enquiry type.
-- Keep submissions limited to form fields; existing RLS enforces consent
-- and the New status. Do not expose staff fields or enquiry reads.
grant insert (id,name,email,phone,service,destination,deadline,message,consent,enquiry_type)
on public.djp_enquiries to anon, authenticated;
