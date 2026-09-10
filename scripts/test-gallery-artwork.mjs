// Source preservation and independent PNG decoding for the offline demo artwork.
// Requires the sibling renderer's development decoder, never at package runtime.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {galleryArtwork} from './gallery-artwork.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sharp=createRequire(new URL('../../opf-render/package.json',import.meta.url))('sharp');
const beforeRef='48d2b328fdeb36e52dbf5cc1c8e765a54d2e5066';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const dimensions={'brand-logo':[320,96],'brand-logo-light':[320,96],'brand-icon':[128,128],'cover-bg':[640,360],watermark:[256,256]};
const files=execFileSync('git',['ls-tree','-r','--name-only',beforeRef,'examples/gallery'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(file=>file.endsWith('.opf.json'));
const changed=[],remaining=[];
assert.equal(files.length,100);
for(const file of files){
 const old=JSON.parse(execFileSync('git',['show',`${beforeRef}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
 const bytes=await readFile(path.join(root,file)),next=JSON.parse(bytes),rest=structuredClone(next);
 if(old.assets){
  const assets=[];
  for(const [name,size]of Object.entries(dimensions)){
   const asset=next.assets[name];assert.ok(asset.src.startsWith('data:image/png;base64,'));
   assert.equal(asset.mediaType,'image/png');assert.match(asset.description,/Original abstract demonstration artwork.*MIT licensed/);
   const png=Buffer.from(asset.src.split(',')[1],'base64'),metadata=await sharp(png).metadata();
   assert.equal(metadata.format,'png');assert.deepEqual([metadata.width,metadata.height],size);assert.equal(metadata.channels,4);
   const {data,info}=await sharp(png).raw().toBuffer({resolveWithObject:true});assert.equal(info.channels,4);
   let visible=0,transparent=0;const colors=new Set();
   for(let at=0;at<data.length;at+=4){if(data[at+3]){visible++;colors.add(data.subarray(at,at+3).toString('hex'));}else transparent++;}
   assert.ok(visible>0&&colors.size>0);if(!['watermark','brand-logo-light'].includes(name))assert.ok(colors.size>1);assert.equal(transparent>0,name!=='cover-bg');
   assets.push({name,width:metadata.width,height:metadata.height,pngSha256:hash(png),pixelsSha256:hash(data),bytes:png.length,visible,transparent});
   // The complete remainder, including original alt descriptions, must be exact.
   rest.assets[name]={...rest.assets[name],src:old.assets[name].src,mediaType:old.assets[name].mediaType};delete rest.assets[name].description;
  }
  changed.push({file,beforeSha256:hash(JSON.stringify(old)),afterSha256:hash(JSON.stringify(next)),assets});
 }
 assert.deepEqual(rest,old,`${file}: change outside the five permitted asset source/type/provenance fields`);
 for(const [name,asset]of Object.entries(next.assets??{}))if(typeof asset.src==='string'&&!asset.src.startsWith('data:'))remaining.push({file,name,src:asset.src});
}
assert.equal(changed.length,80);assert.equal(remaining.length,240);
const generated=[];
for(const index of [0,1,2,3,4,5])for(const dark of [false,true]){
 const first=galleryArtwork('Original fictional demonstration',index,{dark}),second=galleryArtwork('Original fictional demonstration',index,{dark});
 assert.deepEqual(first,second);
 for(const [name,png]of Object.entries(first))generated.push({index,dark,name,sha256:hash(png)});
}
assert.notEqual(hash(galleryArtwork('A',0)['brand-logo']),hash(galleryArtwork('B',0)['brand-logo']));
const report={node:process.version,beforeRef,artworkGeneratorSha256:hash(await readFile(new URL('./gallery-artwork.mjs',import.meta.url))),verifierSha256:hash(await readFile(new URL(import.meta.url))),decoder:sharp.versions,changed,remaining,generated,scope:'All 100 source decks compared with the immutable previous checkpoint; exactly 400 asset sources/types/provenance in 80 decks changed. Original descriptions, document content, values, styles, geometry, opacity and metadata are preserved. Sharp independently decodes every PNG. Repeat generation is byte-stable for all six palettes and both watermark modes. Remaining resource references are explicit gaps, not resolved or substituted. This does not establish browser or native rendering.'};
if(process.argv[2]){const output=path.resolve(process.argv[2]);await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({decks:files.length,changed:changed.length,decodedImages:changed.length*5,remainingResourceReferences:remaining.length,generatedHash:hash(JSON.stringify(generated))}));
