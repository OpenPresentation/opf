import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,titleReferenceNumbers} from '../dist/composition.js';
const meanings=(text,lang)=>titleReferenceNumbers(text,lang).map(({value,decimals,percent,text})=>({value,decimals,percent,text}));
const cases=[['fr','au moins','cinq','six','pour cent','moins','virgule','trois milliards'],['es','al menos','cinco','seis','por ciento','menos','coma','tres billones'],['pt','pelo menos','cinco','seis','por cento','menos','vírgula','três bilhões']];
for(const[lang,prefix,five,six,percent,minus,fraction,tooLarge]of cases)test(`${lang}: complete at-least phrase keeps word/digit meaning and reference line`,()=>{
 assert.deepEqual(meanings(`${prefix} ${five}`,lang),meanings(`${prefix} 5`,lang),'complete at-least words equal the existing digit form');
 assert.deepEqual(meanings(`${prefix} ${five} ${percent}`,`${lang}-XX`),meanings(`${prefix} 5%`,lang),'percent meaning survives family tags');
 assert.deepEqual(meanings(`${minus} ${five}`,lang),[],'bare unary-minus phrase stays ambiguous, never becomes positive');
 assert.deepEqual(meanings(`${prefix} ${five} ${six}`,lang),[],'malformed whole number does not become a shorter reference');
 assert.deepEqual(meanings(`${prefix} ${five} ${fraction} ${six}`,lang),[],'spoken fraction stays rejected');
 assert.deepEqual(meanings(`${prefix} ${tooLarge}`,lang),[],'unsupported larger scale stays rejected');
 assert.deepEqual(meanings(`${prefix} ${minus} ${five}`,lang),[{value:-5,decimals:0,percent:false,text:'-5'}],'unambiguous complete comparison may name a signed cardinal');
 const chart={type:'column',data:{columns:['Week','Requests'],rows:[['W1',2],['W2',4],['W3',6]]}},slide={title:`${prefix} ${five}`,chart},geometry=composeSlide(slide,{width:1280,height:720,presentation:{language:lang,slides:[]}}),item=geometry.items.find(i=>i.field==='chart');
 assert.equal(item.chart.layer.references.lines[0].value,5,'actual composed target line');assert.equal(item.chart.layer.references.lines[0].text,'5');assert.deepEqual(item.value,chart,'source chart data and options unchanged');
});
