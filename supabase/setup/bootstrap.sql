-- Execute manually in the Supabase SQL editor after replacing ALL placeholders.
-- Do not run on production without approval. Authenticate the administrator through email OTP first.
insert into exclusive_private.admins(user_id)
values ('REPLACE_WITH_VERIFIED_ADMIN_AUTH_USER_UUID'::uuid)
on conflict do nothing;

insert into exclusive_private.campaigns(slug,name,active,starts_at,ends_at)
values ('REPLACE_WITH_CAMPAIGN_SLUG','REPLACE_WITH_CAMPAIGN_NAME',false,
 'REPLACE_WITH_START_ISO_TIMESTAMP'::timestamptz,'REPLACE_WITH_END_ISO_TIMESTAMP'::timestamptz);
-- The desk can subsequently edit limits/dates/activation. There are no invented or demo promo codes.
