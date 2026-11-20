// Diagnostic only: distinguish per-deck model identity from style identity during application reuse. No Office calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readSmartArtModel,outlineItems} from '../../../packages/pptx/src/smart-art-import.js';
const {unzipSync,zipSync,strFromU8,strToU8}=createRequire(new URL('../../../packages/pptx/package.json',import.meta.url))('fflate');
const [manifestFile,out,mode]=process.argv.slice(2);if(!manifestFile||!out||!['model-ids','style-ids'].includes(mode)||fs.existsSync(out))throw Error('Supply manifest, fresh output, and model-ids or style-ids.');
const sourceRoot=path.dirname(manifestFile),source=JSON.parse(fs.readFileSync(manifestFile)),manifest=structuredClone(source),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),proof=[];
const idAttribute=/((?:modelId|srcId|destId|cxnId|parTransId|sibTransId)=")({[0-9a-f-]{36}})(")/gi;
const uuid=value=>{const chars=sha(value).slice(0,32).split('');chars[12]='4';chars[16]='8';const s=chars.join('');return '{'+[s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-')+'}';};
for(const directory of ['pptx','pptx-shapes','preview'])fs.mkdirSync(path.join(out,directory),{recursive:true});
for(const spec of manifest.cases){
 assert.match(spec.id,/^[a-z][a-z0-9-]*$/);assert.equal(spec.live.file,'pptx/'+spec.id+'.pptx');assert.equal(spec.native.file,'pptx-shapes/'+spec.id+'.pptx');
 const before=fs.readFileSync(path.join(sourceRoot,spec.live.file));assert.equal(sha(before),spec.live.sha256);const parts=unzipSync(before),changed=[],mapping=new Map(),data=strFromU8(parts['ppt/diagrams/data1.xml']),style=/qsTypeId="([^"]+)"/.exec(data)[1],colors=/csTypeId="([^"]+)"/.exec(data)[1];
 for(const file of Object.keys(parts).filter(name=>mode==='model-ids'?/^ppt\/diagrams\/(data|drawing)\d+\.xml$/.test(name):/^ppt\/diagrams\/(data|quickStyle|colors)\d+\.xml$/.test(name))){
  const original=strFromU8(parts[file]);let next=original;
  if(mode==='model-ids'){next=original.replace(idAttribute,(all,prefix,id,suffix)=>{if(!mapping.has(id))mapping.set(id,uuid(spec.id+'\0'+id));return prefix+mapping.get(id)+suffix;});const reverse=new Map([...mapping].map(([a,b])=>[b,a]));assert.equal(next.replace(idAttribute,(all,prefix,id,suffix)=>prefix+(reverse.get(id)??id)+suffix),original,'exact model-ID token-only change');}
  else{const suffix='/reuse-'+sha(spec.id).slice(0,16);next=original.replaceAll(style,style+suffix).replaceAll(colors,colors+suffix);assert.equal(next.replaceAll(style+suffix,style).replaceAll(colors+suffix,colors),original,'exact style identity token-only change');}
  if(next!==original){parts[file]=strToU8(next);changed.push(file);}
 }
 assert.equal(changed.length,mode==='model-ids'?2:3);const after=zipSync(parts,{level:6,mtime:new Date('2026-11-07T00:00:00Z')}),decoded=unzipSync(after),oldParts=unzipSync(before);assert.deepEqual(Object.keys(decoded),Object.keys(oldParts));for(const file of Object.keys(oldParts))if(!changed.includes(file))assert.deepEqual(decoded[file],oldParts[file],file+' unchanged');
 const beforeModel=readSmartArtModel(data),afterModel=readSmartArtModel(strFromU8(decoded['ppt/diagrams/data1.xml']));assert.equal(afterModel.layoutId,beforeModel.layoutId);assert.deepEqual(outlineItems(afterModel.roots),outlineItems(beforeModel.roots));
 fs.writeFileSync(path.join(out,spec.live.file),after);const native=fs.readFileSync(path.join(sourceRoot,spec.native.file));assert.equal(sha(native),spec.native.sha256);fs.writeFileSync(path.join(out,spec.native.file),native);for(const suffix of ['png','svg'])fs.copyFileSync(path.join(sourceRoot,'preview',spec.id+'-1.'+suffix),path.join(out,'preview',spec.id+'-1.'+suffix));
 proof.push({id:spec.id,mode,beforeSha256:sha(before),afterSha256:sha(after),changedParts:changed,modelIds:mode==='model-ids'?[...mapping].map(([before,after])=>({before,after})):undefined,unchangedParts:Object.keys(parts).length-changed.length,nativeControlByteExact:true,previewByteExact:true,semanticsUnchanged:true});spec.live.sha256=sha(after);
}
manifest.scope='Diagnostic only: '+mode+' per deck; original layout/text/font/geometry/paint and all native controls unchanged; no eligibility.';manifest.parentManifest=path.resolve(manifestFile);manifest.variant={mode,toolSha256:sha(fs.readFileSync(new URL(import.meta.url)))};fs.copyFileSync(path.join(sourceRoot,'meta.json'),path.join(out,'meta.json'));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(mode+': eleven sealed variants; exact token-only part changes, native controls/previews/semantics unchanged.');
