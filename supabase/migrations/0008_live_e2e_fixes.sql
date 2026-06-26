-- YardLine live production E2E fixes.
--
-- Additive hardening discovered during live QA. These changes do not weaken
-- auth or RLS; they make intended app writes possible and keep ownership checks
-- explicit.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profile image uploads
-- ---------------------------------------------------------------------------
-- The production profile editor uploads avatars and banners to:
--   avatars/{auth.uid()}/avatar-*.*
--   avatars/{auth.uid()}/banner-*.*
-- Live QA confirmed the bucket exists but authenticated uploads are blocked by
-- storage RLS. Permit users to manage only their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: owner upload" on storage.objects;
create policy "avatars: owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars: owner delete" on storage.objects;
create policy "avatars: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
-- The app inserts reviews without providing an id. Production currently has an
-- id column with no default, causing NOT NULL failures on valid reviews.

do $$ begin
  if to_regclass('public.reviews') is not null
     and exists (
       select 1
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'reviews'
          and column_name = 'id'
          and column_default is null
     ) then
    alter table public.reviews alter column id set default gen_random_uuid();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Budget request creation
-- ---------------------------------------------------------------------------
-- Live QA confirmed an active organization president cannot create a draft
-- budget request. Keep the intended permission model, but make the create
-- policy self-contained instead of relying on helper resolution.

drop policy if exists "budget requests: create" on budget_requests;
create policy "budget requests: create" on budget_requests
  for insert with check (
    created_by = auth.uid()::text
    and (
      public.is_admin()
      or exists (
        select 1
          from organization_members m
         where m.organization_id = budget_requests.organization_id
           and m.user_id::text = auth.uid()::text
           and m.status = 'active'
           and m.role in ('president', 'treasurer', 'officer', 'advisor', 'admin')
      )
    )
  );
