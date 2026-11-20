// SH21 product-export diagnostic packet. Run only on the evidence-only qualification candidate; never enables production eligibility.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {toPptx,fromPptx} from '../../../packages/pptx/dist/index.js';
import {toSvg,toPng} from '../../../packages/render/dist/index.js';
import {loadFonts} from '../../../packages/render/dist/fonts-node.js';
import {gallery} from '../../../packages/gallery/dist/index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=process.argv[2];
if(!out||fs.existsSync(out))throw Error('Supply a fresh output directory; preserve earlier attempts.');
const {unzipSync,strFromU8}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'}),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const tree3=[{text:'Lead',level:0},{text:'Build',level:1},{text:'Ship',level:1}],tree5=[{text:'Root',level:0},{text:'Build',level:1},{text:'Web',level:2},{text:'App',level:2},{text:'Ship',level:1}];
const cases=[...['org-chart','hierarchy'].flatMap(kind=>[[kind+'-3',kind,tree3],[kind+'-5',kind,tree5]]),...Array.from({length:7},(_,i)=>['venn-'+(i+1),'venn',Array.from({length:i+1},(_,j)=>'N'+(j+1))])];
const manifest={scope:'Evidence-only SH21 product-export baseline. All live eligibility is diagnostic; no native domain acceptance.',sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sources:['packages/javascript/src/arrangements.ts','packages/javascript/src/native-tree-arrangement.ts','packages/javascript/src/venn-arrangement.ts','packages/javascript/src/composition.ts','packages/pptx/src/smart-art.js','packages/render/src/svg.js'].map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),cases:[]},meta={};
for(const sub of ['pptx','pptx-shapes','preview'])fs.mkdirSync(path.join(out,sub),{recursive:true});
for(const [id,kind,items]of cases){
 const deck={$schema:'https://openpresentation.org/schema/opf/v1',name:'SH21 '+id,language:'en-US',catalogs:{custom:{fontSchemes:{'source-sans-3':{name:'Source Sans 3',major:'Source Sans 3',minor:'Source Sans 3',type:'sans-serif'}}}},design:{dimensions:'16:9',fontScheme:'source-sans-3'},slides:[{layout:kind,title:'Measured '+kind+' geometry',items}]};
 const diagnostics=[],options={catalogs:[gallery],fonts,seed:2121,timestamp:'2026-11-07T00:00:00Z',zipDate:'2026-11-07T00:00:00Z',onDiagnostic:d=>diagnostics.push(d)},bytes=new Uint8Array(await toPptx(deck,options)),parts=unzipSync(bytes),xml=strFromU8(parts['ppt/slides/slide1.xml']);assert.ok(xml.includes('drawingml/2006/diagram'),id+': source did not export live; use the evidence-only candidate');
 const native=new Uint8Array(await toPptx(deck,{...options,smartArt:'shapes'})),svg=toSvg(deck,{catalogs:[gallery],fonts})[0];
 const data=strFromU8(parts['ppt/diagrams/data1.xml']),layoutId=/<dgm:prSet loTypeId="([^"]+)"/.exec(data)[1],sizes=[...new Set([...data.matchAll(/<a:rPr[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];assert.equal(sizes.length,1);
 const liveFile='pptx/'+id+'.pptx',nativeFile='pptx-shapes/'+id+'.pptx';fs.writeFileSync(path.join(out,liveFile),bytes);fs.writeFileSync(path.join(out,nativeFile),native);fs.writeFileSync(path.join(out,'preview',id+'-1.svg'),svg);fs.writeFileSync(path.join(out,'preview',id+'-1.png'),await toPng(svg));fs.writeFileSync(path.join(out,id+'.opf.json'),JSON.stringify(deck,null,2)+'\n');
 const round=await fromPptx(bytes),actual=round.slides[0].items??round.slides[0].blocks?.find(block=>block.items)?.items,semantic=xs=>xs.map(v=>typeof v==='string'?{text:v,level:0}:{text:v.text,level:v.level??0});assert.deepEqual(semantic(actual),semantic(items));
 manifest.cases.push({id,kind,count:items.length,layoutId,items,fontSize:sizes[0],live:{file:liveFile,sha256:sha(bytes)},native:{file:nativeFile,sha256:sha(native)}});meta[id+'-1']={kind,count:items.length,text:'short single labels',aspect:'16:9',script:'Latin',findings:diagnostics.map(d=>d.message??d.code)};console.log(id+': live, sealed native-shape control, preview and semantic round trip');
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(out,'meta.json'),JSON.stringify(meta,null,2)+'\n');
