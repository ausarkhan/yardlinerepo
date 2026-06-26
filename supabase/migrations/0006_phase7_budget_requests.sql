-- YardLine Phase 7 - Budget Requests and Campus Funding Workflow
--
-- YardLine manages requests, documentation, approval workflow, status tracking,
-- comments, and finance export readiness. It does not move university funds.
--
-- Compatible with production profiles.id stored as text. All user identity
-- comparisons cast auth.uid() and organization_members.user_id to text.

create extension if not exists pgcrypto;

-- ===========================================================================
-- 1. Core tables
-- ===========================================================================
create table if not exists budget_requests (
  id uuid primary key default gen_random_uuid()
);

alter table budget_requests add column if not exists organization_id uuid;
alter table budget_requests add column if not exists title text;
alter table budget_requests add column if not exists description text;
alter table budget_requests add column if not exists linked_event_id uuid;
alter table budget_requests add column if not exists amount_requested_cents integer not null default 0;
alter table budget_requests add column if not exists amount_approved_cents integer;
alter table budget_requests add column if not exists needed_by_date date;
alter table budget_requests add column if not exists category text;
alter table budget_requests add column if not exists purpose text;
alter table budget_requests add column if not exists vendor_name text;
alter table budget_requests add column if not exists vendor_email text;
alter table budget_requests add column if not exists vendor_phone text;
alter table budget_requests add column if not exists vendor_website text;
alter table budget_requests add column if not exists advisor_name text;
alter table budget_requests add column if not exists advisor_email text;
alter table budget_requests add column if not exists status text not null default 'draft';
alter table budget_requests add column if not exists admin_notes text;
alter table budget_requests add column if not exists created_by text;
alter table budget_requests add column if not exists submitted_at timestamptz;
alter table budget_requests add column if not exists approved_at timestamptz;
alter table budget_requests add column if not exists paid_at timestamptz;
alter table budget_requests add column if not exists closed_at timestamptz;
alter table budget_requests add column if not exists created_at timestamptz not null default now();
alter table budget_requests add column if not exists updated_at timestamptz not null default now();

alter table budget_requests alter column created_by type text using created_by::text;
alter table budget_requests alter column organization_id set not null;
alter table budget_requests alter column title set not null;
alter table budget_requests alter column amount_requested_cents set not null;
alter table budget_requests alter column amount_requested_cents set default 0;
alter table budget_requests alter column status set not null;
alter table budget_requests alter column status set default 'draft';
alter table budget_requests alter column created_by set not null;
alter table budget_requests alter column created_at set not null;
alter table budget_requests alter column created_at set default now();
alter table budget_requests alter column updated_at set not null;
alter table budget_requests alter column updated_at set default now();

do $$ begin
  alter table budget_requests add constraint budget_requests_org_fk
    foreign key (organization_id) references organizations(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table budget_requests add constraint budget_requests_event_fk
    foreign key (linked_event_id) references events(id) on delete set null;
exception when duplicate_object then null; when undefined_table then null; end $$;

do $$ begin
  alter table budget_requests add constraint budget_requests_amounts_check check (
    amount_requested_cents >= 0
    and (amount_approved_cents is null or amount_approved_cents >= 0)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table budget_requests add constraint budget_requests_status_check check (status in (
    'draft',
    'submitted',
    'advisor_review',
    'admin_review',
    'changes_requested',
    'approved',
    'partially_approved',
    'denied',
    'cancelled',
    'paid',
    'closed'
  ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table budget_requests add constraint budget_requests_category_check check (category in (
    'event_supplies',
    'food_catering',
    'venue',
    'travel',
    'speaker_performer',
    'marketing',
    'equipment',
    'security',
    'decorations',
    'printing',
    'other'
  ));
exception when duplicate_object then null; end $$;

create table if not exists budget_request_line_items (
  id uuid primary key default gen_random_uuid()
);

alter table budget_request_line_items add column if not exists budget_request_id uuid;
alter table budget_request_line_items add column if not exists item_name text;
alter table budget_request_line_items add column if not exists description text;
alter table budget_request_line_items add column if not exists quantity numeric(12, 2) not null default 1;
alter table budget_request_line_items add column if not exists unit_cost_cents integer not null default 0;
alter table budget_request_line_items add column if not exists total_cost_cents integer not null default 0;
alter table budget_request_line_items add column if not exists vendor text;
alter table budget_request_line_items add column if not exists notes text;
alter table budget_request_line_items add column if not exists created_at timestamptz not null default now();
alter table budget_request_line_items add column if not exists updated_at timestamptz not null default now();

alter table budget_request_line_items alter column budget_request_id set not null;
alter table budget_request_line_items alter column item_name set not null;
alter table budget_request_line_items alter column quantity set not null;
alter table budget_request_line_items alter column quantity set default 1;
alter table budget_request_line_items alter column unit_cost_cents set not null;
alter table budget_request_line_items alter column unit_cost_cents set default 0;
alter table budget_request_line_items alter column total_cost_cents set not null;
alter table budget_request_line_items alter column total_cost_cents set default 0;
alter table budget_request_line_items alter column created_at set not null;
alter table budget_request_line_items alter column created_at set default now();
alter table budget_request_line_items alter column updated_at set not null;
alter table budget_request_line_items alter column updated_at set default now();

do $$ begin
  alter table budget_request_line_items add constraint budget_line_items_request_fk
    foreign key (budget_request_id) references budget_requests(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table budget_request_line_items add constraint budget_line_items_amounts_check check (
    quantity > 0 and unit_cost_cents >= 0 and total_cost_cents >= 0
  );
exception when duplicate_object then null; end $$;

create table if not exists budget_request_attachments (
  id uuid primary key default gen_random_uuid()
);

alter table budget_request_attachments add column if not exists budget_request_id uuid;
alter table budget_request_attachments add column if not exists uploaded_by text;
alter table budget_request_attachments add column if not exists file_name text;
alter table budget_request_attachments add column if not exists file_path text;
alter table budget_request_attachments add column if not exists file_type text;
alter table budget_request_attachments add column if not exists file_size integer;
alter table budget_request_attachments add column if not exists document_type text;
alter table budget_request_attachments add column if not exists created_at timestamptz not null default now();

alter table budget_request_attachments alter column uploaded_by type text using uploaded_by::text;
alter table budget_request_attachments alter column budget_request_id set not null;
alter table budget_request_attachments alter column uploaded_by set not null;
alter table budget_request_attachments alter column file_name set not null;
alter table budget_request_attachments alter column file_path set not null;
alter table budget_request_attachments alter column created_at set not null;
alter table budget_request_attachments alter column created_at set default now();

do $$ begin
  alter table budget_request_attachments add constraint budget_attachments_request_fk
    foreign key (budget_request_id) references budget_requests(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table budget_request_attachments add constraint budget_attachments_doc_type_check check (
    document_type is null or document_type in (
      'vendor_quote',
      'receipt',
      'flyer',
      'event_proposal',
      'contract',
      'screenshot',
      'budget_breakdown',
      'approval_letter',
      'other'
    )
  );
exception when duplicate_object then null; end $$;

create table if not exists budget_request_comments (
  id uuid primary key default gen_random_uuid()
);

alter table budget_request_comments add column if not exists budget_request_id uuid;
alter table budget_request_comments add column if not exists actor_id text;
alter table budget_request_comments add column if not exists body text;
alter table budget_request_comments add column if not exists visibility text not null default 'organization';
alter table budget_request_comments add column if not exists created_at timestamptz not null default now();

alter table budget_request_comments alter column actor_id type text using actor_id::text;
alter table budget_request_comments alter column budget_request_id set not null;
alter table budget_request_comments alter column actor_id set not null;
alter table budget_request_comments alter column body set not null;
alter table budget_request_comments alter column visibility set not null;
alter table budget_request_comments alter column visibility set default 'organization';
alter table budget_request_comments alter column created_at set not null;
alter table budget_request_comments alter column created_at set default now();

do $$ begin
  alter table budget_request_comments add constraint budget_comments_request_fk
    foreign key (budget_request_id) references budget_requests(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table budget_request_comments add constraint budget_comments_visibility_check check (
    visibility in ('organization', 'advisor_admin', 'admin')
  );
exception when duplicate_object then null; end $$;

create table if not exists budget_request_decisions (
  id uuid primary key default gen_random_uuid()
);

alter table budget_request_decisions add column if not exists budget_request_id uuid;
alter table budget_request_decisions add column if not exists actor_id text;
alter table budget_request_decisions add column if not exists previous_status text;
alter table budget_request_decisions add column if not exists new_status text;
alter table budget_request_decisions add column if not exists amount_approved_cents integer;
alter table budget_request_decisions add column if not exists reason text;
alter table budget_request_decisions add column if not exists created_at timestamptz not null default now();

alter table budget_request_decisions alter column actor_id type text using actor_id::text;
alter table budget_request_decisions alter column budget_request_id set not null;
alter table budget_request_decisions alter column new_status set not null;
alter table budget_request_decisions alter column created_at set not null;
alter table budget_request_decisions alter column created_at set default now();

do $$ begin
  alter table budget_request_decisions add constraint budget_decisions_request_fk
    foreign key (budget_request_id) references budget_requests(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 2. Indexes
-- ===========================================================================
create index if not exists budget_requests_org_idx on budget_requests (organization_id, created_at desc);
create index if not exists budget_requests_status_idx on budget_requests (status, created_at desc);
create index if not exists budget_requests_created_by_idx on budget_requests (created_by, created_at desc);
create index if not exists budget_requests_needed_by_idx on budget_requests (needed_by_date);
create index if not exists budget_requests_category_idx on budget_requests (category);
create index if not exists budget_line_items_request_idx on budget_request_line_items (budget_request_id);
create index if not exists budget_attachments_request_idx on budget_request_attachments (budget_request_id);
create unique index if not exists budget_attachments_path_idx on budget_request_attachments (file_path);
create index if not exists budget_comments_request_idx on budget_request_comments (budget_request_id, created_at);
create index if not exists budget_decisions_request_idx on budget_request_decisions (budget_request_id, created_at);

-- ===========================================================================
-- 3. Storage bucket metadata and storage RLS policies
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'budget-request-attachments',
  'budget-request-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ===========================================================================
-- 4. Permission helpers
-- ===========================================================================
create or replace function public.budget_org_role(org uuid) returns text
  language sql stable security definer set search_path = public as $$
  select role
    from organization_members
   where organization_id = org
     and user_id::text = auth.uid()::text
     and status = 'active'
   limit 1;
$$;

create or replace function public.budget_is_org_member(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from organization_members
     where organization_id = org
       and user_id::text = auth.uid()::text
       and status = 'active'
  );
$$;

create or replace function public.budget_can_submit(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.budget_org_role(org) in ('president', 'treasurer', 'officer', 'advisor', 'admin');
$$;

create or replace function public.budget_can_review_as_advisor(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.budget_org_role(org) in ('advisor', 'admin');
$$;

create or replace function public.budget_can_view(req uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from budget_requests br
     where br.id = req
       and (
         public.is_admin()
         or public.budget_is_org_member(br.organization_id)
         or br.created_by = auth.uid()::text
       )
  );
$$;

create or replace function public.budget_can_edit(req uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from budget_requests br
     where br.id = req
       and br.status in ('draft', 'changes_requested')
       and (
         public.is_admin()
         or br.created_by = auth.uid()::text
         or public.budget_can_submit(br.organization_id)
       )
  );
$$;

do $$ begin
  create policy "budget attachments: authenticated upload" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'budget-request-attachments'
      and exists (
        select 1
          from budget_requests br
         where br.id::text = split_part(name, '/', 1)
           and public.budget_can_edit(br.id)
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "budget attachments: request viewers read" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'budget-request-attachments'
      and exists (
        select 1
          from budget_requests br
         where br.id::text = split_part(name, '/', 1)
           and public.budget_can_view(br.id)
      )
    );
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 5. RLS
-- ===========================================================================
alter table budget_requests enable row level security;
alter table budget_request_line_items enable row level security;
alter table budget_request_attachments enable row level security;
alter table budget_request_comments enable row level security;
alter table budget_request_decisions enable row level security;

drop policy if exists "budget requests: view" on budget_requests;
create policy "budget requests: view" on budget_requests
  for select using (public.budget_can_view(id));

drop policy if exists "budget requests: create" on budget_requests;
create policy "budget requests: create" on budget_requests
  for insert with check (
    created_by = auth.uid()::text
    and public.budget_can_submit(organization_id)
  );

drop policy if exists "budget requests: edit draft" on budget_requests;
create policy "budget requests: edit draft" on budget_requests
  for update using (public.budget_can_edit(id) or public.is_admin())
  with check (public.budget_can_view(id));

drop policy if exists "budget line items: view" on budget_request_line_items;
create policy "budget line items: view" on budget_request_line_items
  for select using (public.budget_can_view(budget_request_id));

drop policy if exists "budget line items: insert" on budget_request_line_items;
create policy "budget line items: insert" on budget_request_line_items
  for insert with check (public.budget_can_edit(budget_request_id));

drop policy if exists "budget line items: update" on budget_request_line_items;
create policy "budget line items: update" on budget_request_line_items
  for update using (public.budget_can_edit(budget_request_id))
  with check (public.budget_can_edit(budget_request_id));

drop policy if exists "budget line items: delete" on budget_request_line_items;
create policy "budget line items: delete" on budget_request_line_items
  for delete using (public.budget_can_edit(budget_request_id));

drop policy if exists "budget attachments: view" on budget_request_attachments;
create policy "budget attachments: view" on budget_request_attachments
  for select using (public.budget_can_view(budget_request_id));

drop policy if exists "budget attachments: insert" on budget_request_attachments;
create policy "budget attachments: insert" on budget_request_attachments
  for insert with check (
    uploaded_by = auth.uid()::text
    and public.budget_can_edit(budget_request_id)
  );

drop policy if exists "budget comments: view" on budget_request_comments;
create policy "budget comments: view" on budget_request_comments
  for select using (
    public.budget_can_view(budget_request_id)
    and (
      visibility = 'organization'
      or public.is_admin()
      or exists (
        select 1 from budget_requests br
         where br.id = budget_request_id
           and public.budget_can_review_as_advisor(br.organization_id)
      )
    )
  );

drop policy if exists "budget comments: insert" on budget_request_comments;
create policy "budget comments: insert" on budget_request_comments
  for insert with check (
    actor_id = auth.uid()::text
    and public.budget_can_view(budget_request_id)
    and (visibility <> 'admin' or public.is_admin())
  );

drop policy if exists "budget decisions: view" on budget_request_decisions;
create policy "budget decisions: view" on budget_request_decisions
  for select using (public.budget_can_view(budget_request_id));

drop policy if exists "budget decisions: insert" on budget_request_decisions;
create policy "budget decisions: insert" on budget_request_decisions
  for insert with check (public.is_admin());

-- ===========================================================================
-- 6. Triggers and workflow functions
-- ===========================================================================
create or replace function public.budget_touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_budget_requests_touch on budget_requests;
create trigger trg_budget_requests_touch before update on budget_requests
  for each row execute function public.budget_touch_updated_at();

drop trigger if exists trg_budget_line_items_touch on budget_request_line_items;
create trigger trg_budget_line_items_touch before update on budget_request_line_items
  for each row execute function public.budget_touch_updated_at();

create or replace function public.budget_line_item_total() returns trigger
  language plpgsql as $$
begin
  new.total_cost_cents := round(new.quantity * new.unit_cost_cents)::integer;
  return new;
end $$;

drop trigger if exists trg_budget_line_item_total on budget_request_line_items;
create trigger trg_budget_line_item_total before insert or update on budget_request_line_items
  for each row execute function public.budget_line_item_total();

create or replace function public.sync_budget_request_amount() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  req uuid;
begin
  req := coalesce(new.budget_request_id, old.budget_request_id);
  update budget_requests br
     set amount_requested_cents = coalesce((
       select sum(total_cost_cents)::integer
         from budget_request_line_items li
        where li.budget_request_id = req
     ), 0),
         updated_at = now()
   where br.id = req;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_budget_line_items_sync_amount on budget_request_line_items;
create trigger trg_budget_line_items_sync_amount
  after insert or update or delete on budget_request_line_items
  for each row execute function public.sync_budget_request_amount();

create or replace function public.budget_notify_org_reviewers(
  p_org uuid, p_type text, p_title text, p_body text, p_link text, p_data jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  reviewer record;
begin
  for reviewer in
    select distinct user_id::text as user_id
      from organization_members
     where organization_id = p_org
       and status = 'active'
       and role in ('president', 'treasurer', 'officer', 'advisor', 'admin')
  loop
    perform public.notify(reviewer.user_id, p_type, p_title, p_body, p_link, p_data);
  end loop;
end $$;

create or replace function public.budget_transition(
  p_request_id uuid,
  p_new_status text,
  p_reason text default null,
  p_amount_approved_cents integer default null,
  p_admin_notes text default null
) returns budget_requests
  language plpgsql security definer set search_path = public as $$
declare
  br budget_requests%rowtype;
  old_status text;
  actor text := auth.uid()::text;
  link text;
begin
  select * into br from budget_requests where id = p_request_id for update;
  if not found then
    raise exception 'Budget request not found';
  end if;

  old_status := br.status;

  if p_new_status not in (
    'draft', 'submitted', 'advisor_review', 'admin_review', 'changes_requested',
    'approved', 'partially_approved', 'denied', 'cancelled', 'paid', 'closed'
  ) then
    raise exception 'Unsupported budget request status: %', p_new_status;
  end if;

  if p_new_status in ('denied', 'changes_requested') and coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required for denial or requested changes';
  end if;

  if p_new_status in ('submitted', 'advisor_review', 'admin_review') then
    if not public.budget_can_submit(br.organization_id) then
      raise exception 'Not allowed to submit this budget request';
    end if;
  elsif p_new_status in ('approved', 'partially_approved') then
    if not public.is_admin() then
      raise exception 'Only admins can approve budget requests';
    end if;
  elsif p_new_status in ('denied', 'changes_requested') then
    if not public.is_admin() and not public.budget_can_review_as_advisor(br.organization_id) then
      raise exception 'Not allowed to review this budget request';
    end if;
  elsif p_new_status in ('paid', 'closed') then
    if not public.is_admin() then
      raise exception 'Only admins can set this budget request status';
    end if;
  elsif p_new_status = 'cancelled' then
    if not public.is_admin() and not public.budget_can_submit(br.organization_id) then
      raise exception 'Not allowed to cancel this budget request';
    end if;
  end if;

  update budget_requests
     set status = p_new_status,
         amount_approved_cents = case
           when p_new_status in ('approved', 'partially_approved') then coalesce(p_amount_approved_cents, amount_requested_cents)
           when p_new_status = 'denied' then 0
           else coalesce(p_amount_approved_cents, amount_approved_cents)
         end,
         admin_notes = coalesce(p_admin_notes, admin_notes),
         submitted_at = case when p_new_status in ('submitted', 'advisor_review', 'admin_review') and submitted_at is null then now() else submitted_at end,
         approved_at = case when p_new_status in ('approved', 'partially_approved') then now() else approved_at end,
         paid_at = case when p_new_status = 'paid' then now() else paid_at end,
         closed_at = case when p_new_status = 'closed' then now() else closed_at end,
         updated_at = now()
   where id = p_request_id
   returning * into br;

  insert into budget_request_decisions (
    budget_request_id, actor_id, previous_status, new_status, amount_approved_cents, reason
  ) values (
    p_request_id, actor, old_status, p_new_status, br.amount_approved_cents, nullif(trim(coalesce(p_reason, '')), '')
  );

  insert into organization_activity_log (organization_id, actor_id, action, metadata)
  values (
    br.organization_id,
    actor,
    'budget_request_' || p_new_status,
    jsonb_build_object('budget_request_id', br.id, 'title', br.title, 'previous_status', old_status, 'new_status', p_new_status)
  );

  link := '/budget-requests/' || br.id::text;

  if p_new_status in ('submitted', 'advisor_review') then
    perform public.budget_notify_org_reviewers(
      br.organization_id,
      'budget_advisor_review_needed',
      'Budget request needs review',
      br.title,
      link,
      jsonb_build_object('budget_request_id', br.id, 'organization_id', br.organization_id)
    );
  elsif p_new_status = 'admin_review' then
    perform public.budget_notify_org_reviewers(
      br.organization_id,
      'budget_admin_review_needed',
      'Budget request sent to admin review',
      br.title,
      link,
      jsonb_build_object('budget_request_id', br.id, 'organization_id', br.organization_id)
    );
  elsif p_new_status in ('changes_requested', 'approved', 'partially_approved', 'denied', 'paid') then
    perform public.notify(
      br.created_by,
      'budget_request_' || p_new_status,
      case p_new_status
        when 'changes_requested' then 'Budget changes requested'
        when 'approved' then 'Budget request approved'
        when 'partially_approved' then 'Budget request partially approved'
        when 'denied' then 'Budget request denied'
        when 'paid' then 'Budget request marked paid'
        else 'Budget request updated'
      end,
      coalesce(p_reason, br.title),
      link,
      jsonb_build_object('budget_request_id', br.id, 'organization_id', br.organization_id, 'status', p_new_status)
    );
  end if;

  return br;
end $$;

create or replace function public.on_budget_comment_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  br budget_requests%rowtype;
begin
  select * into br from budget_requests where id = new.budget_request_id;
  if not found then
    return new;
  end if;

  perform public.budget_notify_org_reviewers(
    br.organization_id,
    'budget_comment_added',
    'New budget request comment',
    left(new.body, 140),
    '/budget-requests/' || br.id::text,
    jsonb_build_object('budget_request_id', br.id, 'organization_id', br.organization_id, 'comment_id', new.id)
  );
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists trg_on_budget_comment_insert on budget_request_comments;
create trigger trg_on_budget_comment_insert after insert on budget_request_comments
  for each row execute function public.on_budget_comment_insert();
