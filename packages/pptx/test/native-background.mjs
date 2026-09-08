import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {renderSvg,svgToPng} from '@openpresentation/opf-render';
import {validatePresentation} from '@openpresentation/opf';
const {toPptx,fromPptx}=await import(process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js');
const root=new URL('fixtures/native-backgrounds/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const nativeBytes=await readFile(new URL(manifest.nativePptx.file,root));
assert.equal(hash(nativeBytes),manifest.nativePptx.sha256);
const diagnostics=[],nativeDoc=await fromPptx(nativeBytes,{onDiagnostic:d=>diagnostics.push(d)});
assert.deepEqual(diagnostics,[],'Keynote-generated linear fills are representable');
assert.equal(validatePresentation(nativeDoc).valid,true);
assert.equal(nativeDoc.slides.length,6);
assert.ok(nativeDoc.slides.every(slide=>!slide.title&&!slide.blocks),'Do not invent content on native background-only slides');
const raw=bytes=>sharp(bytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
let cases=0,observedRgbMax=0,observedAlphaMax=0,observedOpaqueMean=0;
for(const group of manifest.groups) {
 const source=JSON.parse(await readFile(new URL(group.source,root)));
 const restored=await fromPptx(await toPptx(source));
 assert.ok(restored.slides.every(slide=>!slide.title&&!slide.blocks),'Blank slides remain blank after this exporter round-trips');
 for(let i=0;i<group.pngs.length;i++) {
  const fixture=group.pngs[i],bytes=await readFile(new URL(fixture.file,root));
  assert.equal(hash(bytes),fixture.sha256,'Native reference bytes must remain attributable');
  const native=await raw(bytes),dimensions={widthInches:native.info.width/96,heightInches:native.info.height/96};
  const slides=[source.slides[i]];
  if(group.name==='opaque')slides.push(nativeDoc.slides[i]);
  for(const slide of slides) {
   const svg=renderSvg({design:{dimensions},slides:[slide]});
   const reference=await raw(await svgToPng(svg,{useBundledFonts:false,background:group.transparent?'transparent':'#FFFFFF'}));
   assert.equal(reference.info.width,native.info.width);assert.equal(reference.info.height,native.info.height);
   let max=0,total=0,alphaMax=0,premultipliedMax=0,premultipliedTotal=0;
   for(let p=0;p<native.data.length;p+=4) {
    const da=Math.abs(native.data[p+3]-reference.data[p+3]);alphaMax=Math.max(alphaMax,da);total+=da;max=Math.max(max,da);
    for(let c=0;c<3;c++){
     const delta=Math.abs(native.data[p+c]-reference.data[p+c]);max=Math.max(max,delta);total+=delta;
     const premultiplied=Math.abs(native.data[p+c]*native.data[p+3]/255-reference.data[p+c]*reference.data[p+3]/255);
     premultipliedMax=Math.max(premultipliedMax,premultiplied);premultipliedTotal+=premultiplied;
    }
   }
   const mean=total/native.data.length;
   if(group.transparent){
    assert.ok(alphaMax<=1,`${fixture.file}: native alpha difference ${alphaMax}`);
    assert.ok(max<=10,`${fixture.file}: native straight-channel difference ${max}`);
    assert.ok(premultipliedMax<=5&&premultipliedTotal/(native.data.length/4*3)<=1.1,`${fixture.file}: excessive native color/alpha difference`);
   }else{
    assert.ok(max<=5&&mean<=.6,`${fixture.file}: native opaque difference max=${max}, mean=${mean}`);
    observedOpaqueMean=Math.max(observedOpaqueMean,mean);
   }
   observedRgbMax=Math.max(observedRgbMax,max);observedAlphaMax=Math.max(observedAlphaMax,alphaMax);cases++;
  }
 }
}
const blank=await fromPptx(await toPptx({slides:[{}, {notes:'Only speaker notes'}]}));
assert.equal(blank.slides[0].title,undefined);assert.equal(blank.slides[1].title,undefined);assert.equal(blank.slides[1].notes,'Only speaker notes');
console.log(`Native Keynote backgrounds passed: ${cases} PNG comparisons from 12 exported native images, native PPTX import, blank-slide preservation; observed max channel ${observedRgbMax}, alpha ${observedAlphaMax}, opaque mean ${observedOpaqueMean}.`);
