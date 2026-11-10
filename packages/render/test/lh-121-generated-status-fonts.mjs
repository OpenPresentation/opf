import assert from'node:assert/strict';
import{test}from'node:test';
import{toSvg}from'../dist/index.js';
import{loadFonts,detectPresentationScripts}from'../dist/fonts-node.js';
import{timelineStatusWordsFor}from'@openpresentation/opf/composition';
import{gallery}from'@openpresentation/gallery';
const events=()=>['done','current','planned'].map((status,index)=>({when:'Week '+(index+1),what:['Discover','Build','Launch'][index],status}));
const document=language=>({language,design:{fontScheme:'roboto'},slides:[{title:'Roadmap',timeline:events()}]});
test('LH121: generated status vocabulary chooses only its actual slide scripts, including nested/promoted payloads',()=>{
 for(const[language,scripts]of[['ar-SA',['Arab']],['he-IL',['Hebr']],['ja-JP',['Jpan']],['zh-TW',['Hant']],['en-US',[]],['fr-FR',[]],['ga-IE',[]]])assert.deepEqual(detectPresentationScripts(document(language)),scripts,language);
 const override=document('en-US');override.slides[0].language='zh-TW';assert.deepEqual(detectPresentationScripts(override),['Hant']);override.slides[0].language={bcp47:'ar-SA'};assert.deepEqual(detectPresentationScripts(override),['Arab']);override.language='ar-SA';override.slides[0].language='en-US';assert.deepEqual(detectPresentationScripts(override),[]);
 for(const slide of[{blocks:[{blocks:[{timeline:{events:events()}}]}]},{'top:end':{timeline:events()}}])assert.deepEqual(detectPresentationScripts({language:'ar-SA',slides:[slide]}),['Arab']);
 const noStatus=document('ar-SA');for(const event of noStatus.slides[0].timeline)delete event.status;assert.deepEqual(detectPresentationScripts(noStatus),[],'language alone still loads no script');
 assert.deepEqual(detectPresentationScripts({language:'ar-SA',variables:{unused:{timeline:events()}},slides:[{text:'Only Latin',notes:'No translated labels',extensions:{ignored:{timeline:events()}}}],metadata:{timeline:events()},catalogs:{custom:{layouts:{unused:{timeline:events()}}}}}),[],'undrawn arbitrary objects must not acquire generated labels');
});
test('LH121: automatic per-document fonts render generated Arabic, Hebrew, Japanese and Traditional Chinese status words',async()=>{
 for(const[language,script]of[['ar-SA','Arab'],['he-IL','Hebr'],['ja-JP','Jpan'],['zh-TW','Hant']]){
  const doc=document(language),source=structuredClone(doc),fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:doc,renderOptions:{catalogs:[gallery]}});
  assert.deepEqual(fonts.registry.scriptSelection.scripts,[script]);const svg=toSvg(doc,{catalogs:[gallery],fonts})[0];for(const word of Object.values(timelineStatusWordsFor(language)))assert.ok(svg.includes(word),language+' '+word);assert.deepEqual(doc,source);
 }
});
test('LH121: ensure discovers newly generated status text when a document changes in place',async()=>{
 const doc=document('ar-SA');for(const event of doc.slides[0].timeline)delete event.status;const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:doc,renderOptions:{catalogs:[gallery]}});assert.deepEqual(fonts.registry.scriptSelection.scripts,[]);doc.slides[0].timeline[0].status='current';assert.ok(fonts.pending(doc,{catalogs:[gallery]}).some(name=>name.includes('noto-naskh-arabic')));const prepared=await fonts.ensure(doc,{renderOptions:{catalogs:[gallery]}});assert.ok(prepared.scripts.some(name=>name.includes('noto-naskh-arabic')));assert.deepEqual(fonts.pending(doc,{catalogs:[gallery]}),[]);assert.ok(toSvg(doc,{catalogs:[gallery],fonts})[0].includes(timelineStatusWordsFor('ar-SA').current));
});
