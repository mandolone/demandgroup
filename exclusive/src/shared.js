import {createClient} from '@supabase/supabase-js';
export const $=s=>document.querySelector(s);
export const el=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
export const config=await fetch('/exclusive/config.json',{cache:'no-store'}).then(r=>r.json());
export const connectionReady=Boolean(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)&&config.supabasePublishableKey&&config.turnstileSiteKey);
export const configured=Boolean(connectionReady&&config.campaign&&config.privacyReady);
export const client=connectionReady?createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
const errors={PARTNER_ACCESS_REQUIRED:"This private partner link is missing, expired or no longer valid. Please scan the QR supplied by your partner.",ADMIN_REQUIRED:'This verified account does not have administrator access.',VERIFIED_EMAIL_REQUIRED:'Please verify your email again.',CAMPAIGN_CLOSED:'This promotion is not currently open. You can still recover an assigned code.',CAMPAIGN_NOT_FOUND:'This campaign is not available yet.',PARTNER_UNAVAILABLE:'This partner link is not available. Please check with your partner.',WATCHFACE_UNAVAILABLE:'This watch face is not participating right now.',TOO_MANY_REQUESTS:'Too many requests. Please wait a few minutes before trying again.',BOT_CHECK_FAILED:'The security check expired. Complete a new check and try again.',BOT_CHECK_REQUIRED:'Please complete the security check.',DUPLICATE_CODE:'This batch contains a code that was already imported, or duplicate rows. Nothing was imported.',INVALID_CSV:'Use a CSV with one code per row and an optional code header.',INVALID_ROW_COUNT:'The code count does not match the expected batch size. Nothing was imported.',INVALID_EXPIRY:'The batch expiry must be in the future.'};
export async function api(action,input={},captcha){
 if(!client)throw Error('The promotion is being prepared. Please check back with your partner.');
 const {data:{session}}=await client.auth.getSession();
 let response;try{response=await fetch(`${config.supabaseUrl}/functions/v1/exclusive-api`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({action,input:{...input,campaign:config.campaign},captcha}),cache:'no-store',signal:AbortSignal.timeout(25000)});}catch{throw Error('Connection interrupted. Try again to recover any code already assigned to you.');}
 let data;try{data=await response.json();}catch{throw Error('The service is temporarily unavailable. Please try again.');}
 if(!response.ok)throw Error(errors[data.error]||'The request could not be completed. Please retry; any existing assignment will be recovered.');
 return data;
}
let captchaScript;
export async function captcha(container,action){
 if(!window.turnstile){captchaScript??=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=resolve;s.onerror=()=>reject(Error('Security check could not load. Please retry.'));document.head.append(s);});await captchaScript;}
 const element=$(container);element.replaceChildren();let token='';const id=window.turnstile.render(element,{sitekey:config.turnstileSiteKey,action,callback:t=>token=t,'expired-callback':()=>token='','error-callback':()=>token=''});
 return {get:()=>token,reset:()=>{token='';window.turnstile.reset(id);},remove:()=>window.turnstile.remove(id)};
}
export function busy(button,on){button.disabled=on;button.setAttribute('aria-busy',String(on));}
export async function sendOtp(email,token){if(!token)throw Error('Please complete the security check.');const {error}=await client.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{captchaToken:token}});if(error)throw Error('Email could not be sent. Check the address, wait a minute and try again.');}
export async function verifyOtp(email,token){const {error}=await client.auth.verifyOtp({email:email.trim().toLowerCase(),token,type:'email'});if(error)throw Error('This verification code is invalid or expired. Request another email and try again.');}
export function download(name,value,type){const url=URL.createObjectURL(new Blob([value],{type}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function csv(rows){return rows.map(row=>row.map(value=>'"'+String(value??'').replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');}
