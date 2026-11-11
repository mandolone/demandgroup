import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

// Exercise the actual card renderer with unavailable promotional stock.
const source=await readFile('exclusive/src/catalog.js','utf8');
const renderer=source.slice(source.indexOf('function renderCatalog(items){'),source.indexOf('async function loadStock(){'));
const products=JSON.parse(await readFile('exclusive/catalog.json','utf8'));
function render(items){
 const grid={children:[],replaceChildren(){this.children=[];},append(...nodes){this.children.push(...nodes);}};
 const auth=[];
 const el=(tag,text,className)=>({tag,text,className,children:[],append(...nodes){this.children.push(...nodes);}});
 runInNewContext(renderer+'\nrenderCatalog(items);',{products,items,$:()=>grid,el,openAuth:id=>auth.push(id)});
 return {cards:grid.children,auth};
}
test('free watch faces link to Google Play even with no promotional codes, without starting a claim',()=>{
 const result=render(products.map(p=>({id:p.id,available:false})));
 const expected=['com.watchfacestudio.steely','com.watchfacestudio.r4star','com.watchfacestudio.R5S'];
 assert.deepEqual(products.filter(p=>p.free).map(p=>p.package_name).sort(),expected.sort());
 for(const p of products.filter(p=>p.free)){
  const card=result.cards.find(c=>c.children.some(n=>n.tag==='h3'&&n.text===p.name));
  assert.ok(card);
  assert.ok(card.children.some(n=>n.tag==='p'&&n.text==='Free on Google Play · No promotional code needed'));
  const action=card.children.find(n=>n.className==='buy');
  assert.equal(action.tag,'a');assert.equal(action.text,'Install free on Google Play ↗');
  assert.equal(action.href,'https://play.google.com/store/apps/details?id='+encodeURIComponent(p.package_name));
  assert.equal(action.onclick,undefined);
  assert.ok(!card.children.some(n=>/unavailable|No codes available/i.test(n.text||'')));
 }
 assert.deepEqual(result.auth,[]);
});
test('paid watch faces retain partner stock availability and email claim flow',()=>{
 const paid=products.find(p=>!p.free);
 const empty=render([{id:paid.id,available:false}]);
 const disabled=empty.cards[0].children.find(n=>n.className==='buy');
 assert.equal(disabled.tag,'button');assert.equal(disabled.disabled,true);assert.equal(disabled.text,'Currently unavailable');
 const stocked=render([{id:paid.id,available:true}]);
 const enabled=stocked.cards[0].children.find(n=>n.className==='buy');
 assert.equal(enabled.disabled,false);enabled.onclick();assert.deepEqual(stocked.auth,[paid.id]);
});
