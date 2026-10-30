-- Run as the project administrator, after storing the two values in Supabase Vault.
-- Never place the cleanup secret in a public repository or in cron.job.command.
create extension if not exists pg_cron;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

do $check$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='exclusive_cleanup_url' and decrypted_secret ~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/exclusive-cleanup$')
 or not exists(select 1 from vault.decrypted_secrets where name='exclusive_cleanup_secret' and length(decrypted_secret)>=32)
 then raise exception 'Store exclusive_cleanup_url and exclusive_cleanup_secret in Vault before scheduling cleanup'; end if;
end $check$;

-- A named job is updated when this script is run again; no duplicate daily job is created.
select cron.schedule('exclusive-daily-cleanup','17 3 * * *', $job$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='exclusive_cleanup_url'),
   headers := jsonb_build_object('Content-Type','application/json','x-cleanup-secret',
     (select decrypted_secret from vault.decrypted_secrets where name='exclusive_cleanup_secret')),
   body := '{}'::jsonb,
   timeout_milliseconds := 30000
 );
$job$);

-- This result contains configuration metadata only, never secret values or personal data.
select jobname,schedule,active from cron.job where jobname='exclusive-daily-cleanup';
-- The schedule uses the database timezone (UTC by default).
-- Monitor cron.job_run_details AND net._http_response: a successful SQL job only queues HTTP.
-- The endpoint returns 500 when Auth deletions need retrying; queue entries survive failure.
