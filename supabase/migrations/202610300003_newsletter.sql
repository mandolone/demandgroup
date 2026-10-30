-- Optional monthly updates are independent from eligibility for a promotional code.
create table exclusive_private.newsletter_subscriptions (
 email_key text primary key,
 email text,
 user_id uuid references auth.users(id) on delete set null,
 verified_at timestamptz not null,
 consented_at timestamptz not null default now(),
 consent_version text not null,
 consent_text text not null,
 source_partner text references exclusive_private.partners(id),
 source_campaign uuid references exclusive_private.campaigns(id),
 withdrawn_at timestamptz,
 expires_at timestamptz not null default now()+interval '24 months'
);
create table exclusive_private.newsletter_consent_events (
 id bigint generated always as identity primary key,
 email_key text not null,
 event text not null check(event in ('subscribed','withdrawn','expired')),
 consent_version text not null,
 consent_text text not null,
 recorded_at timestamptz not null default now()
);
alter table exclusive_private.newsletter_subscriptions enable row level security;
alter table exclusive_private.newsletter_consent_events enable row level security;
revoke all on exclusive_private.newsletter_subscriptions,exclusive_private.newsletter_consent_events from public,anon,authenticated;

create function public.exclusive_newsletter(p_action text,p_input jsonb default '{}',p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 mail text; verified timestamptz; ident text; enabled boolean; existing exclusive_private.newsletter_subscriptions;
 version constant text:='monthly-watchfaces-2026-10-30-v1';
 wording constant text:='Yes, email me up to once a month about new Demand Group watch faces. I can unsubscribe at any time. Signing up is optional and does not affect my complimentary code.';
 result jsonb; partner text; campaign uuid;
begin
 if p_action in ('admin_newsletter_export','admin_newsletter_withdrawals') then
   if not exists(select 1 from exclusive_private.admins where user_id=p_actor) then raise exception 'ADMIN_REQUIRED'; end if;
   if p_action='admin_newsletter_export' then
     select coalesce(jsonb_agg(jsonb_build_object('email',email,'consented_at',consented_at,'verified_at',verified_at,'consent_version',consent_version,'consent_text',consent_text,'source_partner',source_partner) order by consented_at),'[]') into result
     from exclusive_private.newsletter_subscriptions where withdrawn_at is null and expires_at>now() and email is not null;
   else
     select coalesce(jsonb_agg(jsonb_build_object('email',email,'withdrawn_at',coalesce(withdrawn_at,expires_at))),'[]') into result
     from exclusive_private.newsletter_subscriptions where (withdrawn_at is not null or expires_at<=now()) and email is not null;
   end if;
   return jsonb_build_object('contacts',result);
 end if;
 select lower(trim(email)),email_confirmed_at into mail,verified from auth.users where id=p_actor and email_confirmed_at is not null and coalesce(is_anonymous,false)=false;
 if mail is null then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;
 select encode(extensions.hmac(convert_to(mail,'UTF8'),pepper,'sha256'),'hex') into ident from exclusive_private.settings;
 perform pg_advisory_xact_lock(hashtextextended(ident,3));
 select * into existing from exclusive_private.newsletter_subscriptions where email_key=ident;
 if p_action='newsletter_status' then
   return jsonb_build_object('subscribed',coalesce(existing.withdrawn_at is null and existing.expires_at>now() and existing.email is not null,false));
 elsif p_action='newsletter_set' then
   if jsonb_typeof(p_input->'enabled') is distinct from 'boolean' then raise exception 'EXPLICIT_NEWSLETTER_CHOICE_REQUIRED'; end if;
   enabled:=(p_input->>'enabled')::boolean;
   if enabled then
     if p_input->>'consent_version' is distinct from version then raise exception 'CONSENT_VERSION_REQUIRED'; end if;
     -- Retrying an opted-in request never renews consent or silently changes attribution.
     if existing.email_key is not null and existing.withdrawn_at is null and existing.expires_at>now() then return jsonb_build_object('subscribed',true); end if;
     select id into partner from exclusive_private.partners where id=p_input->>'partner' and active;
     select id into campaign from exclusive_private.campaigns where slug=p_input->>'campaign';
     insert into exclusive_private.newsletter_subscriptions(email_key,email,user_id,verified_at,consent_version,consent_text,source_partner,source_campaign)
     values(ident,mail,p_actor,verified,version,wording,partner,campaign)
     on conflict(email_key) do update set email=excluded.email,user_id=excluded.user_id,verified_at=excluded.verified_at,
       consented_at=now(),consent_version=excluded.consent_version,consent_text=excluded.consent_text,
       source_partner=excluded.source_partner,source_campaign=excluded.source_campaign,withdrawn_at=null,expires_at=now()+interval '24 months';
     insert into exclusive_private.newsletter_consent_events(email_key,event,consent_version,consent_text) values(ident,'subscribed',version,wording);
   elsif existing.email_key is not null and existing.withdrawn_at is null then
     update exclusive_private.newsletter_subscriptions set withdrawn_at=now() where email_key=ident;
     insert into exclusive_private.newsletter_consent_events(email_key,event,consent_version,consent_text) values(ident,'withdrawn',existing.consent_version,existing.consent_text);
   end if;
   return jsonb_build_object('subscribed',enabled);
 end if;
 raise exception 'INVALID_ACTION';
end $$;

create function public.exclusive_newsletter_cleanup() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into exclusive_private.newsletter_consent_events(email_key,event,consent_version,consent_text)
 select email_key,'expired',consent_version,consent_text from exclusive_private.newsletter_subscriptions where withdrawn_at is null and expires_at<=now();
 update exclusive_private.newsletter_subscriptions set withdrawn_at=expires_at where withdrawn_at is null and expires_at<=now();
 -- Operators export withdrawals before every send. Keep addresses only for a 30-day synchronization window.
 update exclusive_private.newsletter_subscriptions set email=null,user_id=null where withdrawn_at<now()-interval '30 days';
 delete from exclusive_private.newsletter_consent_events e where e.recorded_at<now()-interval '24 months' and not exists(select 1 from exclusive_private.newsletter_subscriptions s where s.email_key=e.email_key and s.withdrawn_at is null);
 delete from exclusive_private.newsletter_subscriptions where withdrawn_at<now()-interval '24 months';
end $$;
revoke all on function public.exclusive_newsletter(text,jsonb,uuid),public.exclusive_newsletter_cleanup() from public,anon,authenticated;
grant execute on function public.exclusive_newsletter(text,jsonb,uuid),public.exclusive_newsletter_cleanup() to service_role;
