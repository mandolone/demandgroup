import {PAGE_SIZE,catalogState,filterProducts,stateSearch} from './catalog-model.mjs';
const form=document.querySelector('#catalog-filters');
if(form){
 const cards=[...document.querySelectorAll('[data-product-card]')];
 const products=cards.map(node=>({node,slug:node.dataset.slug,title:node.dataset.title,description:node.dataset.description,category:node.dataset.collection,status:node.dataset.status}));
 const collections=['all',...new Set(products.map(p=>p.category))];let state=catalogState(location.search,collections);
 const field=name=>form.elements.namedItem(name);const grid=document.querySelector('#catalog-grid');const more=document.querySelector('#load-more');const summary=document.querySelector('#catalog-count');const empty=document.querySelector('#catalog-empty');
 function render(){
  for(const key of ['q','collection','status','sort'])field(key).value=state[key];
  const matches=filterProducts(products,state);const shown=matches.slice(0,state.shown);const visible=new Set(shown.map(p=>p.slug));
  for(const p of products)p.node.hidden=!visible.has(p.slug);
  // Reorder existing links without discarding focus or creating new product data.
  for(const p of matches)grid.append(p.node);
  summary.textContent=matches.length?`Showing ${shown.length} of ${matches.length} watch faces`:'No watch faces match your filters';
  empty.hidden=matches.length!==0;more.hidden=shown.length>=matches.length;more.textContent=`Show ${Math.min(PAGE_SIZE,matches.length-shown.length)} more watch faces`;
  document.querySelector('#clear-filters').hidden=state.q===''&&state.collection==='all'&&state.status==='all'&&state.sort==='featured';
 }
 function save(mode='push'){const query=stateSearch(state);history[mode==='replace'?'replaceState':'pushState'](null,'',location.pathname+(query?'?'+query:''));}
 let timer;
 field('q').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.q=field('q').value;state.shown=PAGE_SIZE;save('replace');render();},120);});
 for(const key of ['collection','status','sort'])field(key).addEventListener('change',()=>{state[key]=field(key).value;state.shown=PAGE_SIZE;save();render();});
 form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);state.q=field('q').value;state.shown=PAGE_SIZE;save('replace');render();});
 document.querySelector('#clear-filters').addEventListener('click',()=>{state=catalogState('',collections);save();render();field('q').focus();});
 more.addEventListener('click',()=>{const previous=state.shown;state.shown+=PAGE_SIZE;save();render();const next=filterProducts(products,state)[previous];next?.node.querySelector('h2 a')?.focus();});
 addEventListener('popstate',()=>{state=catalogState(location.search,collections);render();});render();
}
const rail=document.querySelector('#new-releases');
if(rail){
 const controls=document.querySelector('.launch-controls');
 const position=controls.querySelector('#launch-position');
 const updatePosition=()=>{const left=rail.getBoundingClientRect().left;const distances=[...rail.children].map(e=>Math.abs(e.getBoundingClientRect().left-left));const index=distances.indexOf(Math.min(...distances));position.textContent=`${index+1} / ${rail.children.length}`;controls.querySelector('[data-direction="previous"]').disabled=index===0;controls.querySelector('[data-direction="next"]').disabled=index===rail.children.length-1;};
 const update=()=>{controls.hidden=rail.scrollWidth<=rail.clientWidth+4;updatePosition();};new ResizeObserver(update).observe(rail);rail.addEventListener('scroll',updatePosition,{passive:true});update();
 controls.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>rail.scrollBy({left:rail.clientWidth*(button.dataset.direction==='next'?1:-1),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})));
}
// Old homepage product bookmarks remain useful after the collection moves to its own page.
if(location.pathname==='/'){
 const legacy={artemis2celebration:'artemis-ii',zodiac10:'zodiac',voyageranalog:'voyager-analog',voyagerdigital:'voyager-digital',r4star:'r4-star',R5S:'r5s',cyber:'cyber-mechanica',gearweirdo:'gear-weirdo',outfit:'outfit',lavaorange:'lava-lamp-orange',violetlava:'lava-lamp-violet',sputnik:'sputnik','kanji-wave':'kanji-wave','ukiyo-wave':'ukiyo-wave'};
 const slug=legacy[location.hash.slice(1)];if(slug)location.replace('/watch-faces/'+slug+'/');
}
