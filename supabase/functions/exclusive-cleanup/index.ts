import {createClient} from 'npm:@supabase/supabase-js@2';
import { resolveAdminKey } from '../_shared/admin-key.mjs';
// Schedule daily on a dedicated promotion Supabase project. No browser access or PII in responses/logs.
Deno.serve(async req=>{
 const expected=Deno.env.get('EXCLUSIVE_CLEANUP_SECRET');
 const actual=req.headers.get('x-cleanup-secret')||'';
 const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(actual)));
 const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(expected||'')));
 if(req.method!=='POST'||!expected||a.reduce((n,v,i)=>n|(v^b[i]),0)!==0)return new Response(null,{status:403});
 const client=createClient(Deno.env.get('SUPABASE_URL')!,resolveAdminKey((name: string)=>Deno.env.get(name)),{auth:{persistSession:false}});
 const {data,error}=await client.rpc('exclusive_cleanup');if(error)return new Response('Cleanup failed',{status:500});
 const marketing=await client.rpc('exclusive_newsletter_cleanup');if(marketing.error)return new Response('Cleanup failed',{status:500});
 let failures=0;
 for(const id of data||[]){const {error}=await client.auth.admin.deleteUser(id);if(error&&error.code!=='user_not_found'){failures++;continue;}const done=await client.rpc('exclusive_cleanup_done',{p_user:id});if(done.error)failures++;}
 return Response.json({ok:failures===0},{status:failures?500:200,headers:{'Cache-Control':'no-store'}});
});
