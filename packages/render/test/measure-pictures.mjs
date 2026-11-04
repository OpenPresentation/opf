// LH-145: measurePictures reads each picture background once and returns core's `pictureLuminance` sampler, so a dark photo under white
// text gets no scrim and a light one does, in the preview and the PPTX export alike.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {luminanceGrid} from '@openpresentation/opf/composition';
import {measurePictures,toSvg} from '../dist/index.js';
import {measurePictures as measureInBrowser} from '../dist/svg.js';

const W=320,H=180;
const picture=async paint=>{
  const raw=Buffer.alloc(W*H*3);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)raw.set(paint(x,y),(y*W+x)*3);
  return `data:image/png;base64,${(await sharp(raw,{raw:{width:W,height:H,channels:3}}).png().toBuffer()).toString('base64')}`;
};
const dark=await picture(()=>[18,24,40]),light=await picture(()=>[232,232,224]);
const half=await picture(x=>x<W/2?[10,10,10]:[245,245,245]);
const deckOf=(src,variant='dark1',extra={})=>({design:{fontScheme:'roboto'},...extra,slides:[{title:'A cover over a photo',subtitle:'Subtitle',design:{variant,background:{type:'image',src}}}]});
const scrims=svg=>(svg.match(/<linearGradient\b/g)??[]).length;
const gray=grid=>[...grid.values];

// A dark photo under light text needs no scrim; a light one does; the worst case (no sampler) always draws one.
{
  const sampler=await measurePictures(deckOf(dark));
  assert.equal(typeof sampler,'function');
  assert.deepEqual([...sampler.sources],[dark]);
  assert.equal(sampler.measured,1);
  assert.equal(sampler(dark).columns,32);assert.equal(sampler(dark).rows,18);
  assert.ok(Math.max(...sampler(dark).high)<0.02,'the dark photo is dark');
  assert.equal(sampler('data:image/png;base64,AAAA'),undefined,'an unmeasured source answers undefined');
  assert.ok(scrims(toSvg(deckOf(dark),1))>0,'worst case draws a scrim');
  assert.equal(scrims(toSvg(deckOf(dark),1,{pictureLuminance:sampler})),0,'dark photo, light text: no scrim');
  const lightSampler=await measurePictures(deckOf(light));
  assert.ok(scrims(toSvg(deckOf(light),1,{pictureLuminance:lightSampler}))>0,'light photo, light text: a scrim');
  assert.equal(scrims(toSvg(deckOf(light,'light1'),1,{pictureLuminance:lightSampler})),0,'light photo, dark text: no scrim');
}

// The grid is core's luminanceGrid of the decoded pixels: a picture half dark and half light keeps both ends.
{
  const sampler=await measurePictures(deckOf(half));
  const grid=sampler(half),first=grid.values[0],last=grid.values[grid.columns-1];
  assert.ok(first<0.01&&last>0.85,'left dark, right light');
  const raw=await sharp(Buffer.from(half.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const reference=luminanceGrid(raw.data,raw.info.width,raw.info.height);
  assert.deepEqual(gray(grid),gray(reference),'the same grid core builds from the pixels');
}

// Sources: deck and theme backgrounds, asset references (followed through deck.assets) and the host resolver; each picture decoded once.
{
  let decodes=0;
  const decode=async(bytes,type,limits)=>{decodes++;const {data,info}=await sharp(bytes).resize({width:limits.maxSide,withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {width:info.width,height:info.height,data,channels:4};};
  const asset=await measurePictures({design:{background:'asset:night'},assets:{night:{src:dark,alt:'Night'}},slides:[{title:'A'},{title:'B',design:{background:{type:'image',src:'asset:night'}}}]},{decode});
  assert.equal(asset.measured,1);assert.deepEqual([...asset.sources],['asset:night']);assert.ok(asset('asset:night'));
  assert.equal(decodes,1,'one decode for one picture');
  // The resolver turns a path (it returns the same bytes each time, which is what the cache keys on) into bytes, as the CLI's does for a local file; the cache keeps the work between calls.
  const png=new Uint8Array(Buffer.from(light.split(',')[1],'base64'));
  const resolved=[],cache=new Map();
  const options={decode,cache,imageResolver:(src,context)=>{resolved.push([src,context.path]);return src==='photo.png'?{data:png,mediaType:'image/png'}:null;}};
  const deck={slides:[{title:'A',design:{background:{type:'image',src:'photo.png'}}}]};
  const first=await measurePictures(deck,options);
  assert.ok(first('photo.png'));assert.deepEqual(resolved[0],['photo.png','slides.0.design.background']);
  const again=await measurePictures(deck,options);
  assert.equal(again('photo.png'),first('photo.png'),'the cache returns the same grid');
  assert.equal(decodes,2,'decoded once across both calls');
  // A resolver that is async and returns a data URI works too.
  const viaData=await measurePictures(deck,{decode,imageResolver:async()=>dark});
  assert.ok(viaData('photo.png'));
}

// Nothing unread is fetched, and a picture that cannot be decoded is reported and left unmeasured (its scrim keeps the worst case).
{
  const calls=[];
  const remote=await measurePictures(deckOf('https://example.com/photo.jpg'),{fetch:async url=>{calls.push(url);return {ok:true,arrayBuffer:async()=>Buffer.from(dark.split(',')[1],'base64'),headers:{get:()=>'image/png'}};}});
  assert.equal(remote.measured,1);assert.deepEqual(calls,['https://example.com/photo.jpg']);
  const unfetched=await measurePictures(deckOf('https://example.com/photo.jpg'));
  assert.equal(unfetched.measured,0,'without fetch a remote address is never read');
  const diagnostics=[];
  const broken=await measurePictures(deckOf('data:image/png;base64,AAAAAAAA'),{onDiagnostic:d=>diagnostics.push(d)});
  assert.equal(broken.measured,0);
  assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].code,'picture-not-measured');assert.equal(diagnostics[0].path,'slides.0.design.background');
  assert.ok(scrims(toSvg(deckOf(dark),1,{pictureLuminance:broken}))>0,'an unmeasured picture keeps the worst-case scrim');
  // A deck with no picture background measures nothing; a JSON string is read as a deck.
  assert.equal((await measurePictures({slides:[{title:'Plain'}]})).measured,0);
  assert.equal((await measurePictures(JSON.stringify(deckOf(dark)))).measured,1);
  await assert.rejects(measurePictures(42),TypeError);
}

// A recolored picture is not the one measured: core keeps its worst case even with a sampler.
{
  const deck=deckOf(dark);deck.slides[0].design.background.recolor='grayscale';
  assert.ok(scrims(toSvg(deck,1,{pictureLuminance:await measurePictures(deck)}))>0);
}

// The browser entry exports the same function (its default decoder is the canvas; here, with no canvas, a host decoder is needed).
assert.equal(typeof measureInBrowser,'function');
const noCanvas=[];
assert.equal((await measureInBrowser(deckOf(dark),{onDiagnostic:d=>noCanvas.push(d)})).measured,0);
assert.match(noCanvas[0].message,/pass options\.decode/);
console.log('measurePictures: dark, light and mixed pictures, assets, resolver, cache, fetch and failures checked.');
