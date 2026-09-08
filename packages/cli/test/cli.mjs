import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm, symlink, chmod, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL('../dist/index.js', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(),'opf-cli-test-'));
let checks = 0;
function run(args, {input, status=0}={}) {
  const result=spawnSync(process.execPath,[executable,...args],{cwd:temp,input,encoding:'utf8',timeout:20000});
  assert.equal(result.status,status,JSON.stringify({args,stdout:result.stdout,stderr:result.stderr}));checks++;
  return {...result, json:result.stdout ? JSON.parse(result.stdout) : undefined};
}
async function patch(operations) {await writeFile(path.join(temp,'patch.json'),JSON.stringify(operations));}
try {
  assert.match(run(['--version']).json.cli,/^0\./);
  assert.equal(run(['create','deck.opf.json','--title','Decision']).json.valid,true);
  const original=await readFile(path.join(temp,'deck.opf.json'),'utf8');
  run(['create','deck.opf.json'],{status:1});assert.equal(await readFile(path.join(temp,'deck.opf.json'),'utf8'),original);
  assert.equal(run(['create','-','--title','Piped']).json.slides[0].title,'Piped');
  assert.equal(run(['create','copy.json','--from','-'],{input:'\uFEFF'+original}).json.valid,true);
  run(['create','never.json','--from','-'],{input:'{"slides":"bad"}',status:1});
  const validated=run(['validate','deck.opf.json']).json;assert.equal(validated.valid,true);assert.equal(validated.sha256.length,64);
  const warning=JSON.stringify({design:{theme:'not-a-bundled-theme'},slides:[{title:'Warning'}]});
  assert.ok(run(['validate','-'],{input:warning}).json.warnings.length);
  assert.equal(run(['validate','-','--strict'],{input:warning,status:1}).json.valid,true);
  assert.equal(run(['validate','-'],{input:'{"slides":"bad"}',status:1}).json.valid,false);
  run(['validate','-'],{input:'{',status:2});run(['validate','missing.json'],{status:2});run(['validate','deck.opf.json','extra'],{status:2});run(['create','--oops'],{status:2});
  await patch([{op:'test',path:'/slides/0/id',value:'slide-1'},{op:'replace',path:'/slides/0/title',value:'Updated'},{op:'add',path:'/slides/-',value:{id:'two',text:'Preserve me',notes:'Source note'}}]);
  assert.equal(run(['edit','deck.opf.json','--patch','patch.json']).json.slides.length,2);
  assert.equal(await readFile(path.join(temp,'deck.opf.json'),'utf8'),original);
  run(['edit','deck.opf.json','--patch','patch.json','--output','result.json']);
  run(['edit','deck.opf.json','--patch','patch.json','--output','result.json'],{status:1});
  assert.equal(run(['edit','deck.opf.json','--patch','patch.json','--in-place','--dry-run']).json.slides[0].title,'Updated');
  assert.equal(await readFile(path.join(temp,'deck.opf.json'),'utf8'),original);
  run(['edit','deck.opf.json','--patch','patch.json','--in-place','--expect-sha256','0'.repeat(64)],{status:1});
  await chmod(path.join(temp,'deck.opf.json'),0o600);
  run(['edit','deck.opf.json','--patch','patch.json','--in-place','--expect-sha256',validated.sha256]);
  assert.equal((await stat(path.join(temp,'deck.opf.json'))).mode & 0o777,0o600);
  let saved=await readFile(path.join(temp,'deck.opf.json'),'utf8');assert.equal(JSON.parse(saved).slides[1].notes,'Source note');
  await patch([{op:'replace',path:'/slides/0/title',value:'Partial'},{op:'test',path:'/slides/1/id',value:'stale'}]);
  run(['edit','deck.opf.json','--patch','patch.json','--in-place'],{status:1});assert.equal(await readFile(path.join(temp,'deck.opf.json'),'utf8'),saved);
  await patch([{op:'replace',path:'/slides',value:'bad'}]);run(['edit','deck.opf.json','--patch','patch.json','--in-place'],{status:1});assert.equal(await readFile(path.join(temp,'deck.opf.json'),'utf8'),saved);
  await patch([{op:'copy',from:'/slides/0',path:'/slides/-'},{op:'replace',path:'/slides/2/id',value:'three'},{op:'move',from:'/slides/0',path:'/slides/2'},{op:'remove',path:'/slides/1'}]);
  let edited=run(['edit','deck.opf.json','--patch','patch.json']).json;assert.deepEqual(edited.slides.map(s=>s.id),['two','slide-1']);
  for (const operations of [
    [{op:'replace',path:'/missing',value:1}], [{op:'add',path:'/missing/child',value:1}],
    [{op:'add',path:'/slides/99',value:{}}], [{op:'remove',path:'/slides/01'}],
    [{op:'replace',path:'/slides/-',value:{}}], [{op:'test',path:'/slides/0/title'}],
    [{op:'add',path:'/bad~2',value:1}], [{op:'move',from:'/slides',path:'/slides/0/blocks'}],
    [{op:'copy',from:'/constructor',path:'/name'}], [{op:'remove',path:''}],
    [{op:'bogus',path:''}], {op:'add',path:'/name',value:'bad'},
    [{op:'add',path:'/__proto__/polluted',value:true}],
  ]) {await patch(operations);run(['edit','deck.opf.json','--patch','patch.json','--in-place'],{status:1});assert.equal(await readFile(path.join(temp,'deck.opf.json'),'utf8'),saved);}
  // Intermediate values need not conform to OPF. Verify pointers, own keys and copy isolation.
  await patch([{op:'add',path:'/scratch',value:{'a/b':{'~key':1}}},{op:'test',path:'/scratch/a~1b/~0key',value:1},{op:'add',path:'/scratch/__proto__',value:{ok:true}},{op:'test',path:'/scratch/__proto__/ok',value:true},{op:'copy',from:'/scratch',path:'/other'},{op:'replace',path:'/other/a~1b/~0key',value:2},{op:'test',path:'/scratch/a~1b/~0key',value:1},{op:'remove',path:'/scratch'},{op:'remove',path:'/other'}]);
  assert.deepEqual(run(['edit','deck.opf.json','--patch','patch.json']).json,JSON.parse(saved));
  await writeFile(path.join(temp,'patch.json'),'[{"op":"add","path":"/scratch","value":-0},{"op":"test","path":"/scratch","value":0},{"op":"remove","path":"/scratch"}]');
  run(['edit','deck.opf.json','--patch','patch.json']);
  await patch([{op:'test',path:'/slides/0',value:{title:'Updated',id:'slide-1'}},{op:'move',from:'/slides/0',path:'/slides/0'}]);run(['edit','deck.opf.json','--patch','patch.json']);
  run(['edit','-','--patch','patch.json'],{input:saved});
  run(['edit','deck.opf.json','--patch','-'],{input:'[]'});
  run(['edit','-','--patch','-'],{status:2});run(['edit','-','--patch','patch.json','--in-place'],{status:2});
  run(['edit','deck.opf.json','--patch','patch.json','--in-place','--output','bad.json'],{status:2});
  await symlink(path.join(temp,'deck.opf.json'),path.join(temp,'alias.json'));run(['edit','alias.json','--patch','patch.json','--in-place'],{status:1});
  assert.equal(run(['schema','presentation','/$defs/Composition']).json.properties.mode.enum.includes('grid'),true);
  assert.ok(run(['schemas']).json.length>1);assert.ok(run(['catalogs']).json.length>1);
  assert.equal(run(['catalog','fontSchemes','roboto']).json.id,'roboto');run(['catalog','unknown'],{status:2});run(['schema','unknown'],{status:2});
  assert.equal(run(['paginate','deck.opf.json','paginated.json']).json.valid,true);
  run(['paginate','deck.opf.json','paginated.json'],{status:1});
  await writeFile(path.join(temp,'data.csv'),'Quarter,Revenue,Cost\nQ1,12,4\nQ2,18,6');
  let imported=run(['import-data','data.csv','--as','table']).json;assert.equal(imported.slides[0].table.rows[0][1],'12');
  imported=run(['import-data','data.csv','--as','chart','--chart-type','line','--series','["Revenue"]']).json;assert.deepEqual(imported.slides[0].chart.data.rows,[['Q1',12],['Q2',18]]);
  run(['import-data','data.csv','--as','chart','--into','deck.opf.json','--output','data-deck.json']);
  assert.equal(JSON.parse(await readFile(path.join(temp,'data-deck.json'),'utf8')).slides.length,3);
  run(['import-data','-','--format','json','--as','chart','--into','data-deck.json','--path','/slides/2/chart','--in-place'],{input:'[{"Q":"Q3","R":24}]'});
  assert.deepEqual(JSON.parse(await readFile(path.join(temp,'data-deck.json'),'utf8')).slides[2].chart.data.rows,[['Q3',24]]);
  const beforeData=await readFile(path.join(temp,'data-deck.json'),'utf8');
  run(['import-data','-','--as','chart','--into','data-deck.json','--in-place'],{input:'x,y\nQ1,not-numeric',status:1});
  assert.equal(await readFile(path.join(temp,'data-deck.json'),'utf8'),beforeData);
  run(['import-data','data.csv','--as','table','--path','/slides/0/table'],{status:2});
  run(['import-data','data.csv','--as','chart','--series','Revenue'],{status:2});
  assert.equal((await (await import('node:fs/promises')).readdir(temp)).some(name=>name.endsWith('.tmp')),false);
  console.log(`CLI passed ${checks} command checks: file preservation, patch operations, validation, pipes, schema lookup, pagination.`);
} finally {await rm(temp,{recursive:true,force:true});}
