-- Server-side sending: every minute pg_cron calls the app's protected route through pg_net.
-- The shared secret lives only in the vault (name phase1_cron_secret); it is never written in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- The route asks the database whether a bearer token is the vault secret (so the secret never needs to be in an env var).
create or replace function public.phase1_cron_ok(s text) returns boolean
language sql security definer set search_path = public, vault as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'phase1_cron_secret' and decrypted_secret = s);
$$;
revoke all on function public.phase1_cron_ok(text) from public, anon, authenticated;
grant execute on function public.phase1_cron_ok(text) to service_role;

-- One tick: POST the app route with the vault secret. No secret yet means no call.
create or replace function public.phase1_cron_tick(path text default '/phase1/api/cron/send') returns bigint
language plpgsql security definer set search_path = public, vault, net as $$
declare sec text; rid bigint;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'phase1_cron_secret';
  if sec is null then return null; end if;
  select net.http_post(url := 'https://www.arepolabs.com' || path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || sec),
    body := '{}'::jsonb, timeout_milliseconds := 25000) into rid;
  return rid;
end $$;
revoke all on function public.phase1_cron_tick(text) from public, anon, authenticated;

select cron.unschedule('phase1-send-due') where exists (select 1 from cron.job where jobname = 'phase1-send-due');
select cron.schedule('phase1-send-due', '* * * * *', $$select public.phase1_cron_tick()$$);
