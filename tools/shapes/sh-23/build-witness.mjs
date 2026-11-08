// Fresh production SH23 witnesses, each starting inside its currently qualified live domain.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const {toPptx}=await import(pathToFileURL(path.join(root,'packages/pptx/dist/index.js')));
const {loadFonts}=await import(pathToFileURL(path.join(root,'packages/render/dist/fonts-node.js')));
const {gallery}=await import(pathToFileURL(path.join(root,'packages/gallery/dist/index.js')));
const {evaluateLayoutDefinition,presetTextRect}=await import(pathToFileURL(path.join(root,'packages/javascript/dist/composition.js')));
const {parseLayoutDefinition}=await import('./layout-xml.mjs');
const {unzipSync,strFromU8}=createRequire(path.join(root,'packages/pptx/package.json'))('fflate');
const out=process.argv[2];if(!out||fs.existsSync(out))throw Error('Supply a fresh witness output directory');
fs.mkdirSync(out,{recursive:true});
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'}),words=['Vision','Plan','Build','Ship','Learn','Grow','Scale','Serve'];
const manifest={scope:'SH23 production witnesses; parent owns PowerPoint edits and save/reopen qualification.',sources:['packages/pptx/src/smart-art-layouts.js','packages/pptx/dist/smart-art-layouts.js','packages/javascript/src/smart-art-layout.ts','tools/shapes/sh-23/layout-xml.mjs','tools/shapes/sh-23/build-witness.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')})),cases:[]};
for(const [kind,count]of [['pyramid',8],['matrix',3],['flow',7],['chevrons',7],['vertical-flow',5]]){
 const deck={$schema:'https://openpresentation.org/schema/opf/v1',name:'SH23 '+kind,language:'en-US',catalogs:{custom:{fontSchemes:{'source-sans-3':{name:'Source Sans 3',major:'Source Sans 3',minor:'Source Sans 3',type:'sans-serif'}}}},design:{dimensions:'16:9',fontScheme:'source-sans-3'},slides:[{layout:kind,title:'Editable stages',items:words.slice(0,count)}]};
 const file=kind+'.pptx',bytes=new Uint8Array(await toPptx(deck,{catalogs:[gallery],fonts,seed:2323,timestamp:'2026-11-07T00:00:00Z',zipDate:'2026-11-07T00:00:00Z'})),entries=unzipSync(bytes),slide=strFromU8(entries['ppt/slides/slide1.xml']);
 if(!slide.includes('drawingml/2006/diagram'))throw Error(kind+': current source did not export live SmartArt');
 const layout=Object.keys(entries).find(n=>/^ppt\/diagrams\/layout\d+\.xml$/.test(n));if(!layout)throw Error('Expected OPF own layout');
 const definition=parseLayoutDefinition(strFromU8(entries[layout]));
 const [x,y,width,height]=/<p:xfrm><a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(slide).slice(1).map(n=>Number(n)/9525),frame={x,y,width,height};
 const geometry=n=>evaluateLayoutDefinition(definition,frame,n).filter(s=>!s.hidden).map(s=>({left:s.box.x*.75,top:s.box.y*.75,width:s.box.width*.75,height:s.box.height*.75,rotation:s.rotation??0,arrow:s.preset==='rightArrow'}));
 const data=strFromU8(entries['ppt/diagrams/data1.xml']),paragraphAlignment=/<a:pPr[^>]*\balgn="([^"]+)"/.exec(data)?.[1],sizes=[...new Set([...data.matchAll(/<a:rPr[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];
 if(sizes.length!==1||!['l','ctr','r'].includes(paragraphAlignment))throw Error('Expected one fixed node size and paragraph alignment');
 const text9=evaluateLayoutDefinition(definition,frame,9).filter(s=>!s.hidden&&s.presents?.type==='node').map(s=>{const box=s.textOnly?s.box:presetTextRect(s.preset,s.box,s.adjust[0]),m=s.margins??[0,0,0,0];return{left:box.x*.75+m[0]*sizes[0],right:(box.x+box.width)*.75-m[2]*sizes[0]};});
 fs.writeFileSync(path.join(out,kind+'.opf.json'),JSON.stringify(deck,null,2));fs.writeFileSync(path.join(out,file),bytes);
 manifest.cases.push({kind,file,sha256:createHash('sha256').update(bytes).digest('hex'),initialCount:count,initialTexts:words.slice(0,count),fontSize:sizes[0],paragraphAlignment,text9,layoutId:definition.uniqueId,frame,geometry8:geometry(8),geometry9:geometry(9)});
 console.log(kind,count,'live; expected9 shapes',geometry(9).length);
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
