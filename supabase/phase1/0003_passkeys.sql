-- Phase 1 passkey sign-in (WebAuthn). Replaces the emailed magic link. Apply to the separate
-- "arepolabs-phase1" Supabase project only. Idempotent. RLS on, no policies: only the server-side
-- service role key (after the allowlist check) can touch these tables.
-- Note: numbered 0003 as requested; 0003_outreach_send.sql also exists. They touch different tables
-- and are independent, so order does not matter.

create table if not exists passkeys (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  credential_id text not null unique,      -- base64url
  public_key text not null,                -- base64url of the COSE key
  counter bigint not null default 0,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_email_idx on passkeys (email);

-- One-time enrolment invites. Only the sha256 of the token is stored, never the token.
create table if not exists passkey_invites (
  token_hash text primary key,             -- hex sha256
  email text not null,
  expires_at timestamptz not null,         -- created + 7 days
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Short-lived, single-use WebAuthn challenges (5 minutes). The browser holds only the row id in an
-- HttpOnly cookie; the row is deleted when used.
create table if not exists passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  purpose text not null check (purpose in ('enrol','login')),
  email text,                              -- enrol only
  invite_hash text,                        -- enrol only
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table passkeys enable row level security;
alter table passkey_invites enable row level security;
alter table passkey_challenges enable row level security;
