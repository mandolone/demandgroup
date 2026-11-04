import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {catalogState,filterProducts,stateSearch,PAGE_SIZE} from '../../website/catalog-model.mjs';
const read=p=>readFile(p,'utf8');const products=JSON.parse(await read('website/products.json'));
const collections=['all',...new Set(products.map(p=>p.category))];
test('search, availability and collection filters combine; URL state restores expanded results',()=>{
 let state=catalogState('?collection=space&status=available&q=voyager&shown=24',collections);
 assert.equal(state.shown,24);assert.equal(filterProducts(products,state).length,2);
 const roundtrip=catalogState('?'+stateSearch(state),collections);assert.deepEqual(roundtrip,state);
 state=catalogState('?collection=worlds&status=coming-soon',collections);assert.deepEqual(filterProducts(products,state).map(p=>p.slug),['flat-earth']);
 assert.equal(filterProducts(products,{...state,q:'NO SUCH DIAL'}).length,0);
 const bad=catalogState('?collection=unknown&status=private&shown=-1&sort=popular',collections);assert.equal(bad.collection,'all');assert.equal(bad.status,'all');assert.equal(bad.shown,PAGE_SIZE);assert.equal(bad.sort,'featured');
});
test('every released face is linked to a verified companion-catalog package; previews do not invent purchase links',async()=>{
 const official=JSON.parse(await read('public/catalog/watchfaces.json')).apps;
 assert.equal(new Set(products.map(p=>p.slug)).size,products.length);
 for(const p of products){
  const page=await read(`docs/watch-faces/${p.slug}/index.html`);assert.match(page,/rel="canonical"/);assert.ok((await stat('docs'+p.image)).size>0);
  if(p.status==='available'){assert.ok(official.some(a=>a.packageName===p.package));assert.ok(page.includes('https://play.google.com/store/apps/details?id='+p.package));}
  else {assert.equal(p.package,undefined);assert.match(page,/Coming soon/);assert.match(page,/not yet offered for purchase/);}
  assert.equal(page,await read(`public/watch-faces/${p.slug}/index.html`));
 }
});
test('homepage is curated; the complete static catalog stays accessible without JavaScript',async()=>{
 const home=await read('docs/index.html'),catalog=await read('docs/watch-faces/index.html');
 assert.equal((home.match(/class="launch-card"/g)||[]).length,4);assert.doesNotMatch(home,/class="watch-card"/);
 for(const slug of ['flat-earth','long-distance-call','megastructure','solar-flare'])assert.ok(home.includes('/watch-faces/'+slug+'/'));
 assert.equal((catalog.match(/data-product-card /g)||[]).length,products.length);assert.match(catalog,/id="catalog-filters"/);assert.match(catalog,/id="load-more"/);assert.match(catalog,/<noscript>/);
 assert.equal(home,await read('public/index.html'));
 assert.doesNotMatch(await read('docs/sitemap.xml'),/exclusive/);
});
test('legacy galleries and original recorded clips remain on individual product pages',async()=>{
 for(const p of products.filter(p=>p.legacy)){
  const source=(await read(`website/legacy-products/${p.legacy}.html`)).replaceAll('href="#collection"','href="/watch-faces/"');
  assert.ok((await read(`docs/watch-faces/${p.slug}/index.html`)).includes(source));
 }
});
