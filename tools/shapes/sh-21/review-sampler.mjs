// Source/record-only sampler review, using one current renderer for both revisions; never writes baselines.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../../../packages/render/package.json',import.meta.url))('sharp');
import {toSvg,toPng} from '../../../packages/render/dist/index.js';
import {loadFonts} from '../../../packages/render/dist/fonts-node.js';
import {gallery} from '../../../packages/gallery/dist/index.js';
const [beforeRef,out]=process.argv.slice(2);if(!beforeRef||!out||fs.existsSync(out))throw Error('Supply before git ref and a fresh output directory.');
const beforeBytes=execFileSync('git',['show',beforeRef+':examples/technical/layout-sampler.opf.json']),afterBytes=fs.readFileSync('examples/technical/layout-sampler.opf.json'),before=JSON.parse(beforeBytes),after=JSON.parse(afterBytes),sha=b=>createHash('sha256').update(b).digest('hex');assert.deepEqual(after.slides.slice(0,before.slides.length),before.slides);
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual'}),old=toSvg(before,{catalogs:[gallery],fonts}),next=toSvg(after,{catalogs:[gallery],fonts});fs.mkdirSync(out,{recursive:true});
const pngs=[];for(let i=0;i<next.length;i++)pngs.push(await toPng(next[i]));const oldPngs=[];for(let i=0;i<old.length;i++)oldPngs.push(old[i]===next[i]?pngs[i]:await toPng(old[i]));
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function sheet(name,slides,images,columns=4,tileWidth=360){
 const imageHeight=Math.round(tileWidth*9/16),tileHeight=imageHeight+30,width=columns*tileWidth,height=Math.ceil(slides.length/columns)*tileHeight,composites=[];
 for(let i=0;i<slides.length;i++){const left=i%columns*tileWidth,top=Math.floor(i/columns)*tileHeight;composites.push({input:await sharp(images[i]).resize(tileWidth,imageHeight).png().toBuffer(),left,top});const label='<svg xmlns="http://www.w3.org/2000/svg" width="'+tileWidth+'" height="30"><text x="6" y="21" font-size="14" font-family="Arial">'+xml(slides[i].id)+'</text></svg>';composites.push({input:Buffer.from(label),left,top:top+imageHeight});}
 const bytes=await sharp({create:{width,height,channels:4,background:'#eeeeee'}}).composite(composites).png().toBuffer();assert.ok(bytes.length>5000,'nonempty contact sheet');fs.writeFileSync(path.join(out,name),bytes);
}
await sheet('before.png',before.slides,oldPngs);await sheet('after.png',after.slides,pngs);await sheet('new-layouts.png',after.slides.slice(before.slides.length),pngs.slice(before.slides.length),2,640);
const changed=old.flatMap((svg,i)=>svg===next[i]?[]:[i]);for(const [name,slides,images] of [['changed-before.png',before.slides,oldPngs],['changed-after.png',after.slides,pngs]])await sheet(name,changed.map(i=>slides[i]),changed.map(i=>images[i]),2,640);
const report={scope:'Record/example refresh only, one current renderer for both inputs; no native/live-domain or golden claim.',beforeRef,beforeSha256:sha(beforeBytes),afterSha256:sha(afterBytes),beforeSlides:old.length,afterSlides:next.length,preservedAuthoredSlides:before.slides.length,changedExisting:old.flatMap((svg,i)=>svg===next[i]?[]:[before.slides[i].id]),added:after.slides.slice(before.slides.length).map(s=>s.id),entries:next.map((svg,i)=>({id:after.slides[i].id,svgSha256:sha(svg),pngSha256:sha(pngs[i]),sameAsBefore:i<old.length?svg===old[i]:undefined}))};fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({old:old.length,next:next.length,changedExisting:report.changedExisting,added:report.added}));
