import QRCode from 'qrcode';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const base=new URL(process.argv[2]);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Use an HTTPS production origin.');
const output=resolve(process.argv[3]||'exclusive/qr-output');await mkdir(output,{recursive:true});
for(const partner of process.argv.slice(4).length?process.argv.slice(4):['valentina','sara']){if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(partner))throw Error('Invalid partner ID');const url=new URL('/exclusive/',base);url.searchParams.set('partner',partner);const opts={width:1600,margin:4,errorCorrectionLevel:'M'};await QRCode.toFile(`${output}/${partner}-exclusive.png`,url.href,opts);await writeFile(`${output}/${partner}-exclusive.svg`,await QRCode.toString(url.href,{...opts,type:'svg'}));console.log(partner+': '+url.href);}
