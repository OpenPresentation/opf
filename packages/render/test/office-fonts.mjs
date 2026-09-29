import assert from 'node:assert/strict';
import {create} from 'fontkit';
import {loadOfficeFontRegistry,prepareNodeFonts} from '../dist/fonts-node.js';
import {Resvg} from '@resvg/resvg-js';
import sharp from 'sharp';
import {renderSvg,svgToPng} from '../dist/index.js';
import {separateLigatures} from '../dist/font-compatibility.js';
import {createFontRegistry, FONT_COMPATIBILITY, fontPolicyFor} from '../dist/fonts.js';
const registry=await loadOfficeFontRegistry({substitutionPolicy:"visual"});
const pairs={Calibri:'Carlito',Cambria:'Caladea',Arial:'Arimo','Times New Roman':'Tinos','Courier New':'Cousine',Georgia:'Gelasio'};
for(const [fontFamily,substitute] of Object.entries(pairs)) for(const fontWeight of [400,700]) for(const italic of [false,true]) {
  const style={fontFamily,fontWeight,italic,path:'slides.0.text'};
  const resolved=registry.resolveFont(style);
  assert.equal(resolved.resolvedFamily,substitute);
  // FF-31: tiers come from the OPF font policy. Cambria->Caladea (2.7% mean) is visual; the other
  // five are metric, Georgia->Gelasio only because Gelasio is shaped with liga and clig off (below).
  assert.equal(resolved.compatibility,fontPolicyFor(fontFamily).replacement.compatibility);
  assert.equal(resolved.compatibility,fontFamily==='Cambria'?'visual':'metric');
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
// Georgia -> Gelasio is metric at 400/700, so metric-mode registries use it, reported as metric.
for(const fontWeight of [400,700])for(const italic of [false,true]){
  const georgia=metricOnly.resolveFont({fontFamily:'Georgia',fontWeight,italic});
  assert.deepEqual([georgia.resolvedFamily,georgia.resolvedWeight,georgia.italic,georgia.compatibility,georgia.substitute],['Gelasio',fontWeight,italic,'metric',true]);
}
for(const fontWeight of [300,500]) assert.throws(()=>metricOnly.resolveFont({fontFamily:'Georgia',fontWeight}),{code:'font-unavailable'},`Georgia ${fontWeight}`);
// Gelasio ligates fi/fl/ffi/ffl and Georgia does not. The metric claim holds with liga and clig off, so
// measurement (and SVG drawing) shape Gelasio without them, for Georgia and for Gelasio by name.
{const sample='office affine fi fl ffi ffl ff',size=100;
for(const [weight,italic,name] of [[400,false,'Regular'],[700,false,'Bold'],[400,true,'Regular_Italic'],[700,true,'Bold_Italic']]){
  const entry=entries.find(face=>face.family==='Gelasio'&&face.weight===weight&&face.italic===italic);
  const font=create(entry.data),total=run=>run.positions.reduce((sum,position)=>sum+position.xAdvance,0)/font.unitsPerEm*size;
  const unligated=total(font.layout(sample,{liga:false,clig:false})),ligated=total(font.layout(sample));
  assert.ok(ligated<unligated-1,`default Gelasio ligates ${name}`);
  for(const fontFamily of ['Georgia','Gelasio']) assert.equal(metricOnly.textMeasurement.measure(sample,size,{fontFamily,fontWeight:weight,italic}),unligated,`${fontFamily} ${name} is measured without ligatures`);
  // Other faces keep default shaping.
  const carlito=create(entries.find(face=>face.family==='Carlito'&&face.weight===weight&&face.italic===italic).data);
  assert.equal(metricOnly.textMeasurement.measure(sample,size,{fontFamily:'Calibri',fontWeight:weight,italic}),carlito.layout(sample).positions.reduce((sum,position)=>sum+position.xAdvance,0)/carlito.unitsPerEm*size);
}
// The SVG says the same to browsers, only on text drawn with Gelasio.
const deck=family=>({design:{fontScheme:{major:family,minor:family,code:{family:'Cousine'}}},slides:[{title:'Office affine',text:'A finite field of flat office files. '.repeat(4)}]});
const svgOf=family=>renderSvg(deck(family),{textMeasurement:metricOnly.textMeasurement});
const georgia=svgOf('Georgia'),calibri=svgOf('Calibri');
assert.match(georgia,/<text[^>]*font-family="Gelasio, [a-z-]+"[^>]*style="[^"]*font-variant-ligatures:none;font-feature-settings:'liga' 0,'clig' 0"/);
assert.doesNotMatch(georgia,/font-family="Georgia/);
assert.doesNotMatch(calibri,/font-variant-ligatures|font-feature-settings/);
assert.deepEqual(georgia,svgOf('Georgia'));
// Flow lines (estimated measurement): the outer text element carries no style; each tspan names its own family,
// so a Cousine run inside a Gelasio-first line does not inherit ligatures:none.
const flow=renderSvg({design:{fontScheme:{major:'Gelasio',minor:'Gelasio',code:{family:'Cousine'}}},slides:[{title:'Flow',text:[{text:'office fluffy '},{text:'code ff',fontFamily:'Cousine'}]}]},{});
const flowText=flow.split('\n').find(line=>line.includes('office fluffy'));
assert.match(flowText,/<text(?![^>]*font-variant-ligatures)[^>]*>/);
assert.match(flowText,/<tspan[^>]*font-family="Gelasio[^"]*"[^>]*font-variant-ligatures:none[^>]*>office fluffy /);
assert.match(flowText,/<tspan(?![^>]*font-variant-ligatures)[^>]*font-family="Cousine[^"]*"[^>]*>code ff/);
// Nested script runs inside a Gelasio run go back to default shaping.
{const scripts=await prepareNodeFonts({pack:'office',scripts:['Arab'],substitutionPolicy:'metric'});
const mixed=renderSvg({design:{fontScheme:{major:'Gelasio',minor:'Gelasio',code:{family:'Cousine'}}},slides:[{title:'Mixed',text:'office fluffy \u0633\u0644\u0627\u0645 fi'}]},scripts.options);
assert.match(mixed,/<text[^>]*font-variant-ligatures:none[^>]*>/);
assert.match(mixed,/<tspan[^>]*font-family="[^"]*"[^>]*style="font-variant-ligatures:normal;font-feature-settings:normal"[^>]*>\u0633\u0644\u0627\u0645/);}}
// Raster: resvg ignores the SVG properties, so the rasterizer separates the letters a ligature would join
// (a zero-width non-joiner after f) and only for Gelasio text. The emitted SVG is unchanged.
{assert.equal(separateLigatures('<svg><text font-family="Gelasio, serif">off <tspan font-family="Cousine, monospace">ff</tspan><tspan>fi</tspan></text><text font-family="Roboto">fi</text><title>fi</title></svg>'),
  '<svg><text font-family="Gelasio, serif">of\u200Cf <tspan font-family="Cousine, monospace">ff</tspan><tspan>f\u200Ci</tspan></text><text font-family="Roboto">fi</text><title>fi</title></svg>');
const text='office file fluffy',size=24,scale=4;
const measured=metricOnly.textMeasurement.measure(text,size,{fontFamily:'Georgia',fontWeight:400});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="60"><rect width="400" height="60" fill="#fff"/><text x="20" y="40" font-family="Gelasio, serif" font-size="${size}" fill="#000">${text}</text></svg>`;
const inkWidth=async png=>{const {data,info}=await sharp(png).greyscale().raw().toBuffer({resolveWithObject:true});let low=Infinity,high=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[y*info.width+x]<128){low=Math.min(low,x);high=Math.max(high,x);}
  return (high-low+1)/scale;};
const ligated=await inkWidth(new Resvg(svg,{fitTo:{mode:'zoom',value:scale},font:{fontFiles:registry.fontFiles,loadSystemFonts:false,defaultFontFamily:'Gelasio'}}).render().asPng());
const separated=await inkWidth(await svgToPng(svg,{scale,fontFiles:registry.fontFiles,useBundledFonts:false,loadSystemFonts:false}));
assert.ok(measured-ligated>3,`resvg alone ligates: ink ${ligated} vs measured ${measured}`);
assert.ok(Math.abs(measured-separated)<1,`rasterizer closes the gap: ink ${separated} vs measured ${measured}`);
assert.ok(!svg.includes('\u200C'),'the SVG itself is never changed');}
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
