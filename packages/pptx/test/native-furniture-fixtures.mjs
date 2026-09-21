import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {access, mkdir, readFile, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptPath=fileURLToPath(import.meta.url), repository=path.resolve(path.dirname(scriptPath),'..');
const resumeRoot=path.resolve(repository,'../..'), [consumerArgument,outputArgument]=process.argv.slice(2);
assert.ok(consumerArgument,'Usage: node test/native-furniture-fixtures.mjs REGISTRY_CONSUMER [NEW_OUTPUT_DIRECTORY]');
assert.equal(process.versions.node.split('.')[0],'24','Furniture native evidence requires Node 24.');
const consumer=await realpath(consumerArgument), output=path.resolve(outputArgument??path.join(resumeRoot,'furniture-registry-02'));
try { await access(output); throw new Error(`Preserve the prior attempt and select a fresh output directory: ${output}`); } catch(error) { if(error.code!=='ENOENT') throw error; }

const resolve=createRequire(path.join(consumer,'package.json'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const publicSpecifiers=['@openpresentation/opf','@openpresentation/opf-pptx','@openpresentation/opf-render/svg'];
const esmProbe=spawnSync(process.execPath,['--input-type=module','--eval',
  `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(publicSpecifiers)}.map(name=>[name,import.meta.resolve(name)]))))`],
{cwd:consumer,encoding:'utf8',timeout:10000,windowsHide:true});
assert.equal(esmProbe.status,0,esmProbe.error?.message??esmProbe.stderr);
const publicEntries=JSON.parse(esmProbe.stdout);
const [{validatePresentation},{toPptx,fromPptx},{resolvePresentation}]=await Promise.all([
  import(publicEntries['@openpresentation/opf']),import(publicEntries['@openpresentation/opf-pptx']),import(publicEntries['@openpresentation/opf-render/svg']),
]);
const {unzipSync,zipSync}=resolve('fflate'), {XMLParser,XMLValidator}=resolve('fast-xml-parser');
const packageNames=['@openpresentation/opf','@openpresentation/opf-pptx','@openpresentation/opf-render','fflate','fast-xml-parser'];
const inside=(root,file)=>{const relative=path.relative(root,file); return relative!== '..'&&!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative);};
const lockFile=path.join(consumer,'package-lock.json'), lockBytes=await readFile(lockFile), lock=JSON.parse(lockBytes);
const packageIdentities=[];
for(const name of packageNames){
  const manifestPath=await realpath(path.join(consumer,'node_modules',...name.split('/'),'package.json')), bytes=await readFile(manifestPath), value=JSON.parse(bytes);
  assert.ok(inside(path.join(consumer,'node_modules'),manifestPath),`${name} must resolve inside the explicit registry consumer.`);
  const locked=lock.packages[`node_modules/${name}`]; assert.equal(locked.version,value.version); assert.match(locked.resolved,/^https:\/\/registry\.npmjs\.org\//); assert.ok(locked.integrity&&!locked.link);
  const publicSpecifier=name==='@openpresentation/opf-render'?'@openpresentation/opf-render/svg':name;
  const entryUrl=publicEntries[publicSpecifier], entryPath=entryUrl?fileURLToPath(entryUrl):resolve.resolve(name);
  assert.ok(inside(path.dirname(manifestPath),await realpath(entryPath)),`${name} entrypoint escaped its installed package.`);
  packageIdentities.push({name:value.name,version:value.version,manifestPath,manifestSha256:sha(bytes),entrypoint:entryPath,entrypointSha256:sha(await readFile(entryPath)),resolved:locked.resolved,integrity:locked.integrity});
}
const schemaPath=resolve.resolve('@openpresentation/opf/spec/schemas/opf.schema.json');
const schemaBytes=await readFile(schemaPath), schema=JSON.parse(schemaBytes);
assert.ok(schema.$defs.HeaderFooter&&schema.$defs.HeaderFooterItem&&schema.$defs.Slide,'Current core furniture schema is unavailable.');

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true}), array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const jsonBytes=value=>Buffer.from(`${JSON.stringify(value,null,2)}\n`);
const decode=bytes=>decoder.decode(bytes), encode=value=>encoder.encode(value);
const sourceImagePath=path.join(repository,'test','fixtures','images','wide.png'), imageBytes=await readFile(sourceImagePath);
const image={src:`data:image/png;base64,${imageBytes.toString('base64')}`,alt:'  Registry furniture picture alt  '};
const dimensions={widthInches:13.333333,heightInches:7.5};

const inheritedHeader='  Inherited header\twords\r\nsecond line  \r\n';
const inheritedFooter='  Inherited footer  ';
const localHeader='  Local image label  ';
const inherited={
  organization:{id:'registry_org',name:'  Registry Organization  '},
  design:{fontScheme:'roboto',dimensions,
    header:{left:{text:inheritedHeader},center:{organization:true},right:{section:true}},
    footer:{left:{text:inheritedFooter},right:{slideNumber:true}}},
  slides:[
    {title:'Inherited furniture',section:'  Alpha section  ',text:'Scalar body inherited — exact.'},
    {title:'Local furniture',section:'  Beta section  ',text:'Scalar body local — exact.',design:{
      header:{left:{image,text:localHeader},center:{organization:true},right:{section:true}},
      footer:{left:{text:'  Local footer  '},right:{slideNumber:true}}}},
    {title:'Inherited again',section:'  Gamma section  ',text:'Scalar body inherited again — exact.'},
  ],
};
const flags={
  design:{fontScheme:'roboto',dimensions,header:{left:{text:'Global header must be suppressed.'}},footer:{right:{text:'Global footer must be suppressed.'}}},
  slides:[
    {title:'False and empty',text:'Scalar body false and empty.',design:{header:false,footer:{}}},
    {title:'Empty and false',text:'Scalar body empty and false.',design:{header:{},footer:false}},
    {title:'Inactive fields',text:'Scalar body inactive fields.',design:{
      header:{left:{text:''},center:{organization:false,section:false,slideNumber:false,date:false}},
      footer:{right:{text:'',slideNumber:false}}}},
  ],
};
const sources={
  'baseline-inherited-local':inherited,
  'baseline-explicit-flags':flags,
};

function effective(deck,index,kind){return deck.slides[index].design?.[kind]??deck.design?.[kind];}
function dataUriHash(src){const match=/^data:[^;,]+;base64,(.*)$/.exec(src); return match?sha(Buffer.from(match[1],'base64')):sha(Buffer.from(src));}
function normalize(value){
  if(Array.isArray(value)) return value.map(normalize);
  if(value&&typeof value==='object'){
    if(typeof value.src==='string') return {srcSha256:dataUriHash(value.src),...(value.alt!==undefined?{alt:value.alt}:{})};
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,normalize(item)]));
  }
  return value;
}
function semanticSummary(deck){
  return normalize({organization:deck.organization,design:{header:deck.design?.header,footer:deck.design?.footer},slides:deck.slides.map(slide=>({
    title:slide.title,section:slide.section,localDesign:{header:slide.design?.header,footer:slide.design?.footer},
    effectiveHeader:slide.design?.header??deck.design?.header,effectiveFooter:slide.design?.footer??deck.design?.footer,blocks:slide.blocks,
  }))});
}
function bodyTexts(slide){return (slide.blocks??[]).flatMap(block=>typeof block.text==='string'?[block.text]:[]);}
function assertBodies(deck,source){for(const [index,slide] of source.slides.entries()) assert.ok(bodyTexts(deck.slides[index]).includes(slide.text),`Slide ${index+1} scalar body changed.`);}
function expectedBaselineSummary(source){return normalize({organization:source.organization,design:{header:source.design?.header,footer:source.design?.footer},slides:source.slides.map(slide=>({
  title:slide.title,section:slide.section,localDesign:{header:slide.design?.header,footer:slide.design?.footer},
  effectiveHeader:slide.design?.header??source.design?.header,effectiveFooter:slide.design?.footer??source.design?.footer,
  blocks:[{type:'text',text:slide.text}],
}))});}

function sourcePartForRelationships(relPath){
  if(relPath==='_rels/.rels') return '';
  const match=/^(.*)\/_rels\/([^/]+)\.rels$/.exec(relPath);
  if(!match) throw new Error(`Unexpected relationship part: ${relPath}`);
  return `${match[1]}/${match[2]}`;
}
function resolveTarget(sourcePart,target){
  const clean=decodeURIComponent(target.split('#')[0].split('?')[0]);
  return clean.startsWith('/')?path.posix.normalize(clean.slice(1)):path.posix.normalize(path.posix.join(path.posix.dirname(sourcePart),clean));
}
function relationships(entries,slideIndex){
  const slidePath=`ppt/slides/slide${slideIndex+1}.xml`, relPath=`ppt/slides/_rels/slide${slideIndex+1}.xml.rels`;
  const root=parser.parse(decode(entries[relPath])).Relationships;
  return new Map(array(root?.Relationship).map(rel=>[rel.Id,{...rel,path:resolveTarget(slidePath,rel.Target)}]));
}
function validateOpc(entries){
  const missing=[];
  for(const name of Object.keys(entries).filter(item=>/\.(?:xml|rels)$/.test(item))) assert.equal(XMLValidator.validate(decode(entries[name])),true,`${name}: invalid XML.`);
  for(const relPath of Object.keys(entries).filter(name=>name.endsWith('.rels'))){
    const sourcePart=sourcePartForRelationships(relPath), root=parser.parse(decode(entries[relPath])).Relationships;
    const ids=new Set();
    for(const rel of array(root?.Relationship)){
      assert.ok(!ids.has(rel.Id),`${relPath}: duplicate relationship ${rel.Id}.`); ids.add(rel.Id);
      if(rel.TargetMode==='External') continue;
      const target=resolveTarget(sourcePart,rel.Target);
      if(!entries[target]) missing.push({relPath,id:rel.Id,target});
    }
  }
  const types=parser.parse(decode(entries['[Content_Types].xml'])).Types;
  for(const item of array(types?.Override)){
    const target=String(item.PartName??'').replace(/^\//,'');
    if(target&&!entries[target]) missing.push({contentType:true,target});
  }
  assert.deepEqual(missing,[],'Every internal relationship and content-type override must resolve.');
}
function tagRecord(entries,file){
  const root=parser.parse(decode(entries[file]))['p:tagLst'];
  return array(root?.['p:tag']).map(tag=>({name:tag.name,value:tag.val,decoded:decodeTag(tag.val)}));
}
function decodeTag(value){
  if(typeof value!=='string'||!(/^(?:[0-9A-Fa-f]{2})+$/.test(value))) return null;
  try{return JSON.parse(Buffer.from(value,'hex').toString('utf8'));}catch{return null;}
}
function encodeTag(value){return Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase();}
function shapeText(shape){
  return array(shape['p:txBody']?.['a:p']).map(paragraph=>[...array(paragraph['a:r']),...array(paragraph['a:fld'])].map(run=>run['a:t']??'').join('')).join('\n');
}
function shapeGeometry(shape){
  const xfrm=shape['p:spPr']?.['a:xfrm'], off=xfrm?.['a:off'], ext=xfrm?.['a:ext'];
  if(!off||!ext) return null;
  return {left:Number(off.x)/12700,top:Number(off.y)/12700,width:Number(ext.cx)/12700,height:Number(ext.cy)/12700};
}
function inspectSlide(entries,slideIndex,layout){
  const slidePath=`ppt/slides/slide${slideIndex+1}.xml`, root=parser.parse(decode(entries[slidePath]))['p:sld'], cSld=root['p:cSld'];
  const tree=cSld['p:spTree'], rels=relationships(entries,slideIndex), all=[];
  for(const [kind,shape] of [...array(tree['p:sp']).map(item=>['text',item]),...array(tree['p:pic']).map(item=>['picture',item])]){
    const nv=kind==='text'?shape['p:nvSpPr']:shape['p:nvPicPr'], props=nv?.['p:cNvPr'], links=array(nv?.['p:nvPr']?.['p:custDataLst']?.['p:tags']);
    const tags=links.flatMap(link=>{const rel=rels.get(link['r:id']); return rel&&entries[rel.path]?tagRecord(entries,rel.path).map(tag=>({...tag,relationshipId:link['r:id'],part:rel.path})):[];});
    all.push({kind,name:props?.name??'',alternativeText:props?.descr??'',text:kind==='text'?shapeText(shape):undefined,geometryPoints:shapeGeometry(shape),tags});
  }
  const slideTags=array(cSld['p:custDataLst']?.['p:tags']).flatMap(link=>{const rel=rels.get(link['r:id']); return rel&&entries[rel.path]?tagRecord(entries,rel.path).map(tag=>({...tag,relationshipId:link['r:id'],part:rel.path})):[];});
  const furnitureShapes=all.filter(shape=>shape.tags.some(tag=>tag.name?.toUpperCase()==='OPF_FURNITURE_V1')||/^OPF (?:furniture|image) /.test(shape.name));
  return {index:slideIndex+1,allShapeNames:all.map(shape=>shape.name),allShapes:all,furnitureShapes,slideTags,
    acceptedGeometry:{tolerancePoints:0.02,shapes:furnitureShapes.map(({name,geometryPoints})=>({name,...geometryPoints})),
      layoutParts:layout.parts.map(part=>({kind:part.kind,zone:part.zone,field:part.field,type:part.type,text:part.text,
        boxPixels:part.box,boxPoints:Object.fromEntries(Object.entries(part.box).map(([key,value])=>[key,value*.75])),sourceLines:part.fit?.sourceLines}))}};
}
function inspectDeck(bytes,source){
  const entries=unzipSync(bytes); validateOpc(entries);
  const resolved=resolvePresentation(source);
  const slides=source.slides.map((_,index)=>inspectSlide(entries,index,resolved.slides[index].geometry.furniture));
  const pHfCount=Object.entries(entries).filter(([name])=>/^ppt\/(?:slides|slideLayouts|slideMasters)\//.test(name)).reduce((count,[,value])=>count+(decode(value).match(/<p:hf\b/g)?.length??0),0);
  return {entries,slides,pHfCount};
}
function firstFurnitureShapeTag(entries,slideIndex){
  const xml=decode(entries[`ppt/slides/slide${slideIndex+1}.xml`]), rels=relationships(entries,slideIndex);
  for(const match of xml.matchAll(/<p:(?:sp|pic)>[\s\S]*?<\/p:(?:sp|pic)>/g)) for(const link of match[0].matchAll(/<p:tags\s+r:id="([^"]+)"\s*\/>/g)){
    const rel=rels.get(link[1]); if(!rel||!entries[rel.path]) continue;
    const tag=tagRecord(entries,rel.path).find(item=>item.name?.toUpperCase()==='OPF_FURNITURE_V1');
    if(tag?.decoded?.role==='text') return {relationshipId:link[1],part:rel.path,tag};
  }
  throw new Error(`No furniture text shape tag on slide ${slideIndex+1}.`);
}
function replaceExactlyOnce(value,before,after,label){
  const count=value.split(before).length-1; assert.equal(count,1,`${label}: expected one mutation target, observed ${count}.`); return value.replace(before,after);
}
function mutated(base,operation){const entries=unzipSync(base); operation(entries); validateOpc(entries); return zipSync(entries,{level:6});}
function mutationSet(base){
  return {
    'variant-missing-shape-tag':{description:'Remove one furniture shape customer-data link; retain its relationship and tag part as valid unreferenced package data.',bytes:mutated(base,entries=>{
      const target=firstFurnitureShapeTag(entries,0), file='ppt/slides/slide1.xml', marker=`<p:tags r:id="${target.relationshipId}"/>`;
      entries[file]=encode(replaceExactlyOnce(decode(entries[file]),marker,'','missing shape tag'));
    })},
    'variant-duplicate-shape-tag':{description:'Duplicate one furniture shape customer-data link to the same valid relationship and tag part.',bytes:mutated(base,entries=>{
      const target=firstFurnitureShapeTag(entries,0), file='ppt/slides/slide1.xml', marker=`<p:tags r:id="${target.relationshipId}"/>`;
      entries[file]=encode(replaceExactlyOnce(decode(entries[file]),marker,marker+marker,'duplicate shape tag'));
    })},
    'variant-changed-shape-tag':{description:'Change one decoded furniture text tag group while preserving valid hex, XML, part and relationship structure.',bytes:mutated(base,entries=>{
      const target=firstFurnitureShapeTag(entries,0), content=decode(entries[target.part]), changed={...target.tag.decoded,group:'999'};
      entries[target.part]=encode(replaceExactlyOnce(content,`val="${target.tag.value}"`,`val="${encodeTag(changed)}"`,'changed shape tag'));
    })},
    'variant-metadata-disagreement':{description:'Change one current visible organization value on slide 1; provenance tags and metadata identities remain untouched.',bytes:mutated(base,entries=>{
      const file='ppt/slides/slide1.xml';
      entries[file]=encode(replaceExactlyOnce(decode(entries[file]),'Registry Organization','Disagreed Organization','organization disagreement'));
    })},
  };
}

await mkdir(output,{recursive:false});
await mkdir(path.join(output,'sources')); await mkdir(path.join(output,'decks')); await mkdir(path.join(output,'inputs'));
await writeFile(path.join(output,'inputs','wide.png'),imageBytes);
const sourceRecords={};
for(const [id,source] of Object.entries(sources)){
  assert.equal(validatePresentation(source).valid,true,`${id} must satisfy the installed core schema.`);
  const bytes=jsonBytes(source), file=path.join(output,'sources',`${id}.json`); await writeFile(file,bytes);
  sourceRecords[id]={path:file,sha256:sha(bytes)};
}

const fixtures=[], baselineBytes={};
for(const [id,source] of Object.entries(sources)){
  const before=structuredClone(source), bytes=await toPptx(source,{strictAssets:true});
  assert.deepEqual(source,before,`${id}: export mutated its source.`);
  assert.deepEqual(await toPptx(source,{strictAssets:true}),bytes,`${id}: registry export is not deterministic.`);
  baselineBytes[id]=bytes;
  const inspection=inspectDeck(bytes,source), diagnostics=[], imported=await fromPptx(bytes,{onDiagnostic:item=>diagnostics.push(item)});
  assert.equal(validatePresentation(imported).valid,true,`${id}: registry reimport must validate.`); assertBodies(imported,source);
  const expected=expectedBaselineSummary(source);
  if(id==='baseline-explicit-flags'){expected.design.header=undefined; expected.design.footer=undefined;}
  assert.deepEqual(semanticSummary(imported),expected,`${id}: semantic furniture reimport changed.`);
  assert.ok(!diagnostics.some(item=>item.code==='invalid-furniture-provenance'),`${id}: unexpected furniture provenance diagnostic.`);
  const file=path.join(output,'decks',`${id}.pptx`); await writeFile(file,bytes);
  fixtures.push({id,kind:'baseline',file,sha256:sha(bytes),source:sourceRecords[id],slides:inspection.slides,pHfCount:inspection.pHfCount,
    expectedSemanticImport:expected,registryImport:semanticSummary(imported),diagnostics});
}

const variants=mutationSet(baselineBytes['baseline-inherited-local']);
const baselineInspection=inspectDeck(baselineBytes['baseline-inherited-local'],inherited);
for(const [id,variant] of Object.entries(variants)){
  const inspection=inspectDeck(variant.bytes,inherited); assert.equal(inspection.pHfCount,baselineInspection.pHfCount,`${id}: p:hf changed.`);
  assert.deepEqual(inspection.slides.map(slide=>slide.acceptedGeometry.shapes),baselineInspection.slides.map(slide=>slide.acceptedGeometry.shapes),`${id}: shape geometry changed.`);
  const diagnostics=[], imported=await fromPptx(variant.bytes,{onDiagnostic:item=>diagnostics.push(item)});
  assert.equal(validatePresentation(imported).valid,true,`${id}: registry reimport must validate.`); assertBodies(imported,inherited);
  const wholeSlideInvalid=['variant-duplicate-shape-tag','variant-changed-shape-tag'].includes(id);
  const expected=id==='variant-metadata-disagreement'
    ?{organization:undefined,headers:[undefined,undefined,undefined],footers:inherited.slides.map((_,index)=>normalize(inherited.slides[index].design?.footer??inherited.design.footer)),retainedCurrentText:['Disagreed Organization','Registry Organization'],diagnostic:'invalid-furniture-provenance'}
    :{invalidFurnitureRoles:{'1':wholeSlideInvalid?['header','footer']:['header']},validHeaderSlides:[2,3],validFooterSlides:wholeSlideInvalid?[2,3]:[1,2,3],retainedCurrentText:wholeSlideInvalid?['Inherited header','Inherited footer']:['Inherited header'],diagnostic:'invalid-furniture-provenance'};
  if(id==='variant-metadata-disagreement'){
    assert.equal(imported.organization,undefined); for(let index=0;index<3;index++){assert.equal(effective(imported,index,'header'),undefined); assert.deepEqual(normalize(effective(imported,index,'footer')),expected.footers[index]);}
    const serialized=JSON.stringify(imported); for(const text of expected.retainedCurrentText) assert.ok(serialized.includes(text),`${id}: current ${text} missing.`);
  }else{
    assert.equal(effective(imported,0,'header'),undefined);
    if(wholeSlideInvalid) assert.equal(effective(imported,0,'footer'),undefined);
    for(const index of wholeSlideInvalid?[1,2]:[0,1,2]) assert.deepEqual(normalize(effective(imported,index,'footer')),normalize(inherited.slides[index].design?.footer??inherited.design.footer),`${id}: footer ${index+1}`);
    for(const index of [1,2]) assert.deepEqual(normalize(effective(imported,index,'header')),normalize(inherited.slides[index].design?.header??inherited.design.header),`${id}: header ${index+1}`);
    const serialized=JSON.stringify(imported.slides[0]); for(const text of expected.retainedCurrentText) assert.ok(serialized.includes(text),`${id}: current ${text} missing.`);
  }
  assert.ok(diagnostics.some(item=>item.code==='invalid-furniture-provenance'),`${id}: missing invalid provenance diagnostic.`);
  const file=path.join(output,'decks',`${id}.pptx`); await writeFile(file,variant.bytes);
  fixtures.push({id,kind:'controlled-generation-variant',baseId:'baseline-inherited-local',mutation:variant.description,file,sha256:sha(variant.bytes),
    source:sourceRecords['baseline-inherited-local'],slides:inspection.slides,pHfCount:inspection.pHfCount,expectedSemanticImport:expected,
    registryImport:semanticSummary(imported),diagnostics,nativeEditClaim:false});
}

const manifest={
  schemaVersion:1,node:process.version,nodeExecutable:process.execPath,generatedAt:new Date().toISOString(),output,
  generator:{path:scriptPath,sha256:sha(await readFile(scriptPath))},
  publicRegistry:{consumer,lockFile,lockSha256:sha(lockBytes),packages:packageIdentities,
    esmEntrypoints:await Promise.all(Object.entries(publicEntries).map(async([name,url])=>({name,url,path:fileURLToPath(url),sha256:sha(await readFile(fileURLToPath(url)))}))),
    coreSchema:{path:schemaPath,sha256:sha(schemaBytes)}},
  inputs:{image:{path:sourceImagePath,sha256:sha(imageBytes),snapshotPath:path.join(output,'inputs','wide.png'),snapshotSha256:sha(await readFile(path.join(output,'inputs','wide.png')))}},
  fixtures,
  scope:'Current-registry generated PPTX furniture fixtures and controlled package-level provenance/visible-metadata variants. Sources preserve exact scalar body and furniture strings. Accepted geometry is the current registry export with a 0.02 point future native observation tolerance. Variants are generation controls, not actual native edits. No Office, COM, UI, font installation, p:hf mutation or runtime edit is used or claimed.',
};
await writeFile(path.join(output,'manifest.json'),jsonBytes(manifest));
console.log(`Generated ${fixtures.length} selectable furniture decks (${fixtures.filter(item=>item.kind==='baseline').length} baselines, ${fixtures.filter(item=>item.kind!=='baseline').length} controlled variants) at ${output}.`);
