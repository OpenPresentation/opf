import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveSlideContext} from '../../../packages/javascript/dist/index.js';
import {composeSlide} from '../../../packages/javascript/dist/composition.js';
const root=fileURLToPath(new URL('./',import.meta.url)),scanRoot=process.argv[2],cliRoot=process.argv[3],native=process.argv[4];assert.ok(scanRoot&&cliRoot&&native);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await fs.readFile(path.join(cliRoot,'manifest.json'),'utf8')),scan=JSON.parse(await fs.readFile(path.join(scanRoot,'scan.json'),'utf8'));
assert.equal(manifest.cases.length,13);assert.equal(scan.regressions.length,0);
const copy=async(a,b)=>{await fs.mkdir(path.dirname(b),{recursive:true});await fs.copyFile(a,b);};
for(const [source,target]of [[path.join(scanRoot,'scan.json'),'bounded-scan.json'],[cliRoot+'.log','cli-export.log'],[path.join(cliRoot,'manifest.json'),'cli-manifest.json'],['C:/opf-work/lh75-bounded-scan.log','bounded-scan.log'],['C:/opf-work/lh75-focused-core.log','focused-core.log'],['C:/opf-work/lh75-focused-integration.log','focused-integration.log']])await copy(source,path.join(root,target));
const build={revision:manifest.candidate,opfVersion:'0.34.0-preparation',route:manifest.route,decks:[]};
for(const row of manifest.cases){
 const input=path.join(scanRoot,'cases',row.id+'.opf.json'),raw=await fs.readFile(input);assert.equal(hash(raw),row.inputSha256);await copy(input,path.join(root,'inputs',row.id+'.opf.json'));
 for(const label of ['before','after'])for(const ext of ['png','pptx']){const record=row[label][ext],bytes=await fs.readFile(record.file);assert.equal(hash(bytes),record.sha256);await copy(record.file,path.join(root,label,row.id+'.'+ext));await copy(record.file+'.log',path.join(root,label,row.id+'.'+ext+'.log'));}
 const match=/^(batch-\d+)-s(\d+)$/.exec(row.id);if(match)await copy('C:/opf-work/harvest/corpus/'+match[1]+'/claude/s'+match[2].padStart(2,'0')+'.png',path.join(root,'claude',row.id+'.png'));
 const deck=JSON.parse(raw),context=resolveSlideContext(deck,0,{catalogs:[]}),geometry=composeSlide(context.slide,context.options),pptx='pptx/'+row.id+'.pptx',preview='preview/'+row.id+'/slide-1.png';
 await copy(row.after.pptx.file,path.join(native,pptx));await copy(row.after.png.file,path.join(native,preview));
 build.decks.push({id:row.id,source:path.join(root,'after',row.id+'.pptx'),sourceCommit:manifest.candidate,previewOk:true,previewSlides:1,width:geometry.width,height:geometry.height,previewDirectory:'preview/'+row.id,previews:[{slide:1,path:preview,sha256:row.after.png.sha256,width:row.after.png.width,height:row.after.png.height}],variants:[{name:'default',pptx,ok:true,sha256:row.after.pptx.sha256}]});
}
const bytes=JSON.stringify(build,null,2)+'\n';await fs.writeFile(path.join(native,'build.json'),bytes);await fs.writeFile(path.join(root,'native-build.json'),bytes);
for(const deck of build.decks){assert.equal(hash(await fs.readFile(path.join(native,deck.variants[0].pptx))),deck.variants[0].sha256);assert.equal(hash(await fs.readFile(path.join(native,deck.previews[0].path))),deck.previews[0].sha256);}
console.log(JSON.stringify({cases:build.decks.length,manifestSha256:hash(bytes),canvas:build.decks.map(({id,width,height})=>({id,width,height}))}));
