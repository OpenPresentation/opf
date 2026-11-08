import assert from 'node:assert/strict';
import {strFromU8,unzipSync,zipSync,strToU8} from 'fflate';
import {toPptx,fromPptx} from './helpers/default-catalog.mjs';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const fonts=await loadFonts();
const labels=['Week 1','Weeks 2–5','Week 6'];
for(const language of ['ar-SA','he-IL'])for(const ranged of [false,true]){
 const events=labels.map((when,index)=>({when,what:['Discover','Build','Launch'][index],description:'Keep the authored event text.',...(ranged?{duration:[1,4,1][index]}:{})}));
 const deck={language,design:{fontScheme:'roboto'},slides:[{layout:'timeline',title:'Six-week delivery',timeline:{name:'Delivery plan',events}}]};
 const bytes=await toPptx(deck,{fonts}),entries=unzipSync(bytes),xml=strFromU8(entries['ppt/slides/slide1.xml']);
 const shapes=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match=>match[0]);
 for(const label of labels){
  const shape=shapes.find(value=>value.includes('<a:t>'+label+'</a:t>'));
  assert.ok(shape,'a complete editable date label is retained');
  const run=shape.match(/<a:rPr\b[^>]*>/)?.[0];
  assert.match(run,/lang="en-US" altLang="en-US"/,'Latin dates on RTL slides need one left-to-right native proofing run, including digit ranges');
  assert.match(shape,/<a:pPr\b[^>]*rtl="0"/,'the measured label stays left to right');
  assert.doesNotMatch(shape,/<a:(?:normAutofit|spAutoFit)\b/,'no text shrink is introduced');
 }
 const restored=await fromPptx(bytes);assert.equal(restored.language,language,'automatic date language must not replace the deck language');assert.deepEqual(restored.slides[0].timeline,deck.slides[0].timeline);
 entries['ppt/slides/slide1.xml']=strToU8(xml.replace('<a:t>Weeks 2–5</a:t>','<a:t>Weeks 2–6</a:t>'));
 const edited=await fromPptx(zipSync(entries));assert.equal(edited.slides[0].timeline.events[1].when,'Weeks 2–6');if(ranged)assert.equal(edited.slides[0].timeline.events[1].duration,4);
}
for(const language of ['ar-SA','en-US']){
 const deck={language,design:{fontScheme:'roboto'},slides:[{layout:'timeline',timeline:[{when:'الأسبوع ١',what:'ابدأ'},{when:'2026',what:'Finish'}]}]};
 const scriptFonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:deck});
 const entries=unzipSync(await toPptx(deck,{fonts:scriptFonts})),xml=strFromU8(entries['ppt/slides/slide1.xml']);
 const date=[...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(x=>x[0]).find(x=>x.includes('<a:t>الأسبوع ١</a:t>'));
 assert.ok(date);assert.doesNotMatch(date,/<a:rPr[^>]*lang="en-US" altLang="en-US"/,'Arabic dates must not acquire a Latin override');
 assert.equal((await fromPptx(await toPptx(deck,{fonts:scriptFonts}))).language,language);
}
console.log('RTL native timeline dates keep digit order, language, periods and current native edits');

// A date can be the only native text; its shaping language is not the authored base language.
for(const label of ['Weeks 2–5','Week١–٤','Week۱–۴']){
 const doc={language:'ar-SA',design:{fontScheme:'roboto'},slides:[{timeline:[{when:label,what:''}]}]};
 const bytes=await toPptx(doc),parts=unzipSync(bytes),xml=strFromU8(parts['ppt/slides/slide1.xml']);
 if(label!=='Weeks 2–5')assert.doesNotMatch(xml,/<a:rPr[^>]*lang="en-US" altLang="en-US"/,'unqualified non-ASCII digits keep their old route');
 assert.equal((await fromPptx(bytes)).language,'ar-SA','all protected date runs cannot replace the stored Arabic base');
 if(label==='Weeks 2–5'){
  parts['ppt/slides/slide1.xml']=strToU8(xml.replace('lang="en-US" altLang="en-US"','lang="he-IL"'));
  assert.equal((await fromPptx(zipSync(parts))).language,'he-IL','a genuine unprotected native base-language edit remains authoritative');
 }
}
const explicit={language:'ar-SA',design:{fontScheme:'roboto'},slides:[{text:[{text:'Only protected English',lang:'en-US'}]}]};
assert.equal((await fromPptx(await toPptx(explicit))).language,'ar-SA','explicit run language alone is not a base-language edit');
const override={language:'en-US',design:{fontScheme:'roboto'},slides:[{language:'ar-SA',timeline:[{when:'Weeks 2–5',what:''}]}]};
const overridden=await fromPptx(await toPptx(override));assert.equal(overridden.language,'en-US');assert.equal(overridden.slides[0].language,'ar-SA');
