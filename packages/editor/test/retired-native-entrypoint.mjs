import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('native-playground.ps1',import.meta.url),'utf8');
function assertRetired(source) {
const lines=source.split(/\r?\n/);
assert.equal(lines.shift(),'param()');
while(lines[0].startsWith('#') || !lines[0].trim())lines.shift();
assert.equal(lines[0],"throw 'Retired unsafe native helper (ENG-X03-002). Do not retry or bypass. See docs/native-harness-retirement.md; native acceptance remains pending.'",'the fixed-path native helper refuses unconditionally before its first operation');
}
assertRetired(source);
assertRetired(source.replace(/\r?\n/g,'\r\n'));
assert.throws(()=>assertRetired(source.replace("throw 'Retired unsafe","if ($Worker) { throw 'Retired unsafe")),assert.AssertionError,'a conditional refusal is still rejected');
assert.ok(source.includes('$powerpoint.Presentations.Open($inputPath'),'historical body retained');
console.log('Retired editor native entrypoint refuses before all effects with LF and CRLF; no Office/PowerShell invoked.');
