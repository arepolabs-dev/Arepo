-- Founder profiles for the public "Who we are" section, edited at /phase1/profiles.
-- Apply to the same Supabase project as 0001_init.sql ("arepolabs-phase1"). Idempotent.
-- "Allowlisted" here means the signed-in email is in the `people` table, which the dashboard fills
-- on first sign-in and only for emails on PHASE1_ALLOWED_EMAILS (see lib/phase1/supabase.ts).

create table if not exists site_profiles (
  slug text primary key check (slug in ('dayyan', 'jack')),
  name text,
  role text,
  bio text,
  proof text,
  email text,
  calendly text,
  photo_url text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table site_profiles enable row level security;

drop policy if exists site_profiles_read on site_profiles;
create policy site_profiles_read on site_profiles
  for select to anon, authenticated using (true);

drop policy if exists site_profiles_insert on site_profiles;
create policy site_profiles_insert on site_profiles
  for insert to authenticated
  with check (lower(auth.jwt() ->> 'email') in (select lower(email) from people));

drop policy if exists site_profiles_update on site_profiles;
create policy site_profiles_update on site_profiles
  for update to authenticated
  using (lower(auth.jwt() ->> 'email') in (select lower(email) from people))
  with check (lower(auth.jwt() ->> 'email') in (select lower(email) from people));

-- Public bucket for the founders' photos: images only, 5 MB max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-photos', 'team-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Public buckets serve files by URL without a select policy; writes need the allowlist.
drop policy if exists team_photos_insert on storage.objects;
create policy team_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'team-photos' and lower(auth.jwt() ->> 'email') in (select lower(email) from people));

drop policy if exists team_photos_update on storage.objects;
create policy team_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'team-photos' and lower(auth.jwt() ->> 'email') in (select lower(email) from people))
  with check (bucket_id = 'team-photos' and lower(auth.jwt() ->> 'email') in (select lower(email) from people));
