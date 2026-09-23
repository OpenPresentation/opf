import assert from 'node:assert/strict';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
import {createFontRegistry, FONT_COMPATIBILITY, fontPolicyFor} from '../dist/fonts.js';
const registry=await loadOfficeFontRegistry({substitutionPolicy:"visual"});
const pairs={Calibri:'Carlito',Cambria:'Caladea',Arial:'Arimo','Times New Roman':'Tinos','Courier New':'Cousine',Georgia:'Gelasio'};
for(const [fontFamily,substitute] of Object.entries(pairs)) for(const fontWeight of [400,700]) for(const italic of [false,true]) {
  const style={fontFamily,fontWeight,italic,path:'slides.0.text'};
  const resolved=registry.resolveFont(style);
  assert.equal(resolved.resolvedFamily,substitute);
  // FF-31: tiers come from the OPF font policy. Georgia->Gelasio (ligature runs up to 1.02% off)
  // and Cambria->Caladea (2.7% mean) are visual; the other four are metric.
  assert.equal(resolved.compatibility,fontPolicyFor(fontFamily).replacement.compatibility);
  assert.equal(resolved.compatibility,['Georgia','Cambria'].includes(fontFamily)?'visual':'metric');
  assert.equal(resolved.substitute,true);
  assert.equal(resolved.path,style.path);
  assert.ok(registry.textMeasurement.measure('AVATAR office 1234',25,style)>0);
}
assert.equal(registry.embeddedFonts.length,33);
for(const face of registry.embeddedFonts) assert.ok(face.license?.length>1000);
const entries=registry.embeddedFonts.map(face=>({...face,data:new Uint8Array(Buffer.from(face.dataUrl.split(',')[1],'base64'))}));
const alias=createFontRegistry(entries,{aliases:{Carlito:'Arimo'},substitutionPolicy:'visual'});
assert.equal(alias.resolveFont({fontFamily:'Carlito',fontWeight:400}).compatibility,'exact');
assert.equal(alias.resolveFont({fontFamily:'Carlito',fontWeight:400}).resolvedFamily,'Carlito');
assert.equal(alias.resolveFont({fontFamily:'Calibri Light',fontWeight:300}).compatibility,'visual');
assert.equal(alias.resolveFont({fontFamily:'Aptos',fontWeight:400}).compatibility,'visual');
assert.equal(alias.resolveFont({fontFamily:'Calibri',fontWeight:500}).compatibility,'visual');
const metricOnly=createFontRegistry(entries,{substitutionPolicy:'metric'});
assert.throws(()=>metricOnly.resolveFont({fontFamily:'Georgia',fontWeight:400}),{code:'font-unavailable',message:/Gelasio is visual only/});
// FF-31: Cambria was metric at 400/700 (upright and italic) before; its policy decision keeps
// metric-mode registries previewing exactly those styles with Caladea, now reported as visual.
for(const fontWeight of [400,700])for(const italic of [false,true]){
  const cambria=metricOnly.resolveFont({fontFamily:'Cambria',fontWeight,italic});
  assert.deepEqual([cambria.resolvedFamily,cambria.resolvedWeight,cambria.italic,cambria.compatibility,cambria.substitute,cambria.decision],['Caladea',fontWeight,italic,'visual',true,'cambria-tier']);
}
// Other weights still throw in metric mode, as they did before FF-31 and as Calibri 500 does.
for(const fontWeight of [300,500])for(const italic of [false,true]){
  assert.throws(()=>metricOnly.resolveFont({fontFamily:'Cambria',fontWeight,italic}),{code:'font-unavailable'},`Cambria ${fontWeight}`);
  assert.throws(()=>metricOnly.resolveFont({fontFamily:'Calibri',fontWeight,italic}),{code:'font-unavailable'},`Calibri ${fontWeight}`);
}
// Visual mode still previews Cambria at any weight, reported as visual.
assert.equal(registry.resolveFont({fontFamily:'Cambria',fontWeight:500}).resolvedFamily,'Caladea');
{const office=await loadOfficeFontRegistry(),cambria=office.resolveFont({fontFamily:'Cambria',fontWeight:400});
assert.deepEqual([cambria.resolvedFamily,cambria.compatibility],['Caladea','visual'],'the default office registry (metric mode) still previews Cambria');}
// An alternate on a metric row is never labelled metric (Arial -> Arimo, alternate Liberation Sans).
{const liberation=entries.filter(face=>face.family==='Arimo').map(face=>({...face,family:'Liberation Sans'}));
const others=entries.filter(face=>face.family!=='Arimo');
assert.throws(()=>createFontRegistry([...others,...liberation],{substitutionPolicy:'metric'}).resolveFont({fontFamily:'Arial',fontWeight:400}),{code:'font-unavailable'});
const viaAlternate=createFontRegistry([...others,...liberation],{substitutionPolicy:'visual'}).resolveFont({fontFamily:'Arial',fontWeight:400});
assert.deepEqual([viaAlternate.resolvedFamily,viaAlternate.compatibility,viaAlternate.substitute],['Liberation Sans','visual',true]);
assert.equal(createFontRegistry(entries,{substitutionPolicy:'metric'}).resolveFont({fontFamily:'Arial',fontWeight:400}).compatibility,'metric');}
// Consolas keeps Cousine, so bold italic code stays italic.
{const consolas=registry.resolveFont({fontFamily:'Consolas',fontWeight:700,italic:true});
assert.deepEqual([consolas.resolvedFamily,consolas.italic,consolas.styleFallback],['Cousine',true,undefined]);}
for(const family of ['Calibri Light','Aptos','Calibri']) assert.throws(()=>metricOnly.resolveFont({fontFamily:family,fontWeight:500}),{code:'font-unavailable'});
const theme=createFontRegistry(entries,{substitutionPolicy:'metric',themeFonts:{minorLatin:'Calibri',majorLatin:'Cambria'},fallbackFamily:'Roboto'});
assert.equal(theme.resolveFont({fontFamily:'+mn-lt',fontWeight:400}).resolvedFamily,'Carlito');
assert.equal(theme.resolveFont({fontFamily:'+mj-lt',fontWeight:700}).resolvedFamily,'Caladea');
assert.throws(()=>theme.resolveFont({fontFamily:'+mn-ea',fontWeight:400}),{code:'unresolved-theme-font'});
assert.equal(theme.resolveFont({fontFamily:'Unknown Font',fontWeight:400}).compatibility,'generic');
for(const fontFamily of ['Wingdings','Wingdings 2','Wingdings 3','Webdings','Symbol']) assert.throws(()=>theme.resolveFont({fontFamily,fontWeight:400}),{code:'font-encoding-required'});
assert.throws(()=>theme.resolveFont({fontFamily:'Cambria Math',fontWeight:400}),{code:'math-font-required'});
assert.throws(()=>theme.textMeasurement.measure('你好',25,{fontFamily:'Calibri',fontWeight:400}),{code:'missing-glyph'});
const noBold=createFontRegistry(entries.filter(face=>face.weight===400),{substitutionPolicy:'metric'});
assert.throws(()=>noBold.resolveFont({fontFamily:'Calibri',fontWeight:700}),{code:'font-unavailable'});
const missingStyle=createFontRegistry(entries.filter(face=>!face.italic));
assert.throws(()=>missingStyle.resolveFont({fontFamily:'Carlito',fontWeight:400,italic:true}),{code:'font-style-unavailable'});
assert.throws(()=>createFontRegistry(entries,{substitutionPolicy:'best'}),{code:'invalid-font-policy'});
assert.ok(Object.isFrozen(FONT_COMPATIBILITY[0].substitutes));
registry.clearSubstitutions(); assert.deepEqual(registry.substitutions,[]);
console.log('Office font policy passed: 24 bundled faces, exact-first lookup, scoped metric claims, theme aliases, explicit approximate fallback, and symbol/math/coverage errors.');
