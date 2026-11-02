export const PAGE_SIZE=12;
export function catalogState(search,collections){
 const p=new URLSearchParams(search);const collection=p.get('collection')||'all';const status=p.get('status')||'all';
 return {q:(p.get('q')||'').slice(0,150),collection:collections.includes(collection)?collection:'all',status:['all','available','coming-soon'].includes(status)?status:'all',sort:p.get('sort')==='name'?'name':'featured',shown:Math.min(10000,Math.max(PAGE_SIZE,Number.parseInt(p.get('shown')||'',10)||PAGE_SIZE))};
}
export function filterProducts(products,state){
 const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const terms=fold(state.q).trim().split(/\s+/).filter(Boolean);
 const result=products.filter(p=>(state.collection==='all'||p.category===state.collection)&&(state.status==='all'||p.status===state.status)&&terms.every(t=>fold(`${p.title} ${p.description} ${p.category}`).includes(t)));
 return state.sort==='name'?result.sort((a,b)=>a.title.localeCompare(b.title)):result;
}
export function stateSearch(state){const p=new URLSearchParams();for(const key of ['collection','status','q','sort','shown']){const value=state[key];if((key==='shown'&&value===PAGE_SIZE)||((key==='status'||key==='collection')&&value==='all')||(key==='sort'&&value==='featured')||value==='')continue;p.set(key,String(value));}return p.toString();}
