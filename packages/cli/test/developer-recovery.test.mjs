import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const bin=process.env.OPF_TEST_BIN??fileURLToPath(new URL('../dist/index.js',import.meta.url));
const run=args=>spawnSync(process.execPath,[bin,...args],{encoding:'utf8',timeout:20000});

test('website-style catalog names resolve the same records as canonical names',()=>{
  for(const [canonical,alias] of [['colorSchemes','color-schemes'],['fontSchemes','font-schemes'],['chartTypes','chart-types']]){
    const expected=run(['catalog',canonical]),actual=run(['catalog',alias]);
    assert.equal(actual.status,0,actual.stderr);
    assert.deepEqual(JSON.parse(actual.stdout),JSON.parse(expected.stdout));
  }
  assert.notEqual(run(['catalog','not-a-catalog']).status,0);
  assert.match(run(['--help']).stdout,/Node >=22/);
});

test('filling an already marked template suggests values or partial output',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'opf-fill-help-'));
  try {
    const file=path.join(directory,'template.json');
    await writeFile(file,JSON.stringify({template:true,variables:{who:{type:'text',label:'Who'}},slides:[{title:'Hello {{who}}'}]}));
    const failed=run(['fill',file]);
    assert.equal(failed.status,1,failed.stdout+failed.stderr);
    assert.match(failed.stderr,/--data/);
    assert.match(failed.stderr,/--partial/);
    assert.doesNotMatch(failed.stderr,/mark the document as a template/);
    const recovered=run(['fill',file,'--partial']);
    assert.equal(recovered.status,0,recovered.stderr);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('import-data rejects a chart type outside the OPF 0.15 vocabulary before writing anything', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'opf-chart-type-'));
  try {
    const file = path.join(directory, 'data.csv');
    await writeFile(file, 'Quarter,Revenue\nQ1,12\n');
    const rejected = run(['import-data', file, '--as', 'chart', '--chart-type', 'donut']);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Unknown chart type: donut/);
    assert.equal(rejected.stdout, '');
    const accepted = run(['import-data', file, '--as', 'chart', '--chart-type', 'doughnut']);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(JSON.parse(accepted.stdout).slides[0].chart.type, 'doughnut');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
