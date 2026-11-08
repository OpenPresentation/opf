import fs from 'node:fs';import {createRequire} from 'node:module';
const sharp=createRequire('C:/opf-work/release-033-final/packages/render/package.json')('sharp');
const root='C:/opf-work/release-033-artifacts/extras';
const build=JSON.parse(fs.readFileSync(`${root}/build.json`));
const layers=[],index=[];let n=0;
for(const deck of build.decks)for(let s=1;s<=deck.previewSlides;s++){
 const preview=`${root}/preview/${deck.id}/slide-${s}.png`,native=`${root}/powerpoint/${deck.id}/slide-${s}.png`;
 const meta=await sharp(preview).metadata();
 const a=await sharp(preview).flatten({background:'#fff'}).resize(320,180,{fit:'contain',background:'#fff'}).png().toBuffer();
 const normalized=await sharp(native).resize(meta.width,meta.height,{fit:'fill'}).png().toBuffer();
 const b=await sharp(normalized).flatten({background:'#fff'}).resize(320,180,{fit:'contain',background:'#fff'}).png().toBuffer();
 const x=n%3*640,y=Math.floor(n/3)*205;
 const label=Buffer.from(`<svg width="640" height="25"><rect width="640" height="25" fill="white"/><text x="4" y="18" font-size="14">${deck.id} ${s}: preview | native aspect restored</text></svg>`);
 layers.push({input:label,left:x,top:y},{input:a,left:x,top:y+25},{input:b,left:x+320,top:y+25});index.push({deck:deck.id,slide:s,previewSize:[meta.width,meta.height],nativeExportSize:[1280,720]});n++;
}
await sharp({create:{width:1920,height:Math.ceil(n/3)*205,channels:3,background:'#999'}}).composite(layers).png().toFile(`${root}/review-normalized.png`);
fs.writeFileSync(`${root}/review-normalized-index.json`,JSON.stringify(index,null,2)+'\n');console.log(`${n} preview/native pairs (native restored to authored aspect ratio; no content edits)`);
