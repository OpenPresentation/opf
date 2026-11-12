import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {composeSlide,itemizeScripts} from '../dist/composition.js';
import {resolveSlideContext} from '../dist/index.js';

const document=JSON.parse(readFileSync(new URL('../../../scripts/native-acceptance/qualification/decks/smartart-arabic.opf.json',import.meta.url),'utf8'));
const profile={script:'Arab',scriptRole:'complexScript',bcp47:'ar'};

test('centered Arabic arrangement wrapping never measures its trailing space in a different script slot',()=>{
 const calls=[];
 const measure=(text,size)=>{
  text=String(text);if(!text)return 0;
  assert(itemizeScripts(text,profile).every(run=>run.role==='complexScript'),'Only the prepared complex-script face is available');
  calls.push(text);
  // A context-dependent trailing advance makes an isolated-space approximation observably wrong.
  return ([...text].length*.6+(text.endsWith(' ')? .17:0))*size;
 };
 assert.equal(itemizeScripts(' ',profile)[0].role,'latin');
 assert.throws(()=>measure(' ',20),/Only the prepared complex-script face/);
 assert.equal(itemizeScripts('الفرق والمنصة ',profile)[0].role,'complexScript');
 const constrained=structuredClone(document);
 delete constrained.slides[1].title; // Isolate arrangement measurement; actual titles remain covered by the public integration test.
 constrained.slides[1].composition={minFontSize:32,maxFontSize:40};
 const context=resolveSlideContext(constrained,1,{catalogs:[gallery],fonts:{textMeasurement:{measure}}});
 const geometry=composeSlide(context.slide,context.options);
 assert.equal(geometry.arrangements.length,1,'The actual flow arrangement is composed');
 assert(calls.some((text,index)=>text.endsWith(' ')&&calls[index+1]===text.slice(0,-1)),'Trimming measures the full fragment then its exact displayed text');
 assert(!calls.some(text=>/^\s+$/u.test(text)),'No missing Latin face was demanded for an isolated trailing space');
 const list=geometry.items.find(item=>item.field==='items');
 const lines=list.listColumns[3].text.listEntries[0].text.richLines;
 const line=lines.find(line=>line.fragments.length===1&&line.fragments[0].text==='الفرق');
 assert(line,'The final displayed long label really wraps and trims its first line');
 const fragment=line.fragments[0],expected=[...'الفرق'].length*.6*fragment.fontSize;
 assert.equal(fragment.fontSize,40);
 assert(Math.abs(fragment.width-expected)<1e-9,'Displayed fragment keeps the independent context-dependent advance');
 assert(Math.abs(line.width-expected)<1e-9,'Displayed line keeps that same advance, excluding its trailing space');
 assert.deepEqual(document.slides[1].items,['الرؤية','الأهداف','البرامج','الفرق والمنصة']);
});
