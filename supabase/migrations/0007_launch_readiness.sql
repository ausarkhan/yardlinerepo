-- YardLine launch readiness hardening.
--
-- Additive profile fields used by the production profile editor. No existing
-- tables or columns are renamed.

alter table profiles add column if not exists bio text;
alter table profiles add column if not exists banner text;
alter table profiles add column if not exists social_links jsonb not null default '{}'::jsonb;

do $$ begin
  alter table profiles add constraint profiles_social_links_object_check
    check (jsonb_typeof(social_links) = 'object');
exception when duplicate_object then null; end $$;
