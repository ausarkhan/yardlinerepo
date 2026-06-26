-- YardLine live organization engagement follow-up.
--
-- Migration 0010 correctly requires verified organizations for official budget
-- requests, but live QA still saw budget_requests INSERT denied even when the
-- caller was an active president and budget_can_submit(org) returned true.
-- Keep the same rules, evaluated through one SECURITY DEFINER helper, so the
-- create policy does not depend on policy-expression subqueries.

create or replace function public.budget_can_create_verified_request(
  org uuid,
  creator text
) returns boolean
  language sql stable security definer set search_path = public as $$
  select creator = auth.uid()::text
      and public.budget_can_submit(org)
      and exists (
        select 1
          from organizations o
         where o.id = org
           and o.status = 'active'
           and o.verification_level = 'verified'
      );
$$;

drop policy if exists "budget requests: create" on budget_requests;
create policy "budget requests: create" on budget_requests
  for insert with check (
    public.budget_can_create_verified_request(organization_id, created_by)
  );
