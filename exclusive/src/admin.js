import QRCode from 'qrcode';
import {parseCodes} from '../../supabase/functions/_shared/csv.mjs';
import {$,el,client,connectionReady,api,captcha,busy,sendOtp,verifyOtp,download,csv} from './shared.js';
let snapshot,check,importId=null;
const privateLinks=new Map();
const status=s=>$('#status').textContent=s;
const value=id=>$('#'+id).value;
const localDate=v=>{if(!v)return '';const d=new Date(v);return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
function table(target,rows){const t=$(target);t.replaceChildren();const head=el('thead'),body=el('tbody');rows.forEach((row,i)=>{const tr=el('tr');for(const v of row)tr.append(el(i?'td':'th',String(v)));(i?body:head).append(tr);});t.append(head,body);}
function metric(p,kind){return snapshot.events.find(e=>e.partner_id===p&&e.kind===kind)?.total||0;}
function stock(p,kind){return snapshot.stock.filter(s=>s.partner_id===p).reduce((n,s)=>n+Number(s[kind]),0);}
function metricRows(){return [['Metric',...snapshot.partners.map(p=>p.name)],...['visit','verified','assigned','available'].map((k,i)=>[['Catalog page views (last 30 days)','Verified campaign identities','Codes assigned','Codes available'][i],...snapshot.partners.map(p=>i<2?metric(p.id,k):stock(p.id,k))])];}
function privateUrl(partner,access){const url=new URL('/exclusive/',location.origin);url.searchParams.set('partner',partner.id);url.hash=new URLSearchParams({access}).toString();return url;}
function previewQr(row,partner,cached){
 const preview=el('figure',undefined,'private-qr-preview');
 const image=el('img');image.alt=`Private invitation QR for ${partner.name}`;image.width=240;image.height=240;
 const caption=el('figcaption',`Private QR for ${partner.name}. Download PNG or SVG below before closing or reloading this tab.`);
 preview.append(image,caption);row.append(preview);
 QRCode.toDataURL(privateUrl(partner,cached.access).href,{width:480,margin:4,errorCorrectionLevel:'M'}).then(url=>{image.src=url;}).catch(()=>{image.remove();caption.textContent='The QR preview could not load. Try downloading the SVG below.';});
}
async function qr(partner,format){
 const cached=privateLinks.get(partner.id);if(!cached)throw Error('Generate a private QR first. The access key is returned only once and is kept only in this tab’s memory.');
 const state=await api('admin_access_status');const current=state.links.find(l=>l.partner_id===partner.id);
 if(!current||current.id!==cached.id||current.revoked||(current.expires_at&&new Date(current.expires_at)<=new Date())){privateLinks.delete(partner.id);throw Error('This private link has expired, been replaced or revoked. Generate a new QR.');}
 const url=privateUrl(partner,cached.access);
 if(format==='svg')download(`${partner.id}-exclusive-private.svg`,await QRCode.toString(url.href,{type:'svg',errorCorrectionLevel:'M',margin:4,width:1600}),'image/svg+xml');else{const link=el('a');link.download=`${partner.id}-exclusive-private.png`;link.href=await QRCode.toDataURL(url.href,{width:1600,margin:4,errorCorrectionLevel:'M'});link.click();}
 status(`QR ${format.toUpperCase()} download started for ${partner.name}. Check your browser downloads.`);
}
function render(){
 $('#desk').hidden=false;$('#login').hidden=true;table('#metrics',metricRows());
 const ranked=$('#ranking');ranked.replaceChildren();for(const p of snapshot.partners){const top=snapshot.stock.filter(s=>s.partner_id===p.id&&s.assigned>0).sort((a,b)=>b.assigned-a.assigned);ranked.append(el('h3',`${p.name} / Most requested`),el('p',top.map(s=>`${snapshot.watchfaces.find(w=>w.id===s.watchface_id)?.name}: ${s.assigned}`).join(' · ')||'No codes assigned yet.'));}
 $('#partners').replaceChildren();$('#import-partner').replaceChildren();for(const p of snapshot.partners){const row=el('div',undefined,'partner-row');row.append(el('h3',`${p.name} / ${p.active?'Active':'Inactive'}`));const accessState=snapshot.access_links.find(l=>l.partner_id===p.id);row.append(el('p',accessState&&!accessState.revoked?(accessState.expires_at?`Private QR expires ${new Date(accessState.expires_at).toLocaleDateString()}`:'Private QR: no fixed expiry. Revocable at any time.'):'No active private QR.'));
 const cached=privateLinks.get(p.id);const canDownload=Boolean(cached&&accessState?.id===cached.id&&!accessState.revoked&&(!accessState.expires_at||new Date(accessState.expires_at)>new Date()));
 if(canDownload)previewQr(row,p,cached);
 else if(accessState&&!accessState.revoked)row.append(el('p','This QR was created in another session. Use your saved file, or replace the QR to generate a new preview and downloads. Replacing it invalidates the previous QR.','micro'));
 if(!p.active)row.append(el('p','Activate this partner using Edit and Save partner before generating its QR.','micro'));
 const controls=el('div',undefined,'admin-actions');const edit=el('button','Edit','secondary');edit.onclick=()=>{$('#partner-id').value=p.id;$('#partner-name').value=p.name;$('#partner-active').checked=p.active;$('#partner-name').focus();};controls.append(edit);const create=el('button',accessState?'Replace private QR':'Generate private QR','secondary');create.disabled=!p.active;create.onclick=async()=>{busy(create,true);try{if(accessState&&!accessState.revoked&&!window.confirm('Replace the private QR? Previously printed QR codes for this partner and campaign will stop working.'))return;const data=await api('admin_access_create',{partner:p.id});privateLinks.set(p.id,data);await refresh();status('Private QR generated. Download both PNG and SVG now and keep them private. Your preview is shown in the partner section. The key is not retrievable after this tab is closed or reloaded.');}catch(e){status(e.message);}finally{busy(create,false);}};controls.append(create);const revoke=el('button','Revoke QR','secondary');revoke.disabled=!accessState||accessState.revoked;revoke.onclick=async()=>{busy(revoke,true);try{await api('admin_access_revoke',{partner:p.id});privateLinks.delete(p.id);await refresh();status('Private QR revoked. Already assigned codes remain assigned.');}catch(e){status(e.message);}finally{busy(revoke,false);}};controls.append(revoke);for(const format of ['png','svg']){const b=el('button',`Download QR ${format.toUpperCase()}`,'secondary');b.disabled=!canDownload;b.onclick=()=>qr(p,format).catch(e=>status(e.message));controls.append(b);}row.append(controls);$('#partners').append(row);const opt=el('option',p.name);opt.value=p.id;$('#import-partner').append(opt);}
 $('#watchfaces').replaceChildren();$('#import-watchface').replaceChildren();for(const w of snapshot.watchfaces){const label=el('label');const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=w.active;checkbox.onchange=async()=>{checkbox.disabled=true;try{await api('admin_watchface',{id:w.id,active:checkbox.checked});await refresh();}catch(e){checkbox.checked=!checkbox.checked;status(e.message);}finally{checkbox.disabled=false;}};label.append(checkbox,document.createTextNode(' '+w.name));$('#watchfaces').append(label);const opt=el('option',w.name);opt.value=w.id;$('#import-watchface').append(opt);}
 $('#user-limit').value=snapshot.campaign.user_limit;$('#campaign-active').checked=snapshot.campaign.active;$('#starts-at').value=localDate(snapshot.campaign.starts_at);$('#ends-at').value=localDate(snapshot.campaign.ends_at);$('#campaign-open-ended').checked=!snapshot.campaign.ends_at;updateEndDate();$('#retention').value=snapshot.campaign.retention_days;
 table('#imports',[['Batch ID','Partner','Watch face','Codes','Imported'],...snapshot.imports.map(i=>[i.id,i.partner_id,i.watchface_id,i.row_count,new Date(i.imported_at).toLocaleString()])]);
 table('#stock',[['Partner','Watch face','Available','Assigned','Reserved','Expired','Disabled'],...snapshot.stock.map(s=>[snapshot.partners.find(p=>p.id===s.partner_id)?.name,snapshot.watchfaces.find(w=>w.id===s.watchface_id)?.name,s.available,s.assigned,s.reserved,s.expired,s.disabled])]);
}
async function refresh(){try{snapshot=await api('admin_snapshot');render();status('Campaign data is up to date.');}catch(e){$('#desk').hidden=true;status(e.message);}}
async function submit(form,action,input){const b=form.querySelector('button[type=submit],button.buy,button.secondary');busy(b,true);try{await api(action,input());await refresh();}catch(e){status(e.message);}finally{busy(b,false);}}
$('#partner-form').onsubmit=e=>{e.preventDefault();submit(e.target,'admin_partner',()=>({id:value('partner-id'),name:value('partner-name'),active:$('#partner-active').checked}));};
$('#campaign-form').onsubmit=e=>{e.preventDefault();submit(e.target,'admin_campaign',()=>({user_limit:Number(value('user-limit')),active:$('#campaign-active').checked,starts_at:new Date(value('starts-at')).toISOString(),ends_at:$('#campaign-open-ended').checked?null:new Date(value('ends-at')).toISOString(),retention_days:Number(value('retention'))}));};
$('#batch-form').onsubmit=e=>{e.preventDefault();submit(e.target,'admin_code_state',()=>({import_id:value('batch-id'),status:value('batch-state')}));};
$('#csv').onchange=()=>importId=null;
$('#import-form').onsubmit=async e=>{
 e.preventDefault();const b=e.submitter;busy(b,true);
 try{
  const file=$('#csv').files[0];if(!file)throw Error('Choose your Google Play CSV first.');
  if(file.size>500000)throw Error('Use batches below 500 KB.');
  let codes;try{codes=parseCodes(await file.text());}catch{throw Error('Use the original Google Play CSV, or one code per row with an optional Promotion code or code header.');}
  importId??=crypto.randomUUID();
  // Keep compatibility with the live Edge Function, which accepts headerless CSV.
  // Server-side parsing and authorization still validate the complete batch independently.
  const data=await api('admin_import',{partner:value('import-partner'),watchface:value('import-watchface'),expected_rows:Number(value('expected-rows')),expires_at:new Date(value('expires-at')).toISOString(),import_id:importId,csv:codes.join('\n')});
  $('#import-result').textContent=`${data.already_imported?'Batch already imported':`${data.imported} codes imported`}. Batch ID: ${importId}`;
  $('#csv').value='';importId=null;await refresh();
 }catch(e){$('#import-result').textContent=e.message;}finally{busy(b,false);}
};
$('#export').onclick=()=>download('exclusive-statistics.csv',csv([...metricRows(),[],['Partner','Watch face','Available','Assigned','Reserved','Expired','Disabled'],...snapshot.stock.map(s=>[s.partner_id,s.watchface_id,s.available,s.assigned,s.reserved,s.expired,s.disabled])]),'text/csv;charset=utf-8');
$('#refresh').onclick=refresh;$('#signout').onclick=async()=>{privateLinks.clear();await client.auth.signOut({scope:'local'});location.reload();};
$('#email-form').onsubmit=async e=>{e.preventDefault();busy(e.submitter,true);try{await sendOtp(value('email'),check?.get());$('#email-form').hidden=true;$('#otp-form').hidden=false;status('Check your email for the verification code.');$('#otp').focus();}catch(e){status(e.message);}finally{check?.reset();busy(e.submitter,false);}};
$('#otp-form').onsubmit=async e=>{e.preventDefault();busy(e.submitter,true);try{await verifyOtp(value('email'),value('otp'));$('#otp').value='';await refresh();}catch(e){status(e.message);}finally{busy(e.submitter,false);}};
if(!connectionReady){status('Configure the Supabase and Turnstile connection before opening this desk.');$('#login').hidden=true;}else{check=await captcha('#captcha','login');const {data:{session}}=await client.auth.getSession();if(session)await refresh();else status('Verify your administrator email to continue.');}

for(const [id,action] of [['#export-newsletter','admin_newsletter_export'],['#export-withdrawals','admin_newsletter_withdrawals']])$(id).onclick=async e=>{busy(e.target,true);try{const data=await api(action);const withdrawn=action==='admin_newsletter_withdrawals';const rows=withdrawn?[['Email Address','Withdrawn At'],...data.contacts.map(c=>[c.email,c.withdrawn_at])]:[['Email Address','Consent Date','Verified At','Consent Version','Consent Text','Source Partner'],...data.contacts.map(c=>[c.email,c.consented_at,c.verified_at,c.consent_version,c.consent_text,c.source_partner])];download(withdrawn?'newsletter-site-withdrawals.csv':'newsletter-opted-in.csv',csv(rows),'text/csv;charset=utf-8');$('#newsletter-export-status').textContent=`Exported ${data.contacts.length} ${withdrawn?'site withdrawals':'verified, opted-in contacts'}. Keep this personal-data file private.`;}catch(e){$('#newsletter-export-status').textContent=e.message;}finally{busy(e.target,false);}};

function updateEndDate(){$('#ends-at').disabled=$('#campaign-open-ended').checked;$('#ends-at').required=!$('#campaign-open-ended').checked;}
$('#campaign-open-ended').onchange=updateEndDate;
