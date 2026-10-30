import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAdminKey} from '../../supabase/functions/_shared/admin-key.mjs';
const read=values=>name=>values[name];
test('server credentials prefer modern injected secret keys and support renamed or legacy keys',()=>{
 assert.equal(resolveAdminKey(read({SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_synthetic_default',other:'sb_secret_synthetic_other'}),SUPABASE_SERVICE_ROLE_KEY:'synthetic-legacy'})),'sb_secret_synthetic_default');
 assert.equal(resolveAdminKey(read({SUPABASE_SECRET_KEYS:JSON.stringify({server:'sb_secret_synthetic_server'})})),'sb_secret_synthetic_server');
 assert.equal(resolveAdminKey(read({SUPABASE_SERVICE_ROLE_KEY:'synthetic-legacy'})),'synthetic-legacy');
});
test('missing credentials fail closed without echoing credential material',()=>{
 assert.throws(()=>resolveAdminKey(read({SUPABASE_SECRET_KEYS:'invalid-data'})),/^Error: Server credentials are not available in this runtime\.$/);
 assert.throws(()=>resolveAdminKey(read({SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_publishable_not_a_server_key'})})),/Server credentials/);
});
