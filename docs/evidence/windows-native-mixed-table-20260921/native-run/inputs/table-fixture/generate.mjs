import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const resumeRoot=resolve(here,'..','..');
const consumer=join(resumeRoot,'registry-consumer');
const node24=join(resumeRoot,'toolchain','node_modules','node','bin','node.exe');
const requireFromConsumer=createRequire(join(consumer,'package.json'));
const registryEntrypoints={
  '@openpresentation/opf':join(consumer,'node_modules','@openpresentation','opf','dist','index.js'),
  '@openpresentation/opf-pptx':join(consumer,'node_modules','@openpresentation','opf-pptx','dist','index.js'),
  '@openpresentation/opf-render':join(consumer,'node_modules','@openpresentation','opf-render','dist','index.js'),
  '@openpresentation/opf-render/fonts-node':join(consumer,'node_modules','@openpresentation','opf-render','dist','fonts-node.js')
};
const load=async spec=>import(pathToFileURL(registryEntrypoints[spec]??requireFromConsumer.resolve(spec)).href);
const [opfModule,pptxModule,renderModule,fontModule,fflateModule,fastXmlModule]=await Promise.all([
  load('@openpresentation/opf'),load('@openpresentation/opf-pptx'),load('@openpresentation/opf-render'),
  load('@openpresentation/opf-render/fonts-node'),load('fflate'),load('fast-xml-parser')
]);
const {validatePresentation}=opfModule;
const {toPptx,fromPptx}=pptxModule;
const {renderSvg,svgToPng}=renderModule;
const {prepareNodeFonts}=fontModule;
const {unzipSync}=fflateModule.default??fflateModule;
const {XMLParser,XMLValidator}=fastXmlModule.default??fastXmlModule;

const sha256=value=>createHash('sha256').update(value).digest('hex');
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const hashFile=async path=>sha256(await readFile(path));
const writeJson=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const all=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const find=(value,key)=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(item=>find(item,key)):Object.entries(value).flatMap(([name,child])=>name===key?[...all(child),...find(child,key)]:find(child,key));
const textOf=value=>typeof value==='string'?value:value&&typeof value==='object'&&typeof value['#text']==='string'?value['#text']:'';
const flattenCell=value=>{
  const cell=value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'value')?value.value:value;
  if(Array.isArray(cell))return cell.map(run=>typeof run==='string'?run:run?.text??'').join('');
  return cell==null?'':String(cell);
};
const rel=path=>relative(resumeRoot,path).replaceAll('\\','/');

assert.equal(process.versions.node.split('.')[0],'24','Run this immutable registry fixture with Node 24.');
const existing=(await readdir(here)).filter(name=>name!=='generate.mjs');
assert.deepEqual(existing,[],'The fixture output directory must be fresh except for generate.mjs.');

const authoredRuns=[
  {text:'Lead\t',fontFamily:'Carlito',fontSize:18},
  {text:'Large evidence phrase ',fontFamily:'Carlito',fontSize:30,bold:true},
  {text:'continues in smaller text across the same editable table cell so natural layout must wrap this sentence without authored line breaks or inserted offsets. ',fontFamily:'Carlito',fontSize:18},
  {text:'Second large phrase ',fontFamily:'Carlito',fontSize:30},
  {text:'finishes the control with exact source runs.',fontFamily:'Carlito',fontSize:18}
];
const source={
  design:{
    theme:'classic',
    fontScheme:{
      major:'Carlito',minor:'Carlito',type:'sans-serif',
      heading:{family:'Carlito'},body:{family:'Carlito'},accent:{family:'Carlito'},code:{family:'Cousine'}
    }
  },
  slides:[{table:{rows:[[authoredRuns]]}}]
};
const sourceBefore=JSON.stringify(source);
const authoredText=authoredRuns.map(run=>run.text).join('');
assert.equal((authoredText.match(/\t/g)??[]).length,1);
assert.equal(/[\r\n]/.test(authoredText),false);
const validation=validatePresentation(source);
assert.equal(validation.valid,true,JSON.stringify(validation.errors));
assert.deepEqual(validation.warnings,[]);
const sourcePath=join(here,'source.json');
await writeJson(sourcePath,source);

const prepared=await prepareNodeFonts({pack:'office',substitutionPolicy:'visual'});
const selectedFontFiles=prepared.options.fontFiles.filter(path=>/carlito/i.test(path));
const selectedEmbeddedFonts=prepared.options.embeddedFonts.filter(face=>face.family==='Carlito'&&[400,700].includes(face.weight)&&!face.italic);
assert.equal(selectedFontFiles.length,4);
assert.equal(selectedEmbeddedFonts.length,2);

let registeredMeasurement;
try{
  renderSvg(source,{...prepared.options,trace:true});
  registeredMeasurement={usableForLiteralTab:true,error:null};
}catch(error){
  registeredMeasurement={usableForLiteralTab:false,error:{name:error.name,code:error.code??null,message:error.message,details:error.details??null}};
}
assert.equal(registeredMeasurement.usableForLiteralTab,false,'The current registry unexpectedly measured U+0009 in a rich table; review the fixture rather than silently changing its contract.');
assert.equal(registeredMeasurement.error?.code,'missing-glyph');
assert.equal(registeredMeasurement.error?.details?.character,'\t');

// Keep the literal tab and exact runs. The current rich-table layouter therefore
// uses its documented estimated path; no tab replacement, offset, hard break, or
// tolerance is introduced. The selected open Carlito faces still own SVG/PNG paint.
const renderDiagnostics=[];
const svg=renderSvg(source,{trace:true,embeddedFonts:selectedEmbeddedFonts,onDiagnostic:diagnostic=>renderDiagnostics.push(diagnostic)});
const svgPath=join(here,'preview.svg');
await writeFile(svgPath,svg);
const png=await svgToPng(svg,{useBundledFonts:false,loadSystemFonts:false,fontFiles:selectedFontFiles,background:'#FFFFFF'});
const pngPath=join(here,'preview.png');
await writeFile(pngPath,png);
const exportDiagnostics=[];
const pptx=await toPptx(source,{seed:20260921,timestamp:'2026-09-21T00:00:00.000Z',zipDate:'2026-09-21T00:00:00.000Z',onDiagnostic:diagnostic=>exportDiagnostics.push(diagnostic)});
const pptxPath=join(here,'source.pptx');
await writeFile(pptxPath,pptx);
assert.equal(JSON.stringify(source),sourceBefore,'Render/export mutated the authored source.');

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false,processEntities:true});
const svgDocument=parser.parse(svg);
const richGroups=find(svgDocument,'g').filter(group=>group&&group['data-opf-rich-lines']!==undefined);
assert.equal(richGroups.length,1);
const traceLines=JSON.parse(richGroups[0]['data-opf-rich-lines']).map(line=>({...line,text:authoredText.slice(line.start,line.end)}));
assert.ok(traceLines.length>=2,'The accepted layout trace must contain at least two naturally wrapped lines.');

const entries=unzipSync(pptx);
const xmlFiles=Object.entries(entries).filter(([name])=>name.endsWith('.xml')||name.endsWith('.rels'));
const xmlValidation=xmlFiles.map(([name,bytes])=>{
  const result=XMLValidator.validate(new TextDecoder().decode(bytes));
  return {name,valid:result===true,error:result===true?null:result};
});
assert.ok(xmlValidation.every(item=>item.valid),'Generated PPTX contains invalid XML.');
const slideXml=new TextDecoder().decode(entries['ppt/slides/slide1.xml']);
const slideDocument=parser.parse(slideXml);
const tables=find(slideDocument,'a:tbl');
assert.equal(tables.length,1);
const table=tables[0],rows=all(table['a:tr']);
assert.equal(rows.length,1);
const cells=all(rows[0]['a:tc']);
assert.equal(cells.length,1);
const paragraphs=all(cells[0]['a:txBody']?.['a:p']);
const nativeRuns=paragraphs.flatMap(paragraph=>all(paragraph['a:r'])).map(run=>({
  text:textOf(run['a:t']),fontSizeHundredthsPoint:Number(run['a:rPr']?.sz),fontSizePoints:Number(run['a:rPr']?.sz)/100,
  typeface:run['a:rPr']?.['a:latin']?.typeface??null,bold:run['a:rPr']?.b==='1',italic:run['a:rPr']?.i==='1'
}));
const nativeText=nativeRuns.map(run=>run.text).join('');
const tabStops=find(cells[0],'a:tab').map(tab=>({rawPositionEmu:Number(tab.pos),positionPoints:Number(tab.pos)/12700,alignment:tab.algn??null}));
const lineSpacing=find(cells[0],'a:spcPts').map(value=>({rawHundredthsPoint:Number(value.val),points:Number(value.val)/100}));
const frame=find(slideDocument,'p:graphicFrame')[0];
const extent=frame?.['p:xfrm']?.['a:ext']??{};
const gridWidths=all(table['a:tblGrid']?.['a:gridCol']).map(column=>({emu:Number(column.w),points:Number(column.w)/12700}));
const xmlTextBodies=[...slideXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>match[1]);
const rawTabReferences=xmlTextBodies.flatMap(text=>[...text.matchAll(/&#(?:x0*9|0*9);/gi)].map(match=>match[0]));
assert.equal(nativeText,authoredText,'DrawingML did not retain the exact authored text.');
assert.equal((nativeText.match(/\t/g)??[]).length,1,'DrawingML parser did not recover exactly one literal tab.');
assert.equal(paragraphs.length,1,'Exporter inserted a hard paragraph into the one-paragraph source.');
assert.equal(find(cells[0],'a:br').length,0,'Exporter inserted a hard line break.');
assert.deepEqual(nativeRuns.map(run=>run.fontSizePoints),[18,30,18,30,18]);

const importDiagnostics=[];
const reimported=await fromPptx(pptx,{onDiagnostic:diagnostic=>importDiagnostics.push(diagnostic)});
const reimportValidation=validatePresentation(reimported);
const reimportPath=join(here,'reimport.json');
await writeJson(reimportPath,reimported);
const importedSlide=reimported?.slides?.[0];
const importedTable=importedSlide?.table??importedSlide?.blocks?.find(block=>block?.type==='table')?.table;
const importedCell=importedTable?.rows?.[0]?.[0];
const importedText=flattenCell(importedCell);
const importedValue=importedCell&&typeof importedCell==='object'&&!Array.isArray(importedCell)&&Object.hasOwn(importedCell,'value')?importedCell.value:importedCell;
const coreRun=run=>({text:typeof run==='string'?run:run?.text??'',fontFamily:typeof run==='string'?null:run?.fontFamily??null,fontSize:typeof run==='string'?null:run?.fontSize??null,bold:Boolean(typeof run==='object'&&run?.bold),italic:Boolean(typeof run==='object'&&run?.italic)});
const authoredRunCore=authoredRuns.map(coreRun),importedRunCore=Array.isArray(importedValue)?importedValue.map(coreRun):[];
const importedRunCoreEqualsAuthored=JSON.stringify(importedRunCore)===JSON.stringify(authoredRunCore);

const inspection={
  contract:{slideCount:1,tableCount:1,rowCount:1,cellCount:1,authoredTabCount:1,authoredHardBreakCount:0,authoredRunSizesPoints:[18,30,18,30,18]},
  validation,
  registeredMeasurement,
  acceptedLayoutTrace:{measurement:'estimated because the current registered font measurement rejects U+0009',richLineCount:traceLines.length,boxWidth:Number(richGroups[0]['data-opf-box-width']),lines:traceLines,diagnostics:renderDiagnostics},
  pptx:{
    zipEntryCount:Object.keys(entries).length,xmlPartCount:xmlFiles.length,xmlAllValid:xmlValidation.every(item=>item.valid),xmlFailures:xmlValidation.filter(item=>!item.valid),
    slideXmlSha256:sha256(slideXml),paragraphCount:paragraphs.length,hardBreakCount:find(cells[0],'a:br').length,
    nativeRuns,nativeText,nativeTextEqualsAuthored:nativeText===authoredText,literalTabCount:(nativeText.match(/\t/g)??[]).length,
    rawTabReferences,tabStopCount:tabStops.length,tabStops,lineSpacing,
    row:{heightEmu:Number(rows[0].h),heightPoints:Number(rows[0].h)/12700,heightReferencePixels:Number(rows[0].h)/9525},
    frame:{widthEmu:Number(extent.cx),heightEmu:Number(extent.cy),widthPoints:Number(extent.cx)/12700,heightPoints:Number(extent.cy)/12700},
    gridWidths,exportDiagnostics
  },
  reimport:{diagnostics:importDiagnostics,validation:reimportValidation,location:importedSlide?.table?'slides.0.table':'slides.0.blocks.0.table',cell:importedCell??null,text:importedText,textEqualsAuthored:importedText===authoredText,authoredRunCore,importedRunCore,runCoreEqualsAuthored:importedRunCoreEqualsAuthored,structuralCellJsonEqualsAuthored:JSON.stringify(importedCell)===JSON.stringify(authoredRuns)}
};
await writeJson(join(here,'inspection.json'),inspection);

const packagePaths={
  opf:join(consumer,'node_modules','@openpresentation','opf','package.json'),
  pptx:join(consumer,'node_modules','@openpresentation','opf-pptx','package.json'),
  render:join(consumer,'node_modules','@openpresentation','opf-render','package.json'),
  carlito:join(consumer,'node_modules','@expo-google-fonts','carlito','package.json')
};
const packages={};
for(const [name,path] of Object.entries(packagePaths)){
  const json=await readJson(path);
  packages[name]={name:json.name,version:json.version,path:rel(path),sha256:await hashFile(path)};
}
const licensePath=join(consumer,'node_modules','@expo-google-fonts','carlito','LICENSE_FONT');
const artifacts={};
for(const name of ['source.json','source.pptx','preview.svg','preview.png','reimport.json','inspection.json']){
  const path=join(here,name),bytes=await readFile(path);
  artifacts[name]={path:rel(path),bytes:bytes.length,sha256:sha256(bytes)};
}
const generation={
  kind:'mixed-size-soft-wrapped-rich-table-registry-fixture',generatedAt:'2026-09-21T00:00:00.000Z',
  runtime:{node:process.version,nodeExecutable:{path:rel(node24),sha256:await hashFile(node24)}},
  consumer:{path:rel(consumer),registryLock:{path:rel(join(consumer,'package-lock.json')),sha256:await hashFile(join(consumer,'package-lock.json'))},packages},
  generator:{path:rel(fileURLToPath(import.meta.url)),sha256:await hashFile(fileURLToPath(import.meta.url))},
  source:artifacts['source.json'],artifacts,
  fonts:{registrationPerformed:false,systemFontsLoaded:false,packageLicense:packages.carlito,license:{spdx:'OFL-1.1',path:rel(licensePath),sha256:await hashFile(licensePath)},selectedFiles:await Promise.all(selectedFontFiles.map(async path=>({path:rel(path),sha256:await hashFile(path)}))),embeddedSvgFaces:selectedEmbeddedFonts.map(face=>({family:face.family,weight:face.weight,italic:Boolean(face.italic)})),substitutions:prepared.registry.substitutions},
  gates:{schemaValid:validation.valid,sourceUnchanged:JSON.stringify(source)===sourceBefore,softWrapped:traceLines.length>=2,oneNativeParagraph:paragraphs.length===1,noNativeHardBreaks:find(cells[0],'a:br').length===0,exactDrawingMlText:nativeText===authoredText,exactReimportText:importedText===authoredText,exactReimportRunCore:importedRunCoreEqualsAuthored,registeredMeasurementSupportsLiteralTab:registeredMeasurement.usableForLiteralTab,nativeTabStopsPresent:tabStops.length>0}
};
await writeJson(join(here,'generation.json'),generation);

const diagnosticLines=importDiagnostics.length?importDiagnostics.map(item=>`- \`${item.code}\` at \`${item.path}\`: ${item.message}`).join('\n'):'- None.';
const report=`# Mixed-size soft-wrapped table registry fixture\n\nThis one-slide, one-row, one-cell fixture was generated only from the pinned registry consumer with Node ${process.version}. The source has five exact Carlito rich runs at 18/30/18/30/18 points, one literal U+0009, and no CR, LF, hard break, manual offset, or tolerance adjustment. Current schema validation passes with no warnings.\n\nThe accepted renderer trace contains ${traceLines.length} natural soft lines. The current registered Carlito measurement API is available but rejects U+0009 as \`${registeredMeasurement.error.code}\` at \`${registeredMeasurement.error.details.path}\`; the generator preserves the tab and uses the current unmeasured rich-table path rather than replacing it with spaces or inventing an offset. SVG paint embeds only the OFL Carlito 400/700 upright faces; PNG rasterization loads the four pinned package faces without installing them or reading system fonts.\n\nDrawingML contains one table paragraph and zero \`a:br\` elements. Its five runs retain the exact source text and 18/30/18/30/18-point sizes. It contains ${tabStops.length} explicit \`a:tab\` stop${tabStops.length===1?'':'s'}; the literal U+0009 remains in run text${rawTabReferences.length?` as ${rawTabReferences.map(value=>`\`${value}\``).join(', ')}`:''}. The uniform paragraph line spacing is ${lineSpacing.map(value=>value.points).join(', ')||'absent'} points, the row is ${(Number(rows[0].h)/12700).toFixed(6)} points high, and the native frame is ${(Number(extent.cx)/12700).toFixed(6)} by ${(Number(extent.cy)/12700).toFixed(6)} points. These XML values do not establish PowerPoint's actual wrapped-line or tab bounds.\n\nCurrent semantic reimport ${reimportValidation.valid?'validates':'does not validate'}, ${importedText===authoredText?'retains':'does not retain'} the exact flattened authored text, and ${importedRunCoreEqualsAuthored?'retains':'does not retain'} the five run texts, font families, sizes, bold flags, and italic flags. It represents the cell as a styled block cell and adds explicit colors, fill, padding, and borders, so its complete cell JSON is not byte-identical to the minimal source cell. Import diagnostics:\n\n${diagnosticLines}\n\nThe next bounded native control should open this exact PPTX read-only, select the sole table cell without editing it, and record the cell shape name/type, table/row/cell counts, row and frame geometry, paragraph count, literal text, run font name/size/bold/italic, \`TextRange2\` bounds for the full paragraph and text immediately before/after U+0009, paragraph tab stops, and full-slide PNG. It should close only that owned read-only presentation. Comparing those native observations to this package record would test actual PowerPoint wrap/tab behavior; it must not convert soft wraps to hard paragraphs, change offsets or tolerance, save, install fonts, or infer physical glyph provenance.\n`;
await writeFile(join(here,'report.md'),report);
console.log(JSON.stringify({output:here,sourceSha256:artifacts['source.json'].sha256,pptxSha256:artifacts['source.pptx'].sha256,generatorSha256:generation.generator.sha256,registryLockSha256:generation.consumer.registryLock.sha256,softLines:traceLines.length,tabStops:tabStops.length,reimportDiagnostics:importDiagnostics.length},null,2));
