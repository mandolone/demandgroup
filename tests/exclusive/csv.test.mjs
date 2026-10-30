import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCodes} from '../../supabase/functions/_shared/csv.mjs';
test('CSV parses Google Play code rows, optional header, quotes, BOM and CRLF',()=>{assert.deepEqual(parseCodes('\uFEFFcode\r\n"ABCDEF123"\r\n\r\n XYZABC789 \r\n'),['ABCDEF123','XYZABC789']);assert.deepEqual(parseCodes('ABCDEF123\nXYZABC789'),['ABCDEF123','XYZABC789']);});
test('native Google Play Promotion code export accepts all rows and normalizes for the deployed importer',()=>{
 const codes=Array.from({length:25},(_,i)=>`TESTPROMO${String(i).padStart(4,'0')}`);
 for(const header of ['Promotion code','"Promotion code"','\uFEFF"Promotion code"','PROMOTION CODE']){
  const parsed=parseCodes(header+'\r\n'+codes.map(c=>'"'+c+'"').join('\r\n')+'\r\n');
  assert.deepEqual(parsed,codes);
  // The currently deployed Edge Function accepts headerless rows. New clients must retain every code.
  assert.deepEqual(parseCodes(parsed.join('\n')),codes);
 }
});
test('CSV rejects headers-only, invalid code characters, extra columns and malformed quoting',()=>{for(const input of ['code\n','Promotion code\n','Promotion code,extra\nABCDEF123,OTHER123','','ABCDEF123,OTHER123','"UNCLOSED','code\n=FORMULA','CODE-123','A'.repeat(1025)])assert.throws(()=>parseCodes(input),/INVALID_CSV/);});
