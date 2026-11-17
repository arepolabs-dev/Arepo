-- Phase 1 migration 0005: one email per prospect, step AND voice, so both people can send any track from their
-- own Gmail with copy signed by them. ADDITIVE ONLY. NOT applied by the build. Apply after 0004. Idempotent.
--
-- `sender` is a sender key: the lower-cased first name ("dayyan", "jack"). NULL keeps the old meaning: the copy
-- is in the voice of the prospect's track sender (tracks.sender). The dashboard shows a phase as "No emails in
-- your voice yet" on a tab with no matching rows, so loading the other voice is a plain insert of new rows:
--   programme_messages (prospect_ext_id, step, sender, subject, body, send_on, template, status='pending')
-- one row per existing (prospect_ext_id, step) with sender set to the OTHER person's key.

alter table programme_messages add column if not exists sender text;

-- The old one-per-(prospect, step) rule gives way to one-per-(prospect, step, voice).
alter table programme_messages drop constraint if exists programme_messages_prospect_ext_id_step_key;
create unique index if not exists programme_messages_prospect_step_voice_key
  on programme_messages (prospect_ext_id, step, coalesce(sender, ''));
create index if not exists programme_messages_sender_idx on programme_messages (sender);
