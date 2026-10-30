import QRCode from 'qrcode';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// A valid server-issued capability is required. Do not generate working-looking public partner QR codes.
const base=new URL(process.argv[2]);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Use an HTTPS production origin.');
if(!process.argv[4])throw Error('Provide a private JSON file exported/stored during server-side access creation: [{partner,access}]. No keys are generated offline.');
const entries=JSON.parse(await readFile(process.argv[4],'utf8'));
if(!Array.isArray(entries)||!entries.length)throw Error('No private partner entries.');
const output=resolve(process.argv[3]||'exclusive/qr-output');await mkdir(output,{recursive:true});
for(const {partner,access} of entries){if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(partner)||!/^[a-f0-9]{64}$/.test(access))throw Error('A valid partner and server-issued private access key are required.');const url=new URL('/exclusive/',base);url.searchParams.set('partner',partner);url.hash=new URLSearchParams({access}).toString();const opts={width:1600,margin:4,errorCorrectionLevel:'M'};await QRCode.toFile(`${output}/${partner}-exclusive-private.png`,url.href,opts);await writeFile(`${output}/${partner}-exclusive-private.svg`,await QRCode.toString(url.href,{...opts,type:'svg'}));console.log('Saved private QR for '+partner);}
