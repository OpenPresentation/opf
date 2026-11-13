import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[2+i*2],process.argv[3+i*2]]));
assert.ok(args['--consumer']&&args['--out'],'--consumer and --out are required');
const consumer=path.resolve(args['--consumer']),out=path.resolve(args['--out']);
const expected='dde3809913e9d2e38d9c199f67ece8741426067e';
assert.equal(execFileSync('git',['-C',consumer,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),expected,'use the frozen LH-106 review head');
assert.equal(execFileSync('git',['-C',consumer,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','consumer source must be clean');
await fs.mkdir(out);
const load=rel=>import(pathToFileURL(path.join(consumer,rel)).href);
const [{toPptx},{toPng},{loadFonts},{gallery},{validate}]=await Promise.all([load('packages/pptx/dist/index.js'),load('packages/render/dist/png.js'),load('packages/render/dist/fonts-node.js'),load('packages/gallery/dist/index.js'),load('packages/javascript/dist/index.js')]);
const input=await fs.readFile(new URL('./mixed-language.opf.json',import.meta.url)),deck=JSON.parse(input);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:deck});
const findings=validate(deck,{catalogs:[gallery],fonts}).findings.filter(f=>['error','warning'].includes(f.severity));
assert.deepEqual(findings,[],'source validates without warnings');
const manifest={schema:'opf-mixed-language-native/v1',consumerCommit:expected,inputSha256:hash(input),sourceFiles:{},artifacts:{},expectations:[{slide:1,text:'مرحبا بالعالم',language:'ar-SA'},{slide:2,text:'Hello from this English run.',nativeText:'Hello from this English run',language:'en-US'}]};
for(const rel of ['packages/pptx/src/index.js','packages/pptx/src/script-fonts.js','packages/pptx/src/body-text-import.js','packages/pptx/dist/index.js','packages/pptx/dist/script-fonts.js','packages/pptx/dist/body-text-import.js','packages/javascript/dist/composition.js'])manifest.sourceFiles[rel]=hash(await fs.readFile(path.join(consumer,rel)));
const exportDiagnostics={};
for(const bodyText of ['measured','native']){const diagnostics=[];const bytes=new Uint8Array(await toPptx(deck,{fonts,catalogs:[gallery],bodyText,onDiagnostic:d=>diagnostics.push(d)}));exportDiagnostics[bodyText]=diagnostics;const name=bodyText+'.pptx';await fs.writeFile(path.join(out,name),bytes,{flag:'wx'});manifest.artifacts[name]={sha256:hash(bytes),bytes:bytes.length,bodyText};}
for(const [index,bytes]of (await toPng(deck,{fonts,catalogs:[gallery],scale:1})).entries()){const name='preview-'+(index+1)+'.png';await fs.writeFile(path.join(out,name),bytes,{flag:'wx'});manifest.artifacts[name]={sha256:hash(bytes),bytes:bytes.length};}
const diagnosticBytes=Buffer.from(JSON.stringify(exportDiagnostics,null,2)+'\n');await fs.writeFile(path.join(out,'export-diagnostics.json'),diagnosticBytes,{flag:'wx'});manifest.artifacts['export-diagnostics.json']={sha256:hash(diagnosticBytes),bytes:diagnosticBytes.length};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(manifest,null,2));
