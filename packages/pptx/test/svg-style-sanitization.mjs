import assert from 'node:assert/strict';
import {prepareSvg} from '../dist/svg-image.js';
import {toPptx} from '../dist/index.js';
import {unzipSync} from 'fflate';
const encode=new TextEncoder(),decode=new TextDecoder();
const css='@import url(https://example.invalid/style.css);rect{fill:url(https://example.invalid/fill.svg#p)}';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0RkAAAAASUVORK5CYII=','base64'));
for(const body of [css,`<![CDATA[${css}]]>`]){
 const source=`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><style>${body}</style><rect width="10" height="10"/></svg>`;
 const cleaned=prepareSvg(encode.encode(source));assert.deepEqual(cleaned.removed,['external references']);
 assert.equal(decode.decode(cleaned.bytes),cleaned.text);assert.ok(!cleaned.text.includes('example.invalid'));assert.ok(!cleaned.text.includes('@import'));
 const diagnostics=[];let rasterized;
 const bytes=await toPptx({slides:[{image:{src:`data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`}}]},{svgRasterizer:async text=>{rasterized=text;return png;},onDiagnostic:d=>diagnostics.push(d)});
 const entries=unzipSync(bytes);const media=Object.keys(entries).filter(p=>p.endsWith('.svg'));
 assert.equal(media.length,1);assert.equal(decode.decode(entries[media[0]]),cleaned.text);assert.equal(rasterized,cleaned.text);
 assert.equal(diagnostics.filter(d=>d.code==='svg-sanitized').length,1);
}
const safe=encode.encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><style>rect{fill:url(#paint)}</style></svg>');
assert.strictEqual(prepareSvg(safe).bytes,safe,'safe SVG retains exact original bytes');
console.log('SVG style sanitization passed: text and CDATA cleaned in actual native media and raster input, safe bytes preserved.');
