-- Phase 1 migration 0004: the phased outreach programme (tracks, phases, programme prospects, messages,
-- reply playbook, review log, lead requests). ADDITIVE ONLY: nothing existing is dropped or rewritten.
-- NOT applied by the build. Apply after 0001 to 0003. Same access model as 0001: RLS on, no policies,
-- so only the server (service role, after the allowlist check) reads or writes.
-- Idempotent: safe to run twice.

create table if not exists programme_meta (
  key text primary key,                -- version, written, senders, statuses, metrics, dashboard_notes
  value jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,            -- e.g. startups, local
  name text not null,
  sender text,                         -- who sends this track (e.g. Dayyan, Jack)
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  phase_id text not null unique,
  track_key text not null,
  ord int not null default 0,
  variable text,                       -- the one thing this phase tests
  hypothesis text,
  variants jsonb,                      -- {"A": ..., "B": ...}
  send_days jsonb,
  followup_days jsonb,
  judge_on date,
  winner_rule text,
  min_sample int not null default 0,
  on_a_wins text,
  on_b_wins text,
  on_c_wins text,
  on_no_signal text,
  status text not null default 'planned' check (status in ('planned','active','judged')),
  winner text,                         -- A, B, C or none
  judged_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists phases_track_idx on phases (track_key, ord);

create table if not exists programme_prospects (
  id uuid primary key default gen_random_uuid(),
  ext_id text not null unique,
  prospect_id uuid references prospects(id) on delete set null,   -- the core prospect row (sending, replies, metrics)
  track_key text not null,
  phase_id text,
  variant text,
  segment text,
  area_kind text check (area_kind in ('local','non_local')),
  company text not null,
  contact_name text,
  email text,
  website text,
  what_they_do text,
  hook text,
  source text,
  send_slot text,
  status text not null default 'ready',    -- new -> approved -> contacted -> replied ... ; skipped; do_not_contact
  request_id uuid,                         -- the lead request that found it
  email_norm text,                         -- lower-cased email: never added twice
  domain_norm text,                        -- website or email domain (not free mail): never added twice
  created_at timestamptz not null default now()
);
create unique index if not exists programme_prospects_email_key on programme_prospects (email_norm) where email_norm is not null;
create unique index if not exists programme_prospects_domain_key on programme_prospects (domain_norm) where domain_norm is not null;
create index if not exists programme_prospects_phase_idx on programme_prospects (phase_id);

create table if not exists programme_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_ext_id text not null,
  step text not null check (step in ('first','followup1','followup2')),
  subject text,
  body text,
  send_on date,
  template boolean not null default false,   -- {{winner}} style slots are filled when the batch is built
  status text not null default 'pending' check (status in ('pending','sent','skipped')),
  outreach_email_id uuid references outreach_emails(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (prospect_ext_id, step)
);
create index if not exists programme_messages_due_idx on programme_messages (status, send_on);

create table if not exists reply_playbook (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  track_key text not null default 'all',
  detect_cues jsonb,
  reply_subject text,
  reply_body text,
  next_status text,
  retouch boolean not null default false,    -- needs a human touch before sending
  created_at timestamptz not null default now(),
  unique (category, track_key)
);

create table if not exists review_log (
  id uuid primary key default gen_random_uuid(),
  reviewed_on date not null default current_date,
  track_key text,
  sends int,
  replies_by_variant jsonb,
  learnings text,
  decision text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists lead_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by text,
  track text not null,
  count int not null default 20 check (count between 1 and 200),
  area text not null default 'London, anywhere',
  note text,
  status text not null default 'pending' check (status in ('pending','working','done','failed')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  result_count int
);

-- Replies: the playbook category found (or chosen) and the prepared reply that was sent.
alter table replies add column if not exists playbook_category text;
alter table replies add column if not exists reply_sent_at timestamptz;
alter table replies add column if not exists reply_sent_message_id text;

alter table programme_meta enable row level security;
alter table tracks enable row level security;
alter table phases enable row level security;
alter table programme_prospects enable row level security;
alter table programme_messages enable row level security;
alter table reply_playbook enable row level security;
alter table review_log enable row level security;
alter table lead_requests enable row level security;
