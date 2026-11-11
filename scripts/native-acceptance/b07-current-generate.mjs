// New current-consumer preparation only. Default invocation is builtin-only inspection.
// No historical producer, Office process, worker, pack/install/build or generic full59 suite is run here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {B07_NATIVE_BODY_ID,b07NativeBodyExpectedImport,b07SourceSummary,readB07Sources,readB07HistoricalArchive,b07CurrentShapeBound,assertB07Case10Topology} from './b07-current-source.mjs';
import {b07NativeShapes} from './b07-native-shapes.mjs';
import {digest,fileIdentity,installedIdentity,repositoryIdentity,packageNames} from './identity.mjs';
import {installedEngines,fixtureWriter,prepareFreshOutput} from './generate.mjs';
import {preparationInputPaths,sealSuite} from './prepare.mjs';
import {inspectReferenceRuntimeRoutes} from './reference-runtime-routes.mjs';
import {plainLocalPath} from './reference-chart-profile.mjs';

const repository=fileURLToPath(new URL('../../',import.meta.url));
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const hex=value=>assert.match(value??'',/^[a-f0-9]{64}$/u,'Explicit reviewed SHA256 required');
const inside=(root,file)=>file.startsWith(root+path.sep);
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];

export function assertB07Output(output,consumer,sourceRepository=repository) {
  assert.ok(path.isAbsolute(output),'Use an absolute fresh output');const absolute=path.resolve(output);
  assert.equal(fs.realpathSync(path.dirname(absolute)),path.dirname(absolute),'Output parent must be canonical');
  for(const root of [sourceRepository,consumer])assert.ok(absolute!==root&&!inside(absolute,root)&&!inside(root,absolute),'Output overlaps protected source/consumer');
  assert.equal(fs.existsSync(absolute),false,'Output must be new; never resume a failed attempt');return absolute;
}

// This names the retained packed proof's producer root, not this generator's
// source identity. Never normalize an untrusted alias into a different authority.
export function assertB07PackedPreparationRepository(directory){
  assert.ok(typeof directory==='string'&&path.isAbsolute(directory),'Explicit absolute packed-preparation repository required');
  assert.equal(plainLocalPath(directory),directory,'Canonical packed-preparation repository required');assert.equal(fs.realpathSync(directory),directory,'Canonical packed-preparation repository required');assert.ok(fs.statSync(directory).isDirectory(),'Packed-preparation repository must be a directory');
  return directory;
}

/** Recheck the maintained test:packed-ecosystem's installed-code receipt; do not duplicate its stage/archive verification. */
export function readB07PackedProof({consumer,proof,expectedProofSha256,preparationRepository=repository}) {
  hex(expectedProofSha256);const bytes=fs.readFileSync(proof);assert.equal(digest(bytes),expectedProofSha256,'Packed qualification receipt changed');
  const report=JSON.parse(bytes);assert.equal(report.mode,'candidate-tarballs','Use the maintained unpublished local consumer');
  assert.equal(fs.realpathSync(path.resolve(preparationRepository,report.consumer)),consumer,'Packed receipt names another consumer');
  const lockFile=path.join(consumer,'package-lock.json');assert.equal(fileIdentity(lockFile).sha256,report.lockSha256);
  const lock=JSON.parse(fs.readFileSync(lockFile)),installed=installedIdentity(consumer);
  const manifestFile=path.join(path.dirname(consumer),'manifest.json'),manifestBytes=fs.readFileSync(manifestFile),manifest=JSON.parse(manifestBytes);
  assert.equal(manifest.published,false,'Maintained packed manifest must remain unpublished');
  assert.deepEqual(manifest.artifacts,report.packages.map(({installedVersion:_version,integrity:_integrity,...archive})=>archive),'Packed manifest differs from maintained qualification');
  assert.deepEqual(report.packages.map(item=>item.name).sort(),[...packageNames].sort(),'Require the complete six-package maintained consumer');
  for(const item of report.packages){
    assert.equal(item.sourceVersion,'0.33.0','Record current sourceVersion, never invent a published 0.34');
    const actual=installed.packages.find(record=>record.name===item.name),entry=lock.packages['node_modules/'+item.name];
    assert.ok(inside(consumer,actual.directory),'Workspace/source aliases are not installed packages');
    assert.equal(actual.version,item.version);assert.equal(item.installedVersion,item.version);
    assert.equal(entry.version,item.version);assert.equal(entry.link,undefined);assert.ok(entry.resolved?.startsWith('file:'));
    assert.equal(entry.integrity,item.integrity,'Local tarball integrity differs from maintained receipt');
    assert.match(item.sha256,/^[a-f0-9]{64}$/u);
    assert.equal(path.basename(item.file),item.file,'Local archive name only');
    const tar=fs.readFileSync(path.join(path.dirname(consumer),item.file));assert.equal(tar.length,item.bytes);assert.equal(digest(tar),item.sha256,'Local archive differs from maintained qualification');
    assert.equal('sha512-'+createHash('sha512').update(tar).digest('base64'),item.integrity);
  }
  const runtime=Object.entries(report.runtime);assert.ok(runtime.length>0,'Complete maintained runtime receipt required');
  for(const [relative,sha256]of runtime){
    hex(sha256);const file=fs.realpathSync(path.join(consumer,'node_modules',relative));
    assert.ok(inside(path.join(consumer,'node_modules'),file),'Runtime receipt escapes installed modules');
    assert.equal(fileIdentity(file).sha256,sha256,'Installed runtime differs from maintained qualification');
  }
  return {file:fs.realpathSync(proof),sha256:expectedProofSha256,lockSha256:report.lockSha256,packedManifest:{file:manifestFile,sha256:digest(manifestBytes)},packages:report.packages,
    runtime:report.runtime,runtimeFiles:runtime.length,installedFiles:installed.packages.reduce((sum,item)=>sum+item.runtime.files.length,0),
    scope:'Pinned maintained candidate installed-code qualification receipt, rechecked without rerunning its tests; final packed-ecosystem completion is a separate root launch receipt.'};
}

export function assertB07Validation(source,current,original) {
  assert.equal(current.valid,true,source.id+': current authored schema refusal: '+JSON.stringify(current.findings));
  if(source.pin){
    assert.equal(original.valid,source.pin.run===null,source.id+': preserve explicit historical-schema refusal; case10 is already current');
    if(source.pin.run!==null)assert.ok(original.findings.some(finding=>finding.path===source.pin.projection||finding.path===source.pin.projection.replace(/\/lang$/u,'')),source.id+': refusal must identify the typed legacy run');
  }
}

/** All wire properties remain raw: XML lang, physical coordinates, marker and body properties are never vocabulary-projected. */
export function inspectB07Archive(bytes,{fflate,parser},source) {
  const shapeBound=b07CurrentShapeBound(source);
  assert.ok(bytes.length<=16*1024*1024,'Existing archive byte cap');
  const entries=fflate.unzipSync(bytes),names=Object.keys(entries);assert.ok(names.length<=4096,'Existing ZIP part cap');
  const slideNames=names.filter(name=>/^ppt\/slides\/slide\d+\.xml$/u.test(name)).sort();
  const slides=slideNames.map(file=>{
    const xml=fflate.strFromU8(entries[file]),tree=parser.parse(xml)['p:sld']['p:cSld']['p:spTree'];
    return {file,xml,topLevelShapes:['p:sp','p:pic','p:graphicFrame','p:grpSp','p:cxnSp'].reduce((sum,key)=>sum+list(tree[key]).length,0),
      shapes:list(tree['p:sp']).map(shape=>({name:shape['p:nvSpPr']?.['p:cNvPr']?.name,geometry:shape['p:spPr']?.['a:xfrm'],body:shape['p:txBody']}))};
  });
  assert.equal(slides.length,1,'Every complete B07 source remains one slide');
  assert.ok(slides.every(slide=>slide.topLevelShapes<=shapeBound),'Retain declared'+shapeBound+'-shape bound, below unchanged global30 cap');if(shapeBound===22)assert.equal(slides[0].topLevelShapes,22,'Exact reviewed case10 topology required');
  return {parts:names.map(file=>({file,...{bytes:entries[file].length,sha256:digest(entries[file])}})),slides};
}

export function b07Differences(before,after,pointer='',rows=[]) {
  if(isDeepStrictEqual(before,after))return rows;
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)){
    for(const key of new Set([...Object.keys(before),...Object.keys(after)]))b07Differences(before[key],after[key],pointer+'/'+key.replaceAll('~','~0').replaceAll('/','~1'),rows);
  }else rows.push({path:pointer,beforePresent:before!==undefined,afterPresent:after!==undefined,
    ...(before!==undefined?{before}:{}),...(after!==undefined?{after}:{})});
  return rows;
}

export function b07FontFacts(fonts,manifest) {
  const loaded=fonts.registry.exportFaces().map(face=>({family:face.family,bytes:face.data.length,sha256:digest(face.data)}));
  const packages=new Set();for(const face of loaded){
    const pin=manifest.packages.find(pkg=>pkg.faces.some(item=>item.sha256===face.sha256));
    assert.ok(pin,'Loaded preview face must match the actual installed pinned manifest');
    assert.ok(['OFL-1.1','Apache-2.0','MIT','UFL-1.0'].includes(pin.license));packages.add(pin);
  }
  return {faces:fonts.registry.describeFaces(),loaded,licenses:[...packages].map(pkg=>({package:pkg.name,version:pkg.version,license:pkg.license,licenseFile:pkg.licenseFile,licenseSha256:pkg.licenseSha256,
    ...(pkg.noticeFile?{noticeFile:pkg.noticeFile,noticeSha256:pkg.noticeSha256}:{})})),
    scope:'Pinned open preview bytes and loader-verified licenses only; native physical face remains unobserved.'};
}
export async function generateB07Current(options) {
  const {consumer:requestedConsumer,output,proof,expectedProofSha256,expectedRevision,expectedRuntimeIdentitySha256,expectedRoutesSha256,packedPreparationRepository:requestedPackedPreparationRepository}=options;
  assert.match(expectedRevision??'',/^[a-f0-9]{40}$/u,'Freeze the reviewed new preparation HEAD');
  hex(expectedRuntimeIdentitySha256);hex(expectedRoutesSha256);hex(expectedProofSha256);
  assert.match(process.version,/^v24\./u);assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.NODE_PATH,undefined);
  assert.ok(!process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/u.test(arg)),'No runtime resolution aliases');
  const packedPreparationRepository=assertB07PackedPreparationRepository(requestedPackedPreparationRepository);
  const consumer=fs.realpathSync(requestedConsumer),sources=readB07Sources(),sourceSummary=b07SourceSummary();
  const inputs=[...await preparationInputPaths(),'scripts/pack-ecosystem.mjs','scripts/test-packed-ecosystem.mjs','scripts/test-installed-code.mjs','scripts/ecosystem-preview-plan.mjs'];
  const identity=async()=>{
    assert.equal(assertB07PackedPreparationRepository(requestedPackedPreparationRepository),packedPreparationRepository);
    const packages=installedIdentity(consumer);assert.equal(digest(JSON.stringify(packages)),expectedRuntimeIdentitySha256,'Current consumer identity changed');
    const runtimeRoutes=await inspectReferenceRuntimeRoutes(consumer);assert.equal(digest(JSON.stringify(runtimeRoutes.binding)),expectedRoutesSha256,'Current runtime routes changed');
    const suiteRepository=repositoryIdentity(repository,inputs);assert.equal(suiteRepository.revision,expectedRevision);assert.equal(suiteRepository.dirty,false,'New preparation source must be frozen and clean');
    return {packages,runtimeRoutes,packedPreparationRepository,packedProof:readB07PackedProof({consumer,proof,expectedProofSha256,preparationRepository:packedPreparationRepository}),suiteRepository};
  };
  const before=await identity(),engines=await installedEngines(consumer),{core,pptx,render,gallery,fflate}=engines;
  const fontManifest=render.BUNDLED_FONT_MANIFEST;assert.ok(Array.isArray(fontManifest?.packages),'Actual installed font manifest required');
  const require=createRequire(path.join(consumer,'package.json')),peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));
  const {XMLParser}=peer('fast-xml-parser'),parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
  const pptxRuntime=before.packages.packages.find(item=>item.name==='@openpresentation/opf-pptx'),scalarFile=path.join(pptxRuntime.directory,'dist/native-scalar-fragments.js');assert.ok(pptxRuntime.runtime.files.some(item=>item.path==='dist/native-scalar-fragments.js'&&item.sha256===fileIdentity(scalarFile).sha256),'Scalar reader must be the actual bound installed runtime');const {readNativeScalarGroups}=await import(pathToFileURL(scalarFile));
  const validations=sources.map(source=>{
    const current=core.validate(source.document,{catalogs:[gallery],only:['format','references']}),original=source.pin?core.validate(source.original,{catalogs:[gallery],only:['format','references']}):undefined;
    assertB07Validation(source,current,original);return {id:source.id,current,original};
  });
  const historical=new Map(sources.filter(source=>source.pin).map(source=>[source.id,readB07HistoricalArchive(source.pin,repository)]));
  assertB07Output(output,consumer);assertB07Output(output,consumer,packedPreparationRepository);
  const root=await prepareFreshOutput(output,consumer),{put}=fixtureWriter(root),cases=[];
  const provenance={...before,node:{path:process.execPath,version:process.version,...fileIdentity(process.execPath)},sourceSummary,validations,fontManifest,fontManifestSha256:digest(JSON.stringify(fontManifest)),
    fontPolicy:{pack:'office',substitutionPolicy:'visual',scripts:'auto',userFonts:[],extraFaces:[]},sourceVersion:'0.33.0',nativeAcceptance:false,registryAcceptance:false};
  const exportOptions={catalogs:[gallery],seed:0x4f504658,timestamp:'1980-01-01T00:00:00Z',date:'2026-11-08',provenance:'full'};
  let active=null;
  await put('inspection/preparation-before.json',json(provenance));
  try{
    for(const source of sources){
      active=source.id;const deck=structuredClone(source.document),diagnostics=[],importDiagnostics=[];
      const currentSource=await put(`sources/${source.id}.opf.json`,source.currentBytes),actionPlan=`actions/${source.id}.json`;await put(actionPlan,json([]));
      if(source.pin){await put(`historical/${source.id}.opf.json`,source.originalBytes);await put(`historical/${source.id}.pptx`,historical.get(source.id));}
      const fonts=await render.loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:deck,renderOptions:{catalogs:[gallery]}});
      try{
        await fonts.ensure(deck,{renderOptions:{catalogs:[gallery]}});const fontsBefore=b07FontFacts(fonts,fontManifest);
        const bytes=await pptx.toPptx(deck,{...exportOptions,fonts,bodyText:source.bodyText,onDiagnostic:issue=>diagnostics.push(issue)});
        assert.deepEqual(deck,source.document,'Export changed authored source');
        const input=`inputs/${source.id}.pptx`,archive=await put(input,bytes),actual=inspectB07Archive(bytes,{fflate,parser},source);
        if(b07CurrentShapeBound(source)===22){const entries=fflate.unzipSync(bytes);
          // The complete installed V2 reader proves ownership; the shape census below is raw direct text/identity only.
          assertB07Case10Topology(source,b07NativeShapes(actual.slides[0].xml,XMLParser,source),readNativeScalarGroups(entries,'ppt/slides/slide1.xml').groups);
        }
        if(source.id===B07_NATIVE_BODY_ID){
          const bodies=actual.slides[0].shapes.filter(shape=>shape.name?.startsWith('OPF native body'));
          assert.equal(bodies.length,1,'The native body path must execute');assert.equal(list(bodies[0].body?.['a:p']).length,2,'Exactly two native paragraphs, no measured fallback');
          assert.ok(!diagnostics.some(issue=>issue.code==='native-body-fallback'));
        }
        const imported=await pptx.fromPptx(bytes,{catalogs:[gallery],onDiagnostic:issue=>importDiagnostics.push(issue)});
        if(source.id===B07_NATIVE_BODY_ID)assert.deepEqual(imported,b07NativeBodyExpectedImport(),'Preserve exact current native-body canonical import contract');
        const previews={svg:[],png:[]},previewReports=[];for(const format of ['svg','png']){
          const rendered=await core.convert(deck,{format,catalogs:[gallery],fonts,date:exportOptions.date});assert.equal(rendered.files.length,1);
          const file=`previews/${source.id}.${format}`,outputRecord=await put(file,rendered.files[0].bytes);previews[format].push(file);
          const {files:_files,...report}=rendered;previewReports.push({format,report,output:outputRecord});
        }
        const old=source.pin?inspectB07Archive(historical.get(source.id),{fflate,parser}):undefined;
        const historicalImportDiagnostics=[],historicalImported=source.pin?await pptx.fromPptx(historical.get(source.id),{catalogs:[gallery],onDiagnostic:issue=>historicalImportDiagnostics.push(issue)}):undefined;
        await put(`inspection/${source.id}.json`,json({validation:validations.find(row=>row.id===source.id),diagnostics,importDiagnostics,imported,previewReports,
          currentArchive:actual,historicalArchive:old,sourceRoundTripEqual:isDeepStrictEqual(imported,source.document),sourceImportDifferences:b07Differences(source.document,imported),
          ...(old?{historicalImported,historicalImportDiagnostics,historicalImportDifferences:b07Differences(source.document,historicalImported),historicalArchiveEqual:Buffer.from(bytes).equals(historical.get(source.id)),historicalPartDifferences:b07Differences(old.parts,actual.parts),historicalNativeDifferences:b07Differences(old.slides,actual.slides)}:{}),
          fontsBefore,fontsAfter:b07FontFacts(fonts,fontManifest),nativeAcceptance:false,scope:'All raw current/historical archive, native properties and import differences retained as findings; no physical glyph or saved/reopened observation.'}));
        cases.push({id:source.id,input,source:currentSource.path,actionPlan,archiveSha256:archive.sha256,slideCount:1,declaredTopLevelShapes:b07CurrentShapeBound(source),actualTopLevelShapes:actual.slides[0].topLevelShapes,
          bodyText:source.bodyText,automaticControlEligible:false,requiresReviewedNativeProfile:true,previews,nativeAcceptance:false});
      }finally{fonts.dispose?.();}
    }
    const after=await identity();assert.deepEqual(after,before,'Consumer/source qualification changed during preparation');assert.deepEqual(b07SourceSummary(),sourceSummary);
    await put('inspection/preparation-after.json',json(after));
    return await sealSuite(root,{schemaVersion:1,scope:{kind:'b07-current-five-case',fullSuite:false,defaultSuite:false,nativeAcceptance:false},provenance,cases,options:exportOptions,nativeAcceptance:false,registryAcceptance:false});
  }catch(error){
    let after;try{after={identity:await identity(),sources:b07SourceSummary()};}catch(checkError){after={recheckFailure:{name:checkError.name,message:checkError.message,stack:checkError.stack}};}
    await put('inspection/failure.json',json({active,error:{name:error.name,message:error.message,stack:error.stack},after,neverResume:true,nativeAcceptance:false}));throw error;
  }
}

export function parseB07Arguments(args) {
  const [command='inspect',...rest]=args;assert.ok(['inspect','generate'].includes(command),'Only inspect or explicit generate');
  const names={'--packed-preparation-repository':'packedPreparationRepository','--consumer':'consumer','--output':'output','--proof':'proof','--expected-proof-sha256':'expectedProofSha256','--expected-revision':'expectedRevision','--expected-runtime-sha256':'expectedRuntimeIdentitySha256','--expected-routes-sha256':'expectedRoutesSha256'},options={};
  assert.equal(rest.length%2,0,'Every option has one value');for(let i=0;i<rest.length;i+=2){const key=names[rest[i]];assert.ok(key,'Unknown option');assert.equal(options[key],undefined,'Duplicate option');assert.ok(rest[i+1]&&!rest[i+1].startsWith('--'),'Missing option value');options[key]=rest[i+1];}
  if(command==='inspect')assert.deepEqual(options,{});else assert.deepEqual(Object.keys(options).sort(),Object.values(names).sort(),'All explicit source/consumer pins are required');
  return {command,options};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const {command,options}=parseB07Arguments(process.argv.slice(2));
  if(command==='inspect')console.log(JSON.stringify({cases:b07SourceSummary(),generation:false,nativeAcceptance:false,registryAcceptance:false},null,2));
  else{const suite=await generateB07Current(options);console.log(JSON.stringify({cases:suite.cases.length,files:suite.files.length,nativeAcceptance:false,output:options.output}));}
}
