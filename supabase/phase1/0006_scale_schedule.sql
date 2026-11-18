-- 0006: every prospect and phase on the site, company-type gate, scheduled and server-side sending.
alter table programme_prospects
  add column if not exists company_type text,          -- ltd | llp | plc | sole_trader | partnership | individual | unclear | null (not checked)
  add column if not exists ch_number text,
  add column if not exists walk_in boolean not null default false;

alter table phases
  add column if not exists depends_on text,            -- phase_id whose result this phase waits for
  add column if not exists depends_inferred boolean not null default false,
  add column if not exists starts_on date;

alter table outreach_emails
  add column if not exists send_at timestamptz,        -- when the server may send this queued email (UK time picked in the page)
  add column if not exists attempted_at timestamptz;

alter table outreach_emails drop constraint if exists outreach_emails_status_check;
alter table outreach_emails add constraint outreach_emails_status_check
  check (status in ('composed','queued','sending','sent','bounced','replied','stopped','failed'));

create index if not exists outreach_emails_due_idx on outreach_emails (send_at) where status = 'queued';
