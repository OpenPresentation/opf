import path from 'node:path';import {inputs} from './graph.mjs';
const {consumer,output}=await inputs();
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {writeFile} from 'node:fs/promises';
const require=createRequire(path.join(consumer,'package.json'));const {unzipSync,strFromU8}=require('fflate');
const {toPptx,fromPptx}=await import(pathToFileURL(require.resolve('@openpresentation/opf-pptx')));const {gallery}=await import(pathToFileURL(require.resolve('@openpresentation/gallery')));
const reports=[];
for(const title of [[{text:'Rich title',bold:true}],[{text:'Rich ',bold:false},{text:'title',bold:true}],[{text:'Rich ',italic:true},'title']]){
const source={slides:[{title,text:'Body'}]};const options={catalogs:[gallery],seed:1,timestamp:'2026-01-01T00:00:00Z',provenance:'full'};const bytes=await toPptx(source,options);const parts=unzipSync(bytes);const diagnostics=[];const imported=await fromPptx(bytes,{...options,onDiagnostic:d=>diagnostics.push(d)});
const reexported=unzipSync(await toPptx(imported,options));
const runStyles=xml=>[...xml.matchAll(/<a:r><a:rPr[^>]*(?:\/>|>[\s\S]*?<\/a:rPr>)/g)].map(([style])=>style);
const sourceStyles=runStyles(strFromU8(parts['ppt/slides/slide1.xml'])),importedStyles=runStyles(strFromU8(reexported['ppt/slides/slide1.xml']));
reports.push({source,imported,diagnostics,sourceStyles,importedStyles,effectiveNativeRunStylesEqual:JSON.stringify(sourceStyles)===JSON.stringify(importedStyles),slideXml:strFromU8(parts['ppt/slides/slide1.xml']),headingTags:Object.fromEntries(Object.entries(parts).filter(([p,b])=>p.startsWith('ppt/tags/')&&strFromU8(b).includes('OPF_HEADING')).map(([p,b])=>[p,strFromU8(b)]))});}
await writeFile(path.join(output,'inspection/rich-title-probe.json'),JSON.stringify(reports,null,2)+'\n');console.log(reports.map(r=>r.imported.slides[0].title));
