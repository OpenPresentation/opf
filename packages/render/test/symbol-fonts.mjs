// FF-45: symbol-encoded families (Symbol, Wingdings, Wingdings 2, Wingdings 3, Webdings) preview through reversible
// code-to-Unicode tables and the open symbol faces instead of failing with font-encoding-required. Exhaustive: every
// code of every family is mapped, resolved to a loaded face, measured at the verified font's advance and checked for
// ink; the two input forms (private-use U+F0xx and Windows-1252 characters) plan identically; the SVG never names a
// proprietary family or carries a private-use character; raster output draws the glyphs; no proprietary font file is
// required or bundled.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {renderSvg,svgToPng} from '../dist/index.js';
import {BUNDLED_FONT_MANIFEST,autoScriptSelection,detectPresentationScripts,prepareNodeFonts} from '../dist/fonts-node.js';
import {SYMBOL_ENCODINGS,SYMBOL_ENCODINGS_SOURCE,SYMBOL_FACE_FAMILIES,SYMBOL_PLACEHOLDER,SYMBOL_PREVIEW_FACES,SYMBOL_SCRIPT,createFontRegistry,createScriptFonts,createScriptTextMeasurement,glyphFallbackFamilies,isSymbolEncodedFamily,mapSymbolText,symbolCodeOf,symbolEncodingFor} from '../dist/fonts.js';

const FAMILIES=['Symbol','Wingdings','Wingdings 2','Wingdings 3','Webdings'];
const PROPRIETARY=/^(symbol|wingdings|wingdings 2|wingdings 3|webdings)$/i;
const hex=code=>code.toString(16).toUpperCase().padStart(2,'0');
const pua=code=>String.fromCharCode(0xF000+code);
// The Windows-1252 character of a code, when one exists (0x7F and the five holes 0x81, 0x8D, 0x8F, 0x90, 0x9D have none).
const plainForms=new Map();
for(let point=0x20;point<0xF000;point++){const code=symbolCodeOf(String.fromCharCode(point));if(code!==null&&!plainForms.has(code))plainForms.set(code,String.fromCharCode(point));}
const decodeUnicode=value=>String.fromCodePoint(...value.split('+').map(part=>parseInt(part,16)));

// ---- the snapshot ----
assert.deepEqual(SYMBOL_ENCODINGS.map(entry=>entry.family),FAMILIES);
assert.equal(SYMBOL_ENCODINGS_SOURCE.path,'spec/reference/symbol-font-encodings.json');
assert.match(SYMBOL_ENCODINGS_SOURCE.sha256,/^[0-9a-f]{64}$/);
assert.deepEqual(SYMBOL_ENCODINGS.map(entry=>entry.mapped),[189,222,217,208,223],'codes mapped per family (2026-10-01 tables)');
for(const entry of SYMBOL_ENCODINGS){
  assert.equal(entry.codes.length,224);
  assert.match(entry.version,/^Version \d+\.\d+/);
  assert.equal(entry.unitsPerEm,2048);
  assert.equal(entry.codes.filter(([unicode])=>unicode!==null).length,entry.mapped);
  for(const [unicode,advance,reason] of entry.codes){
    if(unicode===null)assert.ok(typeof reason==='string'&&reason,`${entry.family}: an unmapped code says why`);
    else{assert.match(unicode,/^[0-9A-F]{4,5}(\+[0-9A-F]{4,5})*$/);assert.equal(reason,undefined);}
    if(advance!==null)assert.ok(Number.isInteger(advance)&&advance>=0);
  }
  // The inverse mapping is unique except Symbol's sans-serif copyright, registered and trade mark signs (0xE2..0xE4).
  const seen=new Map();const duplicates=[];
  entry.codes.forEach(([unicode],index)=>{if(unicode===null)return;if(seen.has(unicode))duplicates.push(`${hex(0x20+index)}->${hex(seen.get(unicode))}`);else seen.set(unicode,0x20+index);});
  assert.deepEqual(duplicates,entry.family==='Symbol'?['E2->D2','E3->D3','E4->D4']:[],entry.family);
}
for(const family of FAMILIES){assert.ok(isSymbolEncodedFamily(family.toUpperCase()));assert.equal(symbolEncodingFor(family).family,family);assert.ok(symbolEncodingFor(family)===SYMBOL_ENCODINGS.find(entry=>entry.family===family));}
for(const name of ['Calibri','Noto Sans Symbols 2','Wingdings 4',''])assert.ok(!isSymbolEncodedFamily(name),name);
assert.equal(SYMBOL_SCRIPT,'Zsym');
assert.equal(SYMBOL_PLACEHOLDER,'□');
assert.deepEqual(SYMBOL_PREVIEW_FACES.Symbol,['Noto Sans','Noto Sans Math','Noto Sans Symbols 2','Noto Sans Symbols']);
assert.deepEqual([...SYMBOL_FACE_FAMILIES].sort(),['Noto Sans','Noto Sans Math','Noto Sans Symbols','Noto Sans Symbols 2']);
assert.deepEqual(glyphFallbackFamilies('∑').slice(-3),['Noto Sans Symbols 2','Noto Sans Symbols','Noto Sans Math'],'the symbol faces end the glyph fallback chain');

// ---- input forms ----
assert.equal(symbolCodeOf(''),0x6C);assert.equal(symbolCodeOf('l'),0x6C);assert.equal(symbolCodeOf('€'),0x80);assert.equal(symbolCodeOf('•'),0x95);
for(const other of ['\u{1F5B9}','あ','','','\t',''])assert.equal(symbolCodeOf(other),null,JSON.stringify(other));
assert.equal(plainForms.size,218,'0x7F and the five Windows-1252 holes are reachable only as private-use characters');
for(const entry of SYMBOL_ENCODINGS){
  for(let code=0x20;code<=0xFF;code++){
    const [unicode,advance]=entry.codes[code-0x20];
    const forms=[pua(code),...(plainForms.has(code)?[plainForms.get(code)]:[])];
    for(const form of forms){
      const [item]=mapSymbolText(entry.family,form);
      assert.equal(item.code,code,`${entry.family} ${hex(code)} from ${JSON.stringify(form)}`);
      assert.equal(item.unicode,unicode===null?null:decodeUnicode(unicode));
      assert.equal(item.advance,advance===null?null:advance/entry.unitsPerEm);
      if(unicode===null)assert.ok(item.reason);
    }
  }
}
assert.deepEqual(mapSymbolText('Wingdings','あ'),[{source:'あ',code:null,unicode:null,advance:null}]);
assert.deepEqual(mapSymbolText('Calibri','ab').map(item=>item.code),[null,null]);

// ---- the pinned faces: OFL, no proprietary family anywhere ----
const symbolPackages=BUNDLED_FONT_MANIFEST.packages.filter(pkg=>pkg.scripts?.includes(SYMBOL_SCRIPT));
assert.deepEqual(symbolPackages.map(pkg=>pkg.name),['@expo-google-fonts/noto-sans-symbols-2','@expo-google-fonts/noto-sans-symbols','@expo-google-fonts/noto-sans-math']);
for(const pkg of symbolPackages){assert.equal(pkg.pack,'scripts');assert.equal(pkg.license,'OFL-1.1');assert.deepEqual(pkg.reservedFontNames,[]);for(const face of pkg.faces)assert.match(face.sha256,/^[0-9a-f]{64}$/);}
for(const pkg of BUNDLED_FONT_MANIFEST.packages){
  assert.ok(!PROPRIETARY.test(pkg.name.split('/').pop().replace(/-/g,' ')),pkg.name);
  for(const face of pkg.faces){assert.ok(!PROPRIETARY.test(face.family),face.family);assert.ok(!/symbol\.ttf|wingding|webdings/i.test(face.file),face.file);}
}

// ---- every code resolves to a loaded face, at the verified font's advance, with ink ----
const diagnostics=[];
const {registry,options}=await prepareNodeFonts({pack:'office',substitutionPolicy:'visual',scripts:[SYMBOL_SCRIPT],onDiagnostic:diagnostic=>diagnostics.push(diagnostic)});
assert.ok(!registry.describeFaces().some(face=>PROPRIETARY.test(face.family)),'no proprietary symbol face is loaded');
assert.ok(!options.fontFiles.some(file=>/symbol\.ttf|wingding|webdings/i.test(file)),'no proprietary font file is read');
assert.ok(['Noto Sans Symbols 2','Noto Sans Symbols','Noto Sans Math','Noto Sans'].every(family=>registry.describeFaces().some(face=>face.family===family)));
const SIZE=20;
const coverage={};
for(const entry of SYMBOL_ENCODINGS){
  const resolution=registry.resolveFont({fontFamily:entry.family,fontWeight:400});
  assert.equal(resolution.sourceFamily,entry.family);
  assert.equal(resolution.symbolEncoding,entry.family,'the resolution carries the encoding');
  assert.equal(resolution.compatibility,'visual');assert.equal(resolution.substitute,true);
  assert.equal(resolution.resolvedFamily,SYMBOL_PREVIEW_FACES[entry.family][0]);
  const style=registry.textMeasurement.resolveStyle({fontFamily:entry.family,fontWeight:400,path:'slides.0.text'});
  assert.equal(style.symbolEncoding,entry.family);assert.equal(style.fontFamily,resolution.resolvedFamily);
  const scripts=createScriptFonts({},registry.textMeasurement);
  const measurement=scripts.textMeasurement;
  let drawn=0,placeholders=0;const byFace={};
  for(let code=0x20;code<=0xFF;code++){
    const [unicode,advance]=entry.codes[code-0x20];
    const text=pua(code);
    const runs=scripts.plan(text,style);
    assert.equal(runs.length,1,`${entry.family} ${hex(code)} is one run`);
    const [run]=runs;
    assert.equal(run.own,false);assert.equal(run.symbol.code,code);assert.equal(run.symbol.source,text);assert.equal(run.symbol.family,entry.family);
    assert.ok(registry.describeFaces().some(face=>face.family===run.family),`${entry.family} ${hex(code)} draws with a loaded face (${run.family})`);
    if(unicode!==null){
      assert.equal(run.text,decodeUnicode(unicode),`${entry.family} ${hex(code)} draws its Unicode equivalent`);
      assert.ok(!run.symbol.placeholder,`${entry.family} ${hex(code)} U+${unicode} is drawn by a loaded face, not the placeholder`);
      assert.ok(SYMBOL_PREVIEW_FACES[entry.family].includes(run.family));
      drawn++;byFace[run.family]=(byFace[run.family]??0)+1;
    }else{
      assert.equal(run.symbol.placeholder,true);assert.equal(run.text,SYMBOL_PLACEHOLDER);assert.ok(run.symbol.reason);
      placeholders++;
    }
    // The advance is the verified font's (the two forms agree); the open face's own advance is available as `natural`.
    const width=measurement.measure(text,SIZE,style);
    const expected=advance===null?registry.textMeasurement.measure(run.text,SIZE,{...style,fontFamily:run.family,symbolEncoding:null}):advance/entry.unitsPerEm*SIZE;
    assert.ok(Math.abs(width-expected)<1e-9,`${entry.family} ${hex(code)} advance ${width} = ${expected}`);
    assert.deepEqual(scripts.runWidths(runs,SIZE,style),[width]);
    const natural=scripts.runWidths(runs,SIZE,style,{natural:true})[0];
    assert.ok(natural>=0&&Number.isFinite(natural));
    // Bounds: every drawn glyph has ink; the space codes have none.
    const bounds=measurement.outlineBounds(text,SIZE,style);
    if(unicode==='0020'||unicode==='00A0')assert.equal(bounds,null,`${entry.family} ${hex(code)} is a space`);
    else{assert.ok(bounds&&bounds.width>0&&bounds.height>0,`${entry.family} ${hex(code)} has ink`);}
    if(plainForms.has(code)){
      const plain=scripts.plan(plainForms.get(code),style);
      assert.deepEqual(plain.map(item=>({text:item.text,family:item.family,code:item.symbol.code})),runs.map(item=>({text:item.text,family:item.family,code:item.symbol.code})),`${entry.family} ${hex(code)}: the Windows-1252 form plans like the private-use form`);
      assert.equal(measurement.measure(plainForms.get(code),SIZE,style),width);
    }
  }
  assert.equal(drawn,entry.mapped,`${entry.family}: every mapped code draws a real glyph (${drawn} of ${entry.mapped})`);
  assert.equal(placeholders,224-entry.mapped);
  coverage[entry.family]={drawn,placeholders,byFace};
  const notes=scripts.fallbacks;
  assert.ok(notes.some(note=>note.fontFamily===entry.family&&note.scripts.includes(SYMBOL_SCRIPT)&&note.codes.length>0),`${entry.family} reports its mapping as a fallback note with codes`);
  assert.ok(notes.some(note=>note.fontFamily===entry.family&&note.placeholder===SYMBOL_PLACEHOLDER),`${entry.family} reports its placeholders`);
}
// Measured coverage, recorded in docs/programs/font-fidelity-everywhere/special-families.md.
assert.deepEqual(Object.fromEntries(Object.entries(coverage).map(([family,value])=>[family,value.drawn])),{Symbol:189,Wingdings:222,'Wingdings 2':217,'Wingdings 3':208,Webdings:223});

// Bold and italic requests resolve to the open faces that exist (Noto Sans Symbols 2 has one weight) and stay visual.
assert.equal(registry.resolveFont({fontFamily:'Wingdings',fontWeight:700}).resolvedWeight,400);
assert.equal(registry.resolveFont({fontFamily:'Symbol',fontWeight:700,italic:true}).compatibility,'visual');

// Mixed text: codes map, other characters draw as themselves; a Symbol run keeps Greek letters in Noto Sans.
{
  const style=registry.textMeasurement.resolveStyle({fontFamily:'Wingdings',fontWeight:400});
  const scripts=createScriptFonts({},registry.textMeasurement);
  const runs=scripts.plan(' あ l',style);
  assert.deepEqual(runs.map(run=>[run.text,!!run.symbol]),[['✓',true],[' ',true],['あ',false],[' ',true],['⚫',true]]);
  assert.ok(runs[2].family.startsWith('Noto Sans'),'the Hiragana letter draws as itself with a loaded face (glyph fallback)');
  const symbolStyle=registry.textMeasurement.resolveStyle({fontFamily:'Symbol',fontWeight:400});
  assert.deepEqual(scripts.plan('ab',symbolStyle).map(run=>[run.text,run.family]),[['α','Noto Sans'],['β','Noto Sans']]);
  const wrapped=createScriptTextMeasurement(registry.textMeasurement,{});
  assert.equal(wrapped.measure('',SIZE,style),(symbolEncodingFor('Wingdings').codes[0xFC-0x20][1]+symbolEncodingFor('Wingdings').codes[0x6C-0x20][1])/2048*SIZE);
  assert.equal(wrapped.measure('',SIZE,style),0);
}

// ---- without the symbol pack: Symbol's Greek letters still draw (Noto Sans), dingbats become placeholders ----
{
  const bare=await prepareNodeFonts({pack:'office',substitutionPolicy:'visual'});
  assert.equal(bare.registry.resolveFont({fontFamily:'Symbol'}).resolvedFamily,'Noto Sans');
  assert.equal(bare.registry.resolveFont({fontFamily:'Wingdings'}).resolvedFamily,'Noto Sans','the office pack has only Noto Sans of the chain');
  const scripts=createScriptFonts({},bare.registry.textMeasurement);
  const wingdings=scripts.plan('',bare.registry.textMeasurement.resolveStyle({fontFamily:'Wingdings'}));
  assert.equal(wingdings[0].symbol.placeholder,true);assert.equal(wingdings[0].text,'�','U+25A1 needs a symbol face; Noto Sans has U+FFFD');
  assert.match(wingdings[0].symbol.reason,/scripts: \['Zsym'\]/);
  const symbol=scripts.plan('a',bare.registry.textMeasurement.resolveStyle({fontFamily:'Symbol'}));
  assert.deepEqual([symbol[0].text,symbol[0].family,symbol[0].symbol.placeholder],['α','Noto Sans',undefined]);
  // The base pack (Roboto only) has no chain face: the request fails as before, naming the pack, unless a fallback family applies.
  const base=await prepareNodeFonts({pack:'base'});
  assert.throws(()=>base.registry.resolveFont({fontFamily:'Wingdings'}),error=>error.code==='font-encoding-required'&&error.details.scripts[0]==='Zsym'&&error.details.faces.includes('Noto Sans Symbols 2'));
  const eager=base.registry.embeddedFonts.map(face=>({family:face.family,weight:face.weight,italic:face.italic,data:new Uint8Array(Buffer.from(face.dataUrl.split(',')[1],'base64'))}));
  const withFallback=createFontRegistry(eager,{fallbackFamily:'Roboto'});
  assert.equal(withFallback.resolveFont({fontFamily:'Wingdings'}).compatibility,'generic');
}

// ---- scripts: 'auto' loads the symbol faces for a deck that names a symbol family (run, design font or scheme) ----
const deck=(text,extra={})=>({$schema:'https://openpresentation.org/schema/opf/v1',name:'FF-45',slides:[{id:'a',title:'Symbols',text,...extra}]});
const runDeck=deck([{text:'Check: '},{text:' l',fontFamily:'Wingdings'},{text:' alpha '},{text:'abg',fontFamily:'Symbol'},{text:' web '},{text:'',fontFamily:'Webdings'}]);
assert.deepEqual(autoScriptSelection(runDeck).scripts,[SYMBOL_SCRIPT]);
assert.deepEqual(detectPresentationScripts(runDeck),[],'text alone (private-use characters) is not a script');
assert.deepEqual(autoScriptSelection(deck('Plain text')).scripts,[]);
assert.deepEqual(autoScriptSelection({...deck('Plain'),design:{fonts:{body:'Wingdings'}}}).scripts,[SYMBOL_SCRIPT]);
assert.deepEqual(autoScriptSelection(deck([{text:'Plain'}],{design:{fonts:{heading:'Symbol'}}})).scripts,[SYMBOL_SCRIPT]);
{
  const auto=await prepareNodeFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:runDeck});
  assert.deepEqual(auto.registry.scriptSelection.scripts,[SYMBOL_SCRIPT]);
  assert.deepEqual(auto.registry.scriptSelection.packages,symbolPackages.map(pkg=>pkg.name));
}

// ---- SVG: mapped characters, open families, positioned glyphs, no private-use text, identical for both input forms ----
const svgDiagnostics=[];
const svg=renderSvg(runDeck,{...options,onDiagnostic:diagnostic=>svgDiagnostics.push(diagnostic)});
assert.ok(!/[-]/.test(svg),'no private-use character reaches the SVG');
assert.ok(!/font-family="[^"]*(Wingdings|Webdings|Symbol\b)/.test(svg),'no proprietary family is named in the SVG');
for(const character of ['✓','⚫','α','β','γ','\u{1F3D7}'])assert.ok(svg.includes(character),`the SVG draws ${character}`);
assert.ok(/<tspan font-family="'Noto Sans Symbols 2', sans-serif"[^>]*>✓<\/tspan>/.test(svg),'the Wingdings check mark is a positioned Noto Sans Symbols 2 tspan (the name quoted: a digit-leading word is invalid unquoted CSS)');
assert.ok(!/font-family="[^"']*Noto Sans Symbols 2/.test(svg),'a family with a digit-leading word is never written unquoted');
const plainDeck=deck([{text:'Check: '},{text:'ül l',fontFamily:'Wingdings'},{text:' alpha '},{text:'abg',fontFamily:'Symbol'},{text:' web '},{text:'A',fontFamily:'Webdings'}]);
assert.equal(renderSvg(plainDeck,options),svg,'the Windows-1252 form renders byte-identically to the private-use form');
const symbolNotes=svgDiagnostics.filter(diagnostic=>diagnostic.code==='font-glyph-fallback'&&diagnostic.scripts.includes(SYMBOL_SCRIPT));
assert.deepEqual(symbolNotes.map(note=>[note.fontFamily,note.fallbackFamily,note.codes]),[['Wingdings','Noto Sans Symbols 2',['FC','6C']],['Symbol','Noto Sans',['61','62','67']],['Webdings','Noto Sans Symbols 2',['41']]]);
assert.match(symbolNotes[0].message,/symbol-encoded and not bundled; the preview draws codes such as 0xFC, 0x6C as their Unicode equivalents with 'Noto Sans Symbols 2'\. The PPTX keeps the chosen font and the original codes\./);
// The tspans sit at the verified advances: x advances by each code's advance (1 em for the Wingdings space), never by the open face's.
{
  const match=svg.match(/<text[^>]*font-family="'Noto Sans Symbols 2', sans-serif"[^>]*x="([\d.]+)"[^>]*>((?:<tspan[^>]*>[^<]*<\/tspan>)+)<\/text>/);
  assert.ok(match,'the Wingdings run is one positioned text element');
  const xs=[...match[2].matchAll(/x="([\d.]+)"/g)].map(item=>Number(item[1]));
  const size=Number(svg.match(/font-family="'Noto Sans Symbols 2', sans-serif" font-size="([\d.]+)"/)[1]);
  const advances=mapSymbolText('Wingdings',' l').map(item=>item.advance*size);
  for(let index=1;index<xs.length;index++)assert.ok(Math.abs(xs[index]-xs[index-1]-advances[index-1])<0.01,`tspan ${index} sits at the verified advance`);
  assert.equal(advances[2],size,'the Wingdings space is 1 em');
}
// A placeholder code (Wingdings 0xFF, the Windows logo) draws U+25A1 and is reported with its code.
{
  const logoDiagnostics=[];
  const logo=renderSvg(deck([{text:'',fontFamily:'Wingdings'}]),{...options,onDiagnostic:diagnostic=>logoDiagnostics.push(diagnostic)});
  assert.ok(logo.includes(SYMBOL_PLACEHOLDER));
  const note=logoDiagnostics.find(diagnostic=>diagnostic.code==='font-glyph-fallback'&&diagnostic.placeholder);
  assert.deepEqual([note.fontFamily,note.codes,note.placeholder],['Wingdings',['FF'],SYMBOL_PLACEHOLDER]);
  assert.match(note.message,/Windows logo|no Unicode equivalent/);
}

// ---- raster: the glyphs leave ink where the text sits ----
{
  const png=await svgToPng(svg,{fontFiles:options.fontFiles,loadSystemFonts:false,useBundledFonts:false});
  const blank=await svgToPng(renderSvg(deck([{text:'Check: '},{text:'   ',fontFamily:'Roboto'},{text:' alpha '},{text:'   '},{text:' web '},{text:' '}]),options),{fontFiles:options.fontFiles,loadSystemFonts:false,useBundledFonts:false});
  const a=await sharp(png).raw().toBuffer({resolveWithObject:true}),b=await sharp(blank).raw().toBuffer({resolveWithObject:true});
  assert.deepEqual(a.info,b.info);
  let differing=0;for(let index=0;index<a.data.length;index+=a.info.channels){if(a.data[index]!==b.data[index]||a.data[index+1]!==b.data[index+1]||a.data[index+2]!==b.data[index+2])differing++;}
  assert.ok(differing>200,`the symbol glyphs leave ink (${differing} pixels differ from the blank slide)`);
  assert.equal(createHash('sha256').update(png).digest('hex').length,64);
}

// ---- the snapshot is the core table: when a core checkout sits beside this repository, the pinned sha256 must match it ----
try{
  const core=await readFile(new URL('../../opf/spec/reference/symbol-font-encodings.json',import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(core.replace(/\r\n/g,'\n')).digest('hex'),SYMBOL_ENCODINGS_SOURCE.sha256,'src/symbol-encodings.js is behind opf spec/reference/symbol-font-encodings.json; run scripts/update-symbol-encodings.mjs');
}catch(error){if(error.code!=='ENOENT')throw error;}

console.log(`Symbol fonts: ${FAMILIES.length} families, ${Object.values(coverage).reduce((total,value)=>total+value.drawn,0)} of 1120 codes drawn with a real glyph (${Object.entries(coverage).map(([family,value])=>`${family} ${value.drawn}`).join(', ')}), ${Object.values(coverage).reduce((total,value)=>total+value.placeholders,0)} placeholders; both input forms render identically; raster ink verified.`);
