import {$,el,client,configured,api,captcha,busy,sendOtp,verifyOtp} from './shared.js';
const query=new URLSearchParams(location.search);
const fragment=new URLSearchParams(location.hash.slice(1));
const partner=query.get('partner')||'';
// The capability travels in the fragment: it is not sent in page requests/referrers or hosting logs.
const access=fragment.get('access')||'';
let accessValidated=false;
const products=await fetch('/exclusive/catalog.json').then(r=>r.json());
let selected=null,loginCheck,claimCheck,newsletterRequested=false;
const consentVersion='monthly-watchfaces-2026-10-30-v1';
async function newsletterPreferences(saveRequested=false){
 $('#newsletter-preferences').hidden=false;
 try{const data=await api(saveRequested?'newsletter_set':'newsletter_status',saveRequested?{enabled:true,consent_version:consentVersion,partner}:{});$('#newsletter-enabled').checked=data.subscribed;$('#newsletter-status').textContent=saveRequested?'You’re subscribed to monthly watch face updates. You can unsubscribe here or in any newsletter.':data.subscribed?'You’re subscribed to monthly watch face updates.':'You’re not subscribed. This does not affect your complimentary code.';newsletterRequested=false;}catch(e){$('#newsletter-status').textContent='Your newsletter preference could not be saved or checked. Please retry below. '+e.message;}
}
$('#newsletter-form').onsubmit=async e=>{e.preventDefault();busy(e.submitter,true);try{const data=await api('newsletter_set',{enabled:$('#newsletter-enabled').checked,consent_version:consentVersion,partner});$('#newsletter-status').textContent=data.subscribed?'Monthly updates enabled. Thank you!':'Unsubscribed on this site. Your promotional code is unchanged.';}catch(e){$('#newsletter-status').textContent=e.message;}finally{busy(e.submitter,false);}};
const dialog=$('#auth-dialog');
function status(message){$('#status').textContent=message;}
function renderCatalog(items){
 const target=$('#exclusive-grid');target.replaceChildren();
 for(const p of products){const item=items.find(i=>i.id===p.id);if(!item)continue;const card=el('article',undefined,'exclusive-card');const image=el('img');image.src=p.image;image.alt=p.name+' — actual watch face';image.width=512;image.height=512;image.loading='lazy';card.append(image,el('h3',p.name),el('p',p.description),el('p',item.available?'Codes available through your partner':'No codes available','micro'));const b=el('button',item.available?'Get your complimentary watch face':'Currently unavailable','buy');b.disabled=!item.available;b.onclick=()=>openAuth(p.id);card.append(b);const listing=el('a','Check device compatibility ↗');listing.href='https://play.google.com/store/apps/details?id='+encodeURIComponent(p.package_name);listing.target='_blank';listing.rel='noopener noreferrer';card.append(listing);target.append(card);}
}
async function loadStock(){
 const gate=$('#access-status');
 if(!partner||!/^[a-f0-9]{64}$/.test(access)){gate.textContent='This collection is reserved for guests of our partner venues. Scan the private QR provided by your partner to continue.';return false;}
 if(!configured){gate.textContent='This private promotion is being prepared. Please check back with your partner.';return false;}
 try{const data=await api('catalog',{partner,access});accessValidated=true;$('#partner-experience').hidden=false;$('#access-gate').hidden=true;$('#partner-label').textContent=`Courtesy of ${data.partner}`;$('#limit-note').textContent=`Up to ${data.limit} promotional code${data.limit===1?'':'s'} per verified identity for this campaign, across all partners.`;status('Choose a watch face below. Availability is confirmed when your code is assigned.');renderCatalog(data.items);return true;}catch(e){accessValidated=false;$('#partner-experience').hidden=true;$('#access-gate').hidden=false;gate.textContent=e.message;return false;}
}
function renderAssignments(data){
 const target=$('#assignments');target.replaceChildren();if(!data.assignments.length)return false;
 for(const a of data.assignments){const p=products.find(p=>p.id===a.watchface_id);const card=el('article',undefined,'assignment');const img=el('img');img.src=p?.image||'';img.alt=p?.name||a.watchface_id;img.width=240;img.height=240;card.append(img);const copy=el('div');copy.append(el('p','Your assigned promotional code','eyebrow'),el('h3',p?.name||a.watchface_id));const code=el('code',a.code,'promo-code');copy.append(code);const controls=el('div',undefined,'admin-actions');const button=el('button','Copy code','secondary');button.onclick=async()=>{try{await navigator.clipboard.writeText(a.code);button.textContent='Copied';}catch{button.textContent='Select and copy the code above';}};const redeem=el('a','Redeem on Google Play ↗','buy');redeem.href=`https://play.google.com/redeem?code=${encodeURIComponent(a.code)}`;redeem.target='_blank';redeem.rel='noopener noreferrer';redeem.referrerPolicy='no-referrer';controls.append(button,redeem);copy.append(controls);const listing=el('a','Open this watch face on Google Play ↗');listing.href=`https://play.google.com/store/apps/details?id=${encodeURIComponent(p?.package_name||'')}`;listing.target='_blank';listing.rel='noopener noreferrer';copy.append(el('p','Assigned does not mean redeemed. Google Play checks redemption and device compatibility.'),el('p',`Code expiry: ${new Date(a.expires_at).toLocaleDateString()}.`),listing);const review=el('aside',undefined,'review-invitation');review.append(el('p','Had a chance to try your watch face? Feel free to leave an honest review if you wish. It only takes a moment and helps our small studio a lot.'),el('p','Completely optional. Your complimentary code is yours regardless of whether you leave a review.','micro'));const reviewLink=el('a','Leave an honest review on Google Play ↗');reviewLink.href=listing.href;reviewLink.target='_blank';reviewLink.rel='noopener noreferrer';review.append(reviewLink);copy.append(review);card.append(copy);target.append(card);}
 $('#your-codes').hidden=false;return true;
}
async function recover(scroll=false){const data=await api('mine');if(renderAssignments(data)){if(scroll)$('#your-codes').scrollIntoView({behavior:'smooth'});return true;}return false;}
async function openAuth(product=null){
 selected=product;newsletterRequested=false;$('#newsletter-optin').checked=false;$('#auth-status').textContent='';$('#email-form').hidden=true;$('#otp-form').hidden=true;$('#confirm-claim').hidden=true;
 $('#auth-context').textContent=product?`Selected: ${products.find(p=>p.id===product)?.name}. Verify your email to continue.`:'Verify your email to recover your existing code.';
 dialog.showModal();
 try{if(!accessValidated)throw Error('Please scan a valid private partner QR first.');if(!configured)throw Error('The promotion is being prepared. Please check back with your partner.');const {data:{session}}=await client.auth.getSession();if(session){await afterLogin();return;}$('#email-form').hidden=false;loginCheck?.remove();loginCheck=await captcha('#captcha','login');$('#email').focus();}catch(e){$('#auth-status').textContent=e.message;}
}
async function afterLogin(){
 $('#email-form').hidden=true;$('#otp-form').hidden=true;
 await newsletterPreferences(newsletterRequested);
 const data=await api('mine');renderAssignments(data);
 if(!selected){dialog.close();if(!data.assignments.length)status('No code has been assigned to this verified email yet. Choose an available watch face from your partner link.');else $('#your-codes').scrollIntoView();return;}
 // Server decides whether to recover or allocate. Every attempt requires a fresh bot check.
 $('#confirm-claim').hidden=false;claimCheck?.remove();claimCheck=await captcha('#claim-captcha','claim');
}
$('#recover').onclick=()=>openAuth();document.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>openAuth(b.dataset.claim));
$('#auth-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{loginCheck?.remove();loginCheck=null;claimCheck?.remove();claimCheck=null;});
$('#email-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;busy(b,true);try{await sendOtp($('#email').value,loginCheck?.get());newsletterRequested=$('#newsletter-optin').checked;$('#email-form').hidden=true;$('#otp-form').hidden=false;$('#auth-status').textContent='Check your inbox for the verification code.';$('#otp').focus();}catch(e){$('#auth-status').textContent=e.message;}finally{loginCheck?.reset();busy(b,false);}};
$('#change-email').onclick=async()=>{$('#otp-form').hidden=true;$('#email-form').hidden=false;loginCheck?.reset();};
$('#otp-form').onsubmit=async e=>{e.preventDefault();busy(e.submitter,true);try{await verifyOtp($('#email').value,$('#otp').value);$('#otp').value='';await afterLogin();}catch(e){$('#auth-status').textContent=e.message;}finally{busy(e.submitter,false);}};
$('#claim').onclick=async e=>{busy(e.target,true);try{const data=await api('claim',{partner,access,watchface:selected},claimCheck?.get());renderAssignments(data);dialog.close();await loadStock();status(data.unavailable?'No code is available for this selection right now. Please try again later.':data.recovered?'Your existing code has been recovered.':'Your code is ready. Follow the redemption instructions below.');if(data.assignments.length)$('#your-codes').scrollIntoView();}catch(e){$('#auth-status').textContent=e.message;}finally{claimCheck?.reset();busy(e.target,false);}};
$('#signout').onclick=async()=>{await client.auth.signOut({scope:'local'});$('#assignments').replaceChildren();$('#your-codes').hidden=true;$('#newsletter-preferences').hidden=true;$('#newsletter-enabled').checked=false;status('Signed out. Verify the same email to recover your code later.');};
const admitted=await loadStock();if(client&&admitted){const {data:{session}}=await client.auth.getSession();if(session)try{await newsletterPreferences();await recover();}catch(e){status(e.message);}if(partner)api('visit',{partner,access,session_id:crypto.randomUUID()}).catch(()=>{});}
