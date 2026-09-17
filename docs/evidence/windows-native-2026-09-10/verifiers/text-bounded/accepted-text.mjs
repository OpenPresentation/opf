import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import JSZip from 'jszip';
import {toPptx,fromPptx} from '../dist/index.js';
import {resolvePresentation} from '@openpresentation/opf-render';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
const fonts=await loadOfficeFontRegistry({substitutionPolicy:'visual'});
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const nativeText=shape=>array(shape['p:txBody']?.['a:p']).map(p=>array(p['a:r']).map(r=>r['a:t']??'').join('')).join('\n');
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.002,`${label}: ${actual} vs ${expected}`);
let cases=0,lines=0;
const out=process.env.OPF_TEXT_OUT,records=[],hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(out)await mkdir(out,{recursive:true});
for(const dimensions of [{widthInches:40/3,heightInches:7.5},{widthInches:5.625,heightInches:10}])
for(const contentBox of [false,true])for(const alignment of ['left','center','right'])
for(const text of ['Full source\nSecond paragraph.', ['Exact spacing ',{text:'with bold words',bold:true},' and ',{text:'italics.',italic:true},'\n',{text:'Raised ',superscript:true},{text:'note',fontSize:20,underline:true},' stays editable.']]) {
  const deck={design:{contentBox,dimensions,titleAlignment:alignment,contentAlignment:alignment,fontScheme:{id:'roboto',heading:{family:'Aptos Display'},body:{family:'Aptos'}}},slides:[{tag:'Source',title:'A measured title that wraps when space is narrow',subtitle:'Supporting text',composition:{mode:'column',minFontSize:24},text}]};
  const original=structuredClone(deck),options={textMeasurement:fonts.textMeasurement};
  const bound=resolvePresentation(deck,options).slides[0],expected=bound.geometry.items.flatMap(item=>item.text.placement.lines.map((placed,index)=>({item,placed,index})));
  const bytes=await toPptx(deck,options),zip=await JSZip.loadAsync(bytes),xml=await zip.file('ppt/slides/slide1.xml').async('string');
  const shapes=array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']).filter(shape=>nativeText(shape));
  assert.equal(shapes.length,expected.length,'One editable native shape per nonblank accepted line');
  for(const [i,shape] of shapes.entries()) {
    const {item,placed,index}=expected[i],rich=item.text.richLines?.[index],transform=shape['p:spPr']['a:xfrm'];
    const x=Number(transform['a:off'].x)/9525,y=Number(transform['a:off'].y)/9525,width=Number(transform['a:ext'].cx)/9525;
    const factor=alignment==='right'?1:alignment==='center'?.5:0;
    near(x+width*factor,placed.x+placed.width*factor,'Accepted native alignment anchor');
    near(y,rich?placed.y:placed.baseline-item.text.fontSize,'Accepted native line top');
    near(Number(transform['a:ext'].cy)/9525,placed.height,'Accepted native line height');
    assert.equal(nativeText(shape),item.text.lines[index]);
    for(const paragraph of array(shape['p:txBody']['a:p']))assert.equal(paragraph['a:pPr'].algn,{left:'l',center:'ctr',right:'r'}[alignment]);
    assert.equal(shape['p:txBody']['a:bodyPr'].wrap,'none');
    // Omitted autofit means off; the pinned writer avoids explicit noAutofit for Office 2013.
    // https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.noautofit
    for(const auto of ['a:normAutofit','a:spAutoFit'])assert.ok(!Object.hasOwn(shape['p:txBody']['a:bodyPr'],auto),'PowerPoint must not silently refit accepted lines');
    const runs=array(shape['p:txBody']['a:p']).flatMap(p=>array(p['a:r']));
    for(const [j,run] of runs.entries()) {
      const fragment=rich?.fragments[j],style=fragment?.style??item.textStyle;
      assert.equal(run['a:rPr']['a:latin'].typeface,style.fontFamily);
      assert.equal(run['a:rPr'].b==='1',style.fontWeight>=600);
      assert.ok(Math.abs(Number(run['a:rPr'].sz)/100-(fragment?.fontSize??item.text.fontSize)*.75)<.011);
    }
    lines++;
  }
  const imported=await fromPptx(bytes);
  // Import reflows separate native lines; it does not recover original OPF boxes or whitespace.
  for(const field of ['title','subtitle','tag'])assert.equal(imported.slides[0][field],bound.geometry.items.find(item=>item.field===field).text.lines.join('\n'));
  const nativeWords=shapes.map(nativeText).join(' ').match(/\S+/g);
  const collect=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(collect):value&&typeof value==='object'?Object.entries(value).flatMap(([key,item])=>key==='text'||key==='title'||key==='subtitle'||key==='tag'||key==='blocks'?collect(item):[]):[];
  assert.deepEqual(collect(imported.slides[0]).join(' ').match(/\S+/g),nativeWords);
  assert.deepEqual(deck,original);
  if(out){const file=`case-${String(cases).padStart(2,'0')}.pptx`;await writeFile(path.join(out,file),bytes);records.push({file,sha256:hash(bytes),source:deck,geometry:bound.geometry,imported});}
  cases++;
}
if(out)await writeFile(path.join(out,'report.json'),JSON.stringify({node:process.version,scope:'Editable DrawingML geometry and current-text reimport; native application raster/save/reopen not exercised.',cases,lines,records},null,2)+'\n');
console.log(`Accepted text PPTX: ${cases} cases / ${lines} editable lines retain shared anchors, sizes, styles, no-refit and words through import. Native raster and original OPF structure are separate gates.`);
