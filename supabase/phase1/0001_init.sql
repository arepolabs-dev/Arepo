-- Phase 1 dashboard schema (arepolabs.com /phase1). Apply to the separate Supabase project
-- "arepolabs-phase1", never to the Arepo research database. Idempotent: safe to run twice.
-- Row level security is ON for every table with NO policies, so the anon key alone reads nothing;
-- all access goes through server route handlers using the service role key after the allowlist check.

create extension if not exists pgcrypto;

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  initials text,
  colour text,
  created_at timestamptz not null default now()
);

create table if not exists variants (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('subject','body','opener','ask','follow_up','signature')),
  code text not null,
  label text,
  text text not null,
  tone text check (tone in ('homely','professional','neutral')),
  audience text check (audience in ('trades','shops','cafes','ai_keen','all')),
  status text not null default 'active' check (status in ('active','retired')),
  source text check (source in ('jack','dayyan_edit','v2','v1','tests')),
  created_at timestamptz not null default now(),
  unique (kind, code)
);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  stage int not null check (stage between 1 and 4),
  planned_date date,
  subject_variant_id uuid references variants(id),
  body_variant_id uuid references variants(id),
  owner_id uuid references people(id),
  size_planned int,
  notes text
);

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vertical text,
  trade_or_type text,
  tier text check (tier in ('A','B','C')),
  area text check (area in ('W12/W6','W3-W7','W10/W11/NW10','NW10/NW6')),
  postcode text,
  website text,
  maps_url text,
  public_email text,
  phone_public text,
  source_doc text check (source_doc in ('09','10','11','13','17','notes')),
  owner_id uuid references people(id),
  channel text check (channel in ('email','walk_in','warm','online')),
  company_type text not null default 'unknown'
    check (company_type in ('ltd','llp','sole_trader','partnership','unknown')),
  companies_house_no text,
  consent_recorded boolean not null default false,
  consent_note text,
  -- Computed: a Ltd or LLP may be cold-emailed at its business address; others need recorded consent.
  legal_ok boolean generated always as (company_type in ('ltd','llp') or consent_recorded) stored,
  email_found boolean not null default false,
  status text not null default 'prospect'
    check (status in ('prospect','contacted','replied','call_booked','discovery','proposal','won','lost','do_not_contact')),
  status_changed_at timestamptz not null default now(),
  first_name text,
  opener_general text,
  opener_specific text,
  subject_hint text,
  why_fit text,
  suggested_angle text,
  batch_id uuid references batches(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, area)
);
create index if not exists prospects_status_idx on prospects (status);
create index if not exists prospects_owner_idx on prospects (owner_id);
create index if not exists prospects_email_idx on prospects (lower(public_email));

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  variable text not null check (variable in ('subject','opener','ask','tone','length','send_time','follow_up')),
  variant_a_id uuid references variants(id),
  variant_b_id uuid references variants(id),
  started_at timestamptz,
  batch_size int,
  decision_rule text,
  result text,
  decided_at timestamptz
);

create table if not exists outreach_emails (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  owner_id uuid references people(id),
  batch_id uuid references batches(id),
  test_id uuid references tests(id),
  subject_variant_id uuid references variants(id),
  body_variant_id uuid references variants(id),
  opener_used text,
  to_address text,
  subject text,
  body_rendered text,
  composed_at timestamptz not null default now(),
  sent_at timestamptz,
  gmail_message_id text unique,
  gmail_thread_id text,
  rfc_message_id text,
  follow_up_of uuid references outreach_emails(id),
  status text not null default 'composed' check (status in ('composed','sent','bounced','replied','stopped'))
);
create index if not exists outreach_prospect_idx on outreach_emails (prospect_id);
create index if not exists outreach_thread_idx on outreach_emails (gmail_thread_id);

create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  outreach_email_id uuid references outreach_emails(id) on delete set null,
  prospect_id uuid references prospects(id) on delete set null,
  owner_id uuid references people(id),
  gmail_message_id text not null unique,
  gmail_thread_id text,
  from_address text not null,
  received_at timestamptz not null,
  snippet text,
  body_text text,
  reply_type text not null default 'unclassified'
    check (reply_type in ('unclassified','positive','neutral','no','stop','bounce','auto')),
  classified_by uuid references people(id),
  classified_at timestamptz
);
create index if not exists replies_prospect_idx on replies (prospect_id);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  owner_id uuid references people(id),
  kind text not null check (kind in ('status_change','call_booked','discovery_done','proposal_sent','won','lost','walk_in','note','follow_up_sent')),
  at timestamptz not null default now(),
  detail jsonb
);
create index if not exists events_kind_at_idx on events (kind, at);

create table if not exists mailboxes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references people(id),
  address text not null unique,
  provider text not null default 'gmail' check (provider = 'gmail'),
  refresh_token_enc text,
  history_id text,
  last_sync_at timestamptz,
  last_error text
);

create table if not exists checklist (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('week1','week2','legal','setup','backlog')),
  text text not null,
  owner_id uuid references people(id),
  due date,
  done_at timestamptz,
  sort_order int not null default 0  -- the plan's "order" column; ORDER is a reserved word
);

-- Keep prospects.updated_at honest.
create or replace function phase1_touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists prospects_touch on prospects;
create trigger prospects_touch before update on prospects
  for each row execute function phase1_touch_updated_at();

-- RLS on, no policies: anon and authenticated roles can read and write nothing.
alter table people enable row level security;
alter table batches enable row level security;
alter table prospects enable row level security;
alter table variants enable row level security;
alter table tests enable row level security;
alter table outreach_emails enable row level security;
alter table replies enable row level security;
alter table events enable row level security;
alter table mailboxes enable row level security;
alter table checklist enable row level security;
