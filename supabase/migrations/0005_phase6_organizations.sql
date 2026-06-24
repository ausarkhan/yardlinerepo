-- YardLine Phase 6 — Organizations & Campus Management
--
-- ADDITIVE and non-breaking. Renames nothing, drops no data. Guarded for re-runs.
--
-- APPLY ORDER: 0001 → 0002 → 0003 → 0004 → 0005. This migration reuses Phase 5's
-- notifications table + public.notify() helper (migration 0004) for org alerts, so
-- 0004 must be applied first.
--
-- Apply via the Supabase SQL editor (or `supabase db push`). The environment has
-- no direct DB access, so this ships as a file like every prior phase.
--
-- Reused existing tables (NOT recreated): events (we only ADD columns), profiles,
-- notifications. Existing event functionality (host_id, RLS, YardTix) is preserved.

-- ===========================================================================
-- 1. organizations
-- ===========================================================================
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  category      text not null default 'other',
  mission       text,
  logo          text,
  cover         text,
  contact_email text,
  social_links  jsonb,                 -- { instagram, twitter, website, ... }
  advisor_name  text,
  advisor_email text,
  advisor_id    uuid,                  -- optional linked advisor user
  department    text,
  status        text not null default 'active',  -- pending | active | inactive | archived
  member_count  integer not null default 0,      -- denormalized for discovery
  created_by    uuid not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint organizations_status_check check (status in ('pending', 'active', 'inactive', 'archived')),
  constraint organizations_category_check check (category in (
    'academic', 'cultural', 'greek_life', 'student_government', 'service',
    'religious', 'professional', 'social', 'athletics', 'other'))
);
create index if not exists organizations_status_idx on organizations (status, name);
create index if not exists organizations_category_idx on organizations (category);

-- ===========================================================================
-- 2. organization_members  (roles: member | officer | president | treasurer |
--    advisor | admin)
-- ===========================================================================
create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null,
  role            text not null default 'member',
  status          text not null default 'active',   -- active | removed
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint organization_members_role_check check (
    role in ('member', 'officer', 'president', 'treasurer', 'advisor', 'admin')),
  constraint organization_members_status_check check (status in ('active', 'removed')),
  unique (organization_id, user_id)
);
create index if not exists org_members_org_idx on organization_members (organization_id, status);
create index if not exists org_members_user_idx on organization_members (user_id, status);

-- ===========================================================================
-- 3. organization_join_requests
-- ===========================================================================
create table if not exists organization_join_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null,
  message         text,
  status          text not null default 'pending',  -- pending | approved | denied
  decided_by      uuid,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  constraint org_join_status_check check (status in ('pending', 'approved', 'denied'))
);
-- One OPEN request per (org, user); resolved ones may coexist for history.
create unique index if not exists org_join_pending_idx
  on organization_join_requests (organization_id, user_id) where status = 'pending';
create index if not exists org_join_org_idx on organization_join_requests (organization_id, status);

-- ===========================================================================
-- 4. organization_announcements
-- ===========================================================================
create table if not exists organization_announcements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  author_id       uuid not null,
  title           text not null,
  body            text,
  visibility      text not null default 'public',  -- public | members | officers
  created_at      timestamptz not null default now(),
  constraint org_ann_visibility_check check (visibility in ('public', 'members', 'officers'))
);
create index if not exists org_ann_org_idx on organization_announcements (organization_id, created_at desc);

-- ===========================================================================
-- 5. organization_activity_log
-- ===========================================================================
create table if not exists organization_activity_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id        uuid,
  action          text not null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists org_activity_idx on organization_activity_log (organization_id, created_at desc);

-- ===========================================================================
-- 6. events — add organization linkage (ADD columns only)
-- ===========================================================================
alter table events add column if not exists organization_id uuid;
alter table events add column if not exists host_type text not null default 'user';
do $$ begin
  alter table events add constraint events_host_type_check check (host_type in ('user', 'organization'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table events add constraint events_organization_fk
    foreign key (organization_id) references organizations(id) on delete set null;
exception when duplicate_object then null; end $$;
create index if not exists events_organization_idx on events (organization_id);

-- ===========================================================================
-- 7. Permission helpers (SECURITY DEFINER → evaluate caller's org role)
-- ===========================================================================
create or replace function public.org_role(org uuid) returns text
  language sql stable security definer set search_path = public as $$
  select role from organization_members
   where organization_id = org and user_id = auth.uid() and status = 'active'
   limit 1;
$$;

create or replace function public.is_org_member(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members
    where organization_id = org and user_id = auth.uid() and status = 'active');
$$;

-- Officer tier = can manage members, events, announcements.
create or replace function public.is_org_officer(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.org_role(org) in ('officer', 'president', 'admin');
$$;

-- Leader tier = can manage officers + edit the org profile.
create or replace function public.is_org_leader(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.org_role(org) in ('president', 'admin');
$$;

-- Approver tier = can resolve join requests (officers + advisor).
create or replace function public.is_org_approver(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.org_role(org) in ('officer', 'president', 'admin', 'advisor');
$$;

-- ===========================================================================
-- 8. Row Level Security
-- ===========================================================================
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_join_requests enable row level security;
alter table organization_announcements enable row level security;
alter table organization_activity_log enable row level security;

-- organizations: active ones are publicly discoverable; members see their own
-- (even if inactive); platform admins see all. Anyone may create.
do $$ begin
  create policy "orgs: read" on organizations for select
    using (status = 'active' or public.is_org_member(id) or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "orgs: create" on organizations for insert
    with check (auth.uid() = created_by);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "orgs: leader/admin update" on organizations for update
    using (public.is_org_leader(id) or public.is_admin());
exception when duplicate_object then null; end $$;

-- members: visible to fellow members + admins. Officers add; self/officers remove;
-- officers/admin update roles. The creator's president row is seeded by trigger.
do $$ begin
  create policy "org_members: read" on organization_members for select
    using (public.is_org_member(organization_id) or auth.uid() = user_id or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_members: officer insert" on organization_members for insert
    with check (public.is_org_officer(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_members: manage update" on organization_members for update
    using (public.is_org_officer(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_members: leave or remove" on organization_members for delete
    using (auth.uid() = user_id or public.is_org_officer(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;

-- join requests: self-insert; requester + approvers read; approvers update.
do $$ begin
  create policy "org_join: self insert" on organization_join_requests for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_join: read" on organization_join_requests for select
    using (auth.uid() = user_id or public.is_org_approver(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_join: approver update" on organization_join_requests for update
    using (public.is_org_approver(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;

-- announcements: visibility-scoped read; officer write.
do $$ begin
  create policy "org_ann: read" on organization_announcements for select
    using (
      visibility = 'public'
      or (visibility = 'members' and public.is_org_member(organization_id))
      or (visibility = 'officers' and public.is_org_officer(organization_id))
      or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_ann: officer insert" on organization_announcements for insert
    with check (auth.uid() = author_id and public.is_org_officer(organization_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_ann: officer update" on organization_announcements for update
    using (public.is_org_officer(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_ann: officer delete" on organization_announcements for delete
    using (public.is_org_officer(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;

-- activity log: org-internal read; members/system insert.
do $$ begin
  create policy "org_activity: read" on organization_activity_log for select
    using (public.is_org_member(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "org_activity: member insert" on organization_activity_log for insert
    with check (public.is_org_member(organization_id) or public.is_admin());
exception when duplicate_object then null; end $$;

-- events: let org officers manage their organization's events (additive — the
-- existing host_id = auth.uid() policies remain in force for personal events).
do $$ begin
  create policy "events: org officer insert" on events for insert
    with check (organization_id is null or public.is_org_officer(organization_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "events: org officer update" on events for update
    using (organization_id is not null and public.is_org_officer(organization_id));
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 9. Triggers — member count, activity, notifications (reuse public.notify)
-- ===========================================================================
-- Keep organizations.member_count in sync with active memberships.
create or replace function public.sync_org_member_count() returns trigger
  language plpgsql security definer set search_path = public as $$
declare orgid uuid;
begin
  orgid := coalesce(new.organization_id, old.organization_id);
  update organizations o
     set member_count = (
       select count(*) from organization_members m
        where m.organization_id = orgid and m.status = 'active')
   where o.id = orgid;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_org_member_count on organization_members;
create trigger trg_org_member_count
  after insert or update or delete on organization_members
  for each row execute function public.sync_org_member_count();

-- Seed the creator as president when an organization is created.
create or replace function public.on_org_created() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into organization_members (organization_id, user_id, role, status)
  values (new.id, new.created_by, 'president', 'active')
  on conflict (organization_id, user_id) do nothing;
  insert into organization_activity_log (organization_id, actor_id, action, metadata)
  values (new.id, new.created_by, 'organization_created', jsonb_build_object('name', new.name));
  return new;
end $$;

drop trigger if exists trg_on_org_created on organizations;
create trigger trg_on_org_created after insert on organizations
  for each row execute function public.on_org_created();

-- Join request submitted → notify officers of the org.
create or replace function public.on_join_request_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare officer record; requester_name text;
begin
  select coalesce(name, 'A student') into requester_name from profiles where id = new.user_id;
  for officer in
    select user_id from organization_members
     where organization_id = new.organization_id
       and role in ('officer', 'president', 'admin', 'advisor') and status = 'active'
  loop
    perform public.notify(
      officer.user_id, 'org_join_request', 'New join request',
      requester_name || ' asked to join your organization.',
      '/org-dashboard',
      jsonb_build_object('organization_id', new.organization_id, 'request_id', new.id));
  end loop;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_on_join_request_insert on organization_join_requests;
create trigger trg_on_join_request_insert after insert on organization_join_requests
  for each row execute function public.on_join_request_insert();

-- Join request decided → notify the requester.
create or replace function public.on_join_request_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'denied') then
    perform public.notify(
      new.user_id,
      case when new.status = 'approved' then 'org_join_approved' else 'org_join_denied' end,
      case when new.status = 'approved' then 'Join request approved' else 'Join request denied' end,
      case when new.status = 'approved' then 'You are now a member.' else 'Your request was not approved.' end,
      '/organizations/' || new.organization_id::text,
      jsonb_build_object('organization_id', new.organization_id));
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_on_join_request_update on organization_join_requests;
create trigger trg_on_join_request_update after update on organization_join_requests
  for each row execute function public.on_join_request_update();

-- Officer role assigned → notify the member.
create or replace function public.on_member_role_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and new.role in ('officer', 'president', 'treasurer', 'advisor', 'admin') then
    perform public.notify(
      new.user_id, 'org_role_assigned', 'New organization role',
      'You were assigned the ' || new.role || ' role.',
      '/org-dashboard',
      jsonb_build_object('organization_id', new.organization_id, 'role', new.role));
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_on_member_role_update on organization_members;
create trigger trg_on_member_role_update after update on organization_members
  for each row execute function public.on_member_role_update();

-- New announcement → notify members (respecting visibility).
create or replace function public.on_announcement_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in
    select user_id, role from organization_members
     where organization_id = new.organization_id and status = 'active'
  loop
    -- officers-only announcements skip plain members
    if new.visibility = 'officers' and m.role not in ('officer','president','admin','treasurer','advisor') then
      continue;
    end if;
    if m.user_id = new.author_id then continue; end if;
    perform public.notify(
      m.user_id, 'org_announcement', 'New announcement', new.title,
      '/organizations/' || new.organization_id::text,
      jsonb_build_object('organization_id', new.organization_id, 'announcement_id', new.id));
  end loop;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_on_announcement_insert on organization_announcements;
create trigger trg_on_announcement_insert after insert on organization_announcements
  for each row execute function public.on_announcement_insert();

-- Organization event created → notify officers + log activity.
create or replace function public.on_org_event_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare officer record;
begin
  if new.host_type = 'organization' and new.organization_id is not null then
    insert into organization_activity_log (organization_id, actor_id, action, metadata)
    values (new.organization_id, new.host_id, 'event_created',
            jsonb_build_object('event_id', new.id, 'title', new.title));
    for officer in
      select user_id from organization_members
       where organization_id = new.organization_id
         and role in ('officer','president','admin') and status = 'active'
         and user_id <> coalesce(new.host_id, '00000000-0000-0000-0000-000000000000')
    loop
      perform public.notify(
        officer.user_id, 'org_event_created', 'New organization event',
        coalesce(new.title, 'An event') || ' was created.',
        '/event/' || new.id::text,
        jsonb_build_object('organization_id', new.organization_id, 'event_id', new.id));
    end loop;
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_on_org_event_insert on events;
create trigger trg_on_org_event_insert after insert on events
  for each row execute function public.on_org_event_insert();
