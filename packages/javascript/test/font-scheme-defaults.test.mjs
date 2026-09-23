import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fontSchemes,themes,validatePresentation} from '../dist/index.js';
import {resolveFontFamilies} from '../dist/composition.js';
import {paginatePresentation} from '../dist/pagination.js';

// FF-17 (font-fidelity-everywhere): the code role follows the chosen scheme,
// with Roboto Mono as the documented fallback, and the engine default font
// scheme difference between targets stays explicit.

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

test('engine default font schemes are pinned per target (difference documented in docs/design-resolution.md)',()=>{
  const defaults=JSON.parse(readFileSync(new URL('../../../spec/reference/engine-defaults.json',import.meta.url),'utf8'));
  assert.equal(defaults.theme,'minimal');
  assert.equal(defaults.fontScheme.pptx.latin,'aptos');
  assert.equal(defaults.fontScheme.google.latin,'roboto');
  // Every bundled theme names a font scheme, so the last-resort default only
  // applies to custom themes without one.
  for(const theme of themes)assert.ok(record(theme.fontScheme),`${theme.id} names a bundled font scheme`);
  assert.equal(themes.find(theme=>theme.id==='minimal').fontScheme,'aptos');
  // Core pagination's last resort is roboto (the renderer and editor match; opf-pptx uses aptos).
  const bare={$schema:'https://openpresentation.org/schema/opf-theme/v1',id:'bare',name:'Bare'};
  const families=measuredFamilies({name:'No font scheme',design:{theme:'bare'},catalogs:{themes:{records:[bare]}},slides:[{id:'t',title:'Title',text:'Body'}]});
  assert.deepEqual([...families].sort(),['Roboto']);
  // With no design at all, the default theme supplies aptos.
  assert.deepEqual([...measuredFamilies({name:'Defaults',slides:[{id:'t',title:'Title',text:'Body'}]})].sort(),['Aptos','Aptos Display']);
});
