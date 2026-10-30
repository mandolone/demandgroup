import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
// Reject accidental private uploads or server keys before touching deployable files.
async function guard(root){for(const f of await readdir(root,{withFileTypes:true})){const path=root+'/'+f.name;if(f.isDirectory())await guard(path);else if(/\.csv$|^\.env|\.sql$/i.test(f.name))throw Error('Private file in public directory: '+path);}}
await guard('docs');await guard('public');
const config=JSON.parse(await readFile('exclusive/config.json','utf8'));
const key=config.supabasePublishableKey||'';
let role='';try{role=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role||'';}catch{}
if(key.startsWith('sb_secret_')||role==='service_role')throw Error('Never put a server secret in exclusive/config.json');
const products=JSON.parse(await readFile('exclusive/catalog.json','utf8'));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cards=products.map((p,i)=>`<article class="exclusive-card"><img src="${escape(p.image)}" alt="${escape(p.name)} — actual watch face" width="512" height="512" loading="lazy"><p class="eyebrow">DG / ${String(i+1).padStart(2,'0')}</p><h3>${escape(p.name)}</h3><p>${escape(p.description)}</p><p data-stock>Availability not confirmed</p><button class="buy" data-claim="${escape(p.id)}" disabled>Get your complimentary watch face</button><a href="https://play.google.com/store/apps/details?id=${escape(p.package_name)}" target="_blank" rel="noopener noreferrer">Check device compatibility ↗</a></article>`).join('\n');
const csp="default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'";
for(const root of ['docs/exclusive','public/exclusive']){
 await mkdir(root+'/admin',{recursive:true});await mkdir(root+'/privacy',{recursive:true});
 for(const name of ['catalog','admin','privacy']){const body=(await readFile(`exclusive/templates/${name}.html`,'utf8')).replace('{{CARDS}}',cards);const script=name==='privacy'?'':`<script type="module" src="/exclusive/${name}.js"></script>`;const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="robots" content="${name==='admin'?'noindex,nofollow':'index,follow'}"><title>${name==='admin'?'Partner desk':name==='privacy'?'Promotion privacy':'The complimentary collection'} — Demand Group</title><meta name="description" content="Discover the Demand Group partner collection for compatible Wear OS watches."><link rel="icon" href="/favicon.jpg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/shop-fonts.css"><link rel="stylesheet" href="/shop.css"><link rel="stylesheet" href="/exclusive/exclusive.css"></head><body>${body}${script}</body></html>\n`;await writeFile(root+(name==='catalog'?'/index.html':`/${name}/index.html`),html);}
 for(const name of ['catalog.json','config.json','exclusive.css'])await copyFile(`exclusive/${name}`,`${root}/${name}`);
 await build({entryPoints:['exclusive/src/catalog.js','exclusive/src/admin.js'],bundle:true,format:'esm',target:'es2022',outdir:root,minify:true,sourcemap:false,logLevel:'warning'});
}
// Preserve the framework source routes alongside the GitHub Pages deployment.
await mkdir('app/exclusive/admin',{recursive:true});await mkdir('app/exclusive/privacy',{recursive:true});
for(const name of ['catalog','admin','privacy']){
 const body=(await readFile(`exclusive/templates/${name}.html`,'utf8')).replace('{{CARDS}}',cards);
 const dir='app/exclusive'+(name==='catalog'?'':'/'+name);
 const css='<link rel="stylesheet" href="/exclusive/exclusive.css" />';
 await writeFile(dir+'/content.ts','export const html = '+JSON.stringify(css+body)+';\n');
 await writeFile(dir+'/page.tsx',`import Script from "next/script";\nimport { html } from "./content";\nexport const metadata = { title: ${JSON.stringify(name==='admin'?'Partner desk — Demand Group':name==='privacy'?'Promotion privacy — Demand Group':'The complimentary collection — Demand Group')}, alternates: { canonical: ${JSON.stringify('/exclusive/'+(name==='catalog'?'':name+'/'))} } };\nexport default function Page() { return <><div dangerouslySetInnerHTML={{__html: html}} />${name==='privacy'?'':`<Script type="module" src="/exclusive/${name}.js" strategy="afterInteractive" />`}</>; }\n`);
}
console.log(`Built exclusive catalog (${products.length} real products), dashboard and privacy page for GitHub Pages and framework routes.`);
