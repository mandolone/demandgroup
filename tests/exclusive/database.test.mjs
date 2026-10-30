import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

// Actual PostgreSQL, independent connections and real row/advisory locks. Only synthetic inventory.
const dir=await mkdtemp(join(tmpdir(),'exclusive-pg-'));
const server=new EmbeddedPostgres({databaseDir:join(dir,'db'),port:55439,user:'postgres',password:randomUUID(),persistent:false,onLog:()=>{},onError:()=>{},postgresFlags:['-h','127.0.0.1','-k',dir]});
let db;let pool;
const ids=Array.from({length:45},()=>randomUUID());
const campaign=randomUUID();
async function call(action,input={},actor=ids[0],client=db){return (await client.query('select public.exclusive_api($1,$2,$3) as data',[action,{campaign:'test-campaign',...input},actor])).rows[0].data;}
const expires=new Date(Date.now()+86400000).toISOString();
async function batch(partner,face,codes,extra={}){return call('admin_import',{import_id:randomUUID(),partner,watchface:face,codes,expected_rows:codes.length,expires_at:expires,...extra});}
const accessKeys={};
const claim=(user,partner='valentina',watchface='sputnik',client=db)=>call('claim',{partner,access:accessKeys[partner],watchface},user,client);
const consentVersion='monthly-watchfaces-2026-10-30-v1';
async function newsletter(action,input={},actor=ids[0]){return (await db.query('select public.exclusive_newsletter($1,$2,$3) as data',[action,{campaign:'test-campaign',...input},actor])).rows[0].data;}

test('PostgreSQL campaign integration and security',async t=>{
 try{
 await server.initialise();await server.start();db=server.getPgClient();await db.connect();
 const cfg=db.connectionParameters;pool=new pg.Pool({host:'127.0.0.1',port:cfg.port,user:cfg.user,password:cfg.password,database:cfg.database,max:20});
 await db.query("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false)");
 for(const file of ['202610300001_exclusive.sql','202610300002_catalog.sql','202610300003_newsletter.sql','202610300004_partner_access.sql','202610300005_continuing_program.sql'])await db.query(await readFile('supabase/migrations/'+file,'utf8'));
 for(const [i,id] of ids.entries())await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`fixture-${i}@example.invalid`]);
 await db.query('insert into exclusive_private.admins values($1)',[ids[0]]);
 await db.query("insert into exclusive_private.campaigns(id,slug,name,active,ends_at) values($1,'test-campaign','Synthetic test only',true,now()+interval '2 days')",[campaign]);
 for(const partner of ['valentina','sara'])accessKeys[partner]=(await call('admin_access_create',{partner})).access;
 await batch('valentina','sputnik',Array.from({length:25},(_,i)=>`VALENTINA${String(i).padStart(3,'0')}`));
 await batch('sara','sputnik',Array.from({length:25},(_,i)=>`SARACODE${String(i).padStart(3,'0')}`));
 await batch('valentina','cyber',['CYBERCODE001','CYBERCODE002']);
 await batch('sara','cyber',['SARACYBER001','SARACYBER002']);
 await t.test('private QR: public URL, partner-only URL and arbitrary tokens cannot inspect or claim stock',async()=>{
   for(const action of ['catalog','visit','claim']){
     await assert.rejects(()=>call(action,{partner:'valentina',watchface:'sputnik'},ids[32]),/PARTNER_ACCESS_REQUIRED/);
     await assert.rejects(()=>call(action,{partner:'valentina',watchface:'sputnik',access:'a'.repeat(64)},ids[32]),/PARTNER_ACCESS_REQUIRED/);
   }
   const result=await call('catalog',{partner:'valentina',access:accessKeys.valentina},null);assert.equal(result.partner,'Paradise Beach Camper');
   await assert.rejects(()=>call('catalog',{partner:'valentina',access:accessKeys.sara}),/PARTNER_ACCESS_REQUIRED/);
 });
 await t.test('private QR: only administrators issue links, DB stores hashes, snapshots never expose raw keys',async()=>{
   await assert.rejects(()=>call('admin_access_create',{partner:'valentina'},ids[1]),/ADMIN_REQUIRED/);
   await assert.rejects(()=>call('admin_access_revoke',{partner:'valentina'},ids[1]),/ADMIN_REQUIRED/);
   const snapshot=await call('admin_snapshot');assert.equal(snapshot.access_links.length,2);assert.ok(!JSON.stringify(snapshot).includes(accessKeys.valentina));
   const stored=(await db.query("select encode(token_hash,'hex') as hash from exclusive_private.partner_access where partner_id='valentina'")).rows[0].hash;assert.notEqual(stored,accessKeys.valentina);
   await db.query('set role anon');await assert.rejects(()=>db.query('select * from exclusive_private.partner_access'),/permission denied/);await db.query('reset role');
 });
 await t.test('1 and 2: partner pools remain isolated',async()=>{const v=await claim(ids[1]);const s=await claim(ids[2],'sara');assert.match(v.assignments[0].code,/^VALENTINA/);assert.match(s.assignments[0].code,/^SARACODE/);});
 await t.test('3: twenty simultaneous identities receive distinct codes',async()=>{const results=await Promise.all(ids.slice(3,23).map(async id=>{const c=await pool.connect();try{return await claim(id,'valentina','sputnik',c);}finally{c.release();}}));const codes=results.flatMap(r=>r.assignments.map(a=>a.code));assert.equal(codes.length,20);assert.equal(new Set(codes).size,20);});
 await t.test('4: simultaneous same-identity requests across partners and faces allocate only once',async()=>{const results=await Promise.all(Array.from({length:12},async(_,i)=>{const c=await pool.connect();try{return await claim(ids[23],i%2?'sara':'valentina',i%3?'sputnik':'cyber',c);}finally{c.release();}}));assert.equal(new Set(results.map(r=>r.assignments[0].code)).size,1);});
 await t.test('5 and 6: refresh/re-login/change partner recovers existing code',async()=>{const before=await claim(ids[1]);const after=await claim(ids[1],'sara','cyber');const mine=await call('mine',{},ids[1]);assert.equal(before.assignments[0].code,after.assignments[0].code);assert.deepEqual(mine.assignments,after.assignments);});
 await t.test('7: exhausted or expired stock does not spill into another pool',async()=>{await batch('sara','cyber',['EXPIRED001']);await db.query("update exclusive_private.codes set expires_at=now()-interval '1 second' where partner_id='sara' and watchface_id='cyber'");const result=await claim(ids[24],'sara','cyber');assert.equal(result.unavailable,true);assert.deepEqual(result.assignments,[]);assert.equal((await call('mine',{},ids[24])).assignments.length,0);});
 await t.test('8: anonymous and unverified users cannot retrieve/claim; non-admin cannot import',async()=>{await assert.rejects(()=>call('mine',{},null),/VERIFIED_EMAIL_REQUIRED/);await db.query('update auth.users set email_confirmed_at=null where id=$1',[ids[25]]);await assert.rejects(()=>claim(ids[25]),/VERIFIED_EMAIL_REQUIRED/);await assert.rejects(()=>call('admin_snapshot',{},ids[1]),/ADMIN_REQUIRED/);await assert.rejects(()=>call('admin_import',{},ids[1]),/ADMIN_REQUIRED/);await db.query('set role anon');await assert.rejects(()=>db.query("select * from exclusive_private.codes"),/permission denied/);await assert.rejects(()=>db.query("select public.exclusive_api('mine')"),/permission denied/);await db.query('reset role');});
 await t.test('CSV import retries, duplicate rejection and rollback',async()=>{const id=randomUUID();const args={import_id:id,partner:'sara',watchface:'cyber',codes:['IMPORTCODE001'],expected_rows:1,expires_at:expires};assert.equal((await call('admin_import',args)).imported,1);assert.equal((await call('admin_import',args)).already_imported,true);await assert.rejects(()=>batch('sara','cyber',['IMPORTCODE001','NEWIMPORT001']),/DUPLICATE_CODE/);assert.equal((await db.query("select count(*) from exclusive_private.codes where code='NEWIMPORT001'")).rows[0].count,'0');await assert.rejects(()=>batch('sara','cyber',['BADFORMAT!']),/INVALID_CODE_FORMAT/);await assert.rejects(()=>batch('sara','cyber',['NEWIMPORT002'],{expected_rows:25}),/INVALID_ROW_COUNT/);});
 await t.test('account recreation with the same verified email cannot reset global limit',async()=>{const first=await claim(ids[26],'sara');await db.query('delete from auth.users where id=$1',[ids[26]]);await db.query("insert into auth.users values($1,'fixture-26@example.invalid',now(),false)",[ids[27]]).catch(async()=>{await db.query("update auth.users set email='fixture-26@example.invalid' where id=$1",[ids[27]]);});const next=await claim(ids[27]);assert.equal(first.assignments[0].code,next.assignments[0].code);});
 await t.test('configurable higher limit, and repeats on same face stay idempotent',async()=>{await db.query('update exclusive_private.campaigns set user_limit=2 where id=$1',[campaign]);const a=await claim(ids[28],'valentina');const b=await claim(ids[28],'valentina','cyber');assert.equal(a.assignments.length,1);assert.equal(b.assignments.length,2);assert.equal((await claim(ids[28],'sara','cyber')).assignments.length,2);await db.query('update exclusive_private.campaigns set user_limit=1 where id=$1',[campaign]);});
 await t.test('stock disabling and closed campaigns reject allocation, preserve recovery',async()=>{await db.query("update exclusive_private.campaigns set active=false where id=$1",[campaign]);await assert.rejects(()=>claim(ids[29]),/CAMPAIGN_CLOSED/);assert.equal((await claim(ids[1])).assignments.length,1);await db.query('update exclusive_private.campaigns set active=true where id=$1',[campaign]);});
 await t.test('global uniqueness, RLS, stable attribution and no identity in aggregate snapshot',async()=>{const a=await call('admin_snapshot');assert.ok(a.events.some(e=>e.partner_id==='valentina'&&e.kind==='assigned'));assert.doesNotMatch(JSON.stringify(a),/@example|VALENTINA0|SARACODE/);assert.equal((await db.query("select count(*) from pg_tables where schemaname='exclusive_private' and not rowsecurity")).rows[0].count,'0');await assert.rejects(()=>db.query("insert into exclusive_private.codes(code,campaign_id,partner_id,watchface_id,import_id,expires_at) select code,campaign_id,partner_id,watchface_id,import_id,expires_at from exclusive_private.codes limit 1"),/unique constraint/);});
 await t.test('changing verified email on the same account cannot reset the limit',async()=>{const a=await claim(ids[1]);await db.query("update auth.users set email='changed@example.invalid' where id=$1",[ids[1]]);assert.equal((await claim(ids[1],'sara')).assignments[0].code,a.assignments[0].code);});
 await t.test('atomic rate limiting and expiry recovery',async()=>{assert.equal((await db.query("select exclusive_rate_limit('test',2,60) as ok")).rows[0].ok,true);await db.query("select exclusive_rate_limit('test',2,60)");assert.equal((await db.query("select exclusive_rate_limit('test',2,60) as ok")).rows[0].ok,false);});
 await t.test('newsletter: no opt-in by default; verified email and explicit current consent required',async()=>{
   assert.equal((await newsletter('newsletter_status',{},ids[30])).subscribed,false);
   await assert.rejects(()=>newsletter('newsletter_set',{enabled:true,consent_version:consentVersion},null),/VERIFIED_EMAIL_REQUIRED/);
   await assert.rejects(()=>newsletter('newsletter_set',{enabled:true,consent_version:consentVersion},ids[25]),/VERIFIED_EMAIL_REQUIRED/);
   await assert.rejects(()=>newsletter('newsletter_set',{consent_version:consentVersion},ids[30]),/EXPLICIT_NEWSLETTER_CHOICE_REQUIRED/);
   await assert.rejects(()=>newsletter('newsletter_set',{enabled:true},ids[30]),/CONSENT_VERSION_REQUIRED/);
   assert.equal((await newsletter('admin_newsletter_export')).contacts.length,0);
 });
 await t.test('newsletter: consent is independent of claims, idempotent and traceable',async()=>{
   assert.equal((await newsletter('newsletter_set',{enabled:true,consent_version:consentVersion,partner:'sara'},ids[30])).subscribed,true);
   const first=(await newsletter('admin_newsletter_export')).contacts;
   assert.equal(first.length,1);assert.equal(first[0].email,'fixture-30@example.invalid');assert.equal(first[0].source_partner,'sara');assert.ok(first[0].verified_at);assert.ok(first[0].consent_text.includes('optional'));
   await newsletter('newsletter_set',{enabled:true,consent_version:consentVersion,partner:'valentina'},ids[30]);
   assert.deepEqual((await newsletter('admin_newsletter_export')).contacts,first);
   assert.equal((await db.query("select count(*) from exclusive_private.newsletter_consent_events where event='subscribed'")).rows[0].count,'1');
   assert.deepEqual((await call('mine',{},ids[30])).assignments,[]);
   const c=await claim(ids[31],'sara');assert.equal(c.assignments.length,1);assert.equal((await newsletter('newsletter_status',{},ids[31])).subscribed,false);
 });
 await t.test('newsletter: users cannot export other emails; anonymous clients cannot call RPC/read tables',async()=>{
   await assert.rejects(()=>newsletter('admin_newsletter_export',{},ids[30]),/ADMIN_REQUIRED/);
   await assert.rejects(()=>newsletter('admin_newsletter_withdrawals',{},ids[30]),/ADMIN_REQUIRED/);
   await db.query('set role anon');await assert.rejects(()=>db.query("select public.exclusive_newsletter('newsletter_status')"),/permission denied/);await assert.rejects(()=>db.query('select * from exclusive_private.newsletter_subscriptions'),/permission denied/);await db.query('reset role');
 });
 await t.test('newsletter: withdrawal removes email from subscriber export and preserves the assigned code',async()=>{
   const code=(await call('mine',{},ids[31])).assignments[0].code;
   await newsletter('newsletter_set',{enabled:true,consent_version:consentVersion},ids[31]);
   await newsletter('newsletter_set',{enabled:false},ids[31]);
   assert.equal((await newsletter('newsletter_status',{},ids[31])).subscribed,false);
   assert.equal((await newsletter('admin_newsletter_export')).contacts.length,1);
   assert.equal((await newsletter('admin_newsletter_withdrawals')).contacts[0].email,'fixture-31@example.invalid');
   assert.equal((await call('mine',{},ids[31])).assignments[0].code,code);
 });
 await t.test('newsletter: expiry excludes contacts immediately; cleanup removes withdrawn email after 30 days',async()=>{
   await db.query("update exclusive_private.newsletter_subscriptions set expires_at=now()-interval '31 days' where withdrawn_at is null");
   assert.equal((await newsletter('admin_newsletter_export')).contacts.length,0);
   await db.query('select public.exclusive_newsletter_cleanup()');
   assert.equal((await db.query("select count(*) from exclusive_private.newsletter_subscriptions where email='fixture-30@example.invalid'")).rows[0].count,'0');
   const remaining=(await newsletter('admin_newsletter_withdrawals')).contacts;assert.equal(remaining.length,1);assert.equal(remaining[0].email,'fixture-31@example.invalid');
 });
 await t.test('multiple partners: add ten new venues without application changes, isolate QR/stock and keep the global user limit',async()=>{
   for(let i=0;i<10;i++){
     const partner=`test-venue-${i}`;
     await call('admin_partner',{id:partner,name:`Synthetic test venue ${i}`,active:true});
     accessKeys[partner]=(await call('admin_access_create',{partner})).access;
     await batch(partner,'gearweirdo',[`DYNAMICVENUE${i}PROMO`]);
     const assignment=await claim(ids[33+i],partner,'gearweirdo');
     assert.equal(assignment.assignments[0].partner,partner);
     assert.equal(assignment.assignments[0].code,`DYNAMICVENUE${i}PROMO`);
   }
   const snapshot=await call('admin_snapshot');assert.equal(snapshot.partners.length,14);assert.equal(snapshot.access_links.length,12);
   const recovered=await claim(ids[33],'sara');assert.equal(recovered.assignments.length,1);assert.equal(recovered.assignments[0].partner,'test-venue-0');
   await assert.rejects(()=>call('catalog',{partner:'test-venue-1',access:accessKeys['test-venue-0']}),/PARTNER_ACCESS_REQUIRED/);
   await call('admin_partner',{id:'test-venue-0',name:'Renamed synthetic venue',active:false});
   await assert.rejects(()=>call('catalog',{partner:'test-venue-0',access:accessKeys['test-venue-0']}),/PARTNER_ACCESS_REQUIRED/);
   await assert.rejects(()=>claim(ids[43],'test-venue-0','gearweirdo'),/PARTNER_ACCESS_REQUIRED/);
   await call('admin_partner',{id:'test-venue-0',name:'Renamed synthetic venue',active:true});
   assert.equal((await call('catalog',{partner:'test-venue-0',access:accessKeys['test-venue-0']})).partner,'Renamed synthetic venue');
 });
 await t.test('continuing program: no end date, permanent revocable QR, fresh stock and one-gift rule after Auth retention',async()=>{
   await call('admin_campaign',{active:true,user_limit:1,starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:null,retention_days:90});
   const qr=await call('admin_access_create',{partner:'valentina'});accessKeys.valentina=qr.access;assert.equal(qr.expires_at,null);
   const catalog=await call('catalog',{partner:'valentina',access:qr.access},null);assert.equal(catalog.ends_at,null);
   await batch('valentina','zodiac10',['CONTINUINGCODE001']);
   const first=await claim(ids[44],'valentina','zodiac10');assert.equal(first.assignments.length,1);
   const views=(await call('admin_snapshot')).events.filter(e=>e.kind==='visit').reduce((n,e)=>n+Number(e.total),0);
   await call('visit',{partner:'valentina',access:qr.access,session_id:randomUUID()},null);
   assert.equal((await call('admin_snapshot')).events.filter(e=>e.kind==='visit').reduce((n,e)=>n+Number(e.total),0),views+1);
   await db.query("update exclusive_private.identities set last_seen_at=now()-interval '91 days' where user_id=$1",[ids[44]]);
   const queue=(await db.query('select public.exclusive_cleanup() as users')).rows[0].users;assert.ok(queue.includes(ids[44]));assert.ok(!queue.includes(ids[0]));
   const saved=(await db.query('select a.code_id,i.user_id from exclusive_private.assignments a join exclusive_private.identities i on i.id=a.identity_id where a.code_id=(select id from exclusive_private.codes where code=$1)',[first.assignments[0].code])).rows[0];assert.equal(saved.user_id,null);
   await db.query('delete from auth.users where id=$1',[ids[44]]);await db.query('select public.exclusive_cleanup_done($1)',[ids[44]]);
   const returning=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[returning,'fixture-44@example.invalid']);
   const recovered=await claim(returning,'sara');assert.equal(recovered.assignments.length,1);assert.equal(recovered.assignments[0].code,first.assignments[0].code);
   const snapshot=await call('admin_snapshot');assert.equal(snapshot.partners.find(p=>p.id==='sara').name,'Scubadiving');assert.equal(snapshot.partners.find(p=>p.id==='valentina').name,'Paradise Beach Camper');assert.equal(snapshot.partners.find(p=>p.id==='barbiere').active,false);assert.equal(snapshot.partners.find(p=>p.id==='ottico').active,false);
   await call('admin_campaign',{active:true,user_limit:1,starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:new Date(Date.now()+172800000).toISOString(),retention_days:90});
 });
 await t.test('private QR: revocation, replacement and expiry block old keys and preserve other partner links',async()=>{
   const old=accessKeys.sara;
   await call('admin_access_revoke',{partner:'sara'});
   await assert.rejects(()=>call('catalog',{partner:'sara',access:old}),/PARTNER_ACCESS_REQUIRED/);
   await assert.rejects(()=>call('claim',{partner:'sara',access:old,watchface:'sputnik'},ids[2]),/PARTNER_ACCESS_REQUIRED/);
   assert.equal((await call('mine',{},ids[2])).assignments.length,1);
   assert.equal((await call('catalog',{partner:'valentina',access:accessKeys.valentina})).partner,'Paradise Beach Camper');
   const next=await call('admin_access_create',{partner:'sara'});accessKeys.sara=next.access;assert.notEqual(next.access,old);
   await assert.rejects(()=>call('catalog',{partner:'sara',access:old}),/PARTNER_ACCESS_REQUIRED/);
   assert.equal((await call('catalog',{partner:'sara',access:next.access})).partner,'Scubadiving');
   await db.query("update exclusive_private.partner_access set expires_at=now()-interval '1 second' where partner_id='sara'");
   await assert.rejects(()=>call('catalog',{partner:'sara',access:next.access}),/PARTNER_ACCESS_REQUIRED/);
 });
 await t.test('retention cleanup removes identity links, queues promotion accounts, never recycles assigned codes',async()=>{await db.query("update exclusive_private.campaigns set starts_at=now()-interval '200 days', ends_at=now()-interval '100 days' where id=$1",[campaign]);const result=(await db.query('select public.exclusive_cleanup() as users')).rows[0].users;assert.ok(result.length>0);assert.ok(!result.includes(ids[0]));assert.equal((await db.query('select count(*) from exclusive_private.assignments')).rows[0].count,'0');assert.equal((await db.query('select count(*) from exclusive_private.identities')).rows[0].count,'0');assert.ok(Number((await db.query("select count(*) from exclusive_private.codes where status='ASSIGNED' and recipient_id is null")).rows[0].count)>0);await assert.rejects(()=>call('admin_campaign',{active:true,user_limit:1}),/CAMPAIGN_CLOSED/);assert.deepEqual((await call('mine',{},ids[1])).assignments,[]);});

 }finally{await pool?.end();await db?.end();await server.stop();await rm(dir,{recursive:true,force:true});}
});
