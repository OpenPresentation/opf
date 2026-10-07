import assert from 'node:assert/strict';
import {renderSvg, renderSlideSvg} from '../dist/svg.js';
import {colorContrast} from '@openpresentation/opf/composition';
const raster='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO8sAAAAASUVORK5CYII=';
let cases=0;
for(const [background,surface,text]of [['#FFFFFF','#F8FAFC','#000000'],['#000000','#334155','#FFFFFF'],['#000000','#F8FAFC','#FFFFFF'],['#FFFFFF','#0F172A','#000000']]){
 const source={design:{background,colorScheme:{id:'cool-horizon',dark1:text,light1:text,dark2:surface,light2:surface},header:{right:{image:{src:'asset:icon',alt:'Caller-specific header description'}}},watermark:{src:'asset:icon',opacity:.06}},assets:{icon:{src:'./missing.png',alt:'Original description'}},slides:[{image:{src:'asset:icon',alt:'Full content description'}}]},before=structuredClone(source),diagnostics=[];
 const svg=renderSlideSvg(source, 0,{trace:true,onDiagnostic:issue=>diagnostics.push(issue)});
 assert.deepEqual(source,before);assert.equal(diagnostics.filter(d=>d.code==='unresolved-asset').length,3);
 assert.ok(!diagnostics.some(d=>d.code==='text-overflow'),'Generated status labels must not introduce authored-content overflow');
 assert.ok(svg.includes('opacity="0.06"'),'Preserve authored watermark opacity');
 for(const description of ['Caller-specific header description','Original description','Full content description'])assert.ok(svg.includes(`aria-label="Image unavailable: ${description}"`));
 assert.ok(!/<text[^>]*>[^<]*\.\/missing\.png/.test(svg),'Do not display a raw asset path as slide copy');
 for(const [,fill]of svg.matchAll(/<text[^>]*\bfill="([^"]+)"/g))assert.ok(colorContrast(fill,surface)>=4.5,'Opaque placeholder text uses its own panel');
 assert.throws(()=>renderSlideSvg(source, 0,{strictAssets:true}),{code:'unresolved-asset'});
 cases++;
}
const tiny={design:{dimensions:{widthInches:1,heightInches:1},header:{right:{image:{src:'./missing.png',alt:'A complete long description & <not markup> '.repeat(4)}}}},slides:[{}]};
const diagnostic=[];const svg=renderSlideSvg(tiny, 0,{trace:true,onDiagnostic:issue=>diagnostic.push(issue)});
assert.equal(diagnostic[0].placeholder,'icon');assert.ok(svg.includes('A complete long description &amp; &lt;not markup&gt;'));assert.ok(!svg.includes('<text'));
assert.ok(!svg.includes('data-opf-overflow'));cases++;
const chain={assets:{one:{src:'asset:two',alt:'Alias description'},two:{src:raster,alt:'Base description'}},slides:[{image:{src:'asset:one',alt:'Caller description'}}]};
let calls=0;const resolved=renderSlideSvg(chain, 0,{strictAssets:true,imageResolver:(src,context)=>{calls++;assert.equal(src,raster);assert.equal(context.asset.alt,'Caller description');return null;},onDiagnostic:()=>assert.fail('Resolved images must not emit missing-asset diagnostics')});
assert.equal(calls,1);assert.ok(resolved.includes('aria-label="Caller description"'));assert.ok(!resolved.includes('data-opf-asset-status'));cases++;
const missing={slides:[{image:{src:'asset:absent',alt:'Requested image'}}]},missingDiagnostics=[];
renderSlideSvg(missing, 0,{onDiagnostic:issue=>missingDiagnostics.push(issue)});assert.equal(missingDiagnostics[0].reason,'missing-reference');assert.equal(missingDiagnostics[0].assetId,'absent');cases++;
assert.ok(renderSlideSvg(missing, 0,{strictAssets:true,imageResolver:()=>raster}).includes('<image'));
assert.throws(()=>renderSlideSvg({assets:{one:'asset:two',two:'asset:one'},slides:[{image:'asset:one'}]}, 0),{code:'invalid-asset-reference'});
const repeated=[];renderSvg({assets:{a:{src:'./missing.png'}},design:{header:{right:{image:'asset:a'}}},slides:[{},{}]},{onDiagnostic:issue=>repeated.push(issue)});assert.equal(repeated.filter(d=>d.code==='unresolved-asset').length,2,'Report inherited failures on every rendered slide');
const cropped={assets:{a:{src:raster}},design:{imageFill:'crop',header:{right:{image:'asset:a'}},footer:{left:{image:'asset:a'}},watermark:{src:'asset:a',opacity:.06}},slides:[{image:'asset:a'}]};
const fitted=renderSlideSvg(cropped, 0,{trace:true,strictAssets:true});
for(const [,attrs]of fitted.matchAll(/<image\b([^>]*)>/g))assert.ok(attrs.includes(attrs.includes('data-opf-path="slides.0.image"')?'preserveAspectRatio="xMidYMid slice"':'preserveAspectRatio="xMidYMid meet"'),'Crop content pictures while fitting complete header/footer/watermark artwork');
assert.equal([...fitted.matchAll(/<image\b/g)].length,4);
// FF-38: this is the placeholder contract opf-pptx exports natively (test/image-placeholder.mjs there):
// a dashed panel, centered semibold "Image unavailable" over the description (alt, else title, else
// "Image") at 20 px on a 1280x720 canvas, and the group's accessible name.
const contract=renderSvg({slides:[{image:{src:'./missing.png',alt:'Team photo'}},{image:{src:'./missing.png',title:'Only a title'}},{image:'./missing.png'}]},{trace:true}).join('\n');
const contractGroups=[...contract.matchAll(/<g\b[^>]*data-opf-asset-status="unresolved"[^>]*>[\s\S]*?<\/g>\s*<\/g>/g)].map(match=>match[0]);
assert.equal(contractGroups.length,3);
for(const [index,description]of ['Team photo','Only a title','Image'].entries()){
 const group=contractGroups[index];
 assert.ok(group.startsWith(`<g aria-label="Image unavailable: ${description}"`));
 assert.deepEqual([...group.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(match=>match[1]),['Image unavailable',description]);
 for(const [,attrs]of group.matchAll(/<text\b([^>]*)>/g))for(const expected of ['font-size="20"','font-weight="600"','text-anchor="middle"'])assert.ok(attrs.includes(expected),`Placeholder text keeps ${expected}`);
 assert.ok(group.includes('stroke-dasharray="4 3"')&&group.includes('stroke-width="1"'),'Placeholder panel keeps its 4 3 dashed 1 px border');
}
cases++;
console.log(`Image placeholders passed: ${cases} source-preserving theme, bounded-label/icon, accessible-description, alias override and resolver cases; opacity preserved and asset failures explicit.`);
