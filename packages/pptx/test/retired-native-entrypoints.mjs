import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const names=['native-chart-colors','native-code','native-quote','native-table-colors','native-font-selection','native-font-advances','native-metric','native-text','native-tab-control'];
function assertRetired(source,name) {
  const lines=source.split(/\r?\n/);
  assert.match(lines.shift(),/^param\([^\n]*\)$/,'the original literal parameter declaration remains first');
  while(lines[0].startsWith('#') || !lines[0].trim())lines.shift();
  assert.equal(lines[0],"throw 'Retired unsafe native helper (ENG-X03-001). Do not retry or bypass. See docs/native-harness-retirement.md; native acceptance remains pending.'",`${name} unconditionally refuses before its first operation, including -Worker`);
}
for(const name of names){
  const source=await readFile(new URL(`${name}.ps1`,import.meta.url),'utf8');
  assertRetired(source,name);
  assertRetired(source.replace(/\r?\n/g,'\r\n'),name);
  assert.throws(()=>assertRetired(source.replace("throw 'Retired unsafe","if ($Worker) { throw 'Retired unsafe"),name),assert.AssertionError,'a conditional refusal is still rejected');
  assert.ok(source.includes('New-Object -ComObject PowerPoint.Application'),'historical body retained; no new native success claim');
}
console.log('Nine retired legacy native entrypoints refuse before all effects with LF and CRLF; no Office/PowerShell invoked.');
