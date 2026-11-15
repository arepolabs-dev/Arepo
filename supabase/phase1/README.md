# Phase 1 database

Schema for the private `/phase1` dashboard (arepolabs.com). It lives in its own Supabase project
(`arepolabs-phase1`), never in the Arepo research database.

## Apply

1. Create the Supabase project. Auth settings: magic link on, "Allow new users to sign up" off, then
   create the 2 users by hand (Authentication > Users > Add user, "Auto confirm").
2. Run `0001_init.sql` once in the SQL editor, or from a shell:
   `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/phase1/0001_init.sql`
   The file is idempotent (safe to run twice).
3. Check it on a throwaway local Postgres first if you like:
   `createdb phase1_test && psql phase1_test -v ON_ERROR_STOP=1 -f supabase/phase1/0001_init.sql`

Every table has row level security on and no policies: the anon key reads nothing. The app reads and
writes only through `/phase1/api/*` route handlers using `SUPABASE_SERVICE_ROLE_KEY` after the
allowlist check. `prospects.legal_ok` is a generated column; never write it.

Later migrations: `0002_views.sql` (metrics views, WP6).

## Auth settings Dayyan must set

- Site URL: `https://www.arepolabs.com`
- Redirect URLs: `https://www.arepolabs.com/phase1/auth/callback` and the preview pattern
  `https://*-dayyansheikh.vercel.app/phase1/auth/callback` (confirm the team slug), plus
  `http://localhost:3000/phase1/auth/callback` for local runs.
- Vercel env (Preview and Production): see `frontend/.env.example`, "/phase1" block.
