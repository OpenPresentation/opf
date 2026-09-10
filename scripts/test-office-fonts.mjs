import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {loadOfficeFontRegistry} from '../../opf-render/dist/fonts-node.js';
import {createFontRegistry} from '../../opf-render/dist/fonts.js';
import {renderSvgDeck,resolvePresentation,svgToPng} from '../../opf-render/dist/index.js';
import {toPptx} from '../../opf-pptx/dist/index.js';
import {createEditorSession} from '../../opf-editor/dist/index.js';
import {paginatePresentation} from '../packages/javascript/dist/pagination.js';
const require=createRequire(new URL('../../opf-pptx/package.json',import.meta.url));
const {unzipSync}=require('fflate');
const {XMLParser}=require('fast-xml-parser');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const array=value=>Array.isArray(value)?value:value?[value]:[];
const pairs=[['Calibri','Carlito'],['Cambria','Caladea'],['Arial','Arimo'],['Times New Roman','Tinos'],['Courier New','Cousine'],['Georgia','Gelasio']];
const registry=await loadOfficeFontRegistry({substitutionPolicy:'visual'});
const options={textMeasurement:registry.textMeasurement};
const source={name:'Open-source Office font compatibility',slides:pairs.map(([requested,resolved],index)=>({
  id:`font-${index}`, design:{fontScheme:{major:requested,minor:requested,code:{family:'Cousine'}}},
  title:`${requested} to ${resolved}`,composition:{mode:'row',weights:[2,1]},
  blocks:[{text:'The words should keep their rhythm. Actual glyph advances determine wrapping, so previews and exports share the same measured layout. AVATAR office affine 0123456789. '.repeat(3)},
  {text:'Regular and bold, serif and sans serif: use the same font bytes and make every substitution visible.'}]
}))};
const {presentation}=paginatePresentation(source,options);
const editor=createEditorSession(presentation);
const resolved=resolvePresentation(presentation,options);
for(let i=0;i<presentation.slides.length;i++) assert.deepEqual(editor.composeSlide(i,options),resolved.slides[i].geometry);
const diagnostics=[];
const svgs=renderSvgDeck(presentation,{...options,embeddedFonts:registry.embeddedFonts,onDiagnostic:d=>diagnostics.push(d)});
assert.deepEqual(diagnostics,[]);
const pptx=await toPptx(presentation,options);
const zip=unzipSync(pptx);
for(let i=0;i<presentation.slides.length;i++) {
  const xml=new TextDecoder().decode(zip[`ppt/slides/slide${i+1}.xml`]);
  const family=resolved.slides[i].geometry.items.find(item=>item.text)?.textStyle.fontFamily;
  assert.ok(pairs.some(([,substitute])=>substitute===family));
  assert.ok(xml.includes(`typeface="${family}"`));
  assert.ok(svgs[i].includes(`font-family="${family}`));
  const shapes=array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']);
  const lines=resolved.slides[i].geometry.items.flatMap(item=>item.text.placement.lines.map((placed,index)=>({item,placed,index})).filter(({index})=>item.text.lines[index]));
  assert.equal(shapes.length,lines.length,'Each accepted substitute-font line remains editable');
  shapes.forEach((shape,index)=>{
    const transform=shape['p:spPr']['a:xfrm'],{item,placed,index:lineIndex}=lines[index];
    const alignment=item.text.placement.alignment,factor=alignment==='right'?1:alignment==='center'?.5:0;
    const x=Number(transform['a:off'].x)/9525,width=Number(transform['a:ext'].cx)/9525;
    for(const [actual,wanted] of [[x+width*factor,placed.x+placed.width*factor],[Number(transform['a:off'].y)/9525,placed.baseline-item.text.fontSize],[Number(transform['a:ext'].cy)/9525,placed.height]]) assert.ok(Math.abs(actual-wanted)<0.002,'Accepted substitute-font geometry');
    const text=array(shape['p:txBody']['a:p']).map(p=>array(p['a:r']).map(r=>String(r['a:t']??'')).join('')).join('\n');
    assert.equal(text,item.text.lines[lineIndex]);
    assert.equal(shape['p:txBody']['a:bodyPr'].wrap,'none');
    for(const auto of ['a:normAutofit','a:spAutoFit'])assert.ok(!Object.hasOwn(shape['p:txBody']['a:bodyPr'],auto));
  });
}
const output=new URL('../artifacts/fonts/office/',import.meta.url);
await mkdir(output,{recursive:true});
await writeFile(new URL('presentation.opf.json',output),JSON.stringify(presentation,null,2));
await writeFile(new URL('presentation.pptx',output),pptx);
await writeFile(new URL('slide-1.svg',output),svgs[0]);
await writeFile(new URL('slide-1.png',output),await svgToPng(svgs[0],{fontFiles:registry.fontFiles,useBundledFonts:false,loadSystemFonts:false}));
const files=await Promise.all(registry.fontFiles.map(async file=>({file:file.split('/node_modules/')[1],sha256:createHash('sha256').update(await readFile(file)).digest('hex')})));
const report={description:'Compatibility reflects upstream design intent. Tests measure these specific files; no claim of universal identical wrapping.',pages:presentation.slides.length,substitutions:registry.substitutions,files,comparisons:[]};
// Optional, read-only comparison with fonts already installed on this Mac. Never copy or embed originals.
if(process.argv.includes('--system')) {
  const samples=['The quick brown fox jumps over the lazy dog.','AVATAR To Wa Yo fi fl ffi office affine','0123456789 $1,234.56 50% + = (a/b)','Café naïve résumé — “quotes” and punctuation!'];
  for(const [fontFamily,substitute] of pairs.slice(2)) for(const [suffix,fontWeight,italic] of [['',400,false],[' Bold',700,false],[' Italic',400,true],[' Bold Italic',700,true]]) {
    let data;
    try { data=new Uint8Array(await readFile(`/System/Library/Fonts/Supplemental/${fontFamily}${suffix}.ttf`)); }
    catch(error) { if(error.code==='ENOENT') {report.comparisons.push({fontFamily,fontWeight,italic,skipped:'Reference font not installed.'});continue;} throw error; }
    const original=createFontRegistry([{data,weight:fontWeight,italic}]);
    const style={fontFamily,fontWeight,italic};
    const runs=samples.map(text=>{
      const expected=original.textMeasurement.measure(text,25,style),actual=registry.textMeasurement.measure(text,25,style);
      return {text,referenceWidth:expected,substituteWidth:actual,delta:actual-expected,relativeDelta:Math.abs(actual-expected)/expected};
    });
    report.comparisons.push({fontFamily,substitute,fontWeight,italic,referenceSha256:createHash('sha256').update(data).digest('hex'),maxRelativeDelta:Math.max(...runs.map(run=>run.relativeDelta)),runs});
  }
}
await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));
console.log(`Office fonts passed: ${presentation.slides.length} pages, matching editor/SVG geometry and resolved native PPTX families; 24 substitute faces with license notices.`);
for(const result of report.comparisons) console.log(`${result.fontFamily} ${result.fontWeight}${result.italic?' italic':''}: ${result.skipped ?? `${(result.maxRelativeDelta*100).toFixed(4)}% maximum shaped-width difference`}`);
