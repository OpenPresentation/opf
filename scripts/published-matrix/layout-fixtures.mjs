import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {fontSwitchListBlock} from '../font-switch-list-fixture.mjs';
const LABELS=['Revenue up','Costs flat','Margin improved'];
const flat=regions=>(regions??[]).flatMap(region=>region.regions?flat(region.regions):[region]);
export async function checkLayoutFixtures(enginesPath) {
  const engines=await import(enginesPath);
  const {registry}=await engines.loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'all'});
  const catalogs=[engines.gallery],options={catalogs,fonts:{textMeasurement:registry.textMeasurement}};
  const records=Object.entries(engines.gallery.layouts).filter(([,record])=>flat(record.regions).some(region=>region.accepts?.find(kind=>kind!=='group')==='list'));
  assert.ok(records.length>=6,'real catalog contains list-only diagram layouts');
  const deck=(id,block)=>({language:'en-US',design:{fontScheme:'roboto'},slides:[{id:'fixture',layout:id,title:'Layout fixture',blocks:[block]}]});
  const oldDiagnostics=[];
  const old=deck('chevrons',{bullets:LABELS});
  assert.equal(engines.validate(old,{catalogs}).valid,true,'the legacy fixture is schema-valid');
  engines.toSvg(old,{...options,onDiagnostic:d=>oldDiagnostics.push(d)});
  assert.ok(oldDiagnostics.some(d=>d.code==='layout-unplaced'&&d.path==='slides.0.blocks.0'),'exact released bullets fixture reproduces the original placement refusal');
  const checked=[];
  for(const[id,record]of records){
    const block=fontSwitchListBlock(LABELS,record,{supplementalLabel:'Next steps'}),document=deck(id,block),diagnostics=[];
    assert.equal(engines.validate(document,{catalogs}).valid,true,`${id}: valid explicit list`);
    const svgs=engines.toSvg(document,{...options,onDiagnostic:d=>diagnostics.push(d)});
    assert.deepEqual(diagnostics,[],`${id}: real preview diagnostics`);
    assert.equal(svgs.length,1);
    const visible=svgs[0].replace(/<[^>]+>/gu,' ').replace(/\s+/gu,' ');
    for(const label of block.items.map(item=>item.text))assert.ok(visible.includes(label),`${id}: retain visible ${label}`);
    checked.push(id);
  }
  return {result:'PASS',catalogLayouts:Object.keys(engines.gallery.layouts).length,listLayouts:checked,labels:LABELS,originalControl:oldDiagnostics,consumer:engines.source??{kind:'source-packages'}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const enginesPath=process.env.OPF_MATRIX_ENGINES?pathToFileURL(path.resolve(process.env.OPF_MATRIX_ENGINES)).href:new URL('./engines-source.mjs',import.meta.url).href;
  console.log(JSON.stringify(await checkLayoutFixtures(enginesPath),null,2));
}
