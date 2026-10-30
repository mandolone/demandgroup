import {parse} from 'csv-parse/sync';
export function parseCodes(csv){
 if(typeof csv!=='string')throw Error('INVALID_CSV');
 let rows;try{rows=parse(csv,{bom:true,skip_empty_lines:true,trim:true,max_record_size:1024});}catch{throw Error('INVALID_CSV');}
 if(rows[0]?.length===1&&/^(?:code|promotion code)$/i.test(rows[0][0]))rows.shift();
 if(!rows.length||rows.length>5000||rows.some(r=>r.length!==1||!/^[A-Z0-9]{6,100}$/.test(r[0])))throw Error('INVALID_CSV');
 return rows.map(r=>r[0]);
}
