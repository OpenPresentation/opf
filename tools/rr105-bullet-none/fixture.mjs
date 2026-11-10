// Diagnostic pure ZIP mutation only. Never imports an OPF exporter or invokes Office.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
export const ORIGINAL_SHA='4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2';
export const WORKER_SHA='51cb21003f058bd401669458e6f0afdd0acd899fdd54c4ee529595a32f5e65b9';
export const TARGET='ppt/slides/slide1.xml';
export const NAME='OPF list slides.0.items line 0';
export const BEFORE='<a:buAutoNum type="arabicPeriod"/>';
export const AFTER='<a:buNone/>';
export const TEXT='Item 1: Customers told us onboarding took too long, so we rebuilt it ';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
function utf16Text(node,result=[]){if(node&&typeof node==='object')for(const[key,value]of Object.entries(node)){if(key==='a:t')result.push(value);else if(Array.isArray(value))for(const item of value)utf16Text(item,result);else utf16Text(value,result);}return result;}
export function dependencies(root){
 const require=createRequire(path.join(fs.realpathSync(root),'packages/pptx/package.json'));
 const names=['fflate','fast-xml-parser'],identity=names.map(name=>{const entry=require.resolve(name);let folder=path.dirname(entry),manifest;while(folder!==path.dirname(folder)){const candidate=path.join(folder,'package.json');if(fs.existsSync(candidate)&&JSON.parse(fs.readFileSync(candidate)).name===name){manifest=candidate;break;}folder=path.dirname(folder);}assert(manifest,'Bound ZIP/XML package manifest required');return{name,version:JSON.parse(fs.readFileSync(manifest)).version,manifest:{path:manifest,sha256:sha(fs.readFileSync(manifest))},entry:{path:entry,sha256:sha(fs.readFileSync(entry))}};});
 return{...require('fflate'),...require('fast-xml-parser'),identity};
}
function archive(bytes,deps){
 assert(bytes.length>0&&bytes.length<=16*1024*1024);const names=[],seen=new Set();let expanded=0;
 const parts=deps.unzipSync(bytes,{filter(entry){const name=entry.name;assert(name&&!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').some(p=>!p||p==='.'||p==='..'));assert(!seen.has(name.toLowerCase()));seen.add(name.toLowerCase());names.push(name);assert(names.length<=4096);assert(entry.originalSize<=8*1024*1024);expanded+=entry.originalSize;assert(expanded<=64*1024*1024);return true;}});assert.equal(names.length,147);assert.deepEqual(Object.keys(parts),names);return{parts,names};
}
function parsed(xml,deps){
 assert(!/<!DOCTYPE|<!ENTITY/.test(xml));assert.equal(deps.XMLValidator.validate(xml),true);const doc=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false,processEntities:false}).parse(xml),root=doc['p:sld'];
 assert.equal(root['xmlns:p'],'http://schemas.openxmlformats.org/presentationml/2006/main');assert.equal(root['xmlns:a'],'http://schemas.openxmlformats.org/drawingml/2006/main');assert.equal(root['xmlns:r'],'http://schemas.openxmlformats.org/officeDocument/2006/relationships');
 const shapes=list(root['p:cSld']['p:spTree']['p:sp']);assert.equal(shapes.length,3);const matching=shapes.filter(s=>s['p:nvSpPr']['p:cNvPr'].name===NAME);assert.equal(matching.length,1);const target=matching[0],paragraphs=list(target['p:txBody']['a:p']);assert.equal(paragraphs.length,1);const paragraph=paragraphs[0],pPr=paragraph['a:pPr'];assert.equal(pPr.algn,'l');assert.equal(pPr.marL,'394654');assert.equal(pPr.indent,'-394654');assert.equal(pPr.rtl,'0');assert.deepEqual(utf16Text(target),[TEXT]);return{doc,shapes,target,paragraph,pPr};
}
export function mutate(original,deps){
 assert.equal(sha(original),ORIGINAL_SHA,'Only sealed original09 may be mutated');const before=archive(original,deps),originalXml=new TextDecoder('utf-8',{fatal:true}).decode(before.parts[TARGET]),old=parsed(originalXml,deps);
 assert.equal(originalXml.split(BEFORE).length,2,'Exactly one literal automatic-number token');
 const rawShapes=[...originalXml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map(m=>m[0]),rawTarget=rawShapes.filter(s=>s.includes('name="'+NAME+'"'));assert.equal(rawTarget.length,1);assert.equal(rawTarget[0].split(BEFORE).length,2);assert.equal((rawTarget[0].match(/<a:pPr\b/g)||[]).length,1);assert(rawTarget[0].match(/<a:pPr\b[\s\S]*?<\/a:pPr>/)[0].includes(BEFORE));
 assert(Buffer.from(originalXml,'utf8').equals(Buffer.from(before.parts[TARGET])),'Target XML UTF8 bytes must roundtrip exactly');const offset=originalXml.indexOf(BEFORE),xml=originalXml.slice(0,offset)+AFTER+originalXml.slice(offset+BEFORE.length),next=parsed(xml,deps);assert.equal(xml.slice(0,offset)+BEFORE+xml.slice(offset+AFTER.length),originalXml,'Exactly one reversible literal mutation');
 assert.deepEqual(Object.keys(old.pPr).filter(key=>key.startsWith('a:')),['a:lnSpc','a:buClr','a:buSzPts','a:buFont','a:buAutoNum']);assert.deepEqual(Object.keys(next.pPr).filter(key=>key.startsWith('a:')),['a:lnSpc','a:buClr','a:buSzPts','a:buFont','a:buNone']);
 const expected=structuredClone(old.doc),expectedShapes=list(expected['p:sld']['p:cSld']['p:spTree']['p:sp']),expectedParagraph=expectedShapes.find(s=>s['p:nvSpPr']['p:cNvPr'].name===NAME)['p:txBody']['a:p'];delete expectedParagraph['a:pPr']['a:buAutoNum'];expectedParagraph['a:pPr']['a:buNone']='';assert(isDeepStrictEqual(next.doc,expected),'Parsed XML may differ only in bullet-choice element');assert.deepEqual(utf16Text(old.doc),utf16Text(next.doc),'All exact UTF16 text must remain');
 const parts={...before.parts,[TARGET]:new TextEncoder().encode(xml)},bytes=deps.zipSync(parts,{level:6,mtime:new Date('2026-01-01T00:00:00Z')}),after=archive(bytes,deps),proof=verifyParts(before,after,originalXml,xml);return{bytes,proof:{...proof,originalSha256:ORIGINAL_SHA,mutantSha256:sha(bytes),target:TARGET,shapeName:NAME,before:BEFORE,after:AFTER,originalXmlSha256:sha(before.parts[TARGET]),mutantXmlSha256:sha(after.parts[TARGET]),text:TEXT,textUtf16:[...Array(TEXT.length)].map((_,i)=>TEXT.charCodeAt(i)),namespaceAndBulletChoiceChecks:true,fullEcmaXsdValidation:false,xmlContextUnchanged:true,geometryFontLanguageUntouched:true,tools:deps.identity}};
}
function verifyParts(before,after,originalXml,xml){
 assert.deepEqual(after.names,before.names,'ZIP entry names/order may not change');const parts=before.names.map(name=>{const a=Buffer.from(before.parts[name]),b=Buffer.from(after.parts[name]);if(name===TARGET){assert.equal(b.toString('utf8'),xml);assert.equal(xml,originalXml.replace(BEFORE,AFTER));}else assert(a.equals(b),'Unrelated part changed '+name);return{name,originalBytes:a.length,mutantBytes:b.length,originalSha256:sha(a),mutantSha256:sha(b),changed:!a.equals(b)};});assert.deepEqual(parts.filter(p=>p.changed).map(p=>p.name),[TARGET]);return{partCount:147,unchangedParts:146,entryOrderPreserved:true,parts};
}
export function deriveWorker(originalWorker,mutantSha){
 assert.equal(sha(originalWorker),WORKER_SHA);assert.equal(originalWorker.length,81652);assert.match(mutantSha,/^[a-f0-9]{64}$/);assert.notEqual(mutantSha,ORIGINAL_SHA);const text=originalWorker.toString('utf8'),needle="$allowed=@('"+ORIGINAL_SHA+"')";assert.equal(text.split(needle).length,2);const changed=Buffer.from(text.replace(needle,"$allowed=@('"+mutantSha+"')"));assert.equal(changed.length,originalWorker.length);assert(changed.toString('utf8').replace(mutantSha,ORIGINAL_SHA)===text);return changed;
}
export function prepare({input,worker,toolRoot,output}){
 assert(path.isAbsolute(output)&&!output.startsWith('\\\\'));const full=path.resolve(output),parent=path.dirname(full);assert.equal(fs.realpathSync(parent),parent);assert(!fs.existsSync(full),'Fresh output required');const own=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));for(const protectedRoot of [own,path.dirname(fs.realpathSync(input)),path.dirname(fs.realpathSync(worker)),fs.realpathSync(toolRoot)])assert(full!==protectedRoot&&!full.startsWith(protectedRoot+path.sep)&&!protectedRoot.startsWith(full+path.sep),'Output overlaps protected source/input');
 const git=args=>execFileSync('git',['-C',own,...args],{encoding:'utf8'}).trim();const driver={root:own,revision:git(['rev-parse','HEAD']),dirty:git(['status','--porcelain','--untracked-files=normal'])!=='',files:['tools/rr105-bullet-none/fixture.mjs','tools/rr105-bullet-none/qualify-input.ps1'].map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(own,file)))}))};assert.equal(driver.dirty,false,'Freeze pure preparation source before mutation');
 const deps=dependencies(toolRoot),original=fs.readFileSync(input),baseWorker=fs.readFileSync(worker),result=mutate(original,deps),derived=deriveWorker(baseWorker,result.proof.mutantSha256);fs.mkdirSync(full);for(const[name,bytes]of [['original09.pptx',original],['bullet-none.pptx',result.bytes],['derived-native-furniture-control.ps1',derived]])fs.writeFileSync(path.join(full,name),bytes,{flag:'wx'});const receipt={schema:1,diagnosticOnly:true,driver,originalInput:{path:fs.realpathSync(input),sha256:ORIGINAL_SHA},baseWorker:{path:fs.realpathSync(worker),bytes:baseWorker.length,sha256:WORKER_SHA},derivedWorker:{bytes:derived.length,sha256:sha(derived),onlyChange:'one64hex input allowlist literal'},proof:result.proof,glyphFix:false,currentRuntimeAcceptance:false,nativeAcceptance:false,registryAcceptance:false};fs.writeFileSync(path.join(full,'fixture.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){assert.equal(process.argv[2],'prepare','Explicit pure prepare required');const args=process.argv.slice(3),options={};for(let i=0;i<args.length;i+=2){const flag=args[i];assert(['--input','--worker','--tool-root','--output'].includes(flag)&&args[i+1]&&!Object.hasOwn(options,flag));options[flag]=args[i+1];}assert.equal(Object.keys(options).length,4);const result=prepare({input:options['--input'],worker:options['--worker'],toolRoot:options['--tool-root'],output:options['--output']});console.log(JSON.stringify({prepared:true,mutantSha256:result.proof.mutantSha256,derivedWorkerSha256:result.derivedWorker.sha256,partCount:147,unchangedParts:146,nativeRun:false}));}
