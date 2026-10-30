import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
async function render(path){return worker.fetch(new Request('http://localhost'+path,{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});}
for(const [path,text] of [['/','Space-inspired.'],['/exclusive','By invitation.'],['/exclusive/admin','Partner desk.'],['/exclusive/privacy','Your email, with a clear purpose.'],['/website-privacy-policy','Privacy']]){
 test(`framework renders ${path}`,async()=>{const response=await render(path);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);assert.ok((await response.text()).includes(text));});
}
