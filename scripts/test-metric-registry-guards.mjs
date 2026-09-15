// Reject stale or altered registry evidence without touching installed packages.
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=await realpath('.'),consumer=path.resolve(process.argv[2]??'artifacts/npm/registry-consumer');
const report=await realpath('artifacts/editor/installed-code-registry-summary.json');
assert.ok(report.startsWith(path.join(root,'artifacts')+path.sep));
const original=await readFile(report),baseline=JSON.parse(original);
const renderer=data=>data.packages.find(item=>item.name==='@openpresentation/opf-render');
const cases=[
  ['candidate mode',data=>{data.mode='candidate-tarballs'},/requires registry evidence/],
  ['different consumer',data=>{data.consumer='.'},/must describe this consumer/],
  ['stale lock',data=>{data.lockSha256='altered'},/must match the installed lock/],
  ['old version',data=>{renderer(data).version='0.0.0'},/must match the installed version/],
  ['wrong integrity',data=>{renderer(data).integrity='sha512-altered'},/must match the installed integrity/],
  ['changed file digest',data=>{renderer(data).files['dist/fonts.js']='altered'},/must match its verified registry archive/],
];
try {
  for (const [name,change,pattern] of cases) {
    const altered=structuredClone(baseline);change(altered);
    await writeFile(report,JSON.stringify(altered));
    const result=spawnSync(process.execPath,['scripts/test-metric-layout-geometry.mjs',consumer],{encoding:'utf8'});
    if(result.error)throw result.error;
    assert.notEqual(result.status,0,`${name} must reject`);assert.match(result.stderr,pattern,name);
  }
} finally {await writeFile(report,original);}
assert.deepEqual(await readFile(report),original);
console.log(`Metric registry guards: ${cases.length} altered-evidence controls reject; original evidence restored.`);
