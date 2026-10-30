-- A continuing partner program has no fixed end date. Real Google Play batches still expire.
alter table exclusive_private.campaigns alter column ends_at drop not null;
alter table exclusive_private.partner_access alter column expires_at drop not null;
alter table exclusive_private.identities add column last_seen_at timestamptz not null default now();

create or replace function exclusive_private.exclusive_api(p_action text,p_input jsonb default '{}',p_actor uuid default null) returns jsonb
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
   if not camp.active or now()<camp.starts_at or (camp.ends_at is not null and now()>=camp.ends_at) then raise exception 'CAMPAIGN_CLOSED'; end if;
   select * into partner from exclusive_private.partners where id=p_input->>'partner' and active;
   if partner.id is null then raise exception 'PARTNER_UNAVAILABLE'; end if;
   select jsonb_agg(jsonb_build_object('id',w.id,'available',exists(select 1 from exclusive_private.codes c where c.campaign_id=camp.id and c.partner_id=partner.id and c.watchface_id=w.id and c.status='AVAILABLE' and c.expires_at>now()))) into result from exclusive_private.watchfaces w where active;
   return jsonb_build_object('partner',partner.name,'limit',camp.user_limit,'ends_at',camp.ends_at,'items',coalesce(result,'[]'));
 elsif p_action='visit' then
   if camp.active and now()>=camp.starts_at and (camp.ends_at is null or now()<camp.ends_at) and exists(select 1 from exclusive_private.partners where id=p_input->>'partner' and active) then
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
   insert into exclusive_private.identities(id,user_id) values(ident,p_actor) on conflict(id) do update set user_id=excluded.user_id,last_seen_at=now();
   if camp.purged_at is null then insert into exclusive_private.identity_campaigns values(camp.id,ident) on conflict do nothing; end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'watchface_id',a.watchface_id,'partner',a.partner_id,'code',c.code,'assigned_at',a.assigned_at,'expires_at',c.expires_at) order by a.assigned_at),'[]') into existing
   from exclusive_private.assignments a join exclusive_private.codes c on c.id=a.code_id where a.campaign_id=camp.id and a.identity_id=ident;
   if p_action='mine' then return jsonb_build_object('assignments',existing); end if;
   -- Return previous result before checking current partner/stock/campaign. Refreshes are idempotent.
   if jsonb_array_length(existing)>=camp.user_limit or exists(select 1 from exclusive_private.assignments where campaign_id=camp.id and identity_id=ident and watchface_id=p_input->>'watchface') then
     return jsonb_build_object('assignments',existing,'recovered',true);
   end if;
   if not camp.active or now()<camp.starts_at or (camp.ends_at is not null and now()>=camp.ends_at) then raise exception 'CAMPAIGN_CLOSED'; end if;
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


create or replace function public.exclusive_api(p_action text,p_input jsonb default '{}',p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare camp exclusive_private.campaigns; token text; entry exclusive_private.partner_access; result jsonb;
begin
 if p_action in ('catalog','visit','claim') then
   if coalesce(p_input->>'access','') !~ '^[a-f0-9]{64}$' then raise exception 'PARTNER_ACCESS_REQUIRED'; end if;
   select a.* into entry from exclusive_private.partner_access a
   join exclusive_private.campaigns c on c.id=a.campaign_id
   join exclusive_private.partners p on p.id=a.partner_id
   where c.slug=p_input->>'campaign' and a.partner_id=p_input->>'partner' and p.active
     and not a.revoked and (a.expires_at is null or a.expires_at>now())
     and a.token_hash=extensions.digest(p_input->>'access','sha256')
   for share of a;
   if entry.id is null then raise exception 'PARTNER_ACCESS_REQUIRED'; end if;
 end if;
 if p_action in ('admin_access_create','admin_access_revoke','admin_access_status') then
   if not exists(select 1 from exclusive_private.admins where user_id=p_actor) then raise exception 'ADMIN_REQUIRED'; end if;
   select * into camp from exclusive_private.campaigns where slug=p_input->>'campaign' for share;
   if camp.id is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
   if p_action='admin_access_create' then
     if camp.purged_at is not null or (camp.ends_at is not null and camp.ends_at<=now()) then raise exception 'CAMPAIGN_CLOSED'; end if;
     if not exists(select 1 from exclusive_private.partners where id=p_input->>'partner' and active) then raise exception 'PARTNER_UNAVAILABLE'; end if;
     token:=encode(extensions.gen_random_bytes(32),'hex');
     insert into exclusive_private.partner_access(campaign_id,partner_id,token_hash,expires_at)
     values(camp.id,p_input->>'partner',extensions.digest(token,'sha256'),camp.ends_at)
     on conflict(campaign_id,partner_id) do update set id=gen_random_uuid(),token_hash=excluded.token_hash,revoked=false,expires_at=excluded.expires_at,updated_at=now()
     returning * into entry;
     -- Return the raw capability only on creation, to the verified administrator. Never log/persist it in public files.
     return jsonb_build_object('id',entry.id,'access',token,'expires_at',entry.expires_at);
   elsif p_action='admin_access_revoke' then
     update exclusive_private.partner_access set revoked=true,updated_at=now() where campaign_id=camp.id and partner_id=p_input->>'partner';
     return '{}'::jsonb;
   else
     select coalesce(jsonb_agg(jsonb_build_object('partner_id',partner_id,'id',id,'revoked',revoked,'expires_at',expires_at,'updated_at',updated_at)),'[]') into result from exclusive_private.partner_access where campaign_id=camp.id;
     return jsonb_build_object('links',result);
   end if;
 end if;
 result:=exclusive_private.exclusive_api(p_action,p_input,p_actor);
 if p_action='admin_snapshot' then
   select * into camp from exclusive_private.campaigns where slug=p_input->>'campaign';
   result:=result||jsonb_build_object('access_links',(select coalesce(jsonb_agg(jsonb_build_object('partner_id',partner_id,'id',id,'revoked',revoked,'expires_at',expires_at,'updated_at',updated_at)),'[]') from exclusive_private.partner_access where campaign_id=camp.id));
 end if;
 return result;
end $$;
revoke all on function public.exclusive_api(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.exclusive_api(text,jsonb,uuid) to service_role;


-- Keep the existing finite-campaign cleanup and add rolling Auth-account minimization.
alter function public.exclusive_cleanup() set schema exclusive_private;
create function public.exclusive_cleanup() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform exclusive_private.exclusive_cleanup();
 insert into exclusive_private.auth_deletion_queue(user_id)
 select i.user_id from exclusive_private.identities i
 where i.user_id is not null
   and not exists(select 1 from exclusive_private.admins a where a.user_id=i.user_id)
   and exists(select 1 from exclusive_private.identity_campaigns ic join exclusive_private.campaigns c on c.id=ic.campaign_id where ic.identity_id=i.id and c.ends_at is null and c.purged_at is null)
   and not exists(select 1 from exclusive_private.identity_campaigns ic join exclusive_private.campaigns c on c.id=ic.campaign_id where ic.identity_id=i.id and c.purged_at is null and i.last_seen_at>=now()-make_interval(days=>c.retention_days))
 on conflict do nothing;
 -- Sever account linkage before deleting Auth accounts. Keyed email identities remain for the one-gift rule.
 update exclusive_private.identities i set user_id=null where exists(select 1 from exclusive_private.auth_deletion_queue q where q.user_id=i.user_id);
 select coalesce(jsonb_agg(user_id),'[]') into result from exclusive_private.auth_deletion_queue;
 return result;
end $$;
revoke all on function public.exclusive_cleanup() from public,anon,authenticated;
grant execute on function public.exclusive_cleanup() to service_role;

-- Stable internal IDs preserve existing references; names shown to guests are the venue names.
update exclusive_private.partners set name='Scubadiving' where id='sara';
update exclusive_private.partners set name='Paradise Beach Camper' where id='valentina';
insert into exclusive_private.partners(id,name,active) values('barbiere','Barbiere',false),('ottico','Ottico',false) on conflict(id) do nothing;
insert into exclusive_private.campaigns(slug,name,active,ends_at,user_limit)
values('partner-collection','Demand Group Partner Collection',false,null,1) on conflict(slug) do nothing;
