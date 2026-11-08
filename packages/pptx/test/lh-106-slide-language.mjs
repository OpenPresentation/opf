import assert from 'node:assert/strict';
import { strFromU8, unzipSync, zipSync } from 'fflate';
import { toPptx, fromPptx } from '../dist/index.js';
import { gallery } from '@openpresentation/gallery';
import { documentProvenance } from '../src/document-provenance.js';
import { observeLanguage } from '../src/script-fonts.js';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
// Legacy decks must not gain per-slide provenance or change their exact archive bytes.
assert.deepEqual(documentProvenance({language: 'en-US', slides: [{title: 'Legacy'}]}).slides, [{v: 1, slide: 0}]);
assert.deepEqual(documentProvenance({slides: [{title: 'Legacy'}]}).slides, [{v: 1, slide: 0}]);
const deck = { language: 'en-US', slides: [
  { title: 'English', text: 'A simple sentence.' },
  { language: 'ar-SA', title: 'العربية', items: ['الأول', 'الثاني'] },
  { language: 'ja', title: '日本語', text: '同じ資料で言語を選べる' },
] };
const bytes = await toPptx(deck);
const zip = unzipSync(new Uint8Array(bytes));
const slide = n => strFromU8(zip['ppt/slides/slide' + n + '.xml']);
assert.match(slide(1), /lang="en-US"/);
assert.match(slide(2), /lang="ar-SA"/);
assert.match(slide(2), /rtl="1"/);
assert.match(slide(3), /lang="ja-JP"/);
const restored = await fromPptx(bytes);
assert.equal(restored.language, 'en-US');
assert.equal(restored.slides[1].language, 'ar-SA');
assert.equal(restored.slides[2].language, 'ja');
console.log('LH-106: PPTX per-slide language tags, RTL and round trip');

// Native edits win over stored slide-language metadata.
const edited = { ...zip, 'ppt/slides/slide2.xml': new TextEncoder().encode(slide(2).replaceAll('lang="ar-SA"', 'lang="he-IL"')) };
assert.equal((await fromPptx(zipSync(edited))).slides[1].language, 'he-IL');
const selected = { language: 'en-US', slides: [{language: 'ar-SA', design: {fontScheme: 'noto-sans-arabic'}, title: 'العربية', text: 'اختر خط الشريحة'}] };
const selectedZip = unzipSync(new Uint8Array(await toPptx(selected, {catalogs: [gallery]})));
assert.ok(Object.entries(selectedZip).some(([name, value]) => /^ppt\/theme\/theme\d+\.xml$/.test(name) && /<a:cs typeface="Noto Naskh Arabic"/.test(strFromU8(value))), 'the selected Arabic slide face is written in the complex-script theme slot');

// Explicit run languages are compared with their effective slide, never with slide zero.
for (const bodyText of ['measured', 'native']) {
  const mixed = {language:'en-US',slides:[
    {title:'English primary',text:[{text:'English surrounding text stays English. '},{text:'مرحبا',lang:'ar-SA'}]},
    {language:'ar-SA',title:'العربية',text:[{text:'النص العربي الأساسي للشريحة يظل باللغة العربية. '},{text:'Hello',lang:'en-US'}]},
  ]};
  const mixedBytes=await toPptx(mixed,{bodyText});
  const parts=unzipSync(new Uint8Array(mixedBytes));
  const xml1=strFromU8(parts['ppt/slides/slide1.xml']),xml2=strFromU8(parts['ppt/slides/slide2.xml']);
  const run=(xml,text)=>[...xml.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)].map(m=>m[0]).find(value=>value.includes('<a:t>'+text+'</a:t>'));
  assert.match(run(xml1,'مرحبا'),/lang="ar-SA"/,bodyText+' Arabic run on English slide');
  assert.match(run(xml2,'Hello'),/lang="en-US" altLang="en-US"/,bodyText+' authored English run on Arabic slide');
  const restored=await fromPptx(mixedBytes);
  const runs=value=>Array.isArray(value)?value.flatMap(runs):value&&typeof value==='object'?[...(typeof value.text==='string'?[value]:[]),...Object.values(value).filter(x=>typeof x==='object').flatMap(runs)]:[];
  assert.ok(runs(restored.slides[0]).some(r=>r.text==='مرحبا'&&r.lang==='ar-SA'),bodyText+' Arabic run survives import');
  assert.ok(runs(restored.slides[1]).some(r=>r.text==='Hello'&&r.lang==='en-US'),bodyText+' English run survives import');
}

// A measured override can wrap into more native runs than the base language.
const measuredDeck={language:'en-US',design:{theme:'minimal',fontScheme:'aptos'},slides:[
 {title:'English slide with an Arabic run',text:[{text:'This English paragraph keeps its own proofing language. '},{text:'مرحبا بالعالم',lang:'ar-SA'},{text:' The Arabic run keeps its explicit language.'}]},
 {language:{bcp47:'ar-SA',fontScheme:'noto-sans-arabic'},title:'شريحة عربية وفيها نص إنجليزي',text:[{text:'هذا النص العربي يحافظ على لغة الشريحة. '},{text:'Hello from this English run.',lang:'en-US'},{text:' ويظل هذا النص باللغة العربية.'}]},
]};
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:measuredDeck});
const allRuns=value=>Array.isArray(value)?value.flatMap(allRuns):value&&typeof value==='object'?[...(typeof value.text==='string'?[value]:[]),...Object.values(value).filter(x=>typeof x==='object').flatMap(allRuns)]:[];
for(const bodyText of ['measured','native']){
 const bytes=await toPptx(measuredDeck,{fonts,catalogs:[gallery],bodyText});
 const parts=unzipSync(new Uint8Array(bytes));
 const xml=strFromU8(parts['ppt/slides/slide2.xml']);
 const source=observeLanguage({slides:[xml],preferBaseRuns:true}),foreign=observeLanguage({slides:[xml]});
 assert.equal(source.language,'ar-SA');
 assert.equal(foreign.language,'en-US','untagged foreign observation keeps its existing all-run vote');
 assert.deepEqual(source.ranked,foreign.ranked,'mixed-language diagnostics retain all runs');
 const restored=await fromPptx(bytes,{catalogs:[gallery]});
 assert.equal(restored.language,'en-US');
 assert.deepEqual(restored.slides[1].language,measuredDeck.slides[1].language);
 assert.ok(allRuns(restored.slides[1]).some(run=>run.lang==='en-US'&&run.text.includes('Hello from this English run.')));
 assert.ok(allRuns(restored.slides[0]).some(run=>run.lang==='ar-SA'&&run.text.includes('مرحبا بالعالم')));
 const edited=xml.replace(/<a:rPr\b[^>]*>/g,run=>run.includes('altLang=')?run:run.replace('lang="ar-SA"','lang="he-IL"'));
 const native={...parts,'ppt/slides/slide2.xml':new TextEncoder().encode(edited)};
 assert.equal((await fromPptx(zipSync(native),{catalogs:[gallery]})).slides[1].language,'he-IL','an explicit native edit of base runs remains authoritative');
}
