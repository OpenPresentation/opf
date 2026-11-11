import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [repo,out]=process.argv.slice(2),url=relative=>pathToFileURL(path.join(repo,relative)).href;
const {toPptx}=await import(url('packages/pptx/src/index.js'));
const {gallery}=await import(url('packages/gallery/dist/index.js'));
const {unzipSync,strFromU8}=await import(url('packages/pptx/node_modules/fflate/esm/browser.js'));
const relative='examples/technical/multilingual-slides.opf.json',input=await fs.readFile(path.join(repo,relative)),deck=JSON.parse(input),image=new Uint8Array(await fs.readFile(path.join(repo,'packages/pptx/test/fixtures/images/wide.png')));
const bytes=await toPptx(structuredClone(deck),{seed:1,date:'2026-10-02',timestamp:'2026-10-02T00:00:00Z',zipDate:'2026-10-02T00:00:00Z',catalogs:[gallery],imageResolver:async()=>image});
const zip=unzipSync(bytes),app=strFromU8(zip['docProps/app.xml']),sha=b=>createHash('sha256').update(b).digest('hex');
await fs.writeFile(out+'.pptx',bytes);
const sources={};for(const file of ['pnpm-lock.yaml','package.json','packages/pptx/package.json','packages/pptx/test/notes-master-theme.mjs','packages/pptx/src/script-fonts.js','packages/pptx/src/slide-themes.js']){try{sources[file]=sha(await fs.readFile(path.join(repo,file)));}catch{sources[file]='absent';}}
const facts={runtime:{node:process.version,platform:process.platform,arch:process.arch},repo,input:relative,inputSha256:sha(input),archiveSha256:sha(bytes),themes:Object.keys(zip).filter(p=>/^ppt\/theme\/theme\d+\.xml$/.test(p)),headingThemeCount:/<vt:lpstr>Theme<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>(\d+)<\/vt:i4>/.exec(app)?.[1],parts:Object.fromEntries(Object.entries(zip).map(([p,b])=>[p,sha(b)])),sources};
await fs.writeFile(out+'.json',JSON.stringify(facts,null,2)+'\n');console.log(JSON.stringify({repo,inputSha256:facts.inputSha256,archiveSha256:facts.archiveSha256,themes:facts.themes.length,headingThemeCount:facts.headingThemeCount}));
