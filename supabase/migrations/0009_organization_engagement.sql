-- YardLine organization engagement.
--
-- Reuses Phase 6 organization tables and Phase 5 conversations/messages. Adds
-- only the columns and policies needed for richer membership requests and a
-- shared organization inbox.

-- ---------------------------------------------------------------------------
-- 1. Organization metadata
-- ---------------------------------------------------------------------------
alter table organizations add column if not exists membership_policy text not null default 'approval_required';
alter table organizations add column if not exists verification_level text not null default 'community';

do $$ begin
  alter table organizations add constraint organizations_membership_policy_check
    check (membership_policy in ('open', 'approval_required', 'closed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table organizations add constraint organizations_verification_level_check
    check (verification_level in ('community', 'verified'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Richer membership requests
-- ---------------------------------------------------------------------------
alter table organization_join_requests add column if not exists classification_year text;
alter table organization_join_requests add column if not exists major text;
alter table organization_join_requests add column if not exists interests text;

-- ---------------------------------------------------------------------------
-- 3. Shared organization inbox over existing conversations/messages
-- ---------------------------------------------------------------------------
-- Convention:
--   conversations.context_type = 'organization'
--   conversations.context_id   = organizations.id::text
--   conversations.participant_a = requester user id
--   conversations.participant_b = 'org:' || organizations.id
--
-- The requester remains a direct participant; active approver roles can view
-- and reply on behalf of the organization even as leadership changes.

drop policy if exists "conversations: participant read" on conversations;
create policy "conversations: participant read" on conversations
  for select using (
    auth.uid()::text = participant_a
    or auth.uid()::text = participant_b
    or public.is_admin()
    or (
      context_type = 'organization'
      and context_id is not null
      and public.is_org_approver(context_id::uuid)
    )
  );

drop policy if exists "conversations: participant insert" on conversations;
create policy "conversations: participant insert" on conversations
  for insert with check (
    auth.uid()::text = participant_a
    or auth.uid()::text = participant_b
    or (
      context_type = 'organization'
      and context_id is not null
      and public.is_org_approver(context_id::uuid)
    )
  );

drop policy if exists "conversations: participant update" on conversations;
create policy "conversations: participant update" on conversations
  for update using (
    auth.uid()::text = participant_a
    or auth.uid()::text = participant_b
    or (
      context_type = 'organization'
      and context_id is not null
      and public.is_org_approver(context_id::uuid)
    )
  );

drop policy if exists "messages: participant read" on messages;
create policy "messages: participant read" on messages
  for select using (exists (
    select 1
      from conversations c
     where c.id = conversation_id
       and (
         auth.uid()::text = c.participant_a
         or auth.uid()::text = c.participant_b
         or public.is_admin()
         or (
           c.context_type = 'organization'
           and c.context_id is not null
           and public.is_org_approver(c.context_id::uuid)
         )
       )
  ));

drop policy if exists "messages: sender insert" on messages;
create policy "messages: sender insert" on messages
  for insert with check (
    auth.uid()::text = sender_id
    and exists (
      select 1
        from conversations c
       where c.id = conversation_id
         and (
           auth.uid()::text = c.participant_a
           or auth.uid()::text = c.participant_b
           or (
             c.context_type = 'organization'
             and c.context_id is not null
             and public.is_org_approver(c.context_id::uuid)
           )
         )
    )
  );

drop policy if exists "messages: participant update" on messages;
create policy "messages: participant update" on messages
  for update using (exists (
    select 1
      from conversations c
     where c.id = conversation_id
       and (
         auth.uid()::text = c.participant_a
         or auth.uid()::text = c.participant_b
         or (
           c.context_type = 'organization'
           and c.context_id is not null
           and public.is_org_approver(c.context_id::uuid)
         )
       )
  ));

-- ---------------------------------------------------------------------------
-- 4. Membership guardrails
-- ---------------------------------------------------------------------------
-- Open organizations can be joined directly by the requester. Approval-required
-- and closed orgs still go through join requests / officer action.
drop policy if exists "org_members: self open join" on organization_members;
create policy "org_members: self open join" on organization_members
  for insert with check (
    auth.uid() = user_id
    and role = 'member'
    and status = 'active'
    and exists (
      select 1
        from organizations o
       where o.id = organization_id
         and o.membership_policy = 'open'
         and o.status = 'active'
    )
  );

-- Presidents/admins manage roles. Officers keep join-request approval power,
-- but cannot promote/demote members.
drop policy if exists "org_members: manage update" on organization_members;
create policy "org_members: manage update" on organization_members
  for update
  using (public.is_org_leader(organization_id) or public.is_admin())
  with check (public.is_org_leader(organization_id) or public.is_admin());

drop policy if exists "org_members: leave or remove" on organization_members;
create policy "org_members: leave or remove" on organization_members
  for delete using (
    auth.uid() = user_id
    or public.is_org_leader(organization_id)
    or public.is_admin()
  );

create or replace function public.prevent_zero_org_presidents() returns trigger
  language plpgsql security definer set search_path = public as $$
declare remaining integer;
declare orgid uuid;
begin
  orgid := coalesce(old.organization_id, new.organization_id);

  if tg_op = 'DELETE' then
    if old.role = 'president' and old.status = 'active' then
      select count(*) into remaining
        from organization_members
       where organization_id = old.organization_id
         and id <> old.id
         and role = 'president'
         and status = 'active';
      if remaining = 0 then
        raise exception 'Organizations must have at least one active president.';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'president'
     and old.status = 'active'
     and (new.role is distinct from old.role or new.status is distinct from old.status) then
    select count(*) into remaining
      from organization_members
     where organization_id = old.organization_id
       and id <> old.id
       and role = 'president'
       and status = 'active';
    if remaining = 0 then
      raise exception 'Organizations must have at least one active president.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_prevent_zero_org_presidents on organization_members;
create trigger trg_prevent_zero_org_presidents
  before update or delete on organization_members
  for each row execute function public.prevent_zero_org_presidents();
