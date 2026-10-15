// Reusable, Office-free source/export input generation. The caller owns suite
// provenance, seal, native execution, and review of any round-trip difference.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,open,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {actionPlanFor,loadFixtureSource,PRIMARY_CASE_NAMES} from './fixture-source.mjs';
import {loadFontRouteSource,previewRoutePins} from './font-routes.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>Buffer.from(`${JSON.stringify(value,null,2)}\n`);

export async function prepareFreshOutput(output,consumer){
  assert.equal(typeof output,'string');assert.equal(typeof consumer,'string');
  const target=path.resolve(output),parent=path.dirname(target),canonical=await realpath(parent);
  assert.equal(canonical,parent,'output parent must be canonical');
  const installed=await realpath(consumer);
  assert.ok(target!==installed&&!target.startsWith(installed+path.sep),'output cannot live inside installed consumer');
  const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  assert.ok(target!==repository&&!target.startsWith(repository+path.sep),'output cannot live inside suite source repository');
  await mkdir(target); // Exclusive: a failed attempt keeps its evidence and cannot be overwritten.
  return target;
}

export function fixtureWriter(output){
  const root=path.resolve(output),files=[];
  const put=async(relative,bytes)=>{
    assert.equal(typeof relative,'string');
    const parts=relative.split('/');
    assert.ok(parts.length>1&&parts.every(part=>part&&part!=='.'&&part!=='..'&&!part.includes('\\')),'unsafe fixture path');
    const file=path.join(root,...parts);await mkdir(path.dirname(file),{recursive:true});
    const content=Buffer.from(bytes),handle=await open(file,'wx');
    try{await handle.writeFile(content);}finally{await handle.close();}
    const record={path:relative,sha256:sha256(content),bytes:content.length};files.push(record);return record;
  };
  return {put,files};
}

export async function installedEngines(consumer){
  const installed=await realpath(consumer),require=createRequire(path.join(installed,'package.json'));
  const load=async name=>import(pathToFileURL(require.resolve(name)).href);
  const [core,pptx,render,galleryModule]=await Promise.all([
    load('@openpresentation/opf'),load('@openpresentation/opf-pptx'),
    load('@openpresentation/opf-render/fonts-node'),load('@openpresentation/gallery'),
  ]);
  const fflate=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'))('fflate');
  assert.ok(core.validate&&core.convert&&pptx.toPptx&&pptx.fromPptx&&render.loadFonts&&galleryModule.gallery);
  return {core,pptx,render,gallery:galleryModule.gallery,fflate};
}

export async function generatePrimaryFixtures({consumer,output,sourceIdentity,engines,fontRouteNames}={}){
  assert.ok(sourceIdentity&&typeof sourceIdentity==='object'&&!Array.isArray(sourceIdentity),'explicit source identity required');
  const source=fontRouteNames?await loadFontRouteSource(fontRouteNames):await loadFixtureSource();
  const engine=engines??await installedEngines(consumer);
  const {core,pptx,render,gallery,fflate}=engine;
  assert.ok(core?.validate&&core?.convert&&pptx?.toPptx&&pptx?.fromPptx&&render?.loadFonts&&gallery?.layouts&&fflate?.unzipSync&&fflate?.strFromU8);
  const root=await prepareFreshOutput(output,consumer),{put,files}=fixtureWriter(root);
  const options={catalogs:[gallery],seed:1,timestamp:'2026-01-01T00:00:00Z',date:'2026-10-10',provenance:'full'};
  let previewManifest;
  if(fontRouteNames){
    if(engines?.fontManifest)previewManifest=engines.fontManifest;
    else{const require=createRequire(path.join(await realpath(consumer),'package.json'));
      const directory=path.dirname(require.resolve('@openpresentation/opf-render/package.json'));
      previewManifest=(await import(pathToFileURL(path.join(directory,'dist/font-manifest.js')).href)).BUNDLED_FONT_MANIFEST;
    }
  }
  const cases=[];let fonts;
  const measuredFonts=async()=>fonts??=await render.loadFonts({pack:'office',...(fontRouteNames?{scripts:source.previewScripts}:{})});
  for(const name of source.caseNames??PRIMARY_CASE_NAMES){
    const deck={...source.base,...source.decks[name]},before=structuredClone(deck);
    const validation=core.validate(deck,{catalogs:[gallery],only:['format','references']});
    assert.ok(validation.valid,`${name}: ${JSON.stringify(validation.findings)}`);
    const input=`inputs/${name}.pptx`,sourcePath=`sources/${name}.opf.json`,actionPlan=`actions/${name}.json`;
    await put(sourcePath,json(deck));await put(actionPlan,json(fontRouteNames?[]:await actionPlanFor(name)));
    const measured=!!source.fontRoutes?.[name]||Object.hasOwn(source.featureManifest,name)||['list-description-native-edit','list-description-native-save','layout-bleed-card'].includes(name),diagnostics=[];
    if(measured)await (await measuredFonts()).ensure(deck,{renderOptions:{catalogs:[gallery]},onDiagnostic:issue=>diagnostics.push(issue)});
    let fontRouteMetadata;
    if(fontRouteNames){
      fontRouteMetadata=`inspection/${name}-font-route.json`;
      const route=source.fontRoutes[name];
      await put(fontRouteMetadata,json({...route,preview:previewRoutePins(route,fonts,previewManifest),
        comparisonScope:'Preparation and preview byte identity only; Office BoundWidth, physical glyph face, baseline and ink remain unmeasured.'}));
    }
    const exportOptions={...options,...(measured?{fonts}:{}),onDiagnostic:issue=>diagnostics.push(issue)};
    const bytes=await pptx.toPptx(deck,exportOptions);
    assert.deepEqual(deck,before,`${name}: export mutated source`);
    assert.deepEqual(bytes,await pptx.toPptx(deck,{...exportOptions,onDiagnostic:undefined}),`${name}: nondeterministic PPTX`);
    const importDiagnostics=[],imported=await pptx.fromPptx(bytes,{...options,onDiagnostic:issue=>importDiagnostics.push(issue)});
    const roundTripEqual=isDeepStrictEqual(imported,deck);
    const parts=fflate.unzipSync(bytes),slides=Object.keys(parts).filter(file=>/^ppt\/slides\/slide\d+\.xml$/.test(file)).sort();
    const shapes=slides.map(file=>({file,count:(fflate.strFromU8(parts[file]).match(/<p:(?:sp|pic|graphicFrame|grpSp)>/g)??[]).length}));
    const archive=await put(input,bytes);
    await put(`inspection/${name}-imported.opf.json`,json(imported));
    await put(`inspection/${name}.json`,json({roundTripEqual,acceptance:roundTripEqual?'offline-source-preserved':'round-trip-difference-pending-review',validation,diagnostics,importDiagnostics,shapes,layoutParts:Object.keys(parts).filter(file=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(file)),placeholderIndexes:Object.fromEntries(Object.entries(parts).filter(([file])=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(file)).map(([file,data])=>[file,[...fflate.strFromU8(data).matchAll(/<p:ph\b[^>]*>/g)].map(([value])=>value)]))}));
    const previewPaths={svg:[],png:[]};
    for(const format of ['svg','png']){
      const result=await core.convert(deck,{format,catalogs:[gallery],date:options.date,...(measured?{fonts}:{})});
      for(const [index,file] of result.files.entries()){
        const preview=`previews/${name}-${String(index+1).padStart(2,'0')}.${format}`;
        await put(preview,file.bytes);previewPaths[format].push(preview);
      }
    }
    cases.push({id:name,input,source:sourcePath,actionPlan,...(fontRouteMetadata?{fontRouteMetadata,requestedNativeFamily:source.fontRoutes[name].requestedNativeFamily}:{}),archiveSha256:archive.sha256,slideCount:slides.length,automaticControlEligible:slides.length>=1&&slides.length<=3&&shapes.every(item=>item.count<=30),roundTripEqual,roundTripAcceptance:roundTripEqual?'source-preserved':'review-required',fontProfile:measured?'prepared-office-font-handle-for-export-and-preview':'direct-pptx-export; preview independently rendered',chartex:name.startsWith('chart-')?'auto':'not-chart-fixture',previews:previewPaths});
  }
  return {output:root,sourceIdentity:structuredClone(sourceIdentity),...(fontRouteNames?{scope:{kind:'font-routes',caseIds:fontRouteNames,defaultSuite:false,fullSuite:false,nativeAcceptance:false}}:{}),cases,files,sourceFiles:source.sourceFiles,options:{seed:options.seed,timestamp:options.timestamp,date:options.date,provenance:options.provenance,catalog:{source:gallery.source,layoutCount:Object.keys(gallery.layouts).length,layoutsSha256:sha256(JSON.stringify(gallery.layouts))}},nativeAcceptance:false,nativeStatus:'pending'};
}

export {generateChartModes} from './chart-modes.mjs';
export {generateTableColors} from './table-colors.mjs';
export {generateFontInputs} from './fonts.mjs';
