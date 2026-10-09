import assert from 'node:assert/strict';
import {renderSlideSvg} from '../src/svg.js';
// The alignment decks below name the gallery's roboto font scheme, so they pass the host catalog (core Catalog[]) explicitly.
import {defaultCatalog} from '@openpresentation/opf/catalog';
const catalogs=[defaultCatalog];
const deck={organization:{id:'acme',name:'Acme'},design:{header:{left:{text:'Confidential'},center:{text:'{{slide.section}}'},right:{text:'{{organization.name}}'}},footer:{left:{text:'{{slide.number}}'},center:{date:'2026-09-07'},right:{text:'Review'}}},slides:[{title:'Slide',section:'Results'}]};
const svg=renderSlideSvg(deck, 0,{trace:true});for(const text of ['Confidential','Results','Acme','2026-09-07','Review','design.header.left'])assert.ok(svg.includes(text),text);
const hidden=renderSlideSvg({...deck,slides:[{title:'Slide',design:{header:false,footer:false}}]}, 0);assert.ok(!hidden.includes('Confidential'));assert.ok(!hidden.includes('Review'));
for(const angle of [0,90,180]){const svg=renderSlideSvg({design:{background:{type:'gradient',gradient:{angle,stops:[{position:0,color:'#FF0000'},{position:1,color:'#0000FF'}]},opacity:.4}},slides:[{title:'Gradient'}]}, 0);assert.match(svg,/opacity="0.4"/);assert.ok(svg.includes(angle===0?'x1="0%"':angle===90?'y1="0%"':'x1="100%"'));}
for(const preset of ['pct5','ltHorz','diagStripe','wdUpDiag','openDmnd','wave']){
 const diagnostics=[],svg=renderSlideSvg({design:{background:{type:'pattern',pattern:{preset,foregroundColor:'#123456'}}},slides:[{}]}, 0,{onDiagnostic:d=>diagnostics.push(d)});
 assert.match(svg,/<pattern[^>]*>[^]*#123456[^]*<\/pattern>/,preset);assert.deepEqual(diagnostics,[],preset);
}
const stripe=preset=>renderSlideSvg({design:{background:{type:'pattern',pattern:{preset}}},slides:[{}]}, 0).match(/<pattern[^]*<\/pattern>/)[0];
assert.equal(stripe('wdUpDiag'),stripe('diagStripe'),'PPTX export writes diagStripe as wdUpDiag; the preview draws both alike');
const unknown=[];renderSlideSvg({design:{background:{type:'pattern',pattern:{preset:'engineDots'}}},slides:[{}]}, 0,{onDiagnostic:d=>unknown.push(d.code)});assert.deepEqual(unknown,['unsupported-pattern']);
const raster='data:image/png;base64,iVBORw0KGgo=';
assert.match(renderSlideSvg({design:{background:{type:'image',src:raster},watermark:{src:raster,opacity:.12}},slides:[{}]}, 0),/xMidYMid slice/);
console.log('Design preview: header/footer zones, inheritance suppression, angles, opacity, patterns, image background and watermark passed.');

assert.match(renderSlideSvg({design:{titleAlignment:'right',contentAlignment:'center',contentBox:true},slides:[{title:'Right',text:'Center'}]}, 0),/text-anchor="end"/);

// Titles follow design.titleAlignment only (unset: left, as core composition
// places them); subtitle, tag and body text follow contentAlignment. Default
// estimated measurement and accepted outline placement must agree.
{
  const {loadFonts}=await import('../src/fonts-node.js');
  const prepared = await loadFonts();
  const anchors=svg=>Object.fromEntries([...svg.matchAll(/<text\b[^>]*>/g)].map(m=>m[0]).filter(tag=>/data-opf-path="slides\.0\.(title|subtitle|tag|text)"/.test(tag)).map(tag=>[tag.match(/data-opf-path="slides\.0\.(\w+)"/)[1],tag.match(/text-anchor="(\w+)"/)?.[1]??'start']));
  const slide={tag:'Tag',title:'Title',subtitle:'Subtitle',text:'Body'};
  for(const options of [{},{fonts: prepared}]){
    assert.deepEqual(anchors(renderSlideSvg({design:{fontScheme:'roboto',contentAlignment:'center'},slides:[slide]}, 0,{...options,trace:true,catalogs})),{tag:'middle',title:'start',subtitle:'middle',text:'middle'});
    assert.deepEqual(anchors(renderSlideSvg({design:{fontScheme:'roboto',contentAlignment:'right',titleAlignment:'center'},slides:[{...slide,design:{titleAlignment:'right',contentAlignment:'left'}}]}, 0,{...options,trace:true,catalogs})),{tag:'start',title:'end',subtitle:'start',text:'start'});
  }
  console.log('Design preview alignment: titles use titleAlignment (default left) and headings/body use contentAlignment with estimated and outline measurement.');
}