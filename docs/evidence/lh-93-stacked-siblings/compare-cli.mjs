// Qualify the shipped route. Preserve the first API seal and export into a fresh CLI directory.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../../',import.meta.url)),evidence=fileURLToPath(new URL('./',import.meta.url)),out=process.argv[2];assert.ok(out,'fresh output directory required');await fs.mkdir(out);
const source=path.join(evidence,'witness.opf.json'),cli=path.join(root,'packages/cli/dist/index.js');
const invoke=args=>execFileSync(process.execPath,[cli,'convert',source,...args,'--date','2026-11-08'],{cwd:root,encoding:'utf8'});
await fs.writeFile(path.join(out,'pptx-report.log'),invoke([path.join(out,'witness.pptx')]));await fs.writeFile(path.join(out,'png-report.log'),invoke([path.join(out,'slide-{n}.png'),'--scale','0.5']));
const load=relative=>import(pathToFileURL(path.join(root,relative)).href);
const[{loadFonts},{gallery},{toPptx},{unzipSync}]=await Promise.all(['packages/render/dist/fonts-node.js','packages/gallery/dist/index.js','packages/pptx/dist/index.js','packages/pptx/node_modules/fflate/esm/index.mjs'].map(load));
const deck=JSON.parse(await fs.readFile(source,'utf8')),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:deck}),api=await toPptx(deck,{fonts,catalogs:[gallery],date:'2026-11-08'}),bytes=await fs.readFile(path.join(out,'witness.pptx')),initial=await fs.readFile(path.join(evidence,'after.pptx')),hash=x=>createHash('sha256').update(x).digest('hex');
assert.ok(Buffer.from(api).equals(bytes),'API with the same prepared font plan/default options must match CLI bytes');
const a=unzipSync(initial),b=unzipSync(bytes),parts=Object.keys({...a,...b}),changedParts=parts.filter(name=>!a[name]||!b[name]||!Buffer.from(a[name]).equals(Buffer.from(b[name])));
assert.ok(!changedParts.some(name=>/^ppt\/(?:slides\/slide\d+|charts\/chart\d+)\.xml$/.test(name)),'all slide and native chart drawing XML unchanged from the initial API seal');
const initialPreviews=JSON.parse(await fs.readFile(path.join(evidence,'after-manifest.json'),'utf8'));
const previews=[];for(let i=1;i<=7;i++){const name='slide-'+i+'.png',png=await fs.readFile(path.join(out,name));const row={slide:i,sha256:hash(png),initialSha256:initialPreviews.files[name],width:png.readUInt32BE(16),height:png.readUInt32BE(20)};assert.equal(row.sha256,row.initialSha256,'preview drawing unchanged');previews.push(row);}
const report={sourceCommit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),route:'node packages/cli/dist/index.js convert witness.opf.json <output> --date 2026-11-08; PNG --scale0.5',initialApiSha256:hash(initial),cliSha256:hash(bytes),defaultPreparedApiSha256:hash(api),defaultPreparedApiByteIdentical:true,initialSlideAndChartXmlIdentical:true,reason:'Initial API seal used explicit seed93, timestamp/zipDate2026-11-08 and no date option. The CLI uses shipped deterministic defaults plus --date2026-11-08; seal actual CLI archive rather than normalize its differing packaging/master/workbook parts.',changedInitialParts:changedParts,previews};
await fs.writeFile(path.join(out,'comparison.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cliSha256:report.cliSha256,defaultPreparedApiByteIdentical:true,previews:previews.length}));
