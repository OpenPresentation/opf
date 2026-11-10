// Offline proof only: built-ins and the included authored data parser. Never execute archived producer/worker code.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {unzip,parseXml} from './data-tools.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const read=name=>fs.readFileSync(path.join(dir,name)),manifest=JSON.parse(read('manifest.json')),compressed=read(manifest.raw.file);
assert.equal(compressed.length,manifest.raw.bytes);assert.equal(sha(compressed),manifest.raw.sha256);
const records=JSON.parse(gunzipSync(compressed,{maxOutputLength:32*1024*1024})).records;
assert.equal(records.length,manifest.raw.records);assert.equal(new Set(records.map(r=>r.name)).size,records.length);
const raw=new Map();let bytes=0;
for(const record of records){assert.ok(!path.isAbsolute(record.name)&&!record.name.includes('\\')&&!record.name.split('/').some(x=>!x||x==='.'||x==='..'));const b=Buffer.from(record.base64,'base64');assert.equal(b.length,record.bytes);assert.equal(sha(b),record.sha256);assert.deepEqual(manifest.files.find(r=>r.name===record.name),{name:record.name,bytes:record.bytes,sha256:record.sha256});raw.set(record.name,b);bytes+=b.length;}
assert.equal(bytes,manifest.raw.logicalBytes);
const get=name=>{assert.ok(raw.has(name),'Missing evidence '+name);return raw.get(name);},json=name=>JSON.parse(get(name));
const local=n=>n.name?.slice(n.name.indexOf('}')+1),find=(n,name)=>[...(local(n)===name?[n]:[]),...(n.children??[]).filter(x=>x.name).flatMap(x=>find(x,name))],attrs=n=>n?Object.fromEntries(Object.entries(n.attributes).map(([k,v])=>[k.replace('{}',''),v])):{},plain=n=>(n.children??[]).map(x=>x.text??'').join('');
const decode=s=>plain(parseXml('<t>'+s+'</t>'));
const nameOf=s=>decode(/<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(s)?.[1]??'');
const shapeMap=xml=>new Map([...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(m=>[nameOf(m[0]),m[0]]));
const frame=s=>{const n=find(parseXml(s),'xfrm')[0];assert.ok(n);return{...attrs(find(n,'off')[0]),...attrs(find(n,'ext')[0])};};
const paragraph=s=>find(parseXml(s),'pPr')[0];
function runs(s){let at=0;return [...s.matchAll(/<a:r>(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>)<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(m=>{const text=decode(m[2]),from=at;at+=text.length;return{from,to:at,text,properties:m[1]};});}
function strippedPPr(n){return{...n,attributes:Object.fromEntries(Object.entries(n.attributes).filter(([k])=>!['{}rtl','{}algn','{}indent','{}marL'].includes(k))),children:n.children.filter(c=>!local(c)?.startsWith('bu'))};}
const proof=json('attempts/variants03/proof.json'),bridge=json('attempts/bridge01/bridge.json');
assert.equal(proof.cases.length,5);assert.equal(json('attempts/offset-bridge01.exit.json').status,0);
assert.equal(json('attempts/variants01/terminal.json').status,1);assert.equal(json('attempts/variants02/terminal.json').status,1);
assert.equal(json('attempts/variants01/terminal.json').variantsWritten,0);assert.equal(json('attempts/variants02/terminal.json').variantsWritten,0);
assert.equal(json('attempts/capability01/geometry-refusal.json').status,'EXCLUDED');
for(const name of ['capability02','capability03','capability04']){assert.equal(json('attempts/'+name+'/terminal.json').status,0);assert.equal(json('attempts/'+name+'/terminal.json').variantsWritten,0);}
const expectedCounts=[4,4,5,20,3];let changedLines=0,segments=0,unchangedShapes=0;
for(const [index,c]of proof.cases.entries()) {
 const prefix='attempts/capability04/inputs/'+c.id,original=get(prefix+'/original.pptx'),variant=get('attempts/variants03/cases/'+c.id+'/variant.pptx');
 assert.equal(sha(original),c.inputSha256);assert.equal(sha(variant),c.outputSha256);
 assert.ok(original.equals(read('files/'+c.id+'/original.pptx')));assert.ok(variant.equals(read('files/'+c.id+'/variant.pptx')));assert.ok(get(prefix+'/source.opf.json').equals(read('files/'+c.id+'/source.opf.json')));
 const before=unzip(original),after=unzip(variant);assert.equal(before.size,after.size);assert.equal(after.size,c.parts);assert.ok(after.size<=4096&&variant.length<=16*1024*1024);
 assert.deepEqual([...before.keys()].sort(),[...after.keys()].sort());for(const[p,b]of before)if(p!=='ppt/slides/slide1.xml')assert.ok(Buffer.from(after.get(p)).equals(Buffer.from(b)),'Every non-slide native part remains exact');
 const oldXml=Buffer.from(before.get('ppt/slides/slide1.xml')).toString(),newXml=Buffer.from(after.get('ppt/slides/slide1.xml')).toString(),old=shapeMap(oldXml),current=shapeMap(newXml);
 assert.equal(old.size,c.originalShapeCount);assert.equal(current.size,expectedCounts[index]);assert.equal(current.size,c.actualShapeCount);assert.ok(current.size<=30);
 const allNodes=find(parseXml(newXml),'sp');const ids=allNodes.map(n=>attrs(find(n,'cNvPr')[0]).id);assert.equal(new Set(ids).size,ids.length);
 assert.equal([...newXml.matchAll(/<a:buAutoNum\b/g)].length,[...oldXml.matchAll(/<a:buAutoNum\b/g)].length);
 for(const[name,s]of old)if(!c.changed.includes(name)){assert.equal(current.get(name),s,'Every untouched original shape remains byte exact');unchangedShapes++;}
 for(const line of c.proof){changedLines++;const sourceShape=old.get(line.name);assert.ok(sourceShape);const sourceRuns=runs(sourceShape);assert.equal(sourceRuns.map(r=>r.text).join(''),line.originalText);assert.deepEqual(frame(sourceShape),Object.fromEntries(Object.entries(line.originalFrame).map(([k,v])=>[k,String(v)])));
  let at=0;for(const segment of line.segments){segments++;assert.equal(segment.from,at);assert.equal(segment.text,line.originalText.slice(segment.from,segment.to));at=segment.to;const shape=current.get(segment.name);assert.ok(shape);const actualRuns=runs(shape);assert.equal(actualRuns.length,1);assert.equal(actualRuns[0].text,segment.text);const owner=sourceRuns.find(r=>segment.from>=r.from&&segment.to<=r.to);assert.ok(owner);assert.equal(actualRuns[0].properties,owner.properties,'Complete source rPr including native language/font/size remains exact');assert.equal(attrs(find(parseXml(actualRuns[0].properties),'rPr')[0]).lang,'ar-SA');
   const f=Object.fromEntries(Object.entries(frame(shape)).map(([k,v])=>[k,Number(v)]));assert.deepEqual(f,segment.frame);assert.equal(f.y,line.originalFrame.y);assert.equal(f.cy,line.originalFrame.cy);assert.ok(f.cx>0&&f.cy>0);
   assert.deepEqual(find(parseXml(shape),'bodyPr'),find(parseXml(sourceShape),'bodyPr'),'Native vertical body geometry copied');assert.deepEqual(find(parseXml(shape),'endParaRPr'),find(parseXml(sourceShape),'endParaRPr'));
   if(segment.carrier){assert.deepEqual(f,line.originalFrame);assert.deepEqual(paragraph(shape),paragraph(sourceShape),'Exactly original marker carrier paragraph');assert.equal(Math.round(line.coreAnchor*9525),line.nativeAnchor);assert.equal(Math.round((segment.resolvedDirection==='rtl'?segment.right:segment.left)*9525),line.nativeAnchor);}
   else {assert.equal(f.x,Math.round(segment.left*9525));assert.equal(f.cx,Math.round((segment.right-segment.left)*9525));const p=paragraph(shape);assert.equal(attrs(p).rtl,segment.resolvedDirection==='rtl'?'1':'0');assert.equal(attrs(p).algn,segment.resolvedDirection==='rtl'?'r':'l');assert.equal(attrs(p).indent,'0');assert.equal(attrs(p).marL,'0');assert.equal(find(p,'buNone').length,1);assert.equal(find(p,'buAutoNum').length,0);assert.deepEqual(strippedPPr(p),strippedPPr(paragraph(sourceShape)),'Only declared direction/alignment/indent/bullet paragraph changes');}
  }assert.equal(at,line.originalText.length);assert.equal(line.segments.map(s=>s.text).join(''),line.originalText);assert.equal(line.currentPublicReassembly,false);
 }
 const oldSvg=get('attempts/capability03/geometry/'+c.id+'.svg').toString(),traceSvg=get('attempts/capability04/geometry/'+c.id+'.svg').toString();assert.equal(traceSvg.replace(/ data-rr105-[\w-]+="[^"]*"/g,''),oldSvg,'Trace-only append changes no prior full-precision SVG bytes');
 if(c.id.includes('11-'))assert.ok(original.equals(variant),'Whole French negative archive remains exact');
}
assert.equal(changedLines,7);assert.equal(segments,25);assert.equal(unchangedShapes,11);
assert.equal(bridge.cases.flatMap(c=>c.mapped).length,10);assert.ok(bridge.cases.flatMap(c=>c.mapped).every(x=>x.exact));
const fonts=JSON.parse(read('font-provenance.json'));assert.equal(fonts.manifest.license,'OFL-1.1');assert.equal(sha(read('licenses/intos/OFL.txt')),fonts.manifest.licenseSha256);assert.equal(sha(read('licenses/intos/NOTICE.md')),fonts.manifest.noticeSha256);
for(const f of fonts.svgFonts){assert.equal(f.family,'Intos');assert.ok([400,700].includes(f.weight));assert.equal(f.license,'OFL-1.1');assert.ok(fonts.manifest.faces.some(x=>x.sha256===f.sourceFaceSha256));}
assert.equal(manifest.nativeAcceptance,false);assert.equal(manifest.publicImportAcceptance,false);assert.equal(manifest.productChanges,false);assert.equal(manifest.officeCalls,0);assert.equal(manifest.newProductProvenance,false);
console.log(JSON.stringify({status:'PASS',records:records.length,logicalBytes:bytes,cases:5,shapeCounts:expectedCounts,changedLines,segments,unchangedShapes,originalListFramesExact:10,officeCalls:0,nativeAcceptance:false,publicImportAcceptance:false}));