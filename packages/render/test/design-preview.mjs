import assert from 'node:assert/strict';
import {renderSvg} from '../src/svg.js';
const deck={organization:{id:'acme',name:'Acme'},design:{header:{left:{text:'Confidential'},center:{section:true},right:{organization:true}},footer:{left:{slideNumber:true},center:{date:'2026-09-07'},right:{text:'Review'}}},slides:[{title:'Slide',section:'Results'}]};
const svg=renderSvg(deck,{trace:true});for(const text of ['Confidential','Results','Acme','2026-09-07','Review','design.header.left'])assert.ok(svg.includes(text),text);
const hidden=renderSvg({...deck,slides:[{title:'Slide',design:{header:false,footer:false}}]});assert.ok(!hidden.includes('Confidential'));assert.ok(!hidden.includes('Review'));
for(const angle of [0,90,180]){const svg=renderSvg({design:{background:{type:'gradient',gradient:{angle,stops:[{position:0,color:'#FF0000'},{position:1,color:'#0000FF'}]},opacity:.4}},slides:[{title:'Gradient'}]});assert.match(svg,/opacity="0.4"/);assert.ok(svg.includes(angle===0?'x1="0%"':angle===90?'y1="0%"':'x1="100%"'));}
for(const preset of ['pct5','ltHorz','diagStripe'])assert.match(renderSvg({design:{background:{type:'pattern',pattern:{preset}}},slides:[{}]}),/<pattern/);
const raster='data:image/png;base64,iVBORw0KGgo=';
assert.match(renderSvg({design:{background:{type:'image',image:{src:raster}},watermark:{src:raster,opacity:.12}},slides:[{}]}),/xMidYMid slice/);
console.log('Design preview: header/footer zones, inheritance suppression, angles, opacity, patterns, image background and watermark passed.');

assert.match(renderSvg({design:{titleAlignment:'right',contentAlignment:'center',contentBox:true},slides:[{title:'Right',text:'Center'}]}),/text-anchor="end"/);
