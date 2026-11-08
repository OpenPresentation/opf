import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='C:/opf-work/release-033-final';
const out='C:/opf-work/release-033-artifacts/pyramid-check';
for(const folder of ['pptx','preview','sources'])fs.mkdirSync(`${out}/${folder}`,{recursive:true});
const files=execFileSync('git',['ls-files','examples'],{cwd:root,encoding:'utf8'}).trim().split('\n');
const cases=[['layout-sampler','31']];
const sha=b=>createHash('sha256').update(b).digest('hex');
const decks=[];
function convert(args){return JSON.parse(execFileSync(process.execPath,[`${root}/packages/cli/dist/index.js`,'convert',...args,'--force'],{cwd:root,encoding:'utf8',maxBuffer:64<<20}));}
function build(id,source,slides){
 const originalSource=source; const flags=[];
 const assetDir=path.dirname(source); if(slides){const doc=JSON.parse(fs.readFileSync(source));doc.slides=slides.split(",").map(n=>doc.slides[Number(n)-1]);source=`${out}/sources/${id}.opf.json`;fs.writeFileSync(source,JSON.stringify(doc,null,2)+"\n");}
 fs.mkdirSync(`${out}/preview/${id}`,{recursive:true});
 for(const name of fs.readdirSync(`${out}/preview/${id}`))if(name.endsWith(".png"))fs.unlinkSync(`${out}/preview/${id}/${name}`);
 const preview=convert([source,`${out}/preview/${id}/slide-{n}.png`,'--scale','1','--asset-dir',assetDir,...flags]);
 const pptx=convert([source,`${out}/pptx/${id}.pptx`,'--asset-dir',assetDir,...flags]);
 const names=fs.readdirSync(`${out}/preview/${id}`).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
 for(let n=0;n<names.length;n++){const name=names[n],temp=`${out}/preview/${id}/temp-${n+1}.png`;fs.renameSync(`${out}/preview/${id}/${name}`,temp);}
 for(let n=0;n<names.length;n++)fs.renameSync(`${out}/preview/${id}/temp-${n+1}.png`,`${out}/preview/${id}/slide-${n+1}.png`);
 decks.push({id,source,selectedSourceSlides:slides,sourceSha256:sha(fs.readFileSync(source)),previewOk:true,previewSlides:names.length,previewFindings:preview.findings,variants:[{name:'default',flags,pptx:`pptx/${id}.pptx`,ok:true,sha256:sha(fs.readFileSync(`${out}/pptx/${id}.pptx`)),findings:pptx.findings}]});
 console.log(`${id}: ${names.length} preview slides, PPTX ok`);
}
for(const [id,slides] of cases){const rel=files.find(p=>p.endsWith(`/${id}.opf.json`));if(!rel)throw Error(id);build(id,`${root}/${rel}`,slides);}
fs.writeFileSync(`${out}/build.json`,JSON.stringify({manifestVersion:1,revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),opfVersion:'0.32.1',node:process.version,builtAt:new Date().toISOString(),decks},null,2)+'\n');