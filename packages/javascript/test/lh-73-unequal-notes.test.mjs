// LH-73: a long and short note under a metric grid share a measured row without losing role-size text.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {resolveSlideContext} from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';
const original=JSON.parse(fs.readFileSync(new URL('./fixtures/lh-73-unequal-notes.opf.json',import.meta.url),'utf8'));
const compose=(document=original,extra={})=>{const context=resolveSlideContext(document,0,{catalogs:[gallery]});return composeSlide(context.slide,{...context.options,...extra});};
const notes=result=>result.items.filter(item=>item.field==='text');
const plain=value=>typeof value==='string'?value:value.map(run=>typeof run==='string'?run:run.text).join('');
const words=value=>value.replace(/\s+/gu,' ').trim();

test('exact b06 s50 notes share a 60:40 row at 28px and leave the metric grid more body height',()=>{
 const result=compose(),[long,short]=notes(result),region=result.regions.find(region=>region.name==='note');
 assert.equal(region.arrangement,'row');assert.equal(long.box.y,short.box.y);
 assert.ok(long.box.width>short.box.width*1.49 && long.box.width<=short.box.width*7/3+.01);
 assert.equal(long.text.fontSize,28);assert.equal(short.text.fontSize,28);
 assert.ok(result.regions.find(region=>region.name==='metrics').box.height>330.28,'former stacked-note grid gained height');
 for(const[index,item]of notes(result).entries()){
  assert.equal(words(item.text.lines.join('')),words(plain(original.slides[0].blocks[index===0?1:3].text)),'all authored words retained');
  assert.ok(item.text.lines.every(line=>line.trim().length<=70),'notes retain a readable measure');
  assert.ok(!item.text.overflow);
 }
 assert.deepEqual(result.diagnostics,[]);
});

test('long note takes the wider share in either source order and right-to-left layout',()=>{
 for(const reverse of [false,true])for(const direction of ['ltr','rtl']){
  const deck=structuredClone(original);
  if(reverse)[deck.slides[0].blocks[1],deck.slides[0].blocks[3]]=[deck.slides[0].blocks[3],deck.slides[0].blocks[1]];
  const result=compose(deck,{direction}),drawn=notes(result),long=drawn.find(item=>plain(item.value).length>100),short=drawn.find(item=>plain(item.value).length<100);
  assert.equal(long.box.y,short.box.y);assert.ok(long.box.width>short.box.width*1.49);
  assert.equal(drawn[0].box.x>drawn[1].box.x,direction==='rtl');
  assert.ok(drawn.every(item=>item.text.fontSize===28 && !item.text.overflow));
 }
});

test('cards retain note role sizes and a narrow portrait is free to stack',()=>{
 const cards=structuredClone(original);cards.design.contentBox=true;
 const result=compose(cards);assert.deepEqual(result.diagnostics,[]);assert.ok(notes(result).every(item=>item.text.fontSize>=28));
 const portrait=compose(original,{width:720,height:1280});assert.ok(notes(portrait).every(item=>!item.text.overflow && item.text.fontSize>=28));
 assert.ok(notes(portrait)[0].box.y<notes(portrait)[1].box.y,'a portrait keeps the shorter stack instead of forcing narrow columns');
});

test('authored direction and peer notes retain their arrangement',()=>{
 const authored=structuredClone(original);authored.slides[0].design={contentDirection:'vertical'};
 const result=compose(authored,{recompose:false}),drawn=notes(result);assert.ok(Math.abs(drawn[0].box.width-drawn[1].box.width)<.001,'authored direction disables moved-note reweighting; fixed note region retains existing equal tracks');
 const peers=structuredClone(original);peers.slides[0].blocks[3].text=peers.slides[0].blocks[1].text;
 const peerResult=compose(peers),pair=notes(peerResult);assert.ok(Math.abs(pair[0].box.width-pair[1].box.width)<.001,'peer tracks stay equal');
});
