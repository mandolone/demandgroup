import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCodes} from '../../supabase/functions/_shared/csv.mjs';
test('CSV parses Google Play code rows, optional header, quotes, BOM and CRLF',()=>{assert.deepEqual(parseCodes('\uFEFFcode\r\n"ABCDEF123"\r\n\r\n XYZABC789 \r\n'),['ABCDEF123','XYZABC789']);assert.deepEqual(parseCodes('ABCDEF123\nXYZABC789'),['ABCDEF123','XYZABC789']);});
test('CSV rejects headers-only, invalid code characters, extra columns and malformed quoting',()=>{for(const input of ['code\n','','ABCDEF123,OTHER123','"UNCLOSED','code\n=FORMULA','CODE-123','A'.repeat(1025)])assert.throws(()=>parseCodes(input),/INVALID_CSV/);});
