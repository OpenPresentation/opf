import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {toPdf} from '../dist/index.js';
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">${body}</svg>`;
const text=(attrs='',body='Offset')=>`<text x="10" y="50" font-family="Roboto" font-size="20"${attrs}>${body}</text>`;
const ordinary=await toPdf(svg(text()),{compress:false,strict:true});
assert.equal(createHash('sha256').update(ordinary).digest('hex'),'1444c8fe65d4e4980b03ae839f5cadfcd354f8f67a74e96dca4e4320520fcc34','ordinary actual PDF bytes stay unchanged');
for(const attrs of [' dx="0" dy="0"',' dx="0 0px -0.0" dy="0%,+0e3"'])assert.deepEqual(await toPdf(svg(text(attrs)),{compress:false,strict:true}),ordinary,'valid zero positioning lists are no-ops');
for(const body of [
 text(' dx="80" dy="30"'),
 text(' dx="50%"'),
 text('', '<tspan><tspan dy="-25%">Offset</tspan></tspan>'),
 text('', '<tspan dx="80" dy="30">Offset</tspan>'),
 text('', '<tspan><tspan dx="1 2 3">Offset</tspan></tspan>'),
 text(' text-anchor="middle" textLength="100" lengthAdjust="spacingAndGlyphs"', '<tspan dy="12">Offset</tspan>'),
 text(' direction="rtl"', '<tspan dx="10">Offset</tspan>'),
 text(' dx="bad"'),text(' dy="1e999"'),text(' dx="0,,0"'),
]) {
 const diagnostics=[];
 const bytes=await toPdf(svg(body),{compress:false,onDiagnostic:d=>diagnostics.push(d)});
 assert.ok(bytes.length>0,'non-strict existing export returns bytes with an explicit limitation');
 assert.ok(diagnostics.some(d=>d.code==='pdf-unsupported-feature'&&['dx','dy'].includes(d.attribute)&&/relative text positioning/.test(d.message)));
 await assert.rejects(()=>toPdf(svg(body),{strict:true}),error=>error.code==='pdf-unsupported-feature'&&['dx','dy'].includes(error.details.attribute));
}
console.log('Vector PDF relative text positions report/refuse explicitly; nested/list/anchor/textLength/RTL and exact no-op bytes pass.');
