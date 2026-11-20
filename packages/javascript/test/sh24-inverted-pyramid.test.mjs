import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pyramidNodes,pyramidSteps,nodeWidthAt} from '../dist/composition.js';
const frame={x:80,y:60,width:800,height:420};
test('inverted pyramid retains entry order from widest top to narrowest bottom',()=>{
  for(let count=1;count<=8;count++){
    const nodes=pyramidNodes(frame,count,'down');
    assert.deepEqual(nodes.map(node=>node.index),Array.from({length:count},(_,i)=>i));
    assert.equal(nodes[0].box.width,frame.width);
    for(let i=1;i<count;i++)assert.ok(nodes[i].box.width<nodes[i-1].box.width);
    assert.ok(nodes.every(node=>node.flipV===true));
    assert.ok(Math.abs(nodeWidthAt(nodes.at(-1),frame.y+frame.height))<.01);
    assert.ok(Math.abs(nodeWidthAt(nodes[0],frame.y)-frame.width)<.01);
  }
});
test('inverted stepped pyramid keeps labels beside the corresponding wide-first levels',()=>{
  const up=pyramidSteps(frame,4,12,8),down=pyramidSteps(frame,4,12,8,'down');
  assert.deepEqual(down.map(node=>node.box.width),up.map(node=>node.box.width).reverse());
  assert.ok(down.every(node=>node.beside&&node.textBox.y===node.box.y));
  assert.deepEqual(down.map(node=>node.textBox.width),up.map(node=>node.textBox.width));
  assert.deepEqual(pyramidNodes(frame,4),pyramidNodes(frame,4,'up'));
  assert.deepEqual(pyramidSteps(frame,4,12,8),pyramidSteps(frame,4,12,8,'up'));
});

import {gallery} from '@openpresentation/gallery';
import {composeSlide,layoutTemplate,smartArtUnavailable} from '../dist/composition.js';
import {validateCatalogRecord} from '../dist/index.js';
const record=gallery.layouts['inverted-pyramid'];
const published={$schema:'https://openpresentation.org/schema/opf-layout/v2',id:'inverted-pyramid',...record};
test('the inverted pyramid is one arrangement value; 0.34 pyramidDirection fails the schema',()=>{
  assert.ok(record);
  assert.equal(validateCatalogRecord('layouts',published).valid,true);
  assert.equal(layoutTemplate(record).regions.find(r=>r.name==='body').arrangement,'inverted-pyramid');
  for(const direction of ['down','up','sideways'])assert.equal(validateCatalogRecord('layouts',{...published,regions:[{name:'levels',arrangement:'pyramid',pyramidDirection:direction}]}).valid,false);
  assert.equal(validateCatalogRecord('layouts',{...published,regions:[{name:'levels',arrangement:'inverted-pyramid'}]}).valid,true);
});
test('composition preserves top-to-bottom source paths without shrinking or enabling unmeasured SmartArt',()=>{
  const items=['Possibilities','Qualified options','Shortlist','Decision'];
  for(const blocks of [false,true]){
    const slide={title:'From options to a decision',...(blocks?{blocks:items.map(text=>({items:[text]}))}:{items})};
    const result=composeSlide(slide,{layout:record});
    const a=result.arrangements?.[0];assert.ok(a);assert.equal(a.kind,'inverted-pyramid');assert.equal('pyramidDirection' in a,false);
    assert.deepEqual(a.nodes.map(n=>n.index),[0,1,2,3]);
    assert.ok(a.nodes[0].box.width>a.nodes.at(-1).box.width);
    const up=composeSlide(slide,{layout:{...record,regions:record.regions.map(region=>region.arrangement==='inverted-pyramid'?{...region,arrangement:'pyramid'}:region)}});
    assert.equal(a.fontSize,up.arrangements[0].fontSize,'direction changes no text size');
    assert.match(smartArtUnavailable({kind:'inverted-pyramid',count:4,frame:a.frame,nodes:[]}),/no qualified live/);
  }
});
