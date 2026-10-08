import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import { ENGINE_DEFAULT_FONT_SCHEME, resolveFontScheme } from "../dist/index.js";
import { defaultCatalog } from "../dist/catalog.js";
import {resolveFontFamilies} from '../dist/composition.js';
import {paginate} from '../dist/pagination.js';
import { check } from './support/validation.mjs';

// FF-17 (font-fidelity-everywhere): the code role follows the chosen scheme,
// with Roboto Mono as the documented fallback.
// FF-35 / FA-21: every engine shares one last-resort font scheme, ENGINE_DEFAULT_FONT_SCHEME
// (Aptos Display / Aptos, spec/reference/engine-defaults.json), so pagination, preview and PPTX export agree.

const catalogs=[defaultCatalog];
const record=id=>defaultCatalog.fontSchemes[id];
const fontSchemes=Object.entries(defaultCatalog.fontSchemes).map(([id,scheme])=>({id,...scheme}));
const codeSlide={id:'code',layout:'code-1x',title:'Rule',code:{source:'const score = urgency * confidence;',language:'ts'}};
function measuredFamilies(presentation){
  const families=new Set();
  paginate(structuredClone(presentation),{catalogs,fonts:{textMeasurement:{measure:(text,size,style)=>{families.add(style.fontFamily);return text.length*size*.5;}}}});
  return families;
}

test('catalog records carry code only for monospace schemes, and it matches their body family',()=>{
  const withCode=fontSchemes.filter(scheme=>scheme.code!==undefined).map(scheme=>scheme.id).sort();
  const monospace=fontSchemes.filter(scheme=>scheme.type==='monospace').map(scheme=>scheme.id).sort();
  assert.deepEqual(withCode,['consolas','courier-new']);
  assert.deepEqual(withCode,monospace);
  for(const id of withCode)assert.deepEqual(record(id).code,record(id).minor);
});

test('the code role resolves from the scheme, else the documented Roboto Mono fallback',()=>{
  assert.equal(resolveFontFamilies(record('consolas')).code,'Consolas');
  assert.equal(resolveFontFamilies(record('courier-new')).code,'Courier New');
  for(const id of ['roboto','aptos','calibri','meiryo'])assert.equal(resolveFontFamilies(record(id)).code,'Roboto Mono');
  assert.equal(resolveFontFamilies(undefined).code,'Roboto Mono');
  // A design override on the same object still wins over the record.
  assert.equal(resolveFontFamilies({...record('consolas'),code:'JetBrains Mono'}).code,'JetBrains Mono');
  // Heading and body families never become the code fallback.
  assert.equal(resolveFontFamilies({major:'Consolas',minor:'Consolas',type:'monospace'}).code,'Roboto Mono');
});

test('pagination measures code in the chosen scheme family',()=>{
  for(const [fontScheme,family,absent] of [['consolas','Consolas','Roboto Mono'],['courier-new','Courier New','Roboto Mono'],['aptos','Roboto Mono','Consolas']]){
    const families=measuredFamilies({name:'Code font',design:{fontScheme},slides:[codeSlide]});
    assert.ok(families.has(family),`${fontScheme} measures ${family}`);
    assert.ok(!families.has(absent),`${fontScheme} does not measure ${absent}`);
  }
  const override=measuredFamilies({name:'Code font',design:{fontScheme:{id:'consolas',code:'JetBrains Mono'}},slides:[codeSlide]});
  assert.ok(override.has('JetBrains Mono')&&!override.has('Roboto Mono'));
});

test('a document\'s own font scheme may carry the code role and still validates',()=>{
  const custom={name:'Team Mono',major:'Inter',minor:'Inter',code:'JetBrains Mono'};
  const presentation={name:'Inline code font',design:{fontScheme:'team-mono'},catalogs:{custom:{fontSchemes:{'team-mono':custom}}},slides:[codeSlide]};
  assert.equal(check(presentation).valid,true);
  const families=measuredFamilies(presentation);
  assert.ok(families.has('JetBrains Mono')&&!families.has('Roboto Mono'));
});

test('one shared engine default font scheme: Aptos Display / Aptos (FF-35, docs/design-resolution.md)',()=>{
  const defaults=JSON.parse(readFileSync(new URL('../../../spec/reference/engine-defaults.json',import.meta.url),'utf8'));
  assert.deepEqual(defaults.fontScheme,ENGINE_DEFAULT_FONT_SCHEME);
  // The engine default is the gallery's aptos scheme, as drawn: the same families, no catalog lookup.
  assert.deepEqual(resolveFontFamilies(ENGINE_DEFAULT_FONT_SCHEME),resolveFontFamilies(record('aptos')));
  assert.equal(ENGINE_DEFAULT_FONT_SCHEME.languageFamily,record('aptos').languageFamily);
  // Every gallery theme names a font scheme, so the last-resort default only applies to themes without one.
  for(const [id,theme] of Object.entries(defaultCatalog.themes))assert.ok(record(theme.fontScheme),`${id} names a font scheme of the default catalog`);
});

test('pagination measures a custom theme without a font scheme in the shared default (Aptos, as exported)',()=>{
  const bare={name:'Bare'};
  const slides=[{id:'t',title:'Title',text:'Body'}];
  const aptos=[resolveFontFamilies(ENGINE_DEFAULT_FONT_SCHEME).heading,resolveFontFamilies(ENGINE_DEFAULT_FONT_SCHEME).body].sort();
  assert.deepEqual(aptos,['Aptos','Aptos Display']);
  const custom=measuredFamilies({name:'No font scheme',design:{theme:'bare'},catalogs:{custom:{themes:{bare}}},slides});
  assert.deepEqual([...custom].sort(),aptos);
  assert.ok(!custom.has('Roboto'),'the former roboto last resort is gone');
  // Same result as a document with no design and as naming aptos explicitly.
  assert.deepEqual([...measuredFamilies({name:'Defaults',slides})].sort(),aptos);
  assert.deepEqual([...measuredFamilies({name:'Explicit',design:{fontScheme:'aptos'},slides})].sort(),aptos);
  // Deck and slide choices still win over the last resort.
  assert.deepEqual([...measuredFamilies({name:'Deck',design:{theme:'bare',fontScheme:'roboto'},catalogs:{custom:{themes:{bare}}},slides})].sort(),['Roboto']);
});

// FF-35b: an unresolvable font scheme behaves the same in every engine. The engine default font scheme is the base,
// sibling overrides still apply, and one `unresolved-reference` diagnostic names the reference. opf-render, opf-editor
// and opf-pptx run the same cases in their own test/default-font-scheme.mjs.
const unknownCases=[
  ['string id',{design:{fontScheme:'no-such-scheme'}},['Aptos','Aptos Display'],'design.fontScheme'],
  ['object id',{design:{fontScheme:{id:'no-such-scheme'}}},['Aptos','Aptos Display'],'design.fontScheme.id'],
  ['object id with a family pair',{design:{fontScheme:{id:'no-such-scheme',major:'Inter',minor:'Inter'}}},['Inter'],'design.fontScheme.id'],
  ['slide design',{slideDesign:{fontScheme:'no-such-scheme'}},['Aptos','Aptos Display'],'slides.0.design.fontScheme'],
  ['theme record',{design:{theme:'bare-unknown'},catalogs:{custom:{themes:{'bare-unknown':{name:'Bare',fontScheme:'no-such-scheme'}}}}},['Aptos','Aptos Display'],'catalogs.custom.themes.bare-unknown.fontScheme'],
  ['inline scheme without id',{design:{fontScheme:{major:'Inter',minor:'Inter'}}},['Inter'],undefined],
  ['inline code role without id',{design:{fontScheme:{code:'JetBrains Mono'}}},['Aptos','Aptos Display'],undefined],
];
const unknownDeck=({design,slideDesign,catalogs:groups})=>({name:'Unknown font scheme',...(design?{design}:{}),...(groups?{catalogs:groups}:{}),slides:[{id:'t',title:'Title',text:'Body',...(slideDesign?{design:slideDesign}:{})},{id:'u',title:'Second',text:'Body'}]});

test('an unresolved font scheme falls back to the shared default with one diagnostic',()=>{
  for(const [name,input,families,path] of unknownCases){
    const deck=unknownDeck(input),diagnostics=[],measured=new Set();
    assert.equal(check(deck).valid,true,name);
    paginate(structuredClone(deck),{catalogs,onDiagnostic:diagnostic=>diagnostics.push(diagnostic),fonts:{textMeasurement:{measure:(text,size,style)=>{measured.add(style.fontFamily);return text.length*size*.5;}}}});
    assert.deepEqual([...measured].sort(),families,name);
    assert.deepEqual(diagnostics.map(({code,kind,path,reference,fallback})=>({code,kind,path,reference,fallback})),path?[{code:'unresolved-reference',kind:'fontSchemes',path,reference:'no-such-scheme',fallback:'engine-default'}]:[],name);
  }
});

test('resolveFontScheme and resolveFontFamilies share the default base',()=>{
  const deck={slides:[{title:'x'}]};
  assert.deepEqual(resolveFontFamilies(undefined),resolveFontFamilies(ENGINE_DEFAULT_FONT_SCHEME),'inlined default families match the engine default');
  assert.deepEqual(resolveFontFamilies({}),{heading:'Aptos Display',body:'Aptos',code:'Roboto Mono'});
  assert.deepEqual(resolveFontScheme(deck,'roboto','design.fontScheme',{catalogs}),{scheme:{...record('roboto')},diagnostics:[]});
  assert.deepEqual(resolveFontScheme(deck,{id:'consolas',minor:'Consolas'},'design.fontScheme',{catalogs}).scheme,{...record('consolas'),id:'consolas',minor:'Consolas'});
  const unresolved=resolveFontScheme(deck,{id:'nope',code:'JetBrains Mono'},'slides.2.design.fontScheme',{catalogs});
  assert.deepEqual(unresolved.scheme,{...ENGINE_DEFAULT_FONT_SCHEME,id:'nope',code:'JetBrains Mono'});
  assert.equal(unresolved.diagnostics[0].path,'slides.2.design.fontScheme.id');
  assert.deepEqual(resolveFontFamilies(unresolved.scheme),{heading:'Aptos Display',body:'Aptos',code:'JetBrains Mono'});
  // With no catalog registered, a reference resolves nowhere and the default families still apply.
  assert.deepEqual(resolveFontFamilies(resolveFontScheme(deck,'aptos','design.fontScheme',{catalogs:[]}).scheme),{heading:'Aptos Display',body:'Aptos',code:'Roboto Mono'});
});
