import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide, titleReferenceNumbers} from '../dist/composition.js';
import {resolveSlideContext} from '../dist/index.js';
const values = (title, language) => titleReferenceNumbers(title,language).map(({value,percent})=>[value,percent]);
const cases = [
 ['de','über','zweiundneunzig','einhundertdreiundzwanzig','zweitausendfünfhundert','drei Millionen','Prozent'],
 ['fr','au-dessus de','quatre-vingt-douze','cent vingt-trois','deux mille cinq cents','trois millions','pour cent'],
 ['es','por encima de','noventa y dos','ciento veintitrés','dos mil quinientos','tres millones','por ciento'],
 ['it','sopra','novantadue','centoventitré','duemilacinquecento','tre milioni','per cento'],
 ['pt','acima de','noventa e dois','cento e vinte e três','dois mil e quinhentos','três milhões','por cento'],
 ['nl','boven','tweeënnegentig','honderddrieëntwintig','tweeduizendvijfhonderd','drie miljoen','procent'],
];
for(const [lang,comparison,n92,n123,n2500,n3m,percent]of cases){
 test(`${lang}: complete cardinal references and percentages, with locale-family tags`,()=>{
  for(const [words,number]of [[n92,92],[n123,123],[n2500,2500],[n3m,3000000]]){
   assert.deepEqual(values(`${comparison} ${words}`,lang),[[number,false]],words);
   assert.deepEqual(values(`${comparison} ${words} ${percent}`,`${lang}-XX`),[[number,true]],words);
  }
  assert.deepEqual(values(`${n92} équipes`,lang),[],'no comparison');
  assert.deepEqual(values(`above ${n92} percent`,lang),[],'no English comparison fallback');
  assert.deepEqual(values(`${comparison} ninety-two percent`,lang),[],'no English number fallback');
 });
}
test('cardinal orthography, genders, regional forms, compound boundaries and the integer upper bound',()=>{
 for(const [lang,title,n]of [
  ['de','über einundzwanzig',21],['de','über hunderttausend',100000],['de','über eine Million zweihunderttausend',1200000],
  ['fr','plus de soixante et onze',71],['fr','plus de quatre-vingts',80],['fr','plus de quatre-vingt-une',81],['fr','plus de septante-deux',72],['fr','plus de huitante',80],['fr','plus de nonante-neuf',99],['fr','plus de deux cent mille',200000],
  ['es','más de veintiún',21],['es','más de doscientas treinta y una',231],['es','más de setecientos ochenta y seis',786],['es','más de quinientas',500],
  ['it','oltre ventuno',21],['it','oltre ventotto',28],['it','oltre centotto',108],['it','oltre centottantotto',188],['it','oltre duemilacentoventitré',2123],
  ['pt','mais de dezasseis',16],['pt','mais de dezassete',17],['pt','mais de dezanove',19],['pt','mais de quatorze',14],['pt','mais de duzentas e duas',202],['pt','mais de duzentas e dezasseis',216],
  ['nl','boven één',1],['nl','boven drieëntwintig',23],['nl','boven honderd en één',101],
  ['de','über neunhundertneunundneunzig Millionen neunhundertneunundneunzigtausendneunhundertneunundneunzig',999999999],
 ])assert.deepEqual(values(title,lang),[[n,false]],`${lang}: ${title}`);
});
test('a malformed phrase, spoken fraction, negative or unsupported scale never becomes a shorter positive reference',()=>{
 for(const [lang,title]of [
  ['de','über fünf sechs'],['fr','plus de cinq six'],['es','más de treinta y doce'],['it','sopra due tre'],['pt','acima de vinte e doze'],['nl','boven vijf zes'],
  ['de','über fünf Komma sechs'],['fr','plus de cinq virgule six'],['es','más de cinco coma seis'],['it','oltre cinque virgola sei'],['pt','mais de cinco vírgula seis'],['nl','boven vijf komma zes'],
  ['fr','moins cinq'],['es','menos cinco'],['it','meno cinque'],['pt','menos cinco'],['de','über zwei tausend tausend'],['de','über drei Milliarden'],['fr','plus de trois milliards'],['es','más de tres billones'],['it','oltre tre miliardi'],['pt','mais de três bilhões'],['nl','boven drie miljard'],
 ])assert.deepEqual(values(title,lang),[],`${lang}: ${title}`);
 assert.deepEqual(values('plus de moins cinq','fr'),[[-5,false]],'unambiguous outer comparison keeps the signed value');
 assert.deepEqual(values('above 92%','ja'),[]);
});
const chart = (labels=['2022','2023','2024'])=>({type:'line',data:{columns:['Year','Revenue'],rows:labels.map((label,i)=>[label,[70,80,100][i]])}});
const refs=(title,language,value=chart())=>composeSlide({title,chart:value},{width:1280,height:720,presentation:{language,slides:[]}}).items.find(item=>item.field==='chart').chart.layer?.references;
const bands=[
 ['en','Growth accelerated in 2023','Growth accelerated since March'],
 ['de','Das Wachstum stieg im 2023','Das Wachstum stieg seit März'],
 ['fr','La croissance a accéléré à partir de 2023','La croissance a accéléré jusqu’en mars'],
 ['es','El crecimiento aumentó después de 2023','El crecimiento aumentó desde marzo'],
 ['it','La crescita è aumentata fino a 2023','La crescita è aumentata nel marzo'],
 ['pt','O crescimento aumentou a partir de 2023','O crescimento aumentou em março'],
 ['nl','De groei nam toe vanaf 2023','De groei nam toe sinds maart'],
];
for(const [language,year,month]of bands)test(`${language}: local multiword/contraction time phrases name one year or localized month`,()=>{
 assert.deepEqual(refs(year,language)?.bands.map(b=>b.row),[1]);
 assert.deepEqual(refs(month,`${language}-XX`,chart(['Feb','Mar','Apr']))?.bands.map(b=>b.row),[1]);
});
test('period bands remain conservative and preserve authored highlight and effective slide language',()=>{
 assert.equal(refs('La croissance en 2023','ja'),undefined);
 assert.equal(refs('Growth en 2023','en'),undefined);
 assert.equal(refs('Growth 2023','en'),undefined);
 assert.equal(refs('Growth in 2023 and in 2024','en'),undefined,'not an invented multi-period band');
 assert.equal(refs('Growth in 2023','en',chart(['2024','2023','2022'])),undefined,'not forward time');
 assert.equal(refs('Growth in Beta','en',{...chart(['Alpha','Beta','Gamma']),data:{...chart(['Alpha','Beta','Gamma']).data,columns:['Category','Revenue']}}),undefined,'nominal categories');
 assert.equal(refs('La croissance en 2023','fr',{...chart(),highlight:{rows:[0]}}),undefined,'authored highlight wins');
 const deck={language:'en',slides:[{language:{bcp47:'fr-FR'},title:'La croissance en 2023',chart:chart()}]};
 const context=resolveSlideContext(deck,0);const geometry=composeSlide(context.slide,context.options);
 assert.deepEqual(geometry.items.find(item=>item.field==='chart').chart.layer.references.bands.map(b=>b.row),[1]);
});
