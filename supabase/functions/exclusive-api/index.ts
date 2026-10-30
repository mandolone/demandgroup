import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseCodes } from '../_shared/csv.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
const origins = (Deno.env.get('EXCLUSIVE_ALLOWED_ORIGINS') || '').split(',').map(s=>s.trim());
const messages = ['ADMIN_REQUIRED','CAMPAIGN_NOT_FOUND','CAMPAIGN_CLOSED','PARTNER_UNAVAILABLE','WATCHFACE_UNAVAILABLE','VERIFIED_EMAIL_REQUIRED','INVALID_ROW_COUNT','INVALID_EXPIRY','INVALID_CODE_FORMAT','DUPLICATE_CODE','INVALID_STATE'];
const publicActions = ['catalog','visit'];
const allowedActions = [...publicActions,'mine','claim','admin_snapshot','admin_partner','admin_campaign','admin_watchface','admin_import','admin_code_state'];

async function digest(value: string) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('EXCLUSIVE_RATE_SECRET')!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!origins.includes(origin)) return reply({error:'ORIGIN_NOT_ALLOWED'},403);
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
 if(req.method!=='POST') return reply({error:'METHOD_NOT_ALLOWED'},405);
 if(!Deno.env.get('EXCLUSIVE_RATE_SECRET') || !Deno.env.get('TURNSTILE_SECRET_KEY') || !Deno.env.get('EXCLUSIVE_TURNSTILE_HOSTNAMES')) return reply({error:'SERVICE_NOT_CONFIGURED'},503);
 try {
  // Bound reads even when Content-Length is absent or dishonest. Never log bodies or provider errors.
  const reader=req.body?.getReader(); if(!reader) return reply({error:'INVALID_REQUEST'},400);
  const chunks:Uint8Array[]=[]; let size=0;
  while(true){const {done,value}=await reader.read(); if(done)break;size+=value.length;if(size>1048576){await reader.cancel();return reply({error:'UPLOAD_TOO_LARGE'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  const action=body.action; const input=body.input||{};
  if(!allowedActions.includes(action) || typeof input!=='object' || Array.isArray(input) || typeof input.campaign!=='string' || input.campaign.length>100) return reply({error:'INVALID_REQUEST'},400);
  // Supabase gateway supplies x-forwarded-for. IP is short-lived HMAC, never an identity or allocation key.
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  const bucket=Math.floor(Date.now()/3600000);
  const key=await digest(`ip:${bucket}:${ip}`);
  const rate=await service.rpc('exclusive_rate_limit',{p_key:key,p_limit:1200,p_seconds:3600});
  if(rate.error) return reply({error:'SERVICE_UNAVAILABLE'},503);
  // Shared networks must not exhaust another verified user's claim quota.
  // Under anonymous visit floods, drop only the nonessential metric; never allocate by IP.
  if(!rate.data && action==='visit') return reply({});
  let actor:string|null=null;
  if(!publicActions.includes(action)){
   const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
   const {data,error}=await service.auth.getUser(token);
   if(error||!data.user?.email_confirmed_at||data.user.is_anonymous) return reply({error:'VERIFIED_EMAIL_REQUIRED'},401);
   actor=data.user.id;
   const userRate=await service.rpc('exclusive_rate_limit',{p_key:await digest(`user:${actor}:${action}`),p_limit:action==='claim'?12:120,p_seconds:300});
   if(userRate.error) return reply({error:'SERVICE_UNAVAILABLE'},503);
   if(!userRate.data) return reply({error:'TOO_MANY_REQUESTS'},429);
  }
  if(action==='claim'){
   if(typeof body.captcha!=='string') return reply({error:'BOT_CHECK_REQUIRED'},400);
   const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:Deno.env.get('TURNSTILE_SECRET_KEY')!,response:body.captcha}),signal:AbortSignal.timeout(10000)});
   const proof=await check.json();
   const hosts=Deno.env.get('EXCLUSIVE_TURNSTILE_HOSTNAMES')!.split(',').map(s=>s.trim());
   if(!proof.success||!hosts.includes(proof.hostname)||proof.action!=='claim') return reply({error:'BOT_CHECK_FAILED'},400);
  }
  if(action==='admin_import'){
   // Authorization precedes CSV parsing. The RPC independently checks admin membership again.
   const authz=await service.rpc('exclusive_api',{p_action:'admin_snapshot',p_input:{campaign:input.campaign},p_actor:actor});
   if(authz.error) return reply({error:'ADMIN_REQUIRED'},403);
   try{input.codes=parseCodes(input.csv);}catch{return reply({error:'INVALID_CSV'},400);}
   delete input.csv;
  }
  const {data,error}=await service.rpc('exclusive_api',{p_action:action,p_input:input,p_actor:actor});
  if(error){const safe=messages.find(m=>error.message.includes(m));return reply({error:safe||'REQUEST_FAILED'},safe==='ADMIN_REQUIRED'?403:400);}
  return reply(data);
 }catch{return reply({error:'REQUEST_FAILED'},400);}
});
