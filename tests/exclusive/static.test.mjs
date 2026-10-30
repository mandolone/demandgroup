import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
const read=path=>readFile(path,'utf8');
async function files(root){const result=[];for(const entry of await readdir(root,{withFileTypes:true})){const name=root+'/'+entry.name;if(entry.isDirectory())result.push(...await files(name));else result.push(name);}return result;}
test('9: published exclusive files contain no CSV, private inventory or secrets',async()=>{for(const root of ['docs/exclusive','public/exclusive'])for(const f of await files(root)){assert.doesNotMatch(f,/\.csv$|\.env|\.sql$/i);const text=await read(f);assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_[A-Za-z0-9]{20,}|VALENTINA00[0-9]|SARACODE00[0-9]|BEGIN PRIVATE KEY/);}});
test('catalog contains real repository assets and listed packages only',async()=>{const products=JSON.parse(await read('exclusive/catalog.json'));const apps=JSON.parse(await read('public/catalog/watchfaces.json'));const html=await read('docs/exclusive/index.html');assert.equal(products.length,14);for(const p of products){assert.ok(apps.apps.some(a=>a.packageName===p.package_name));assert.ok((await stat('docs'+p.image)).size>100);assert.ok(!html.includes('data-claim="'+p.id+'"'));}assert.match(html,/id="partner-experience" hidden/);assert.match(html,/id="access-gate"/);assert.match(html,/Content-Security-Policy/);});
test('published and source asset copies stay synchronized',async()=>{for(const f of await files('docs/exclusive')){assert.equal(await read(f),await read(f.replace(/^docs\//,'public/')));}});
test('public connection uses publishable credentials and activation requires a completed notice',async()=>{
 const cfg=JSON.parse(await read('docs/exclusive/config.json'));assert.equal(typeof cfg.privacyReady,'boolean');
 if(cfg.supabaseUrl)assert.match(cfg.supabaseUrl,/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
 if(cfg.supabasePublishableKey)assert.match(cfg.supabasePublishableKey,/^sb_publishable_/);
 assert.match(cfg.campaign,/^[a-z0-9-]*$/);
 if(cfg.privacyReady){
  assert.ok(cfg.supabaseUrl&&cfg.supabasePublishableKey&&cfg.turnstileSiteKey&&cfg.campaign);
  const notice=await read('docs/exclusive/privacy/index.html');
  assert.doesNotMatch(notice,/pre-launch draft|Before launch the controller must|will be finalized before launch/);
  assert.match(notice,/West EU — Ireland/);assert.match(notice,/Resend/);assert.match(notice,/Article 6\(1\)\(b\)/);
  assert.match(notice,/Article 6\(1\)\(f\)/);assert.match(notice,/Article 6\(1\)\(a\)/);
 }
});
test('10: existing catalog and privacy pages remain present, main navigation does not advertise the private promotion',async()=>{assert.doesNotMatch(await read('docs/index.html'),/href="\/exclusive\/"/);assert.doesNotMatch(await read('app/shop-content.ts'),/>Exclusive</);for(const name of ['cookie-policy','website-privacy-policy'])assert.ok((await stat(`docs/${name}/index.html`)).size>0);const apps=JSON.parse(await read('docs/catalog/watchfaces.json'));assert.ok(apps.apps.length>=14);assert.match(await read('docs/index.html'),/Sputnik Animated Watch Face/);});

test('newsletter checkbox is optional and unchecked, with matching server consent wording',async()=>{const html=await read('docs/exclusive/index.html');const tag=html.match(/<input[^>]+id="newsletter-optin"[^>]*>/)?.[0];assert.ok(tag);assert.doesNotMatch(tag,/checked|required/);assert.match(html,/Signing up is optional and does not affect my complimentary code/);const sql=await read('supabase/migrations/202610300003_newsletter.sql');assert.match(sql,/monthly-watchfaces-2026-10-30-v1/);assert.match(sql,/Signing up is optional and does not affect my complimentary code/);assert.match(await read('exclusive/src/catalog.js'),/Feel free to leave an honest review if you wish/);assert.match(await read('docs/exclusive/admin/index.html'),/Export opted-in emails CSV/);});

test('private promotion is unindexed and never renders catalog cards before validating a QR key',async()=>{const html=await read('docs/exclusive/index.html');assert.match(html,/noindex,nofollow,noarchive/);assert.doesNotMatch(html,/class="exclusive-card"/);const source=await read('exclusive/src/catalog.js');assert.match(source,/api\('catalog',\{partner,access\}\)/);assert.match(source,/api\('claim',\{partner,access,watchface:selected\}/);assert.match(source,/fragment.get\('access'\)/);});
