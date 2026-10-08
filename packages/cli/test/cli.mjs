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
  const validated=run(['validate','deck.opf.json']).json;assert.equal(validated.valid,true);assert.equal(validated.sha256.length,64);assert.equal(validated.schemaValid,true);
  const warning=JSON.stringify({design:{theme:'not-a-bundled-theme'},slides:[{title:'Warning'}]});
  assert.ok(run(['validate','-','--only','format,references'],{input:warning}).json.findings.some(item=>item.ruleId==='opf/catalog-reference'&&item.severity==='warning'));
  assert.equal(run(['validate','-','--only','format,references','--fail-on','warning'],{input:warning,status:1}).json.valid,true);
  assert.equal(run(['validate','-'],{input:'{"slides":"bad"}',status:1}).json.valid,false);
  // CLI 0.9.1 bundles core 0.11.3: the 70 legacy gallery layout ids are bundled, so none is an unknown id.
  {const layouts=run(['catalog','layouts']).json.map(record=>record.id);assert.ok(layouts.length>=99);
   for(const id of ['title-slide','two-column','action-plan','swot-analysis','data-visualization','executive-summary'])assert.ok(layouts.includes(id),id);
   const legacy=run(['validate','-','--only','format,references'],{input:JSON.stringify({name:'Legacy layouts',slides:layouts.map((layout,index)=>({title:'Slide '+(index+1),layout}))})}).json;
   assert.equal(legacy.valid,true);assert.deepEqual(legacy.findings,[]);
   assert.equal(run(['validate','-','--only','format,references','--fail-on','warning'],{input:JSON.stringify({slides:[{title:'Gallery layout',layout:'swot-analysis'}]})}).json.valid,true);
   assert.equal(run(['validate','-','--only','format,references','--fail-on','warning'],{input:JSON.stringify({slides:[{title:'Gallery layout',layout:'two-column'}]})}).json.counts.warning,0);}
  // Invalid JSON is an invalid document (exit 1); a missing file or an unknown option is a usage error (exit 2).
  run(['validate','-'],{input:'{',status:1});run(['validate','missing.json'],{status:2});run(['validate','deck.opf.json','extra'],{status:2});run(['create','--oops'],{status:2});
  const lintRaw='﻿{\r\n  "name" : "Keep  spacing",\r  "slides": [{"title":"Target","layout":"pratner"}]\n}';
  await writeFile(path.join(temp,'target.opf.json'),lintRaw);
  const linted=run(['validate','target.opf.json','--only','format,references']).json;assert.equal(linted.valid,true);assert.equal(linted.counts.warning,1);assert.equal(linted.findings[0].location.offset,lintRaw.indexOf('"pratner"'));
  assert.equal(run(['validate','target.opf.json','--only','format,references','--fail-on','warning'],{status:1}).json.valid,true);
  assert.equal(run(['validate','-','--only','format,references','--fail-on','warning'],{input:'{"language":"en-US","slides":[{"title":"Regional tag"}]}'}).json.counts.warning,0);
  assert.equal(run(['validate','-'],{input:'{"slides":[}',status:1}).json.schemaValid,null);
  assert.ok(run(['validate','-'],{input:'{"slides":[{"title":"Earlier","title":"Later"}]}',status:1}).json.findings.some(issue=>issue.ruleId==='opf/duplicate-key'));
  const config={catalogs:{layouts:[{id:'pratner',name:'Authoritative custom spelling',placeholders:[{type:'title'}]}]}},configRaw=JSON.stringify(config);
  await writeFile(path.join(temp,'house-config.json'),configRaw);
  const configured=run(['validate','target.opf.json','--only','format,references','--config','house-config.json','--fail-on','warning']).json;assert.equal(configured.valid,true);assert.equal(configured.counts.warning,0);assert.match(configured.context.sha256,/^[a-f0-9]{64}$/);assert.equal(configured.sha256,linted.sha256);
  config.contracts=[{path:'/slides/*/layout',allowedValues:['text-1x'],message:'Brand layouts: {{allowed}}.'}];await writeFile(path.join(temp,'house-config.json'),JSON.stringify(config));
  const policy=run(['validate','target.opf.json','--config','house-config.json'],{status:1}).json;assert.ok(policy.findings.some(issue=>issue.ruleId==='opf/contract'&&issue.message.includes('text-1x')));
  await writeFile(path.join(temp,'bad-config.json'),'{"contract":[]}');run(['validate','target.opf.json','--config','bad-config.json'],{status:2});run(['validate','target.opf.json','--config','-'],{status:2});run(['validate','missing.opf.json'],{status:2});run(['validate','target.opf.json','--fix'],{status:2});run(['validate','target.opf.json','--strict'],{status:2});
  for(const gone of ['lint','audit'])run([gone,'target.opf.json'],{status:2});
  assert.equal(await readFile(path.join(temp,'target.opf.json'),'utf8'),lintRaw,'Validate never rewrites source, including BOM and mixed line endings');
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
  // Windows exposes a read-only attribute rather than POSIX owner/group modes.
  if(process.platform!=='win32')assert.equal((await stat(path.join(temp,'deck.opf.json'))).mode & 0o777,0o600);
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
  let fileSymlink=true;
  try{await symlink(path.join(temp,'deck.opf.json'),path.join(temp,'alias.json'));}catch(error){
    if(process.platform!=='win32'||error.code!=='EPERM')throw error;
    fileSymlink=false;console.log('SKIP file symlink rejection: this Windows account lacks file-symlink privileges; Unix CI covers this case.');
  }
  if(fileSymlink)run(['edit','alias.json','--patch','patch.json','--in-place'],{status:1});
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
  // RR-54: --dataset writes the data into the top-level datasets map and references it.
  const shared=run(['import-data','data.csv','--as','chart','--series','["Revenue"]','--dataset','revenue']).json;
  assert.deepEqual(shared.slides[0].chart.data,{dataset:'revenue'});
  assert.deepEqual(shared.datasets.revenue.rows,[['Q1',12],['Q2',18]]);
  assert.equal(shared.datasets.revenue.source.src,'data.csv');
  run(['import-data','data.csv','--as','table','--into','data-deck.json','--dataset','revenue','--in-place']);
  const withDataset=JSON.parse(await readFile(path.join(temp,'data-deck.json'),'utf8'));
  assert.deepEqual(withDataset.slides.at(-1).table,{dataset:'revenue'});
  assert.deepEqual(withDataset.datasets.revenue.columns,['Quarter','Revenue','Cost']);
  run(['import-data','data.csv','--as','table','--dataset','bad id'],{status:2});
  // Re-importing into an existing dataset keeps each same-named column's format, and a source only describes the new
  // origin: the old sheet/range of another file are dropped, and data from stdin has no file source.
  await writeFile(path.join(temp,'formatted-deck.json'),JSON.stringify({name:'Formatted',datasets:{revenue:{title:'Revenue',columns:['Quarter',{name:'Revenue',format:'$#,##0'},{name:'Dropped',format:'0%'}],rows:[['Q0',1,0.5]],source:{src:'book.xlsx',sheet:'Sheet1',range:'A1:C2',description:'Finance export'}}},slides:[{title:'Uses it',table:{dataset:'revenue'}}]}));
  const refreshed=run(['import-data','data.csv','--as','chart','--series','["Revenue"]','--dataset','revenue','--into','formatted-deck.json']).json;
  assert.deepEqual(refreshed.datasets.revenue.columns,['Quarter',{name:'Revenue',format:'$#,##0'}]);
  assert.equal(refreshed.datasets.revenue.title,'Revenue');
  assert.deepEqual(Object.keys(refreshed.datasets.revenue.source).sort(),['retrieved','src']);
  assert.equal(refreshed.datasets.revenue.source.src,'data.csv');
  const piped=run(['import-data','-','--as','chart','--dataset','revenue','--into','formatted-deck.json'],{input:'Quarter,Revenue\nQ1,12'}).json;
  assert.equal(piped.datasets.revenue.source,undefined);
  assert.deepEqual(piped.datasets.revenue.columns,['Quarter',{name:'Revenue',format:'$#,##0'}]);
  run(['import-data','data.csv','--as','table','--path','/slides/0/table'],{status:2});
  run(['import-data','data.csv','--as','chart','--series','Revenue'],{status:2});
  const styled={slides:[{table:{rows:[[{value:'Merged',rowSpan:2,colSpan:2,style:{fill:'#12345680',padding:{left:0},borders:{top:{color:'#ABCDEF',width:2,dash:'dot'}}}},null],[null,null]]}}]};
  run(['create','styled.json','--from','-'],{input:JSON.stringify(styled)});
  assert.equal(run(['validate','styled.json']).json.valid,true);
  assert.ok(run(['schema','presentation','/$defs/StyledTableCell']).json.properties.rowSpan);
  await patch([{op:'replace',path:'/slides/0/table/rows/0/0/value',value:['Edited ',{text:'cell',bold:true}]},{op:'replace',path:'/slides/0/table/rows/0/0/style/fill',value:'#FEDCBA80'}]);
  run(['edit','styled.json','--patch','patch.json','--in-place']);
  const styledSaved=await readFile(path.join(temp,'styled.json'),'utf8'),styledRows=JSON.parse(styledSaved).slides[0].table.rows;
  assert.equal(styledRows[0][0].rowSpan,2);assert.equal(styledRows[0][0].colSpan,2);assert.equal(styledRows[1][1],null);
  assert.deepEqual(styledRows[0][0].value,['Edited ',{text:'cell',bold:true}]);assert.equal(styledRows[0][0].style.fill,'#FEDCBA80');
  assert.deepEqual(styledRows[0][0].style.borders,styled.slides[0].table.rows[0][0].style.borders);
  for(const operation of [{op:'replace',path:'/slides/0/table/rows/1/1',value:'Hidden content'},{op:'replace',path:'/slides/0/table/rows/0/0/rowSpan',value:3},{op:'remove',path:'/slides/0/table/rows/1'}]){
    await patch([operation]);run(['edit','styled.json','--patch','patch.json','--in-place'],{status:1});
    assert.equal(await readFile(path.join(temp,'styled.json'),'utf8'),styledSaved,'Invalid merged-cell edits must preserve the entire file');
  }
  run(['paginate','styled.json','styled-pages.json']);
  assert.equal(run(['validate','styled-pages.json']).json.valid,true);
  const pages=JSON.parse(await readFile(path.join(temp,'styled-pages.json'),'utf8'));
  assert.deepEqual(pages.slides[0].table.rows,styledRows,'Pagination preserves a connected merge group and its cell styles');
  await patch([{op:'replace',path:'/slides/0/table/rows/0/0/rowSpan',value:1},{op:'remove',path:'/slides/0/table/rows/1'}]);
  run(['edit','styled.json','--patch','patch.json','--in-place']);
  const resized=JSON.parse(await readFile(path.join(temp,'styled.json'),'utf8')).slides[0].table.rows;
  assert.equal(resized.length,1);assert.equal(resized[0][0].rowSpan,1);assert.equal(resized[0][0].colSpan,2);
  assert.equal((await (await import('node:fs/promises')).readdir(temp)).some(name=>name.endsWith('.tmp')),false);
  console.log(`CLI passed ${checks} command checks: file preservation, patch operations, validation findings/contracts, pipes, schema lookup, pagination.`);
} finally {await rm(temp,{recursive:true,force:true});}
