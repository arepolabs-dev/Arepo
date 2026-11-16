-- Phase 1 migration 0003: sending from the dashboard, reply sync, the plan targets and the shared enquiries inbox.
-- NOT applied by the build. Apply after 0001 and 0002, then run seed_0001.sql.
-- Same access model as 0001: RLS on, no policies, so only the server (service role, after the allowlist
-- check) can read or write. Gmail refresh tokens stay encrypted (AES-GCM, PHASE1_TOKEN_KEY) in mailboxes.

-- Mailboxes: each person connects a PERSONAL Gmail account that sends as their arepolabs address
-- (Gmail "Send mail as" alias); one SHARED mailbox (enquiries@) can be used by every allowed person.
alter table mailboxes add column if not exists kind text not null default 'personal'
  check (kind in ('personal','shared'));
alter table mailboxes add column if not exists send_as text;                       -- e.g. dayyan.sheikh@arepolabs.com
alter table mailboxes add column if not exists send_as_name text;                  -- display name on the From header
alter table mailboxes add column if not exists send_as_verified boolean not null default false;
alter table mailboxes add column if not exists status text not null default 'connected'
  check (status in ('connected','needs_reconnect'));
alter table mailboxes add column if not exists connected_at timestamptz;
alter table mailboxes add column if not exists scopes text;

-- Outbound queue and audit: a composed row is a queued email; sending fills the gmail ids.
alter table outreach_emails add column if not exists mailbox_id uuid references mailboxes(id) on delete set null;
alter table outreach_emails add column if not exists from_address text;
alter table outreach_emails add column if not exists sent_via text check (sent_via in ('gmail','manual'));
alter table outreach_emails add column if not exists send_error text;
create index if not exists outreach_sent_idx on outreach_emails (owner_id, sent_at);
create index if not exists outreach_rfc_idx on outreach_emails (rfc_message_id);

-- Replies: how an inbound message was matched.
alter table replies add column if not exists mailbox_id uuid references mailboxes(id) on delete set null;
alter table replies add column if not exists matched_by text check (matched_by in ('thread','in_reply_to','address','bounce'));
alter table replies add column if not exists subject text;

-- A test is unique by name so the seed can run twice.
create unique index if not exists tests_name_key on tests (name);
alter table tests add column if not exists winner text check (winner in ('a','b','none'));

-- Targets from doc 06 (weekly GTM plan, plan-of-action headline table, rates).
create table if not exists plan_targets (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('week','headline','rate')),
  period text not null,
  metric text not null,
  target numeric not null,
  cumulative boolean not null default true,
  note text,
  unique (scope, period, metric)
);

-- Mail that arrived in the SHARED mailbox and matched no prospect: listed in the Enquiries view.
-- Mail in a personal mailbox that matches no prospect is never stored.
create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid references mailboxes(id) on delete cascade,
  gmail_message_id text not null unique,
  gmail_thread_id text,
  from_address text not null,
  from_name text,
  subject text,
  snippet text,
  received_at timestamptz not null,
  handled_at timestamptz,
  handled_by uuid references people(id)
);
create index if not exists enquiries_received_idx on enquiries (received_at desc);

alter table plan_targets enable row level security;
alter table enquiries enable row level security;
