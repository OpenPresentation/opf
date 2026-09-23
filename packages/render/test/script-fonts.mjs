// FF-19: script fonts, lang and RTL in previews. Offline and deterministic.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as core from '@openpresentation/opf';
import {renderSvg,renderSvgDeck,resolvePresentation,svgToPng} from '../dist/index.js';
import {prepareNodeFonts,scriptFontPackages,BUNDLED_FONT_MANIFEST} from '../dist/fonts-node.js';
import {createScriptFonts,createScriptTextMeasurement,detectScripts,itemizeScripts,scriptFontAliases,scriptFontRole,textRole,SCRIPT_FONT_FAMILIES,SCRIPT_FONT_REPLACEMENTS} from '../dist/fonts.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const hasCoreResolver=typeof core.resolveScriptFonts==='function';

// Pack metadata: open licenses, exact optional peers, hash-pinned faces.
const scriptPackages=scriptFontPackages('all');
assert.ok(scriptPackages.length>=30);
for(const item of scriptPackages){
  assert.equal(item.license,'OFL-1.1',item.name);
  assert.equal(pkg.peerDependencies[item.name],item.version,`${item.name} is an exact peer`);
  assert.equal(pkg.peerDependenciesMeta[item.name].optional,true,`${item.name} is optional`);
  assert.equal(pkg.devDependencies[item.name],item.version,`${item.name} is pinned for tests`);
  assert.equal(pkg.dependencies[item.name],undefined,`${item.name} must not bloat the runtime install`);
  assert.ok(item.faces.length>=1&&item.faces.every(face=>/^[0-9a-f]{64}$/.test(face.sha256)),item.name);
  assert.match(await readFile(new URL(`../node_modules/${item.name}/${item.licenseFile}`,import.meta.url),'utf8'),/SIL Open Font License, Version 1\.1/);
}
for(const item of BUNDLED_FONT_MANIFEST.packages.filter(entry=>entry.pack!=='scripts'))assert.equal(item.scripts,undefined);
assert.deepEqual(scriptFontPackages(['Hira']).map(item=>item.name),['@expo-google-fonts/noto-sans-jp']);
assert.throws(()=>scriptFontPackages(['Zzzz']),{code:'font-script-unavailable'});
assert.throws(()=>scriptFontPackages('Jpan'),{code:'invalid-font-scripts'});
// Every designated family that the pack pins is a real pinned face.
const pinnedFamilies=new Set(scriptPackages.flatMap(item=>item.faces.map(face=>face.family)));
for(const [script,entry] of Object.entries(SCRIPT_FONT_FAMILIES))assert.ok(Object.values(entry).some(family=>pinnedFamilies.has(family)),`${script} has a pinned replacement`);
for(const rule of SCRIPT_FONT_REPLACEMENTS)assert.ok(rule.substitutes.some(family=>pinnedFamilies.has(family)),`${rule.requestedFamily} has a pinned replacement`);
assert.equal(scriptFontAliases(['Noto Sans JP']).Meiryo,'Noto Sans JP');
assert.equal(scriptFontAliases(['Noto Sans JP'])['MS Mincho'],'Noto Sans JP');
assert.equal(scriptFontAliases([]).Meiryo,undefined);

// Itemization by Unicode script with PowerPoint's slot rules for common characters.
assert.deepEqual(itemizeScripts('ABC 日本語、テスト。').map(run=>[run.text,run.script,run.role]),[['ABC ','Latn','latin'],['日本語、テスト。','Jpan','eastAsian']]);
assert.deepEqual(itemizeScripts('中文 text').map(run=>run.script),['Hans','Latn']);
assert.deepEqual(itemizeScripts('中文',{bcp47:'zh-Hant'}).map(run=>run.script),['Hant']);
// ASCII spaces, digits and punctuation next to East Asian text use the latin slot.
assert.deepEqual(itemizeScripts('한국어 漢字').map(run=>[run.text,run.script]),[['한국어','Kore'],[' ','Latn'],['漢字','Kore']]);
assert.deepEqual(itemizeScripts('売上は12%増').map(run=>[run.text,run.role]),[['売上は','eastAsian'],['12%','latin'],['増','eastAsian']]);
// CJK punctuation (U+3000-303F) and fullwidth forms (U+FF00-FFEF) are East Asian, also at the start of a text.
assert.deepEqual(itemizeScripts('「引用」').map(run=>[run.text,run.role]),[['「引用」','eastAsian']]);
assert.deepEqual(itemizeScripts('　ABC').map(run=>[run.text,run.role]),[['　','eastAsian'],['ABC','latin']]);
assert.deepEqual(itemizeScripts('ABC（x）').map(run=>[run.text,run.role]),[['ABC','latin'],['（','eastAsian'],['x','latin'],['）','eastAsian']]);
// Curly quotes, dashes and the ellipsis follow the language: East Asian under ja-JP, Latin otherwise.
const japaneseProfile={bcp47:'ja',script:'Jpan',scriptRole:'eastAsian'};
assert.deepEqual(itemizeScripts('“Hi” — ok…',japaneseProfile).map(run=>run.role),['eastAsian','latin','eastAsian','latin','eastAsian','latin','eastAsian']);
assert.deepEqual(itemizeScripts('“Hi” — ok…',{bcp47:'en'}).map(run=>run.role),['latin']);
// ASCII neutrals stay inside complex-script runs; leading ones join the first complex-script run.
assert.deepEqual(itemizeScripts('12 مرحبا 34').map(run=>[run.text,run.script]),[['12 مرحبا 34','Arab']]);
assert.deepEqual(itemizeScripts('"مرحبا" hello').map(run=>[run.text,run.script]),[['"مرحبا" ','Arab'],['hello','Latn']]);
// Paragraph direction comes from core paragraphDirection (core #134): required, never vendored.
// Every paragraph's rendered direction must equal core's, including marks, isolates and historic RTL scripts.
assert.equal(typeof core.paragraphDirection,'function','the linked core exports paragraphDirection');
{
  const ch=code=>String.fromCodePoint(code),arabic=ch(0x645)+ch(0x631)+ch(0x62D)+ch(0x628)+ch(0x627),hebrew=ch(0x5E9)+ch(0x5DC)+ch(0x5D5)+ch(0x5DD);
  const LRM=ch(0x200E),RLM=ch(0x200F),ALM=ch(0x61C),LRI=ch(0x2066),RLI=ch(0x2067),PDI=ch(0x2069);
  const samples=[
    [arabic+' PowerPoint','rtl'],['PowerPoint '+arabic,'ltr'],['123 !?','rtl'],['English only.','ltr'],[hebrew,'rtl'],
    [LRM+'123','ltr'],[RLM+'123 abc','rtl'],[ALM+' abc','rtl'],
    [LRI+arabic+PDI+' abc','ltr'],[RLI+'abc'+PDI+' '+arabic,'rtl'],
    [ch(0x10900)+ch(0x10901)+' abc','rtl'],[ch(0x10A10)+' abc','rtl'],
  ];
  const rendered=(text,language)=>{
    const svg=renderSvg({$schema:'https://openpresentation.org/schema/opf/v1',name:'direction',language,design:{fontScheme:'roboto'},slides:[{title:'T',text}]});
    const body=/<text [^>]*font-size="25"[^>]*>([\s\S]*?)<\/text>/.exec(svg)[1];
    // The renderer wraps an RTL paragraph in RLI...PDI; no sample text itself ends with PDI.
    return body.startsWith(RLI)&&body.endsWith(PDI)?'rtl':'ltr';
  };
  for(const [text,expected] of samples){
    assert.equal(core.paragraphDirection(text,'rtl'),expected,'core rule for '+JSON.stringify(text));
    assert.equal(rendered(text,'arabic'),core.paragraphDirection(text,'rtl'),'preview direction equals core for '+JSON.stringify(text));
    assert.equal(rendered(text,'english'),core.paragraphDirection(text,'ltr'),'left-to-right deck for '+JSON.stringify(text));
  }
}
// Heading or body slots follow the text's role, not its latin family.
assert.equal(textRole({path:'slides.0.title'}),'heading');assert.equal(textRole({path:'slides.2.subtitle.1'}),'heading');
assert.equal(textRole({path:'slides.0.text'}),'body');assert.equal(textRole({path:'slides.0.blocks.1.text.0'}),'body');assert.equal(textRole({}),undefined);
{
  const same={latin:'Roboto',eastAsian:'Heading EA',complexScript:'Roboto'},body={latin:'Roboto',eastAsian:'Body EA',complexScript:'Roboto'};
  const planner=createScriptFonts({heading:same,body,script:'Latn'});
  assert.equal(planner.plan('Title 日本',{fontFamily:'Roboto',path:'slides.0.title'}).find(run=>!run.own).family,'Heading EA');
  assert.equal(planner.plan('Body 日本',{fontFamily:'Roboto',path:'slides.0.text'}).find(run=>!run.own).family,'Body EA');
}
assert.deepEqual(itemizeScripts('हिन्दी').map(run=>run.role),['complexScript']);
assert.equal(scriptFontRole('Thai'),'complexScript');assert.equal(scriptFontRole('Cyrl'),'latin');
assert.deepEqual(detectScripts({slides:[{title:'Привет',text:['日本語です','ไทย']}]}),['Jpan','Thai']);
if(hasCoreResolver)for(const script of ['Jpan','Hans','Arab','Deva','Thai','Latn','Cyrl','Grek'])assert.equal(scriptFontRole(script),core.scriptFontRole(script),script);

const scriptsNeeded=['Jpan','Hans','Hant','Kore','Arab','Hebr','Deva','Thai','Guru'];
const fonts=await prepareNodeFonts({pack:'base',scripts:scriptsNeeded});
assert.equal(fonts.registry.textMeasurement.resolveStyle({fontFamily:'Meiryo',fontWeight:400}).fontFamily,'Noto Sans JP');
assert.equal(fonts.options.embeddedFonts.length,9,'Script faces stay out of embedded SVG fonts unless requested');
assert.ok(fonts.options.fontFiles.some(file=>/NotoSansJP_400Regular\.ttf$/.test(file)));
// No italic CJK faces: italic requests use upright advances, recorded as visual.
fonts.registry.clearSubstitutions();
const italic=fonts.registry.resolveFont({fontFamily:'Noto Sans JP',fontWeight:400,italic:true});
assert.equal(italic.italic,false);assert.equal(italic.compatibility,'visual');
assert.equal(fonts.registry.substitutions.length,1);
// fontkit cannot apply one Noto Sans Gurmukhi mark anchor (tippi); advances are measured without mark positioning.
assert.ok(fonts.registry.textMeasurement.measure('ਪੰਜਾਬੀ',20,{fontFamily:'Noto Sans Gurmukhi',fontWeight:400})>0);
// The raw registry stays strict: no hidden fallback without the script-aware wrapper.
assert.throws(()=>fonts.registry.textMeasurement.measure('日本語',20,{fontFamily:'Roboto',fontWeight:400}),{code:'missing-glyph'});

const svgFamilies=svg=>[...new Set([...svg.matchAll(/font-family="([^"]*)"/g)].map(match=>match[1].split(',')[0].trim()))];
const scriptRuns=svg=>[...svg.matchAll(/<tspan font-family="([^",]*)[^"]*"[^>]*>([^<]*)<\/tspan>/g)].map(match=>[match[1],match[2]]);
const deck=(language,fontScheme,title,text)=>({$schema:'https://openpresentation.org/schema/opf/v1',name:`FF-19 ${language}`,language,design:{fontScheme},slides:[{title,text}]});
const classes=[
  {id:'latin',language:'english',scheme:'roboto',title:'Quarterly review',text:'Revenue grew 12% year over year.',family:'Roboto',lang:'en',rtl:false},
  {id:'cyrillic',language:'russian',scheme:'roboto',title:'Квартальный обзор',text:'Выручка выросла на 12%.',family:'Roboto',lang:'ru',rtl:false},
  {id:'greek',language:'greek',scheme:'roboto',title:'Τριμηνιαία ανασκόπηση',text:'Τα έσοδα αυξήθηκαν 12%.',family:'Roboto',lang:'el',rtl:false},
  {id:'ja',language:'japanese',scheme:'meiryo',title:'四半期レビュー',text:'売上は前年比12%増加しました。',family:'Noto Sans JP',lang:'ja',rtl:false,substitution:'Meiryo'},
  {id:'zh-Hans',language:'chinese-simplified',scheme:'microsoft-yahei',title:'季度回顾',text:'收入同比增长12%。',family:'Noto Sans SC',lang:'zh-Hans',rtl:false,substitution:'Microsoft YaHei'},
  {id:'zh-Hant',language:'chinese-traditional',scheme:'microsoft-jhenghei',title:'季度回顧',text:'營收年增12%。',family:'Noto Sans TC',lang:'zh-Hant',rtl:false,substitution:'Microsoft JhengHei'},
  {id:'ko',language:'korean',scheme:'malgun-gothic',title:'분기별 검토',text:'매출이 전년 대비 12% 증가했습니다.',family:'Noto Sans KR',lang:'ko',rtl:false,substitution:'Malgun Gothic'},
  {id:'ar',language:'arabic',scheme:'arabic-typesetting',title:'مراجعة ربع سنوية',text:'نمت الإيرادات بنسبة 12% على أساس سنوي.',family:'Noto Naskh Arabic',lang:'ar',rtl:true,substitution:'Arabic Typesetting'},
  {id:'he',language:'hebrew',scheme:'david',title:'סקירה רבעונית',text:'ההכנסות גדלו ב-12% משנה לשנה.',family:'Noto Serif Hebrew',lang:'he',rtl:true,substitution:'David'},
  {id:'hi',language:'hindi',scheme:'mangal',title:'तिमाही समीक्षा',text:'राजस्व में साल-दर-साल 12% की वृद्धि हुई।',family:'Noto Sans Devanagari',lang:'hi',rtl:false,substitution:'Mangal'},
  {id:'th',language:'thai',scheme:'angsana-new',title:'การทบทวนรายไตรมาส',text:'รายได้เติบโตขึ้น 12% เมื่อเทียบกับปีก่อน',family:'Noto Sans Thai',lang:'th',rtl:false,substitution:'Angsana New'},
];
const report=[];
for(const value of classes){
  const document=deck(value.language,value.scheme,value.title,value.text);
  fonts.registry.clearSubstitutions();
  const svg=renderSvg(document,{...fonts.options,trace:true});
  // Deterministic: identical SVG for identical input and fonts.
  assert.equal(renderSvg(document,{...fonts.options,trace:true}),svg,`${value.id} SVG is deterministic`);
  const families=svgFamilies(svg);
  assert.ok(families.includes(value.family),`${value.id} draws ${value.family}: ${families}`);
  if(value.substitution)assert.ok(fonts.registry.substitutions.some(item=>item.requestedFamily===value.substitution&&item.resolvedFamily===value.family&&item.compatibility==='visual'),`${value.id} records ${value.substitution}`);
  if(hasCoreResolver){
    assert.match(svg,new RegExp(` lang="${value.lang}"`),`${value.id} lang`);
    assert.match(svg,new RegExp(` xml:lang="${value.lang}"`),`${value.id} xml:lang`);
  }
  assert.equal(svg.includes('\u2067'),value.rtl&&hasCoreResolver,`${value.id} right-to-left isolates`);
  report.push({id:value.id,families});
}

// Script text inside a Latin deck: each run takes its slot's face, and the
// measured advance is the sum of the per-run advances.
const mixed=deck('english','roboto','Mixed 日本語 title','Body with 中文 and العربية text');
const mixedSvg=renderSvg(mixed,fonts.options);
assert.deepEqual(scriptRuns(mixedSvg).map(([family])=>family),['Noto Sans SC','Noto Sans SC','Noto Sans Arabic']);
for(const element of mixedSvg.match(/<text [^>]*>(?:(?!<\/text>).)*<\/text>/gs).filter(item=>item.includes('<tspan x='))){
  // Positioned runs replace one textLength that would span differently fonted tspans.
  assert.doesNotMatch(element.slice(0,element.indexOf('>')),/textLength/);
  const advances=[...element.matchAll(/<tspan [^>]*textLength="([\d.]+)"[^>]*x="([\d.]+)"/g)].map(match=>[Number(match[1]),Number(match[2])]);
  for(let index=1;index<advances.length;index++)assert.ok(Math.abs(advances[index-1][1]+advances[index-1][0]-advances[index][1])<0.002,'Runs abut at their measured advances');
}
const resolvedMixed=resolvePresentation(mixed,fonts.options).slides[0];
const measurement=resolvedMixed.textMeasurement,style={fontFamily:'Roboto',fontWeight:400};
const parts=[['Body with ','Roboto'],['中文','Noto Sans SC'],[' and ','Roboto'],['العربية ','Noto Sans Arabic'],['text','Roboto']];
const sum=parts.reduce((total,[text,fontFamily])=>total+fonts.registry.textMeasurement.measure(text,25,{...style,fontFamily}),0);
assert.ok(Math.abs(measurement.measure('Body with 中文 and العربية text',25,style)-sum)<1e-9);
// Latin text measures exactly as before (the wrapper passes it through).
assert.equal(measurement.measure('Revenue grew 12%.',25,style),fonts.registry.textMeasurement.measure('Revenue grew 12%.',25,style));
assert.ok(measurement.outlineBounds('中文 and',25,style).width>0);

// A Japanese language in a Latin deck: the East Asian slot is the language's
// font (Meiryo), previewed with its designated replacement.
const latinJapanese=renderSvg(deck('japanese','roboto','Quarterly 四半期','Body'),fonts.options);
assert.deepEqual(scriptRuns(latinJapanese).map(([family])=>family),['Noto Sans JP']);
// Han with a Traditional Chinese language uses the TC face.
assert.deepEqual(scriptRuns(renderSvg(deck('chinese-traditional','roboto','Report 季度','Body'),fonts.options)).map(([family])=>family),['Noto Sans TC']);

// Right to left: a line with Arabic letters is one isolate; its runs are placed
// from the right edge. A Latin-only line in the same deck keeps its order.
const arabicMixed=renderSvg(deck('arabic','roboto','العربية PowerPoint 365.','English only line.'),fonts.options);
if(hasCoreResolver){
  const title=arabicMixed.match(/<text [^>]*font-size="54"[^>]*>(.*?)<\/text>/s)[1];
  const positions=[...title.matchAll(/<tspan [^>]*x="([\d.]+)"[^>]*>\u2067([^<]*)\u2069<\/tspan>/g)].map(match=>[match[2],Number(match[1])]);
  assert.deepEqual(positions.map(([text])=>text),['العربية ','PowerPoint 365.']);
  assert.ok(positions[0][1]>positions[1][1],'The first logical run is placed to the right');
  assert.match(arabicMixed,/>English only line\.</);
}

// Direction is per paragraph: every wrapped line of an RTL paragraph is isolated,
// including lines with only Latin words, and each paragraph decides on its own.
if(hasCoreResolver){
  const paragraphDeck=deck('arabic','roboto','Title','مرحبا '+'English words wrap here '.repeat(12)+'\nSecond paragraph in English.');
  const svg=renderSvg(paragraphDeck,fonts.options);
  const body=[...svg.matchAll(/<text [^>]*font-size="25"[^>]*>([\s\S]*?)<\/text>/g)].map(match=>match[1]);
  assert.ok(body.length>=3,'the RTL paragraph wraps');
  assert.ok(body.slice(0,-1).every(line=>line.includes('\u2067')),'every wrapped line of the RTL paragraph is isolated');
  assert.ok(body.slice(0,-1).some(line=>!/[؀-ۿ]/.test(line)),'a wrapped RTL-paragraph line holds only Latin words');
  assert.ok(!body.at(-1).includes('\u2067'),'the English paragraph stays left to right');
  const diagnostics=[];renderSvg(paragraphDeck,{onDiagnostic:item=>diagnostics.push(item)});
  assert.ok(!diagnostics.some(item=>/^language-preview/.test(item.code)),'no language diagnostic with a resolver');
}else{
  const diagnostics=[];renderSvgDeck(deck('arabic','roboto','مرحبا','x'),{onDiagnostic:item=>diagnostics.push(item)});
  assert.equal(diagnostics.filter(item=>item.code==='language-preview-unavailable').length,1,'published core without the resolver reports once');
}

// Estimated previews (no registry) name every candidate so the host resolves glyphs.
const estimated=renderSvg(deck('japanese','roboto','Quarterly 四半期','Body'));
assert.match(estimated,/<tspan font-family="Meiryo, Noto Sans JP, Noto Serif JP, sans-serif">四半期<\/tspan>/);
assert.doesNotMatch(renderSvg(deck('english','roboto','Quarterly review','Body')),/<tspan/);

// Raster output is deterministic and draws the script faces from fontFiles.
const pngA=await svgToPng(renderSvg(deck('japanese','meiryo','四半期レビュー','売上'),fonts.options),{...fonts.options,scale:.25});
const pngB=await svgToPng(renderSvg(deck('japanese','meiryo','四半期レビュー','売上'),fonts.options),{...fonts.options,scale:.25});
assert.deepEqual(pngA,pngB);
const withoutFace=await svgToPng(renderSvg(deck('japanese','meiryo','四半期レビュー','売上'),fonts.options),{...fonts.options,fontFiles:fonts.options.fontFiles.filter(file=>!/NotoSansJP/.test(file)),scale:.25});
assert.notDeepEqual(pngA,withoutFace,'The raster uses the pinned Noto Sans JP face');

// Deck-level API for pagination and editors: the same wrapper outside the renderer.
if(hasCoreResolver){
  const wrapped=createScriptTextMeasurement(fonts.registry.textMeasurement,core.resolveScriptFonts(deck('japanese','roboto','x','y')));
  assert.ok(wrapped.measure('四半期',20,style)>0);
  assert.equal(createScriptFonts({},wrapped).textMeasurement.measure('四半期',20,style),wrapped.measure('四半期',20,style),'Wrapping twice does not change measurement');
}
// Without the script pack, a strict registry still reports what is missing.
const strict=await prepareNodeFonts({pack:'base'});
assert.throws(()=>renderSvgDeck(deck('japanese','roboto','四半期','Body'),strict.options),{code:'missing-glyph'});
assert.throws(()=>renderSvgDeck(deck('japanese','meiryo','四半期','Body'),strict.options),{code:'font-unavailable'});
console.log(`Script fonts passed: ${classes.length} script classes (${report.map(item=>`${item.id}:${item.families.join('/')}`).join(', ')}), mixed-script runs, lang, RTL isolates, estimated stacks, deterministic raster and ${scriptPackages.length} pinned OFL packages.`);
