// Blocking check of the retained opf-render#24 native variable-font evidence (RR-15).
// Every one of the 356 retained Fontkit rows must be within VARIABLE_FONT_METRIC_GATE_PX (0.15 px, owner
// decision 2026-10-01) of native Chromium on BOTH Linux (retained CI) and macOS (fresh Chromium 153).
// It reads the evidence file from the archived checkpoint named in #24; nothing is regenerated here.
// Usage: node test/variable-font-retained-gate.mjs <archived docs/evidence/rejected-truetype-rounding-20260915 dir> [output.json]
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {PREVIOUS_GATE_PX,VARIABLE_FONT_METRIC_GATE_PX as GATE} from '../scripts/variable-font-gate.mjs';

const EVIDENCE_SHA256='da212c6404dd70848d6ddad735955985fe9a14c2e28e68c66c7fffc56c8311db';
const dir=process.argv[2];
if(!dir)throw new Error('Pass the archived docs/evidence/rejected-truetype-rounding-20260915 directory');
const output=path.resolve(process.argv[3]??'artifacts/variable-font-gate/retained.json');
const compressed=await readFile(path.join(dir,'rounding-probe.json.gz'));
assert.equal(createHash('sha256').update(compressed).digest('hex'),EVIDENCE_SHA256,'Retained evidence hash mismatch');
const evidence=JSON.parse(gunzipSync(compressed));
assert.equal(evidence.rows.length,356,'Expected the 356 retained Fontkit rows');
const rows=evidence.rows.map(row=>({
  file:row.file,id:row.id,format:row.format,fontkit:row.current,
  linux:row.linux,macos:row.mac,linuxDelta:row.linux-row.current,macosDelta:row.mac-row.current,
}));
for(const row of rows)for(const key of ['fontkit','linux','macos'])assert.ok(Number.isFinite(row[key]),`${row.file}#${row.id}: ${key} is not a number`);
const worst=platform=>[...rows].sort((a,b)=>Math.abs(b[`${platform}Delta`])-Math.abs(a[`${platform}Delta`])).slice(0,5);
const summary={
  rows:rows.length,gatePx:GATE,previousGatePx:PREVIOUS_GATE_PX,
  linux:{overGate:rows.filter(row=>!(Math.abs(row.linuxDelta)<GATE)).length,overPreviousGate:rows.filter(row=>!(Math.abs(row.linuxDelta)<PREVIOUS_GATE_PX)).length,maxAbsDelta:Math.max(...rows.map(row=>Math.abs(row.linuxDelta))),worst:worst('linux')},
  macos:{overGate:rows.filter(row=>!(Math.abs(row.macosDelta)<GATE)).length,overPreviousGate:rows.filter(row=>!(Math.abs(row.macosDelta)<PREVIOUS_GATE_PX)).length,maxAbsDelta:Math.max(...rows.map(row=>Math.abs(row.macosDelta))),worst:worst('macos')},
};
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,JSON.stringify({status:'gate',issue:'OpenPresentation/opf-render#24',evidence:{file:'rounding-probe.json.gz',sha256:EVIDENCE_SHA256,retainedBrowser:evidence.retainedBrowser},summary},null,2)+'\n');
for(const platform of ['linux','macos']){
  for(const row of rows)assert.ok(Math.abs(row[`${platform}Delta`])<GATE,`${row.file}#${row.id} (${row.format}) ${platform}: Fontkit ${row.fontkit} vs Chromium ${row[platform]} differs by ${Math.abs(row[`${platform}Delta`])} px (gate ${GATE})`);
}
console.log(`Variable-font retained gate: ${rows.length} rows within ${GATE} px on Linux (max ${summary.linux.maxAbsDelta.toFixed(4)} px; ${summary.linux.overPreviousGate} rows were at or over the previous ${PREVIOUS_GATE_PX} px) and macOS (max ${summary.macos.maxAbsDelta.toFixed(4)} px).`);
