-- Enable pg_cron and pg_net in Supabase Extensions first.
-- In Vault create exclusive_cleanup_url (actual function URL) and exclusive_cleanup_secret.
-- The latter must match EXCLUSIVE_CLEANUP_SECRET set on the Edge Function.
select cron.schedule('exclusive-daily-cleanup','17 3 * * *', $$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='exclusive_cleanup_url'),
   headers := jsonb_build_object('Content-Type','application/json','x-cleanup-secret',
     (select decrypted_secret from vault.decrypted_secrets where name='exclusive_cleanup_secret')),
   body := '{}'::jsonb
 );
$$);
-- Monitor cron.job_run_details AND net._http_response for failed requests.
-- The endpoint returns 500 when Auth deletions need retrying; queue entries survive failure.
