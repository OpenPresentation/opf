import assert from 'node:assert/strict';
import {renderSvg} from '../src/svg.js';
const deck={organization:{id:'acme',name:'Acme'},design:{header:{left:{text:'Confidential'},center:{section:true},right:{organization:true}},footer:{left:{slideNumber:true},center:{date:'2026-09-07'},right:{text:'Review'}}},slides:[{title:'Slide',section:'Results'}]};
const svg=renderSvg(deck,{trace:true});for(const text of ['Confidential','Results','Acme','2026-09-07','Review','design.header.left'])assert.ok(svg.includes(text),text);
const hidden=renderSvg({...deck,slides:[{title:'Slide',design:{header:false,footer:false}}]});assert.ok(!hidden.includes('Confidential'));assert.ok(!hidden.includes('Review'));
for(const angle of [0,90,180]){const svg=renderSvg({design:{background:{type:'gradient',gradient:{angle,stops:[{position:0,color:'#FF0000'},{position:1,color:'#0000FF'}]},opacity:.4}},slides:[{title:'Gradient'}]});assert.match(svg,/opacity="0.4"/);assert.ok(svg.includes(angle===0?'x1="0%"':angle===90?'y1="0%"':'x1="100%"'));}
for(const preset of ['pct5','ltHorz','diagStripe','wdUpDiag','openDmnd','wave']){
 const diagnostics=[],svg=renderSvg({design:{background:{type:'pattern',pattern:{preset,foregroundColor:'#123456'}}},slides:[{}]},{onDiagnostic:d=>diagnostics.push(d)});
 assert.match(svg,/<pattern[^>]*>[^]*#123456[^]*<\/pattern>/,preset);assert.deepEqual(diagnostics,[],preset);
}
const stripe=preset=>renderSvg({design:{background:{type:'pattern',pattern:{preset}}},slides:[{}]}).match(/<pattern[^]*<\/pattern>/)[0];
assert.equal(stripe('wdUpDiag'),stripe('diagStripe'),'PPTX export writes diagStripe as wdUpDiag; the preview draws both alike');
const unknown=[];renderSvg({design:{background:{type:'pattern',pattern:{preset:'engineDots'}}},slides:[{}]},{onDiagnostic:d=>unknown.push(d.code)});assert.deepEqual(unknown,['unsupported-pattern']);
const raster='data:image/png;base64,iVBORw0KGgo=';
assert.match(renderSvg({design:{background:{type:'image',image:{src:raster}},watermark:{src:raster,opacity:.12}},slides:[{}]}),/xMidYMid slice/);
console.log('Design preview: header/footer zones, inheritance suppression, angles, opacity, patterns, image background and watermark passed.');

assert.match(renderSvg({design:{titleAlignment:'right',contentAlignment:'center',contentBox:true},slides:[{title:'Right',text:'Center'}]}),/text-anchor="end"/);

// Titles follow design.titleAlignment only (unset: left, as core composition
// places them); subtitle, tag and body text follow contentAlignment. Default
// estimated measurement and accepted outline placement must agree.
{
  const {prepareNodeFonts}=await import('../src/fonts-node.js');
  const {options:measured}=await prepareNodeFonts();
  const anchors=svg=>Object.fromEntries([...svg.matchAll(/<text\b[^>]*>/g)].map(m=>m[0]).filter(tag=>/data-opf-path="slides\.0\.(title|subtitle|tag|text)"/.test(tag)).map(tag=>[tag.match(/data-opf-path="slides\.0\.(\w+)"/)[1],tag.match(/text-anchor="(\w+)"/)?.[1]??'start']));
  const slide={tag:'Tag',title:'Title',subtitle:'Subtitle',text:'Body'};
  for(const options of [{},measured]){
    assert.deepEqual(anchors(renderSvg({design:{fontScheme:'roboto',contentAlignment:'center'},slides:[slide]},{...options,trace:true})),{tag:'middle',title:'start',subtitle:'middle',text:'middle'});
    assert.deepEqual(anchors(renderSvg({design:{fontScheme:'roboto',contentAlignment:'right',titleAlignment:'center'},slides:[{...slide,design:{titleAlignment:'right',contentAlignment:'left'}}]},{...options,trace:true})),{tag:'start',title:'end',subtitle:'start',text:'start'});
  }
  console.log('Design preview alignment: titles use titleAlignment (default left) and headings/body use contentAlignment with estimated and outline measurement.');
}