-- YardLine live organization engagement QA fixes.
--
-- Closed organizations must not accept membership requests, even if a caller
-- bypasses the frontend and inserts directly through the REST API.
-- Organization verification is also a privileged platform/admin state; normal
-- org creators and leaders can manage profile details but cannot self-verify.

create or replace function public.prevent_self_org_verification() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' and new.verification_level is distinct from 'community' then
    raise exception 'Only admins can verify organizations.';
  end if;

  if tg_op = 'UPDATE' and new.verification_level is distinct from old.verification_level then
    raise exception 'Only admins can change organization verification.';
  end if;

  return new;
end $$;

drop trigger if exists trg_prevent_self_org_verification on organizations;
create trigger trg_prevent_self_org_verification
  before insert or update on organizations
  for each row execute function public.prevent_self_org_verification();

drop policy if exists "org_join: self insert" on organization_join_requests;
create policy "org_join: self insert" on organization_join_requests
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
        from organizations o
       where o.id = organization_id
         and o.status = 'active'
         and o.membership_policy = 'approval_required'
    )
  );

drop policy if exists "budget requests: create" on budget_requests;
create policy "budget requests: create" on budget_requests
  for insert with check (
    created_by = auth.uid()::text
    and public.budget_can_submit(organization_id)
    and exists (
      select 1
        from organizations o
       where o.id = organization_id
         and o.status = 'active'
         and o.verification_level = 'verified'
    )
  );

drop policy if exists "conversations: participant insert" on conversations;
create policy "conversations: participant insert" on conversations
  for insert with check (
    (
      context_type is distinct from 'organization'
      and (
        auth.uid()::text = participant_a
        or auth.uid()::text = participant_b
      )
    )
    or (
      context_type = 'organization'
      and context_id is not null
      and context_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and participant_b = 'org:' || context_id
      and exists (
        select 1
          from organizations o
         where o.id = context_id::uuid
           and o.status = 'active'
      )
      and (
        auth.uid()::text = participant_a
        or public.is_org_approver(context_id::uuid)
        or public.is_admin()
      )
    )
  );
