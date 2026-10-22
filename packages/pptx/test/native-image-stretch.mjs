// Synthetic native Change Picture XML controls, not an Office observation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync,zipSync} from 'fflate';
import sharp from 'sharp';
import {gallery} from '@openpresentation/gallery';
import {toPptx,fromPptx} from '../dist/index.js';
const wide=await readFile(new URL('fixtures/images/wide.png',import.meta.url));
const replacement=await sharp({create:{width:1280,height:720,channels:3,background:'#336699'}}).png().toBuffer();
const uri=bytes=>`data:image/png;base64,${bytes.toString('base64')}`;
const deck={design:{fontScheme:'roboto',dimensions:{widthInches:13.333333,heightInches:7.5}},slides:[{layout:'image-beside',title:'Picture region',blocks:[{text:'Native picture notes.'},{image:{src:uri(wide),alt:'Packet local picture'}}]}]};
const options={catalogs:[gallery],seed:1,timestamp:'2026-01-01T00:00:00Z'};
const decode=bytes=>new TextDecoder().decode(bytes),encode=text=>new TextEncoder().encode(text);
const imageOf=doc=>doc.slides[0].blocks.find(block=>block.image!==undefined);
const original=await toPptx(deck,options),parts=unzipSync(original);
assert.deepEqual(await fromPptx(original,options),deck,'Unchanged source with absent fit round-trips literally');
function nativeReplacement({crop='',fillRect='',tile=false,emptyStretch=false,bytes=replacement}={}) {
 const changed={...parts};
 const rels=decode(parts['ppt/slides/_rels/slide1.xml.rels']);
 const target=rels.match(/Type="[^"]*\/image" Target="([^\"]+)"/)[1];
 changed['ppt/'+target.replace(/^\.\.\//,'')]=bytes;
 let slide=decode(parts['ppt/slides/slide1.xml']);
 slide=slide.replace(/<p:pic>[\s\S]*?<\/p:pic>/,picture=>picture.replace(/ descr="[^"]*"/,'').replace(/<a:srcRect\b[^>]*\/>/g,'').replace(/<a:stretch>[\s\S]*?<\/a:stretch>/,`${crop}${tile?'<a:tile/>':emptyStretch?'<a:stretch/>':`<a:stretch><a:fillRect ${fillRect}/></a:stretch>`}`));
 changed['ppt/slides/slide1.xml']=encode(slide);return zipSync(changed);
}
const replaced=nativeReplacement({crop:'<a:srcRect/>',emptyStretch:true}),findings=[];
const imported=await fromPptx(replaced,{...options,onDiagnostic:d=>findings.push(d)}),image=imageOf(imported);
assert.equal(image.fit,'stretch','Aspect-changing full-source native empty stretch is represented');
assert.equal(imageOf(await fromPptx(nativeReplacement(),options)).fit,'stretch','An explicit empty fillRect is also a full-source stretch');
assert.equal(image.image.src,uri(replacement),'Replacement bytes stay authoritative');
assert.equal(image.image.alt,undefined,'PowerPoint-cleared alt does not resurrect');
assert.equal(imported.slides[0].layout,'image-beside');
assert.equal(imported.slides[0].blocks[0].text,'Native picture notes.');
assert.ok(!findings.some(d=>d.code==='unsupported-image-crop'));
const reexport=unzipSync(await toPptx(imported,options)),picture=decode(reexport['ppt/slides/slide1.xml']).match(/<p:pic>[\s\S]*?<\/p:pic>/)[0];
assert.ok(!/<a:srcRect\b[^>]*(?:[lrtb]="(?!0")[^\"]+")/.test(picture),'Reexport does not crop the full source');
assert.match(picture,/<p:ph[^>]*type="pic"[^>]*idx="500"/,'Picture remains placeholder-bound');
for(const edit of [{crop:'<a:srcRect l="1000"/>'},{fillRect:'l="1000"'},{tile:true}]) {
 const diagnostics=[];const result=await fromPptx(nativeReplacement(edit),{...options,onDiagnostic:d=>diagnostics.push(d)});
 assert.equal(imageOf(result).fit,undefined,'Crop/offset/tile does not infer stretch');
 if(edit.crop)assert.ok(diagnostics.some(d=>d.code==='unsupported-image-crop'));
 else assert.ok(diagnostics.some(d=>d.code==='unsupported-image-fit'),'Unsupported fill is diagnosed');
}
const sameAspect=await sharp({create:{width:1280,height:640,channels:3,background:'#669933'}}).png().toBuffer();
assert.equal(imageOf(await fromPptx(nativeReplacement({bytes:sameAspect}),options)).fit,undefined,'Same aspect cannot distinguish fits');
for(const fit of ['cover','contain','stretch']) {
 const authored=structuredClone(deck);authored.slides[0].blocks[1].fit=fit;
 const imported=await fromPptx(await toPptx(authored,options),options);
 assert.deepEqual(imported,authored,`Unchanged authored ${fit} provenance remains literal`);
}
const quantized=structuredClone(deck);quantized.slides[0].blocks[1].image.src=uri(await sharp({create:{width:1279,height:640,channels:3,background:'#996633'}}).png().toBuffer());
assert.deepEqual(await fromPptx(await toPptx(quantized,options),options),quantized,'Serialized same-aspect EMU rounding does not invent stretch');
const inherited=structuredClone(deck);inherited.design.imageFit='stretch';
assert.deepEqual(await fromPptx(await toPptx(inherited,options),options),inherited,'Unchanged inherited stretch does not acquire a redundant own fit');
const scalar=structuredClone(deck);scalar.design.imageFit='contain';scalar.slides[0].text='Scalar native body';scalar.slides[0].image=scalar.slides[0].blocks[1].image;delete scalar.slides[0].blocks;
const scalarArchive=unzipSync(await toPptx(scalar,options));
const scalarRels=decode(scalarArchive['ppt/slides/_rels/slide1.xml.rels']);
const scalarTarget=scalarRels.match(/Type="[^"]*\/image" Target="([^\"]+)"/)[1];
scalarArchive['ppt/'+scalarTarget.replace(/^\.\.\//,'')]=replacement;
scalarArchive['ppt/slides/slide1.xml']=encode(decode(scalarArchive['ppt/slides/slide1.xml']).replace(/<a:srcRect\b[^>]*\/>/g,''));
const scalarDiagnostics=[],scalarImported=await fromPptx(zipSync(scalarArchive),{...options,onDiagnostic:d=>scalarDiagnostics.push(d)});
assert.equal(scalarImported.slides[0].image,undefined,'Scalar alias gives way to representable image block');
assert.equal(imageOf(scalarImported).fit,'stretch');assert.equal(imageOf(scalarImported).image.src,uri(replacement));
assert.equal(scalarImported.slides[0].text??scalarImported.slides[0].blocks.find(block=>block.text!==undefined)?.text,'Scalar native body');assert.equal(scalarImported.slides[0].title,'Picture region');
assert.ok(scalarDiagnostics.some(d=>d.code==='invalid-document-provenance'&&d.path==='slides.0.content'),'Unrepresentable scalar source reconstruction falls back to the native image block');
const grouped=structuredClone(inherited);grouped.slides[0].blocks=[{type:'group',blocks:grouped.slides[0].blocks}];
assert.deepEqual(await fromPptx(await toPptx(grouped,options),options),grouped,'Restored group paths retain inherited stretch without own overrides');
console.log('Native stretch controls: synthetic replacement, same-aspect ambiguity, crop/offset/tile refusals and unchanged own/inherited fits passed.');
