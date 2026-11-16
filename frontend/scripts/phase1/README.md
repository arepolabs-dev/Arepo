# Phase 1 passkey sign-in

/phase1 signs in with a passkey (WebAuthn, SimpleWebAuthn). There is no password and no emailed link.
Only addresses in `PHASE1_ALLOWED_EMAILS` can enrol or sign in; the allowlist is re-checked on every request.

## Environment variable names (values never in the repo)

| Name | What | Production | Vercel preview |
|---|---|---|---|
| `PHASE1_SESSION_SECRET` | HMAC key for the session cookie, 32+ random chars, server only | its own random value | a different random value |
| `PHASE1_RP_ID` | WebAuthn relying party ID | `arepolabs.com` | the preview host exactly, e.g. `<branch>-<team>.vercel.app` |
| `PHASE1_ORIGINS` | comma-separated exact origins | `https://www.arepolabs.com,https://arepolabs.com` | `https://<that preview host>` |
| `PHASE1_ALLOWED_EMAILS` | allowlist (existing) | the 2 addresses | same |
| `NEXT_PUBLIC_SITE_URL` | base of printed invite links (existing) | `https://www.arepolabs.com` | the preview URL |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | data project (existing) | set | set |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is no longer used. Passkeys are bound to the RP ID: a passkey made on a
preview host does not work on production, and the other way round, so enrol again per environment.

## Create an invite (run by hand, never in CI)

    npm --prefix frontend exec tsx -- --env-file=frontend/.env.local frontend/scripts/phase1/invite.ts <email>

(or from `frontend/`: `npx tsx --env-file=.env.local scripts/phase1/invite.ts <email>`.) It refuses emails
not on the allowlist, stores only the sha256 of the token, and prints
`${NEXT_PUBLIC_SITE_URL}/phase1/enrol?token=...`. The link works once and expires after 7 days. A second
passkey for the same person needs a fresh invite. A lost passkey is replaced the same way.

Apply `supabase/phase1/0003_passkeys.sql` to the phase1 Supabase project first.
