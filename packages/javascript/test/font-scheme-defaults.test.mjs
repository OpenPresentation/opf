import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {DEFAULT_FONT_SCHEME,fontSchemes,resolveFontSchemeReference,themes,validatePresentation} from '../dist/index.js';
import {resolveFontFamilies} from '../dist/composition.js';
import {paginatePresentation} from '../dist/pagination.js';

// FF-17 (font-fidelity-everywhere): the code role follows the chosen scheme,
// with Roboto Mono as the documented fallback.
// FF-35: every engine shares one last-resort font scheme, DEFAULT_FONT_SCHEME
// ('aptos'), so pagination, preview and PPTX export agree.

const record=id=>fontSchemes.find(scheme=>scheme.id===id);
const codeSlide={id:'code',layout:'code-1x',title:'Rule',code:{source:'const score = urgency * confidence;',language:'ts'}};
function measuredFamilies(presentation){
  const families=new Set();
  paginatePresentation(structuredClone(presentation),{textMeasurement:{measure:(text,size,style)=>{families.add(style.fontFamily);return text.length*size*.5;}}});
  return families;
}

test('catalog records carry code only for monospace schemes, and it matches their body family',()=>{
  const withCode=fontSchemes.filter(scheme=>scheme.code!==undefined).map(scheme=>scheme.id).sort();
  const monospace=fontSchemes.filter(scheme=>scheme.type==='monospace').map(scheme=>scheme.id).sort();
  assert.deepEqual(withCode,['consolas','courier-new']);
  assert.deepEqual(withCode,monospace);
  for(const id of withCode)assert.deepEqual(record(id).code,{family:record(id).minor});
});

test('the code role resolves from the scheme, else the documented Roboto Mono fallback',()=>{
  assert.equal(resolveFontFamilies(record('consolas')).code,'Consolas');
  assert.equal(resolveFontFamilies(record('courier-new')).code,'Courier New');
  for(const id of ['roboto','aptos','calibri','meiryo'])assert.equal(resolveFontFamilies(record(id)).code,'Roboto Mono');
  assert.equal(resolveFontFamilies(undefined).code,'Roboto Mono');
  // A design override on the same object still wins over the record.
  assert.equal(resolveFontFamilies({...record('consolas'),code:{family:'JetBrains Mono'}}).code,'JetBrains Mono');
  // Heading and body families never become the code fallback.
  assert.equal(resolveFontFamilies({major:'Consolas',minor:'Consolas',type:'monospace'}).code,'Roboto Mono');
});

test('pagination measures code in the chosen scheme family',()=>{
  for(const [fontScheme,family,absent] of [['consolas','Consolas','Roboto Mono'],['courier-new','Courier New','Roboto Mono'],['aptos','Roboto Mono','Consolas']]){
    const families=measuredFamilies({name:'Code font',design:{fontScheme},slides:[codeSlide]});
    assert.ok(families.has(family),`${fontScheme} measures ${family}`);
    assert.ok(!families.has(absent),`${fontScheme} does not measure ${absent}`);
  }
  const override=measuredFamilies({name:'Code font',design:{fontScheme:{id:'consolas',code:{family:'JetBrains Mono'}}},slides:[codeSlide]});
  assert.ok(override.has('JetBrains Mono')&&!override.has('Roboto Mono'));
});

test('inline catalog records may carry the code role and still validate',()=>{
  const custom={$schema:'https://openpresentation.org/schema/opf-font-scheme/v1',id:'team-mono',name:'Team Mono',major:'Inter',minor:'Inter',code:{family:'JetBrains Mono',weight:400}};
  const presentation={name:'Inline code font',design:{fontScheme:'team-mono'},catalogs:{fontSchemes:{records:[custom]}},slides:[codeSlide]};
  assert.equal(validatePresentation(presentation).valid,true);
  const families=measuredFamilies(presentation);
  assert.ok(families.has('JetBrains Mono')&&!families.has('Roboto Mono'));
});

test('one shared engine default font scheme: aptos (FF-35, docs/design-resolution.md)',()=>{
  assert.equal(DEFAULT_FONT_SCHEME,'aptos');
  assert.ok(record(DEFAULT_FONT_SCHEME),'the shared default is a bundled font scheme');
  const defaults=JSON.parse(readFileSync(new URL('../../../spec/reference/engine-defaults.json',import.meta.url),'utf8'));
  assert.equal(defaults.theme,'minimal');
  assert.equal(defaults.fontScheme.pptx.latin,DEFAULT_FONT_SCHEME);
  // Kept only as the target default for a future Google Slides exporter; no current engine reads it.
  assert.equal(defaults.fontScheme.google.latin,'roboto');
  // Every bundled theme names a font scheme, so the last-resort default only
  // applies to custom themes without one.
  for(const theme of themes)assert.ok(record(theme.fontScheme),`${theme.id} names a bundled font scheme`);
  assert.equal(themes.find(theme=>theme.id==='minimal').fontScheme,DEFAULT_FONT_SCHEME);
});

test('pagination measures a custom theme without a font scheme in the shared default (Aptos, as exported)',()=>{
  const bare={$schema:'https://openpresentation.org/schema/opf-theme/v1',id:'bare',name:'Bare'};
  const slides=[{id:'t',title:'Title',text:'Body'}];
  const aptos=[resolveFontFamilies(record(DEFAULT_FONT_SCHEME)).heading,resolveFontFamilies(record(DEFAULT_FONT_SCHEME)).body].sort();
  assert.deepEqual(aptos,['Aptos','Aptos Display']);
  const custom=measuredFamilies({name:'No font scheme',design:{theme:'bare'},catalogs:{themes:{records:[bare]}},slides});
  assert.deepEqual([...custom].sort(),aptos);
  assert.ok(!custom.has('Roboto'),'the former roboto last resort is gone');
  // Same result as a document with no design (default theme minimal, which names aptos)
  // and as naming the default explicitly.
  assert.deepEqual([...measuredFamilies({name:'Defaults',slides})].sort(),aptos);
  assert.deepEqual([...measuredFamilies({name:'Explicit',design:{fontScheme:DEFAULT_FONT_SCHEME},slides})].sort(),aptos);
  // Deck and slide choices still win over the last resort.
  assert.deepEqual([...measuredFamilies({name:'Deck',design:{theme:'bare',fontScheme:'roboto'},catalogs:{themes:{records:[bare]}},slides})].sort(),['Roboto']);
});

// FF-35b: an unresolvable font scheme behaves the same in every engine. The
// DEFAULT_FONT_SCHEME record is the base, sibling overrides still apply, and one
// `unresolved-font-scheme` diagnostic names the reference. opf-render, opf-editor
// and opf-pptx run the same cases in their own test/default-font-scheme.mjs.
const unknownCases=[
  ['string id',{design:{fontScheme:'no-such-scheme'}},['Aptos','Aptos Display'],'design.fontScheme'],
  ['object id',{design:{fontScheme:{id:'no-such-scheme'}}},['Aptos','Aptos Display'],'design.fontScheme'],
  ['object id with a family pair',{design:{fontScheme:{id:'no-such-scheme',major:'Inter',minor:'Inter'}}},['Inter'],'design.fontScheme'],
  ['slide design',{slideDesign:{fontScheme:'no-such-scheme'}},['Aptos','Aptos Display'],'slides.0.design.fontScheme'],
  ['theme record',{design:{theme:'bare-unknown'},catalogs:{themes:{records:[{$schema:'https://openpresentation.org/schema/opf-theme/v1',id:'bare-unknown',name:'Bare',fontScheme:'no-such-scheme'}]}}},['Aptos','Aptos Display'],'design.theme'],
  ['inline scheme without id',{design:{fontScheme:{major:'Inter',minor:'Inter'}}},['Inter'],undefined],
  ['inline code role without id',{design:{fontScheme:{code:{family:'JetBrains Mono'}}}},['Aptos','Aptos Display'],undefined],
];
const unknownDeck=({design,slideDesign,catalogs})=>({name:'Unknown font scheme',...(design?{design}:{}),...(catalogs?{catalogs}:{}),slides:[{id:'t',title:'Title',text:'Body',...(slideDesign?{design:slideDesign}:{})},{id:'u',title:'Second',text:'Body'}]});

test('an unresolved font scheme falls back to the shared default with one diagnostic',()=>{
  for(const [name,input,families,path] of unknownCases){
    const deck=unknownDeck(input),diagnostics=[],measured=new Set();
    assert.equal(validatePresentation(deck).valid,true,name);
    paginatePresentation(structuredClone(deck),{onDiagnostic:diagnostic=>diagnostics.push(diagnostic),textMeasurement:{measure:(text,size,style)=>{measured.add(style.fontFamily);return text.length*size*.5;}}});
    assert.deepEqual([...measured].sort(),families,name);
    assert.deepEqual(diagnostics,path?[{code:'unresolved-font-scheme',path,id:'no-such-scheme',fallback:DEFAULT_FONT_SCHEME,message:`Font scheme 'no-such-scheme' is not in the inline or bundled catalogs; using the default font scheme '${DEFAULT_FONT_SCHEME}'.`}]:[],name);
  }
});

test('resolveFontSchemeReference and resolveFontFamilies share the default base',()=>{
  const lookup=id=>record(id);
  assert.deepEqual(resolveFontFamilies(undefined),resolveFontFamilies(record(DEFAULT_FONT_SCHEME)),'inlined default families match the aptos record');
  assert.deepEqual(resolveFontFamilies({}),{heading:'Aptos Display',body:'Aptos',code:'Roboto Mono'});
  assert.deepEqual(resolveFontSchemeReference('roboto',lookup),{scheme:record('roboto')});
  assert.deepEqual(resolveFontSchemeReference({id:'consolas',minor:'Consolas'},lookup).scheme,{...record('consolas'),id:'consolas',minor:'Consolas'});
  const unresolved=resolveFontSchemeReference({id:'nope',code:{family:'JetBrains Mono'}},lookup,'slides.2.design.fontScheme');
  assert.deepEqual(unresolved.scheme,{...record(DEFAULT_FONT_SCHEME),id:'nope',code:{family:'JetBrains Mono'}});
  assert.equal(unresolved.diagnostic.path,'slides.2.design.fontScheme');
  assert.deepEqual(resolveFontFamilies(unresolved.scheme),{heading:'Aptos Display',body:'Aptos',code:'JetBrains Mono'});
  // A host that cannot supply even the default record still gets the default families.
  assert.deepEqual(resolveFontFamilies(resolveFontSchemeReference('nope',()=>undefined).scheme),{heading:'Aptos Display',body:'Aptos',code:'Roboto Mono'});
});
