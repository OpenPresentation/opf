// FF-19: `scripts: 'auto'` loads only the script faces a presentation draws.
import assert from 'node:assert/strict';
import * as core from '@openpresentation/opf';
import {cp,mkdir,readFile,mkdtemp,readdir,rm,symlink,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {renderSvgDeck,svgToPng} from '../dist/index.js';
import {loadBundledFontRegistry,loadOfficeFontRegistry,prepareNodeFonts,detectPresentationScripts,autoScriptSelection,scriptFontPackages} from '../dist/fonts-node.js';
import {detectScripts} from '../dist/fonts.js';
import {loadBrowserFontRegistry} from '../dist/fonts-browser.js';
import * as fontsModule from '../dist/fonts.js';

const deck=(title,text='Body',extra={})=>({$schema:'https://openpresentation.org/schema/opf/v1',name:'Auto script fonts',slides:[{title,text}],...extra});
const short=name=>name.replace('@expo-google-fonts/','');
// The document language decides Han text only when the installed core resolves it (resolveScriptFonts, as the renderer does);
// otherwise the renderer ignores the language and so does detection: Han is Simplified Chinese.
const hasCore=typeof core.resolveScriptFonts==='function';
// A renderer with per-character glyph fallback draws Greek and Cyrillic a Latin face lacks with Noto Sans, so auto loads it then.
const hasFallback=typeof fontsModule.glyphFallbackFamilies==='function';
const han=(withCore,without='Hans')=>hasCore?withCore:without;

// Detection: text decides. Latin, Greek and Cyrillic need no script face.
for(const title of ['Quarterly review 12%','Café Übersicht, naïve — “quotes” …',''])assert.deepEqual(detectPresentationScripts(deck(title)),[],title);
for(const title of ['Ελληνικά Τριμηνιαία','Квартальный обзор'])assert.deepEqual(detectPresentationScripts(deck(title)),[],title);
assert.deepEqual(detectPresentationScripts(deck('Review',['Q1','Q2'])),[]);
// Languages name the script only where text is ambiguous (Han).
const expected=[
  ['ja','四半期レビュー 12%','Jpan'],['ja','漢字',han('Jpan')],['zh-Hans','季度回顾','Hans'],['zh-Hant','季度回顧',han('Hant')],['zh-TW','季度回顧',han('Hant')],
  ['ko','분기별 검토 12%','Kore'],['ar','مراجعة ربع سنوية.','Arab'],['he','סקירה רבעונית.','Hebr'],['hi','तिमाही समीक्षा','Deva'],
  ['th','การทบทวนรายไตรมาส','Thai'],['km','ខ្មែរ','Khmr'],['ta','தமிழ்','Taml'],['bn','বাংলা','Beng'],['am','አማርኛ','Ethi'],['ka','ქართული','Geor'],['hy','հայերեն','Armn'],
];
for(const [language,title,script] of expected)assert.deepEqual(detectPresentationScripts(deck(title,'Body',{language})),[script],`${language} ${title}`);
// Kana marks Japanese and Hangul marks Korean, with or without a language.
assert.deepEqual(detectPresentationScripts(deck('概要とまとめ')),['Jpan']);
assert.deepEqual(detectPresentationScripts(deck('개요 요약')),['Kore']);
// Han without language or kana defaults to Simplified Chinese; a language decides otherwise.
assert.deepEqual(detectPresentationScripts(deck('概要')),['Hans']);
assert.deepEqual(detectPresentationScripts(deck('概要','Body',{language:'ja-JP'})),[han('Jpan')]);
assert.deepEqual(detectPresentationScripts(deck('概要','Body',{language:{bcp47:'zh-Hant'}})),[han('Hant')]);
// CJK inside Latin text (mixed runs) and mixed-script decks load exactly their scripts.
assert.deepEqual(detectPresentationScripts(deck('Review 四半期 2026','Body',{language:'ja'})),[han('Jpan')]);
assert.deepEqual(detectPresentationScripts(deck('Roadmap','Ship 日本語 and مرحبا and שלום')),['Arab','Hans','Hebr']);
// A document language alone needs no face: nothing non-Latin is drawn.
assert.deepEqual(detectPresentationScripts(deck('Review','Body',{language:'ja'})),[]);
assert.deepEqual(detectPresentationScripts(deck('Review','Body',{language:'ar'})),[]);
// Text that is never drawn does not load faces.
assert.deepEqual(detectPresentationScripts(deck('Review','Body',{assets:{logo:{name:'ロゴ'}},catalogs:{fontSchemes:{records:[{name:'日本'}]}}})),[]);
assert.deepEqual(detectPresentationScripts({...deck('Review'),slides:[{title:'Review',notes:'日本語のメモ'}]}),[]);
// Nested content, tables and charts count.
assert.deepEqual(detectPresentationScripts({slides:[{title:'T',blocks:[{table:{columns:['名前','Owner'],rows:[['A','B']]}},{chart:{type:'column',data:{columns:['Q','値'],rows:[['Q1',1]]}}}]}]}),['Hans']);
// The older helper keeps counting the language script unless asked not to.
assert.deepEqual(detectScripts({},{script:'Jpan'}),['Jpan']);
assert.deepEqual(detectScripts({},{script:'Jpan'},{includeLanguage:false}),[]);
// Scripts no pinned font serves are reported, not loaded.
assert.deepEqual(autoScriptSelection(deck('ᏣᎳᎩ 日本語','Body',{language:'ja'})),{detected:['Cher',han('Jpan')].sort(),scripts:[han('Jpan')],unavailable:['Cher']});
// Kana or Hangul in the text pins Japanese or Korean whatever the language.
assert.deepEqual(detectPresentationScripts(deck('概要とまとめ','Body',{language:'zh-Hant'})),['Jpan']);

// The office registry always carries the fallback-only Noto Sans (glyph fallback); it is not a script pack face loaded on demand.
const families=registry=>[...new Set(registry.describeFaces().filter(face=>face.scripts&&!face.fallbackOnly).map(face=>face.family))];
const scriptFaces=registry=>registry.describeFaces().filter(face=>face.scripts&&!face.fallbackOnly).length;

// Latin-only deck: no script face is loaded or read.
for(const load of [loadBundledFontRegistry,loadOfficeFontRegistry]){
  const latin=await load({scripts:'auto',presentation:deck('Quarterly review','Only Latin text, café and naïve')});
  assert.equal(scriptFaces(latin),0);
  assert.deepEqual(latin.scriptSelection,{detected:[],scripts:[],unavailable:[],packages:[],notInstalled:[]});
  const plain=await load();
  assert.equal(latin.describeFaces().length,plain.describeFaces().length,'a Latin-only deck loads the same faces as no scripts');
  assert.equal(latin.fontFiles.length,plain.fontFiles.length);
}

// Each language loads its script packages and nothing else, and the proprietary scheme font resolves to the designated face.
const wanted={
  Jpan:[['noto-sans-jp'],'Meiryo','Noto Sans JP'],Hans:[['noto-sans-sc'],'Microsoft YaHei','Noto Sans SC'],Hant:[['noto-sans-tc'],'Microsoft JhengHei','Noto Sans TC'],
  Kore:[['noto-sans-kr'],'Malgun Gothic','Noto Sans KR'],Arab:[['noto-sans-arabic','noto-naskh-arabic','noto-nastaliq-urdu'],'Arabic Typesetting','Noto Naskh Arabic'],
  Hebr:[['noto-sans-hebrew','noto-serif-hebrew'],'David','Noto Serif Hebrew'],Deva:[['noto-sans-devanagari'],'Mangal','Noto Sans Devanagari'],Thai:[['noto-sans-thai'],'Angsana New','Noto Sans Thai'],
};
for(const [language,title,script] of expected.filter(([,,value])=>wanted[value])){
  const [packages,proprietary,designated]=wanted[script];
  const registry=await loadBundledFontRegistry({scripts:'auto',presentation:deck(title,'Body',{language})});
  assert.deepEqual(registry.scriptSelection.scripts,[script],language);
  assert.deepEqual(registry.scriptSelection.packages.map(short),packages,language);
  assert.ok(families(registry).length>=1&&registry.describeFaces().every(face=>!face.scripts||face.scripts.includes(script)),`${language} loads only ${script} faces`);
  assert.equal(registry.resolveFont({fontFamily:proprietary,fontWeight:400}).resolvedFamily,designated,`${proprietary} -> ${designated}`);
}
// A CJK deck does not pull in another script, and a mixed deck loads both.
const mixed=await loadBundledFontRegistry({scripts:'auto',presentation:deck('Ship 日本語 かな','שלום',{language:'ja'})});
assert.deepEqual(mixed.scriptSelection.scripts,['Hebr','Jpan']);
assert.deepEqual(new Set(families(mixed)),new Set(['Noto Sans JP','Noto Sans Hebrew','Noto Serif Hebrew']));

// Explicit lists keep their behavior; auto needs a presentation; a presentation alone loads nothing.
assert.equal(scriptFaces(await loadBundledFontRegistry({scripts:['Thai']})),2);
await assert.rejects(()=>loadBundledFontRegistry({scripts:'auto'}),{code:'invalid-font-scripts'});
await assert.rejects(()=>prepareNodeFonts({scripts:'auto'}),{code:'invalid-font-scripts'});
assert.equal(scriptFaces(await loadBundledFontRegistry({presentation:deck('日本語')})),0);

// A script no pinned font serves is reported and does not stop the others.
const diagnostics=[];
const partial=await loadBundledFontRegistry({scripts:'auto',presentation:deck('ᏣᎳᎩ 日本語'),onDiagnostic:value=>diagnostics.push(value)});
assert.deepEqual(diagnostics.map(value=>[value.code,value.script]),[['script-font-unavailable','Cher']]);
assert.deepEqual(partial.scriptSelection.scripts,['Hans']);

// prepareNodeFonts: layout, SVG and PNG agree, script faces stay out of embedded SVG, and raster reads them from fontFiles.
{
  const presentation=deck('四半期レビュー 12%','Body text',{language:'ja',design:{fontScheme:'meiryo'}});
  const prepared=await prepareNodeFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation});
  assert.deepEqual(prepared.registry.scriptSelection.scripts,['Jpan']);
  assert.equal(prepared.options.fontFiles.filter(file=>/noto-sans-jp/.test(file)).length,2);
  assert.equal(prepared.options.fontFiles.some(file=>/noto-sans-(sc|tc|kr|arabic)/.test(file)),false);
  assert.equal(prepared.options.embeddedFonts.some(face=>/Noto/.test(face.family)&&face.family!=='Noto Sans'),false,'only the default Noto Sans fallback (embed used) is offered');
  const [svg]=renderSvgDeck(presentation,prepared.options);
  if(hasCore)assert.match(svg,/lang="ja/);
  assert.ok(svg.includes('Noto Sans JP'),'the SVG names the designated family');
  const png=await svgToPng(svg,prepared.options);
  assert.equal(Buffer.from(png.subarray(1,4)).toString(),'PNG');
  if(process.env.OPF_AUTO_FONTS_OUT){await mkdir(process.env.OPF_AUTO_FONTS_OUT,{recursive:true});await writeFile(path.join(process.env.OPF_AUTO_FONTS_OUT,'auto-ja.png'),png);}
}

// Registry growth: addFaces registers faces atomically and updates the script aliases.
{
  const base=await loadBundledFontRegistry();
  const jp=await loadBundledFontRegistry({scripts:['Jpan']});
  const entries=jp.selectEmbeddedFonts(face=>face.scripts).map(face=>({...face,data:Uint8Array.from(Buffer.from(face.dataUrl.split(',')[1],'base64')),scripts:['Jpan']}));
  assert.equal(entries.length,2);
  assert.throws(()=>base.resolveFont({fontFamily:'Meiryo'}),{code:'font-unavailable'});
  const before=base.describeFaces().length;
  assert.throws(()=>base.addFaces([entries[0],entries[0]]),{code:'duplicate-font-face'});
  assert.equal(base.describeFaces().length,before,'a rejected addFaces adds nothing');
  assert.throws(()=>base.addFaces('nope'),{code:'invalid-font-data'});
  assert.deepEqual(base.addFaces(entries).map(face=>face.family),['Noto Sans JP','Noto Sans JP']);
  assert.equal(base.describeFaces().length,before+2);
  assert.equal(base.resolveFont({fontFamily:'Meiryo'}).resolvedFamily,'Noto Sans JP');
  assert.throws(()=>base.addFaces([entries[0]]),{code:'duplicate-font-face'},'faces cannot be added twice');
}

// An optional peer that is not installed is skipped and reported, never a crash. A copy of dist runs beside a
// node_modules that lacks the Japanese package.
{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const temp=await mkdtemp(path.join(os.tmpdir(),'opf-auto-fonts-'));
  try {
    await cp(path.join(root,'dist'),path.join(temp,'dist'),{recursive:true});
    await writeFile(path.join(temp,'package.json'),JSON.stringify({type:'module'}));
    const modules=path.join(temp,'node_modules');
    for(const scope of ['','@expo-google-fonts','@openpresentation']){
      const source=path.join(root,'node_modules',scope),target=path.join(modules,scope);
      await mkdir(target,{recursive:true});
      for(const name of await readdir(source)){
        if(scope===''&&name.startsWith('@'))continue;
        if(scope==='@expo-google-fonts'&&name==='noto-sans-jp')continue;
        await symlink(path.join(source,name),path.join(target,name),'junction');
      }
    }
    const probe=`
      import {loadBundledFontRegistry} from ${JSON.stringify(pathToFileURL(path.join(temp,'dist/fonts-node.js')).href)};
      const diagnostics=[];
      const registry=await loadBundledFontRegistry({scripts:'auto',presentation:{language:'ja',slides:[{title:'日本語です שלום'}]},onDiagnostic:value=>diagnostics.push(value)});
      let explicit;try{await loadBundledFontRegistry({scripts:['Jpan']});}catch(error){explicit=error.code;}
      console.log(JSON.stringify({selection:registry.scriptSelection,diagnostics,explicit,scripts:[...new Set(registry.describeFaces().filter(face=>face.scripts).flatMap(face=>face.scripts))]}));`;
    const run=spawnSync(process.execPath,['--input-type=module','-e',probe],{cwd:temp,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const result=JSON.parse(run.stdout);
    assert.deepEqual(result.selection.notInstalled,['@expo-google-fonts/noto-sans-jp']);
    // Without the Japanese package, a renderer with glyph fallback draws the kanji and kana with the next CJK face, so auto loads it.
    assert.deepEqual(result.selection.packages.map(short),hasFallback?['noto-sans-hebrew','noto-serif-hebrew','noto-sans-sc']:['noto-sans-hebrew','noto-serif-hebrew']);
    assert.deepEqual(result.diagnostics.map(value=>value.code),['script-font-not-installed']);
    assert.match(result.diagnostics[0].message,/Install @expo-google-fonts\/noto-sans-jp@\d+\.\d+\.\d+/);
    assert.deepEqual(result.scripts,hasFallback?['Hebr','Hans']:['Hebr']);
    assert.equal(result.explicit,'font-resource-unavailable','an explicit request for a missing package still fails');
  } finally { await rm(temp,{recursive:true,force:true}); }
}
// Browser loader (mock Font Loading API): faces are fetched lazily, once, hash-verified, and only for the scripts needed.
{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  class Face{constructor(family,bytes,descriptors){this.family=family;this.bytes=bytes;this.descriptors=descriptors;}async load(){return this;}}
  const makeDocument=()=>{const fonts=new Set();fonts.ready=Promise.resolve();return {fonts,defaultView:{FontFace:Face}};};
  const base=(await loadBundledFontRegistry()).selectEmbeddedFonts(face=>!face.scripts).filter(face=>face.family==='Roboto'&&face.weight===400&&!face.italic).map(face=>({...face,data:Uint8Array.from(Buffer.from(face.dataUrl.split(',')[1],'base64'))}));
  assert.equal(base.length,1);
  const requests=[];
  let tamper;
  const fetch=async url=>{
    requests.push(url);
    const match=url.startsWith("https://fonts.test/pack/")?[url,url.slice("https://fonts.test/pack/".length)]:null;
    if(!match)return {ok:false,status:404};
    try{
      const bytes=await readFile(path.join(root,'node_modules/@expo-google-fonts',match[1]));
      if(tamper&&tamper.test(url))bytes[bytes.length>>1]^=1;
      return {ok:true,status:200,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    }catch{return {ok:false,status:404};}
  };
  const scriptRequests=()=>requests.filter(url=>url.startsWith('https://fonts.test/pack/'));
  const fresh=(options={})=>{const document=makeDocument();return loadBrowserFontRegistry(base,{document,fetch,substitutionPolicy:'visual',fallbackFamily:'Roboto',scriptBaseUrl:'https://fonts.test/pack/',...options}).then(registry=>({registry,document}));};

  // Latin-only deck: nothing is fetched beyond the supplied faces.
  let {registry,document}=await fresh({scripts:'auto',presentation:deck('Quarterly review','Latin only, café')});
  assert.equal(scriptRequests().length,0);
  assert.deepEqual(registry.loadedScriptPackages,[]);
  assert.equal(document.fonts.size,1);
  // Edits that stay Latin fetch nothing; the first Japanese edit fetches exactly the Japanese package.
  assert.deepEqual((await registry.ensureScripts(deck('Still Latin'))).loaded,[]);
  assert.equal(scriptRequests().length,0);
  const japanese=deck('四半期レビュー','Body',{language:'ja'});
  assert.deepEqual(registry.pendingScripts(deck('Still Latin')),[]);
  assert.deepEqual(registry.pendingScripts(japanese).map(short),['noto-sans-jp']);
  assert.equal(scriptRequests().length,0,'pendingScripts fetches nothing');
  const grown=await registry.ensureScripts(japanese);
  assert.deepEqual(registry.pendingScripts(japanese),[]);
  assert.deepEqual(grown.loaded.map(short),['noto-sans-jp']);
  assert.deepEqual(scriptRequests().map(url=>url.split('/').at(-2)),['400Regular','700Bold']);
  assert.ok(scriptRequests().every(url=>url.includes('/noto-sans-jp/')));
  assert.equal(document.fonts.size,3);
  assert.equal(registry.resolveFont({fontFamily:'Meiryo',fontWeight:700}).resolvedFamily,'Noto Sans JP');
  assert.ok(registry.textMeasurement.measure('四半期',20,{fontFamily:'Noto Sans JP',fontWeight:400})>0);
  // The same scripts again are free; Arabic adds its own packages; no package loads twice.
  const before=scriptRequests().length;
  assert.deepEqual((await registry.ensureScripts(japanese)).loaded,[]);
  assert.equal(scriptRequests().length,before);
  const both=await registry.ensureScripts(deck('四半期です','مراجعة',{language:'ja'}));
  assert.deepEqual(both.loaded.map(short),['noto-sans-arabic','noto-naskh-arabic','noto-nastaliq-urdu']);
  assert.equal(new Set(scriptRequests()).size,scriptRequests().length,'no font file is fetched twice');
  assert.deepEqual(registry.loadedScriptPackages.map(short),['noto-sans-jp','noto-sans-arabic','noto-naskh-arabic','noto-nastaliq-urdu']);
  // Concurrent calls share the work.
  ({registry,document}=await fresh());
  const start=scriptRequests().length;
  await Promise.all([registry.ensureScripts(japanese),registry.ensureScripts(japanese),registry.loadScripts(['Jpan'])]);
  assert.equal(scriptRequests().length-start,2);
  // dispose removes every face, script faces included.
  registry.dispose();
  assert.equal(document.fonts.size,0);
  // Creation with a presentation loads the same way; a bad setup is reported.
  ({registry,document}=await fresh({scripts:'auto',presentation:deck('ไทย')}));
  assert.deepEqual(registry.loadedScriptPackages.map(short),['noto-sans-thai']);
  ({registry,document}=await fresh({scripts:['Hebr']}));
  assert.deepEqual(registry.loadedScriptPackages.map(short),['noto-sans-hebrew','noto-serif-hebrew']);
  await assert.rejects(()=>fresh({scripts:'auto'}),{code:'invalid-font-scripts'});
  ({registry}=await fresh());
  await assert.rejects(()=>registry.ensureScripts(japanese).then(()=>loadBrowserFontRegistry(base,{document:makeDocument(),fetch}).then(other=>other.ensureScripts(japanese))),{code:'invalid-font-source'});
  // A missing or tampered file is never used, and a later call can retry.
  tamper=new RegExp('noto-sans-jp/700Bold');
  ({registry,document}=await fresh());
  await assert.rejects(()=>registry.ensureScripts(japanese),{code:'font-integrity-mismatch'});
  assert.equal(document.fonts.size,1,'a failed load leaves no script face behind');
  assert.deepEqual(registry.loadedScriptPackages,[]);
  tamper=undefined;
  assert.deepEqual((await registry.ensureScripts(japanese)).loaded.map(short),['noto-sans-jp']);
  ({registry}=await fresh({scriptBaseUrl:'https://fonts.test/missing/'}));
  await assert.rejects(()=>registry.ensureScripts(japanese),{code:'font-fetch-failed'});
}
console.log('Auto script fonts: detection, per-language loading, Latin-only no-ops, diagnostics, registry growth and missing optional peers verified.');
