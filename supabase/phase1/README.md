# Phase 1 database

Schema for the private `/phase1` dashboard (arepolabs.com). It lives in its own Supabase project
(`arepolabs-phase1`), never in the Arepo research database.

## Apply

1. Create the Supabase project. Sign-in is by passkey (app-side, see `0003_passkeys.sql`), so
   Supabase Auth settings and Auth users are no longer used.
2. Run `0001_init.sql` once in the SQL editor, or from a shell:
   `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/phase1/0001_init.sql`
   The file is idempotent (safe to run twice).
3. Check it on a throwaway local Postgres first if you like:
   `createdb phase1_test && psql phase1_test -v ON_ERROR_STOP=1 -f supabase/phase1/0001_init.sql`

Every table has row level security on and no policies: the anon key reads nothing. The app reads and
writes only through `/phase1/api/*` route handlers using `SUPABASE_SERVICE_ROLE_KEY` after the
allowlist check. `prospects.legal_ok` is a generated column; never write it.

Also in this folder, NOT applied yet (review first): `0003_outreach_send.sql` (mailboxes, send-as, enquiries, plan targets) and `seed_0001.sql` (107 prospects, 35 variants, 6 tests, 34 plan targets). Apply 0003 before the seed.

## Sign-in settings Dayyan must set

Apply `0003_passkeys.sql` (passkeys, invites, challenges; RLS on, no policies). No Supabase Auth redirect
URLs are needed any more. Then set the passkey env vars and create invites: `frontend/scripts/phase1/README.md`.
- Vercel env (Preview and Production): see `frontend/.env.example`, "/phase1" block.
