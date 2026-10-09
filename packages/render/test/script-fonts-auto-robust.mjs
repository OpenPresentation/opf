// FF-19: `scripts: 'auto'` robustness. Browser loads are all-or-nothing, dispose and abort are safe, detection
// walks only drawn text with the renderer's own itemization, script faces embed only when used, and the glyph
// fallback faces (renderer with glyphFallbackFamilies) are loaded for characters the primary face lacks.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as core from '@openpresentation/opf/composition';
import {examples} from '@openpresentation/opf/examples';
// The example corpus and some decks name gallery records (themes, layouts, the roboto font scheme): they render, resolve and
// detect scripts with the host catalog registered.
import {catalogs, toSvg} from './catalog-harness.mjs';
import {loadFonts,detectPresentationScripts,scriptFontPackages} from '../dist/fonts-node.js';
import {loadFonts as loadBrowserFonts} from '../dist/fonts-browser.js';
import {scriptsOfText} from '../dist/script-fonts.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const short=name=>name.replace('@expo-google-fonts/','');
const deck=(title,text='Body',extra={})=>({$schema:'https://openpresentation.org/schema/opf/v1',name:'Robust',slides:[{title,text}],...extra});

// ---- Detection walks drawn text only ----
assert.deepEqual(detectPresentationScripts({name:'日本語のデッキ',author:'山田',language:'en',slides:[{id:'スライド',title:'Plain',alt:'画像の説明',image:{src:'https://例え.jp/日本語.png',alt:'代替'},notes:'メモ'}],assets:{a:{name:'ロゴ'}},catalogs:{custom:{fontSchemes:{'x-jp':{name:'日本語'}}}},metadata:{k:'値'}}),[]);
// Drawn fields all count: titles, subtitle, list items, quotes, metrics, code, timelines, table cells, chart labels, footers.
const drawn={
  title:['タイトルです'],subtitle:['サブタイトルです'],items:['項目です','Item'],
  blocks:[{quote:{text:'引用です',attribution:'著者です'}},{metric:{value:98,label:'指標です',unit:'%'}},{code:{source:'// コメントです\nconst a = 1;',language:'javascript'}},
    {timeline:[{when:'今です',what:'試作です'}]},{table:{columns:['名前です','Owner'],rows:[['はい','B']]}},{chart:{type:'column',data:{columns:['四半期です','値です'],rows:[['Q1',1]]}}}],
  design:{footer:{center:{text:'フッターです'}}},
};
for(const [field,value] of Object.entries({title:drawn.title[0],subtitle:drawn.subtitle[0],items:drawn.items})){
  assert.deepEqual(detectPresentationScripts({slides:[{[field]:value}]}),['Jpan'],field);
}
for(const [index,block] of drawn.blocks.entries())assert.deepEqual(detectPresentationScripts({slides:[{title:"T",blocks:[block]}]}),["Jpan"],`block ${index}`);
assert.deepEqual(detectPresentationScripts({design:drawn.design,slides:[{title:'T'}]}),['Jpan']);
// Deck metadata is not drawn: description, filename, speaker, audience, purpose, tone, takeaway, duration, tags, narrative,
// extensions, and a slide's beat. Organization, speaker and section are drawn only through the built-in variables that read them (FA-31).
assert.deepEqual(detectPresentationScripts({description:'説明です',filename:'ファイル',speaker:{name:'山田さん'},audience:'顧客です',purpose:'目的です',tone:'丁寧です',takeaway:'要点です',duration:'三十分',tags:['タグです'],narrative:'物語です',extensions:{x:'拡張です'},
  organization:{name:'株式会社です'},slides:[{title:'T',beat:'導入です',section:'第一章です',extensions:{y:'値です'}}]}),[]);
assert.deepEqual(detectPresentationScripts({organization:{name:'株式会社です'},design:{footer:{left:{text:'{{organization.name}}'}}},slides:[{title:'T'}]}),['Jpan']);
assert.deepEqual(detectPresentationScripts({design:{footer:{left:{text:'{{slide.section}}'}}},slides:[{title:'T',section:'第一章です'}]}),['Jpan']);
assert.deepEqual(detectPresentationScripts({design:{footer:{left:{text:'{{slide.section}}'}}},organization:{name:'株式会社です'},slides:[{title:'T'}]}),[],'a section footer does not draw the organization');
assert.deepEqual(detectPresentationScripts({speaker:{name:'山田さん'},slides:[{title:'T',text:'By {{speaker.name}}'}]}),['Jpan'],'a speaker token in body text draws the speaker');
assert.deepEqual(detectPresentationScripts({organization:{name:'株式会社です'},slides:[{title:'T',section:'第一章です',text:'{{slide.number}}'}]}),[],'a slide number token draws neither the organization nor the section');
// A URL is not text; ids, alt, src, notes and metadata are not drawn; the presentation's own name and author are not either.
assert.deepEqual(detectPresentationScripts({slides:[{title:'T',text:'https://例え.jp/日本語'}]}),[]);

// Language-dependent punctuation: with an East Asian language the renderer itemizes curly quotes, dashes and the ellipsis as
// East Asian, so the script is detected exactly where drawing plans it.
const quoted=deck('“Hello” — world…','Body',{language:'ja'});
assert.deepEqual(detectPresentationScripts(quoted),['Jpan']);
assert.deepEqual(detectPresentationScripts(deck('“Hello”','Body',{language:'ko'})),['Kore']);
assert.deepEqual(detectPresentationScripts(deck('“Hello”','Body',{language:'en'})),[]);
assert.deepEqual([...new Set(scriptsOfText('“Hello”',{scriptRole:'eastAsian',bcp47:'ja',script:'Jpan'}))],['Jpan']);
assert.deepEqual(scriptsOfText('“Hello”',{}),[]);

// Parity with drawing: every script in the text of the rendered SVG was detected. A deck that mixes scripts and block types,
// and every deck of the installed core's example corpus.
const decode=text=>text.replace(/<[^>]+>/g,'').replace(/&(?:#x([0-9a-f]+)|#(\d+)|amp|lt|gt|quot|apos);/gi,(match,hex,decimal)=>hex?String.fromCodePoint(parseInt(hex,16)):decimal?String.fromCodePoint(Number(decimal)):{'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[match.toLowerCase()]);
const drawnScripts=(presentation,svgs)=>{
  const profile=core.resolveScriptFonts(presentation,{catalogs});
  const found=new Set();
  for(const svg of svgs)for(const [,content] of svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)){const text=decode(content);if(/^[•\u2022\d.\s]*$/.test(text))continue;for(const script of scriptsOfText(text,profile))found.add(script);}
  return [...found];
};
const mixed={$schema:'https://openpresentation.org/schema/opf/v1',name:'Parity',language:'ja',design:{footer:{center:{text:'フッターです “x”'}}},
  slides:[{title:'四半期レビューです',subtitle:'مرحبا',blocks:[{quote:{text:'引用です — x',attribution:'שלום'}},{metric:{value:98,label:'指標です',unit:'%'}},{table:{columns:['名前です','Owner'],rows:[['はい','B']]}},{timeline:[{when:'今です',what:'試作です'}]}]},
    {title:'Chart',chart:{type:'column',data:{columns:['四半期です','値です'],rows:[['Q1',1],['Q2',2]]}}},{title:'Items',items:['項目です','한국어','ไทย']},{title:'Code',code:{source:'// コメントです',language:'javascript'}}]};
const rendered=toSvg(mixed);
const found=drawnScripts(mixed,rendered);
assert.ok(found.length>=4,`the parity deck draws several scripts: ${found}`);
for(const script of found)assert.ok(detectPresentationScripts(mixed,{catalogs}).includes(script),`drawn script ${script} is detected`);
let corpus=0;
for(const {deck:example} of examples){
  const drawnHere=drawnScripts(example,toSvg(example));
  for(const script of drawnHere)assert.ok(detectPresentationScripts(example,{catalogs}).includes(script),`${script} drawn in an example deck is detected`);
  corpus++;
}
assert.ok(corpus>=100,'the example corpus ran');

// ---- Browser loader: all-or-nothing, dispose, abort ----
const base=((await loadFonts({pack: 'base'})).registry).selectEmbeddedFonts(face=>face.family==='Roboto'&&face.weight===400&&!face.italic).map(face=>({...face,data:Uint8Array.from(Buffer.from(face.dataUrl.split(',')[1],'base64'))}));
const packRoot=path.join(root,'node_modules/@expo-google-fonts');
const japanese=deck('四半期レビュー','Body',{language:'ja'});
class Face{constructor(family,bytes,descriptors){this.family=family;this.bytes=bytes;this.descriptors=descriptors;}async load(){if(Face.failing?.test(this.family))throw new Error('FontFace rejected');return this;}}
const makeDocument=()=>{const fonts=new Set();fonts.ready=Promise.resolve();return {fonts,defaultView:{FontFace:Face}};};
const calls=[];
let delay;
const fetch=async(url,init={})=>{
  calls.push({url,signal:init.signal});
  if(delay)await delay;
  init.signal?.throwIfAborted?.();
  try{
    const bytes=await readFile(path.join(packRoot,url.replace('https://fonts.test/pack/','')));
    return {ok:true,status:200,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  }catch{return {ok:false,status:404};}
};
const fresh=(options={})=>{const document=makeDocument();return loadBrowserFonts({faces:base,document,fetch,substitutionPolicy:'visual',fallbackFamily:'Roboto',scriptBaseUrl:'https://fonts.test/pack/',...options}).then(fonts=>({registry:fonts.registry,document}));};

// A FontFace that fails to load leaves the registry, the document and the loaded set untouched, and the next call retries.
{
  const {registry,document}=await fresh();
  const before=registry.describeFaces().length;
  Face.failing=/Noto Sans JP/;
  await assert.rejects(()=>registry.ensureScripts(japanese),{code:'font-load-failed'});
  assert.equal(registry.describeFaces().length,before,'no Noto metrics in the registry');
  assert.equal(document.fonts.size,1,'no face in the document');
  assert.deepEqual(registry.loadedScriptPackages,[]);
  assert.deepEqual(registry.pendingScripts(japanese).map(short),['noto-sans-jp'],'still pending');
  assert.equal(registry.describeFaces().some(face=>/Noto/.test(face.family)),false);
  Face.failing=undefined;
  assert.deepEqual((await registry.ensureScripts(japanese)).loaded.map(short),['noto-sans-jp']);
  assert.equal(registry.describeFaces().length,before+2);
  assert.equal(document.fonts.size,3);
  assert.deepEqual(registry.pendingScripts(japanese),[]);
}
// One failing package does not lose the others: each package is all or nothing, the call rejects with per-package details
// (loaded and failed), and a later call retries only the failure.
{
  const {registry,document}=await fresh();
  Face.failing=/Noto Naskh Arabic/;
  const arabic=deck('مراجعة','Body',{language:'ar'});
  const failure=await registry.ensureScripts(arabic).then(()=>undefined,error=>error);
  assert.equal(failure?.code,'font-load-failed');
  assert.deepEqual(failure.details.loaded.map(short),['noto-sans-arabic','noto-nastaliq-urdu']);
  assert.deepEqual(failure.details.failed.map(item=>[short(item.package),item.code]),[['noto-naskh-arabic','font-load-failed']]);
  assert.deepEqual(registry.loadedScriptPackages.map(short),['noto-sans-arabic','noto-nastaliq-urdu'],'the successful packages stay loaded');
  assert.equal(document.fonts.size,1+4,'only the two loaded packages are in the document');
  assert.deepEqual(registry.pendingScripts(arabic).map(short),['noto-naskh-arabic']);
  const requestsBefore=calls.length;
  Face.failing=undefined;
  const retried=await registry.ensureScripts(arabic);
  assert.deepEqual(retried.loaded.map(short),['noto-naskh-arabic']);
  assert.equal(calls.length-requestsBefore,2,'only the failed package is fetched again');
}
// dispose() during a load leaves no face in the registry or the document, and later calls are rejected.
{
  const {registry,document}=await fresh();
  const before=registry.describeFaces().length;
  let release;delay=new Promise(resolve=>{release=resolve;});
  const pending=registry.ensureScripts(japanese);
  await new Promise(resolve=>setTimeout(resolve,10));
  registry.dispose();
  release();delay=undefined;
  await assert.rejects(()=>pending,{code:'font-registry-disposed'});
  assert.equal(document.fonts.size,0);
  assert.equal(registry.describeFaces().length,before);
  await assert.rejects(()=>registry.ensureScripts(japanese),{code:'font-registry-disposed'});
}
// The abort signal is per call: the creation signal is never reused for lazy fetches.
{
  const creation=new AbortController();
  const {registry}=await fresh({signal:creation.signal});
  creation.abort();
  calls.length=0;
  await registry.ensureScripts(japanese);
  assert.ok(calls.length===2&&calls.every(call=>call.signal===undefined),'lazy fetches without a call signal carry none');
  const call=new AbortController();
  calls.length=0;
  await registry.ensureScripts(deck('ไทย'),{signal:call.signal});
  assert.ok(calls.length>0&&calls.every(entry=>entry.signal===call.signal),'lazy fetches carry the call signal');
  const aborted=new AbortController();aborted.abort();
  await assert.rejects(()=>registry.ensureScripts(deck('שלום'),{signal:aborted.signal}));
  assert.deepEqual(registry.pendingScripts(deck('שלום')).map(short),['noto-sans-hebrew','noto-serif-hebrew'],'an aborted call leaves the package pending');
}

// ---- Registry growth drops stale substitutions ----
{
  const {registry}=await fresh();
  const resolved=registry.resolveFont({fontFamily:'Meiryo',fontWeight:400});
  assert.equal(resolved.resolvedFamily,'Roboto');
  assert.ok(registry.substitutions.some(item=>item.requestedFamily==='Meiryo'),'the fallback was recorded');
  await registry.ensureScripts(japanese);
  assert.equal(registry.substitutions.some(item=>item.requestedFamily==='Meiryo'),false,'a substitution resolved before the face existed is dropped');
  assert.equal(registry.resolveFont({fontFamily:'Meiryo',fontWeight:400}).resolvedFamily,'Noto Sans JP');
}

// ---- Script faces embed only when the slide uses them ----
{
  const registry=(await loadFonts({pack: 'base', scripts:['Jpan','Arab']})).registry;
  // The eager list leaves "used" faces out (like the open families); select them explicitly to embed them per slide.
  assert.equal(registry.embeddedFonts.some(face=>/Noto/.test(face.family)),false,'script faces are not in the eager embeddedFonts');
  const scriptFaces=registry.selectEmbeddedFonts(face=>face.scripts);
  assert.ok(scriptFaces.length>=4&&scriptFaces.every(face=>face.embed==='used'),'script faces are flagged used');
  const options={fonts:{textMeasurement:registry.textMeasurement,embeddedFonts:[...registry.embeddedFonts,...scriptFaces]}};
  const latin=toSvg({slides:[{title:'Plain title',text:'Body'}],design:{fontScheme:'roboto'}}, 1,options);
  assert.equal(/font-family:"Noto/.test(latin),false,'a Latin slide embeds no script face');
  const japaneseSvg=toSvg({language:'ja',design:{fontScheme:'roboto'},slides:[{title:'四半期レビュー',text:'Body'}]}, 1,options);
  assert.ok(japaneseSvg.includes('font-family:"Noto Sans JP"'),'a Japanese slide embeds Noto Sans JP');
  assert.equal(japaneseSvg.includes('font-family:"Noto Naskh Arabic"'),false,'and not the unused Arabic faces');
  assert.ok(latin.length<japaneseSvg.length/3,'the Latin slide is much smaller');
  // Browser entries are flagged too.
  const browser=(await fresh({scripts:['Jpan']})).registry;
  const browserFaces=browser.selectEmbeddedFonts(face=>face.scripts);
  assert.ok(browserFaces.length===2&&browserFaces.every(face=>face.embed==='used'&&/Noto Sans JP/.test(face.family)));
  assert.equal(browser.embeddedFonts.some(face=>/Noto/.test(face.family)),false);
}

// ---- Glyph fallback faces (FF-19 per-character fallback) ----
const cappedDiagnostics=[];
  // Greek and Cyrillic add no package: the office registry always carries Noto Sans as the fallback face, and Roboto covers them.
  for(const title of ['Ελληνικά','Кириллица'])assert.deepEqual(detectPresentationScripts(deck(title)),[],title);
  assert.deepEqual(detectPresentationScripts(deck('Quarterly review')),[]);
  const greek=(await loadFonts({pack: 'base', scripts:'auto',presentation:deck('Ελληνικά')})).registry;
  assert.deepEqual(greek.scriptSelection.packages.map(short),[]);
  // A Simplified-only hanzi inside Japanese text is not in Noto Sans JP; the next CJK face of the chain is loaded.
  const japaneseText=deck('これは啰です','Body',{language:'ja'});
  const registry=(await loadFonts({pack: 'base', scripts:'auto',presentation:japaneseText})).registry;
  assert.deepEqual(registry.scriptSelection.packages.map(short),['noto-sans-jp','noto-sans-sc']);
  assert.ok(registry.scriptFacesCover('啰'));
  assert.equal(registry.fontFiles.filter(file=>/noto-sans-sc/.test(file)).length,2,'the raster font files include the fallback face');
  // Only characters the loaded faces lack trigger more faces: plain Japanese needs only Noto Sans JP.
  assert.deepEqual(((await loadFonts({pack: 'base', scripts:'auto',presentation:deck('これは日本語です','Body',{language:'ja'})})).registry).scriptSelection.packages.map(short),['noto-sans-jp']);
  // The fallback is capped: a Han character no CJK face covers loads the language's face plus ONE fallback, not all four, and is reported.
  const nowhere=deck('これは\u{20000}です','Body',{language:'ja'});
  const capped=(await loadFonts({pack: 'base', scripts:'auto',presentation:nowhere,onDiagnostic:value=>cappedDiagnostics.push(value)})).registry;
  assert.equal(capped.scriptSelection.packages.length,2,'the language face and one fallback');
  assert.ok(capped.scriptSelection.packages.map(short).includes('noto-sans-jp'));
  assert.deepEqual(capped.scriptSelection.uncovered,['\u{20000}']);
  assert.deepEqual(cappedDiagnostics.map(value=>value.code),['script-glyph-uncovered']);
  const {registry:cappedBrowser}=await fresh();
  const cappedResult=await cappedBrowser.ensureScripts(nowhere);
  assert.equal(cappedResult.loaded.length,2);
  assert.deepEqual(cappedResult.uncovered,['\u{20000}']);
  assert.deepEqual(cappedBrowser.pendingScripts(nowhere),[],'nothing more is pending once the cap is reached');
  // Browser: pendingScripts reports the fallback package once the primary is loaded, and ensureScripts loads it.
  const {registry:browser}=await fresh();
  assert.deepEqual(browser.pendingScripts(japaneseText).map(short),['noto-sans-jp']);
  const ensured=await browser.ensureScripts(japaneseText);
  assert.deepEqual(ensured.loaded.map(short),['noto-sans-jp','noto-sans-sc']);
  assert.deepEqual(browser.pendingScripts(japaneseText),[]);
  const drawnText=toSvg({...japaneseText,design:{fontScheme:'roboto'}}, 1,{fonts:{textMeasurement:browser.textMeasurement}});
  assert.ok(drawnText.includes('啰'));

console.log(`Auto script fonts robustness: drawn-text detection, ${corpus}-deck parity corpus, all-or-nothing browser loads, dispose and abort, stale substitutions, used-only embedding, glyph fallback faces.`);
