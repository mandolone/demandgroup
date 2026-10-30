-- Partner attribution is public metadata. Private QR access is a separate, unguessable capability.
create table exclusive_private.partner_access (
 campaign_id uuid not null references exclusive_private.campaigns(id),
 partner_id text not null references exclusive_private.partners(id),
 id uuid not null unique default gen_random_uuid(),
 token_hash bytea not null unique,
 revoked boolean not null default false,
 expires_at timestamptz not null,
 updated_at timestamptz not null default now(),
 primary key(campaign_id,partner_id)
);
alter table exclusive_private.partner_access enable row level security;
revoke all on exclusive_private.partner_access from public,anon,authenticated;

-- Preserve the transaction/locking implementation behind a single gated public service-role RPC.
alter function public.exclusive_api(text,jsonb,uuid) set schema exclusive_private;
create function public.exclusive_api(p_action text,p_input jsonb default '{}',p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare camp exclusive_private.campaigns; token text; entry exclusive_private.partner_access; result jsonb;
begin
 if p_action in ('catalog','visit','claim') then
   if coalesce(p_input->>'access','') !~ '^[a-f0-9]{64}$' then raise exception 'PARTNER_ACCESS_REQUIRED'; end if;
   select a.* into entry from exclusive_private.partner_access a
   join exclusive_private.campaigns c on c.id=a.campaign_id
   join exclusive_private.partners p on p.id=a.partner_id
   where c.slug=p_input->>'campaign' and a.partner_id=p_input->>'partner' and p.active
     and not a.revoked and a.expires_at>now()
     and a.token_hash=extensions.digest(p_input->>'access','sha256')
   for share of a;
   if entry.id is null then raise exception 'PARTNER_ACCESS_REQUIRED'; end if;
 end if;
 if p_action in ('admin_access_create','admin_access_revoke','admin_access_status') then
   if not exists(select 1 from exclusive_private.admins where user_id=p_actor) then raise exception 'ADMIN_REQUIRED'; end if;
   select * into camp from exclusive_private.campaigns where slug=p_input->>'campaign' for share;
   if camp.id is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
   if p_action='admin_access_create' then
     if camp.purged_at is not null or camp.ends_at<=now() then raise exception 'CAMPAIGN_CLOSED'; end if;
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
