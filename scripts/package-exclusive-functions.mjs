import {mkdir,readFile,writeFile} from 'node:fs/promises';
const root='work/supabase-setup';await mkdir(root,{recursive:true});
// Keep TypeScript annotations and flatten only the two small shared helpers.
const admin=(await readFile('supabase/functions/_shared/admin-key.mjs','utf8')).replace(/\/\*\*[^]*?\*\//,'').replace('export function resolveAdminKey(getEnv)','function resolveAdminKey(getEnv: (name: string) => string | undefined): string');
const csv=(await readFile('supabase/functions/_shared/csv.mjs','utf8')).replace("import {parse} from 'csv-parse/sync';",'').replace('export function parseCodes(csv)','function parseCodes(csv: unknown): string[]').replace('let rows;','let rows: string[][];');
for(const [name,file] of [['exclusive-api','04_EXCLUSIVE_API_DA_COPIARE'],['exclusive-cleanup','05_EXCLUSIVE_CLEANUP_DA_COPIARE']]){
 let source=await readFile(`supabase/functions/${name}/index.ts`,'utf8');
 source=source.replace(/^import \{ resolveAdminKey \} from .*;\n/m,'').replace(/^import \{ parseCodes \} from .*;\n/m,'');
 const imports=source.match(/^import .*;$/gm)||[];source=source.replace(/^import .*;\n/gm,'');
 const result=`// Supabase Dashboard function name: ${name}\n// Paste into index.ts. No secret values belong in this source.\n`+imports.join('\n')+'\n'+(name==='exclusive-api'?"import {parse} from 'npm:csv-parse@7.0.3/sync';\n":'')+'\n'+admin+'\n'+(name==='exclusive-api'?csv+'\n':'')+source;
 await writeFile(`${root}/${file}.ts`,result);await writeFile(`${root}/${file}.txt`,result);console.log(`Prepared self-contained ${name} (${result.length} characters).`);
}
