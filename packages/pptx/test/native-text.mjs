// Native Office is an optional compatibility verifier, never an OPF dependency.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {fromPptx} from '../dist/index.js';
const [mode,directory='artifacts/native-text',caseArgument]=process.argv.slice(2);
assert.ok(['generate','compare','compare-case'].includes(mode));
const selectedCase=mode==='compare-case'?Number(caseArgument):null;
if(mode==='compare-case')assert.ok(caseArgument!==undefined&&Number.isInteger(selectedCase)&&selectedCase>=0&&selectedCase<24,'Select case 0 through 23');
const output=path.resolve(directory),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(output,{recursive:true});
const write=(file,value)=>writeFile(path.join(output,file),JSON.stringify(value,null,2)+'\n');
const json=async file=>JSON.parse((await readFile(path.join(output,file),'utf8')).replace(/^\uFEFF/,''));
const runtime={};
for(const name of ['@openpresentation/opf','@openpresentation/opf-render','@openpresentation/opf-pptx']) {
  const root=path.dirname(fileURLToPath(import.meta.resolve(name+'/package.json'))),seen=new Set();
  const visit=async file=>{
    if(seen.has(file))return;seen.add(file);
    const bytes=await readFile(path.join(root,'dist',file));runtime[name+'/dist/'+file]=hash(bytes);
    for(const [,child] of bytes.toString().matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js)['"]/g))await visit(path.posix.join(path.posix.dirname(file),child));
  };
  for(const file of name==='@openpresentation/opf'?['composition.js','validator.js','catalogs.js']:(await readdir(path.join(root,'dist'))).filter(file=>file.endsWith('.js')).sort())await visit(file);
  runtime[name+'/package.json']=hash(await readFile(path.join(root,'package.json')));
}
for(const file of ['test/native-text.mjs','test/native-text.ps1','test/native-text-fonts.ps1','test/native-process.ps1','test/accepted-text.mjs','vendor/pptxgenjs/pptxgen.es.js','package-lock.json'])runtime[file]=hash(await readFile(new URL('../'+file,import.meta.url)));
const visible=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(visible):value&&typeof value==='object'?Object.entries(value).flatMap(([key,item])=>['text','title','subtitle','tag','blocks'].includes(key)?visible(item):[]):[];
if(mode==='generate') {
  const run=spawnSync(process.execPath,[fileURLToPath(new URL('./accepted-text.mjs',import.meta.url))],{env:{...process.env,OPF_TEXT_OUT:output},encoding:'utf8'});
  const log=(run.stdout??'')+(run.stderr??'')+(run.error?String(run.error)+'\n':'');
  await writeFile(path.join(output,'generation.log'),log);assert.ifError(run.error);assert.equal(run.status,0,log);
  const report=await json('report.json'),registry=await loadOfficeFontRegistry({substitutionPolicy:'visual'}),faces=registry.embeddedFonts.filter(face=>face.family==='Carlito');
  assert.equal(faces.length,4);await mkdir(path.join(output,'fonts'),{recursive:true});
  const fonts=[];
  for(const face of faces) {
    assert.ok(face.license);const file=`fonts/Carlito-${face.weight}-${face.italic?'italic':'normal'}.ttf`,bytes=Buffer.from(face.dataUrl.split(',')[1],'base64');
    await writeFile(path.join(output,file),bytes);fonts.push({file,sha256:hash(bytes),family:face.family,weight:face.weight,italic:face.italic});
  }
  await writeFile(path.join(output,'fonts/LICENSE.txt'),faces[0].license);
  await write('generation.json',{node:process.version,runtime,fonts,reportSha256:hash(await readFile(path.join(output,'report.json'))),records:report.records.map(record=>{
    const {source,geometry,...rest}=record,dimensions=source.design.dimensions;
    return {...rest,width:Math.round(dimensions.widthInches*96),height:Math.round(dimensions.heightInches*96),alignment:source.design.contentAlignment,
      items:geometry.items.map(item=>({path:item.path,field:item.field,box:item.box,text:item.text,textStyle:item.textStyle}))};
  }),scope:'Four exact openly licensed Carlito faces for session-only native testing. Requested Aptos is an explicit visual substitute. Accepted text still normalizes plain whitespace; no arbitrary round-trip or native font-file identity claim.'});
  console.log(`Generated ${report.cases} native text fixtures with ${fonts.length} exact open font files.`);
} else {
  const generation=await json('generation.json'),generationSha256=hash(await readFile(path.join(output,'generation.json')));
  const selectedRecords=selectedCase===null?generation.records:[generation.records[selectedCase]];
  const native={records:[],fontRegistration:[],runs:[]};
  for(const record of selectedRecords) {
    const directory=`runs/${record.file.replace('.pptx','')}`;
    const observed=await json(`${directory}/native.json`),worker=await json(`${directory}/worker.json`),fonts=await json(`${directory}/font-registration.json`);
    assert.equal(worker.timedOut,false);assert.equal(worker.exitCode,0);assert.equal(observed.generationSha256,generationSha256);
    assert.equal(observed.records.length,1);assert.equal(observed.records[0].file,record.file);
    assert.deepEqual(fonts.map(({file,sha256})=>({file,sha256})),generation.fonts.map(({file,sha256})=>({file,sha256})));
    native.records.push(...observed.records);native.fontRegistration.push(...fonts);
    native.runs.push({file:`${directory}/native.json`,sha256:hash(await readFile(path.join(output,directory,'native.json'))),workerSha256:hash(await readFile(path.join(output,directory,'worker.json'))),fontRegistrationSha256:hash(await readFile(path.join(output,directory,'font-registration.json')))});
  }
  assert.deepEqual(runtime,generation.runtime);
  assert.equal(hash(await readFile(path.join(output,'report.json'))),generation.reportSha256);
  for(const face of generation.fonts)assert.equal(hash(await readFile(path.join(output,face.file))),face.sha256);
  assert.equal(native.records.length,selectedRecords.length);
  assert.equal(native.fontRegistration.every(face=>face.added>0&&face.removed),true,'Remove each owned temporary font registration');
  const failures=[],imports=[],rasters=[];
  for(const record of selectedRecords) {
    const observed=native.records.find(item=>item.file===record.file);assert.ok(observed);
    const expectedLines=record.items.flatMap(item=>item.text.lines.map((text,index)=>({text,index,item}))).filter(line=>line.text);
    assert.equal(observed.lines.length,expectedLines.length);
    for(const [index,line] of observed.lines.entries()) {
      const expected=expectedLines[index];assert.equal(line.text,expected.text);assert.equal(line.path,expected.item.path);
      assert.ok(line.fonts.every(font=>font==='Carlito'),`${record.file}: native font descriptors`);
    }
    for(const phase of ['original','saved','edited']) {
      const file=phase==='original'?record.file:record.file.replace('.pptx',`-${phase}.pptx`),bytes=await readFile(path.join(output,file));
      assert.equal(hash(bytes),phase==='original'?record.sha256:observed[phase+'Sha256']);
      const imported=(await fromPptx(bytes)).slides[0];
      for(const field of ['title','subtitle','tag']) {
        const expected=record.items.find(item=>item.field===field).text.lines.join('\n');
        assert.equal(imported[field],(phase==='edited'?'Edited ':'')+expected,`${file}: heading ${field}`);
      }
      const expectedWords=expectedLines.map(({text,index})=>(phase==='edited'&&index===0?'Edited ':'')+text).join(' ').match(/\S+/g);
      assert.deepEqual(visible(imported).join(' ').match(/\S+/g),expectedWords,`${file}: visible words`);
      imports.push({file,sha256:hash(bytes),headingRoles:true,visibleWords:true});
    }
    for(const phase of ['original','reopened']) {
      const full=observed[phase];assert.equal(hash(await readFile(path.join(output,full.file))),full.sha256);
    }
    assert.equal(observed.original.sha256,observed.reopened.sha256,`${record.file}: native save/reopen raster`);
    assert.equal(observed.masks.length,record.items.length);
    for(const mask of observed.masks) {
      const item=record.items.find(item=>item.path===mask.path);assert.ok(item);
      const bytes=await readFile(path.join(output,mask.file));assert.equal(hash(bytes),mask.sha256);
      const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(info.width,record.width);assert.equal(info.height,record.height);
      let pixels=0;const outside=[],bounds={left:info.width,top:info.height,right:-1,bottom:-1};
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++) {
        const offset=(y*info.width+x)*info.channels,coverage=Math.max(data[offset],data[offset+1],data[offset+2]);if(!coverage)continue;
        pixels++;bounds.left=Math.min(bounds.left,x);bounds.top=Math.min(bounds.top,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);
        const box=item.box;
        if(Math.max(box.x-(x+.5),box.y-(y+.5),x+.5-box.x-box.width,y+.5-box.y-box.height)>.1+1e-9)outside.push({x,y,coverage});
      }
      assert.ok(pixels>0,`${mask.file}: missing nonblank text paint`);
      if(outside.length)failures.push({file:record.file,path:item.path,reason:'Native paint leaves accepted cell',pixels:outside.length});
      rasters.push({file:mask.file,path:item.path,box:item.box,sha256:hash(bytes),pixels,bounds,outside});
    }
  }
  await write(selectedCase===null?'comparison.json':`comparison-case-${String(selectedCase).padStart(2,'0')}.json`,{node:process.version,runtime,generationSha256,nativeRuns:native.runs,selectedCase,completeMatrix:selectedCase===null,imports,rasters,failures,passed:failures.length===0,
    scope:'Actual PowerPoint editable lines, unchanged accepted anchors, current heading/body text after native edits and renamed shapes, save/reopen and original/saved/edited reimport. Isolated white-on-black native text masks include decorations; every nonzero pixel center uses the browser fixture 0.1-reference-pixel containment gate. Native font descriptors and temporary exact font registration do not prove the font file selected for every glyph or browser/native pixel equivalence.'});
  console.log(`Native text: ${imports.length} imports, ${rasters.length} ink masks, ${failures.length} containment failures.`);
  assert.deepEqual(failures,[],'Native text paint gate remains open; see comparison.json');
}
