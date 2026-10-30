-- All inventory and identity data lives outside exposed schemas.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists exclusive_private;
revoke all on schema exclusive_private from public, anon, authenticated;
create table exclusive_private.settings (singleton boolean primary key default true check(singleton), pepper bytea not null default extensions.gen_random_bytes(32));
insert into exclusive_private.settings(singleton) values(true);
create table exclusive_private.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table exclusive_private.partners (
 id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{0,63}$'), name text not null check(length(name) between 1 and 100), active boolean not null default true
);
create table exclusive_private.campaigns (
 id uuid primary key default gen_random_uuid(), slug text unique not null,
 name text not null, active boolean not null default false,
 starts_at timestamptz not null default now(), ends_at timestamptz not null,
 user_limit integer not null default 1 check(user_limit between 1 and 20),
 purged_at timestamptz,
 retention_days integer not null default 90 check(retention_days between 1 and 365),
 check(ends_at > starts_at)
);
create table exclusive_private.watchfaces (
 id text primary key, package_name text unique not null, name text not null,
 description text not null, image text not null check(image like '/products/%'), active boolean not null default true
);
create table exclusive_private.identities (
 id text primary key, user_id uuid unique references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table exclusive_private.identity_campaigns (
 campaign_id uuid references exclusive_private.campaigns(id), identity_id text references exclusive_private.identities(id),
 primary key(campaign_id,identity_id)
);
create table exclusive_private.imports (
 id uuid primary key, campaign_id uuid not null references exclusive_private.campaigns(id),
 partner_id text not null references exclusive_private.partners(id), watchface_id text not null references exclusive_private.watchfaces(id),
 imported_at timestamptz not null default now(), row_count integer not null, admin_id uuid references auth.users(id) on delete set null
);
create table exclusive_private.codes (
 id uuid primary key default gen_random_uuid(), code text unique not null check(code ~ '^[A-Z0-9]{6,100}$'),
 campaign_id uuid not null references exclusive_private.campaigns(id), partner_id text not null references exclusive_private.partners(id),
 watchface_id text not null references exclusive_private.watchfaces(id), import_id uuid not null references exclusive_private.imports(id),
 status text not null default 'AVAILABLE' check(status in ('AVAILABLE','RESERVED','ASSIGNED','EXPIRED','DISABLED')),
 imported_at timestamptz not null default now(), assigned_at timestamptz, recipient_id text references exclusive_private.identities(id),
 expires_at timestamptz not null, unique(id,campaign_id,partner_id,watchface_id),
 check((status='ASSIGNED' and assigned_at is not null) or (status<>'ASSIGNED' and assigned_at is null and recipient_id is null))
);
create index code_stock on exclusive_private.codes(campaign_id,partner_id,watchface_id,expires_at) where status='AVAILABLE';
create table exclusive_private.assignments (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references exclusive_private.campaigns(id),
 identity_id text not null references exclusive_private.identities(id), partner_id text not null, watchface_id text not null,
 code_id uuid unique not null, slot integer not null check(slot between 1 and 20), assigned_at timestamptz not null default now(),
 unique(campaign_id,identity_id,slot), unique(campaign_id,identity_id,watchface_id),
 foreign key(code_id,campaign_id,partner_id,watchface_id) references exclusive_private.codes(id,campaign_id,partner_id,watchface_id)
);
create table exclusive_private.events (
 id bigint generated always as identity primary key, campaign_id uuid not null references exclusive_private.campaigns(id),
 partner_id text not null references exclusive_private.partners(id), kind text not null check(kind in ('visit','verified','assigned','import','settings')),
 watchface_id text references exclusive_private.watchfaces(id), created_at timestamptz not null default now()
);
create table exclusive_private.verifications (
 campaign_id uuid references exclusive_private.campaigns(id), identity_id text references exclusive_private.identities(id),
 partner_id text references exclusive_private.partners(id), primary key(campaign_id,identity_id)
);
create table exclusive_private.visit_dedup (
 campaign_id uuid references exclusive_private.campaigns(id), partner_id text references exclusive_private.partners(id),
 session_id uuid not null, day date default current_date, primary key(campaign_id,partner_id,session_id,day)
);
create table exclusive_private.rate_limits (key text primary key, hits integer not null, expires_at timestamptz not null);
-- Defense in depth: private schema, no direct table grants, RLS without client policies.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='exclusive_private' loop
 execute format('alter table exclusive_private.%I enable row level security',t);
 execute format('revoke all on exclusive_private.%I from public, anon, authenticated',t);
 end loop;
end $$;

-- Only the Edge Function's service role can execute entry points. Actor is from getUser(), never request JSON.
create function public.exclusive_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer; begin
 insert into exclusive_private.rate_limits as r(key,hits,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when r.expires_at<=now() then 1 else r.hits+1 end,
 expires_at=case when r.expires_at<=now() then excluded.expires_at else r.expires_at end returning hits into n;
 return n<=p_limit;
end $$;

create function public.exclusive_api(p_action text,p_input jsonb default '{}',p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 camp exclusive_private.campaigns; selected exclusive_private.codes; partner exclusive_private.partners;
 ident text; mail text; admin boolean; result jsonb; existing jsonb; n integer; lim integer; import_uuid uuid;
 face text; part text; expiry timestamptz;
begin
 select exists(select 1 from exclusive_private.admins where user_id=p_actor) into admin;
 if p_action like 'admin_%' and not admin then raise exception 'ADMIN_REQUIRED'; end if;
 select * into camp from exclusive_private.campaigns where slug=p_input->>'campaign' for share;
 if camp.id is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
 if p_action='catalog' then
   if not camp.active or now()<camp.starts_at or now()>=camp.ends_at then raise exception 'CAMPAIGN_CLOSED'; end if;
   select * into partner from exclusive_private.partners where id=p_input->>'partner' and active;
   if partner.id is null then raise exception 'PARTNER_UNAVAILABLE'; end if;
   select jsonb_agg(jsonb_build_object('id',w.id,'available',exists(select 1 from exclusive_private.codes c where c.campaign_id=camp.id and c.partner_id=partner.id and c.watchface_id=w.id and c.status='AVAILABLE' and c.expires_at>now()))) into result from exclusive_private.watchfaces w where active;
   return jsonb_build_object('partner',partner.name,'limit',camp.user_limit,'ends_at',camp.ends_at,'items',coalesce(result,'[]'));
 elsif p_action='visit' then
   if camp.active and now() between camp.starts_at and camp.ends_at and exists(select 1 from exclusive_private.partners where id=p_input->>'partner' and active) then
     insert into exclusive_private.visit_dedup(campaign_id,partner_id,session_id) values(camp.id,p_input->>'partner',(p_input->>'session_id')::uuid) on conflict do nothing;
     if found then insert into exclusive_private.events(campaign_id,partner_id,kind) values(camp.id,p_input->>'partner','visit'); end if;
   end if;
   return '{}'::jsonb;
 elsif p_action in ('mine','claim') then
   select lower(trim(email)) into mail from auth.users where id=p_actor and email_confirmed_at is not null and coalesce(is_anonymous,false)=false;
   if mail is null then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;
   if camp.purged_at is not null then
     if p_action='mine' then return jsonb_build_object('assignments','[]'::jsonb); end if;
     raise exception 'CAMPAIGN_CLOSED';
   end if;
   perform pg_advisory_xact_lock(hashtextextended(p_actor::text,2));
   select id into ident from exclusive_private.identities where user_id=p_actor;
   if ident is null then select encode(extensions.hmac(convert_to(mail,'UTF8'),pepper,'sha256'),'hex') into ident from exclusive_private.settings; end if;
   -- Same verified email remains the same identity after account recreation.
   perform pg_advisory_xact_lock(hashtextextended(camp.id::text||ident,0));
   insert into exclusive_private.identities(id,user_id) values(ident,p_actor) on conflict(id) do update set user_id=excluded.user_id;
   if camp.purged_at is null then insert into exclusive_private.identity_campaigns values(camp.id,ident) on conflict do nothing; end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'watchface_id',a.watchface_id,'partner',a.partner_id,'code',c.code,'assigned_at',a.assigned_at,'expires_at',c.expires_at) order by a.assigned_at),'[]') into existing
   from exclusive_private.assignments a join exclusive_private.codes c on c.id=a.code_id where a.campaign_id=camp.id and a.identity_id=ident;
   if p_action='mine' then return jsonb_build_object('assignments',existing); end if;
   -- Return previous result before checking current partner/stock/campaign. Refreshes are idempotent.
   if jsonb_array_length(existing)>=camp.user_limit or exists(select 1 from exclusive_private.assignments where campaign_id=camp.id and identity_id=ident and watchface_id=p_input->>'watchface') then
     return jsonb_build_object('assignments',existing,'recovered',true);
   end if;
   if not camp.active or now()<camp.starts_at or now()>=camp.ends_at then raise exception 'CAMPAIGN_CLOSED'; end if;
   select * into partner from exclusive_private.partners where id=p_input->>'partner' and active;
   if partner.id is null then raise exception 'PARTNER_UNAVAILABLE'; end if;
   if not exists(select 1 from exclusive_private.watchfaces where id=p_input->>'watchface' and active) then raise exception 'WATCHFACE_UNAVAILABLE'; end if;
   insert into exclusive_private.verifications(campaign_id,identity_id,partner_id) values(camp.id,ident,partner.id) on conflict do nothing;
   if found then insert into exclusive_private.events(campaign_id,partner_id,kind) values(camp.id,partner.id,'verified'); end if;
   select * into selected from exclusive_private.codes where campaign_id=camp.id and partner_id=partner.id and watchface_id=p_input->>'watchface' and status='AVAILABLE' and expires_at>now()
   order by expires_at,id for update skip locked limit 1;
   if selected.id is null then return jsonb_build_object('assignments',existing,'unavailable',true); end if;
   n:=jsonb_array_length(existing)+1;
   update exclusive_private.codes set status='ASSIGNED',assigned_at=now(),recipient_id=ident where id=selected.id;
   insert into exclusive_private.assignments(campaign_id,identity_id,partner_id,watchface_id,code_id,slot) values(camp.id,ident,partner.id,selected.watchface_id,selected.id,n);
   insert into exclusive_private.events(campaign_id,partner_id,kind,watchface_id) values(camp.id,partner.id,'assigned',selected.watchface_id);
   return jsonb_build_object('assignments',existing||jsonb_build_array(jsonb_build_object('id',selected.id,'watchface_id',selected.watchface_id,'partner',partner.id,'code',selected.code,'expires_at',selected.expires_at,'assigned_at',now())),'recovered',false);
 elsif p_action='admin_snapshot' then
   return jsonb_build_object('campaign',to_jsonb(camp),'partners',(select coalesce(jsonb_agg(to_jsonb(p) order by p.name),'[]') from exclusive_private.partners p),
   'watchfaces',(select jsonb_agg(to_jsonb(w) order by w.name) from exclusive_private.watchfaces w),
   'imports',(select coalesce(jsonb_agg(x),'[]') from (select id,partner_id,watchface_id,row_count,imported_at from exclusive_private.imports where campaign_id=camp.id order by imported_at desc limit 100) x),
   'stock',(select coalesce(jsonb_agg(x),'[]') from (select partner_id,watchface_id,count(*) filter(where status='AVAILABLE' and expires_at>now()) as available,count(*) filter(where status='ASSIGNED') as assigned,count(*) filter(where status='RESERVED') as reserved,count(*) filter(where status='DISABLED') as disabled,count(*) filter(where status='EXPIRED' or (status='AVAILABLE' and expires_at<=now())) as expired from exclusive_private.codes where campaign_id=camp.id group by partner_id,watchface_id) x),
   'events',(select coalesce(jsonb_agg(x),'[]') from (select partner_id,kind,count(*) as total from exclusive_private.events where campaign_id=camp.id group by partner_id,kind) x));
 elsif p_action='admin_partner' then
   insert into exclusive_private.partners(id,name,active) values(p_input->>'id',p_input->>'name',(p_input->>'active')::boolean)
   on conflict(id) do update set name=excluded.name,active=excluded.active;
 elsif p_action='admin_campaign' then
   if camp.purged_at is not null then raise exception 'CAMPAIGN_CLOSED'; end if;
   update exclusive_private.campaigns set user_limit=(p_input->>'user_limit')::integer, active=(p_input->>'active')::boolean,
   starts_at=(p_input->>'starts_at')::timestamptz,ends_at=(p_input->>'ends_at')::timestamptz,retention_days=(p_input->>'retention_days')::integer where id=camp.id;
   insert into exclusive_private.events(campaign_id,partner_id,kind) select camp.id,id,'settings' from exclusive_private.partners where active;
 elsif p_action='admin_watchface' then
   update exclusive_private.watchfaces set active=(p_input->>'active')::boolean where id=p_input->>'id';
 elsif p_action='admin_code_state' then
   if p_input->>'status' not in ('AVAILABLE','DISABLED','EXPIRED') then raise exception 'INVALID_STATE'; end if;
   update exclusive_private.codes set status=p_input->>'status' where import_id=(p_input->>'import_id')::uuid and campaign_id=camp.id and status in ('AVAILABLE','DISABLED','EXPIRED');
 elsif p_action='admin_import' then
   import_uuid:=(p_input->>'import_id')::uuid;
   -- Serialize retried uploads by batch ID. Never echo submitted codes in errors or audit records.
   perform pg_advisory_xact_lock(hashtextextended(import_uuid::text,1));
   if exists(select 1 from exclusive_private.imports where id=import_uuid) then return jsonb_build_object('already_imported',true); end if;
   part:=p_input->>'partner'; face:=p_input->>'watchface'; expiry:=(p_input->>'expires_at')::timestamptz;
   if camp.purged_at is not null then raise exception 'CAMPAIGN_CLOSED'; end if;
   if expiry<=now() then raise exception 'INVALID_EXPIRY'; end if;
   n:=jsonb_array_length(p_input->'codes'); lim:=(p_input->>'expected_rows')::integer;
   if n<1 or n>5000 or n<>lim then raise exception 'INVALID_ROW_COUNT'; end if;
   if exists(select 1 from jsonb_array_elements_text(p_input->'codes') v where v !~ '^[A-Z0-9]{6,100}$') then raise exception 'INVALID_CODE_FORMAT'; end if;
   if exists(select 1 from jsonb_array_elements_text(p_input->'codes') v join exclusive_private.codes c on c.code=v) or (select count(distinct v) from jsonb_array_elements_text(p_input->'codes') v)<>n then raise exception 'DUPLICATE_CODE'; end if;
   insert into exclusive_private.imports(id,campaign_id,partner_id,watchface_id,row_count,admin_id) values(import_uuid,camp.id,part,face,n,p_actor);
   insert into exclusive_private.codes(code,campaign_id,partner_id,watchface_id,import_id,expires_at) select v,camp.id,part,face,import_uuid,expiry from jsonb_array_elements_text(p_input->'codes') v;
   insert into exclusive_private.events(campaign_id,partner_id,kind,watchface_id) values(camp.id,part,'import',face);
   return jsonb_build_object('imported',n);
 else raise exception 'INVALID_ACTION'; end if;
 return '{}'::jsonb;
end $$;

-- Auth deletion queue makes scheduled cleanup retry-safe. Only campaign identities enter it.
create table exclusive_private.auth_deletion_queue(user_id uuid primary key);
alter table exclusive_private.auth_deletion_queue enable row level security;
revoke all on exclusive_private.auth_deletion_queue from public,anon,authenticated;
create function public.exclusive_cleanup() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 delete from exclusive_private.rate_limits where expires_at<now()-interval '1 day';
 delete from exclusive_private.visit_dedup where day<current_date-2;
 delete from exclusive_private.events where created_at<now()-interval '30 days' and kind='visit';
 update exclusive_private.campaigns set active=false,purged_at=now() where purged_at is null and now()>ends_at+make_interval(days=>retention_days);
 delete from exclusive_private.verifications v using exclusive_private.campaigns c where c.id=v.campaign_id and c.purged_at is not null;
 delete from exclusive_private.assignments a using exclusive_private.campaigns c where c.id=a.campaign_id and c.purged_at is not null;
 update exclusive_private.codes cd set recipient_id=null from exclusive_private.campaigns c where c.id=cd.campaign_id and c.purged_at is not null;
 delete from exclusive_private.identity_campaigns ic using exclusive_private.campaigns c where c.id=ic.campaign_id and c.purged_at is not null;
 insert into exclusive_private.auth_deletion_queue(user_id) select i.user_id from exclusive_private.identities i
 where i.user_id is not null and not exists(select 1 from exclusive_private.assignments a where a.identity_id=i.id)
 and not exists(select 1 from exclusive_private.verifications v where v.identity_id=i.id)
 and not exists(select 1 from exclusive_private.codes c where c.recipient_id=i.id)
 and not exists(select 1 from exclusive_private.identity_campaigns ic where ic.identity_id=i.id)
 and not exists(select 1 from exclusive_private.admins a where a.user_id=i.user_id) on conflict do nothing;
 delete from exclusive_private.identities i where not exists(select 1 from exclusive_private.assignments a where a.identity_id=i.id)
 and not exists(select 1 from exclusive_private.verifications v where v.identity_id=i.id)
 and not exists(select 1 from exclusive_private.codes c where c.recipient_id=i.id) and not exists(select 1 from exclusive_private.identity_campaigns ic where ic.identity_id=i.id);
 update exclusive_private.codes set status='EXPIRED' where status='AVAILABLE' and expires_at<=now();
 -- A user who returned for a new campaign must no longer be queued for deletion.
 delete from exclusive_private.auth_deletion_queue q where exists(select 1 from exclusive_private.admins a where a.user_id=q.user_id) or exists(select 1 from exclusive_private.identities i join exclusive_private.identity_campaigns ic on ic.identity_id=i.id where i.user_id=q.user_id);
 select coalesce(jsonb_agg(user_id),'[]') into result from exclusive_private.auth_deletion_queue;
 return result;
end $$;
create function public.exclusive_cleanup_done(p_user uuid) returns void language sql security definer set search_path='' as $$
 delete from exclusive_private.auth_deletion_queue where user_id=p_user;
$$;
revoke all on function public.exclusive_cleanup_done(uuid) from public,anon,authenticated;
grant execute on function public.exclusive_cleanup_done(uuid) to service_role;
revoke all on function public.exclusive_api(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.exclusive_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.exclusive_cleanup() from public,anon,authenticated;
grant execute on function public.exclusive_api(text,jsonb,uuid),public.exclusive_rate_limit(text,integer,integer),public.exclusive_cleanup() to service_role;
insert into exclusive_private.partners(id,name) values('valentina','Valentina'),('sara','Sara');
-- Campaign dates and activation are deliberately configured by the administrator, not invented here.
