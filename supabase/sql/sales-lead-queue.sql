create or replace function sales_private.guard_lead() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.opted_out or new.stage='Do not contact' then
  new.opted_out=true;
  new.stage='Do not contact';
 end if;
 if new.stage is distinct from old.stage and new.stage='Preview sent' and not exists(select 1 from public.sales_previews where lead=new.id and stage in ('Sent to customer','Accepted') and url is not null) then
  raise exception 'Record confirmed preview delivery first';
 end if;
 if new.stage is distinct from old.stage and new.stage in ('Payment confirmed','Closed successfully') and not exists(select 1 from public.sales_payments where lead=new.id and status='Verified') then
  raise exception 'This stage requires a verified workflow event';
 end if;
 return new;
end $$;

-- Assignment changes go through the two RPCs below. Other lead edits retain their RLS policies.
revoke update (assignee) on public.sales_leads from authenticated;

create index sales_lead_claim_order on public.sales_leads(created_at,id)
 where assignee is null and not opted_out and stage not in ('Closed successfully','Not interested','Do not contact');

create function sales_private.claim_lead() returns uuid
language plpgsql security definer set search_path='' as $$
declare claimed_id uuid;
begin
 if sales_private.sales_role() is distinct from 'consultant' then
  raise exception 'Active consultant access required' using errcode='42501';
 end if;
 with next_lead as (
  select id from public.sales_leads
  where assignee is null and not opted_out and stage not in ('Closed successfully','Not interested','Do not contact')
  order by created_at,id
  limit 1 for update skip locked
 )
 update public.sales_leads lead set assignee=auth.uid()
 from next_lead where lead.id=next_lead.id
 returning lead.id into claimed_id;
 return claimed_id;
end $$;

create function sales_private.assign_lead(lead_id uuid, expected_assignee uuid, consultant_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare assigned_id uuid;
begin
 if sales_private.sales_role() is distinct from 'admin' then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if consultant_id is not null and not exists (
  select 1 from public.sales_team where id=consultant_id and active
 ) then
  raise exception 'Choose an active team member';
 end if;
 update public.sales_leads set assignee=consultant_id
 where id=lead_id and assignee is not distinct from expected_assignee
 returning id into assigned_id;
 if assigned_id is null then
  raise exception 'This lead assignment has changed. Refresh and try again.';
 end if;
 return assigned_id;
end $$;

create function public.sales_claim_lead() returns uuid
language sql set search_path='' as $$ select sales_private.claim_lead() $$;
create function public.sales_assign_lead(lead_id uuid, expected_assignee uuid, consultant_id uuid) returns uuid
language sql set search_path='' as $$ select sales_private.assign_lead(lead_id,expected_assignee,consultant_id) $$;

revoke all on function sales_private.claim_lead(),sales_private.assign_lead(uuid,uuid,uuid),
 public.sales_claim_lead(),public.sales_assign_lead(uuid,uuid,uuid) from public,anon;
grant execute on function sales_private.claim_lead(),sales_private.assign_lead(uuid,uuid,uuid),
 public.sales_claim_lead(),public.sales_assign_lead(uuid,uuid,uuid) to authenticated;
