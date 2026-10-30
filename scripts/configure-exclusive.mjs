import {readFile,writeFile} from 'node:fs/promises';
const names={'supabase-url':'supabaseUrl','publishable-key':'supabasePublishableKey','turnstile-site-key':'turnstileSiteKey','campaign':'campaign'};
const config=JSON.parse(await readFile('exclusive/config.json','utf8'));
for(let i=2;i<process.argv.length;i++){const arg=process.argv[i].replace(/^--/,'');if(arg==='privacy-ready'){config.privacyReady=true;continue;}if(!names[arg])throw Error('Unknown option: '+arg);const value=process.argv[++i];if(!value)throw Error('Missing value');config[names[arg]]=value;}
if(config.supabasePublishableKey.startsWith('sb_secret_'))throw Error('Only a public publishable/anon key belongs in frontend configuration.');
await writeFile('exclusive/config.json',JSON.stringify(config,null,2)+'\n');console.log('Public configuration saved. Run npm run build:exclusive. No deployment performed.');
