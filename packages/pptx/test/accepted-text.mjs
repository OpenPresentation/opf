import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
import {toPptx,fromPptx} from '../dist/index.js';
import {resolvePresentation} from '@openpresentation/opf-render';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
// FF-31: the deck chooses Carlito itself, so preview, package and the native text gate name one exact open face.
// Substituted previews (Aptos measured with Carlito) name the chosen family instead: test/export-chosen-fonts.mjs.
const fonts=await loadFonts({pack: 'office', substitutionPolicy:'none'});
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const nativeText=shape=>array(shape['p:txBody']?.['a:p']).map(p=>array(p['a:r']).map(r=>r['a:t']??'').join('')).join('\n');
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.002,`${label}: ${actual} vs ${expected}`);
let cases=0,lines=0;
const out=process.env.OPF_TEXT_OUT,records=[],hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(out)await mkdir(out,{recursive:true});
for(const dimensions of [{widthInches:40/3,heightInches:7.5},{widthInches:5.625,heightInches:10}])
for(const contentBox of [false,true])for(const alignment of ['start','center','end'])
for(const text of ['Full source\nSecond paragraph.', ['Exact spacing ',{text:'with bold words',bold:true},' and ',{text:'italics.',italic:true},'\n',{text:'Raised ',superscript:true},{text:'note',fontSize:20,underline:true},' stays editable.']]) {
  const deck={design:{contentBox,dimensions,titleAlignment:alignment,contentAlignment:alignment,fontScheme:{id:'carlito',heading: 'Carlito',body: 'Carlito'}},slides:[{tag:'Source',title:'A measured title that wraps when space is narrow',subtitle:'Supporting text',composition:{mode:'column',minFontSize:24},text}]};
  const original=structuredClone(deck),options={fonts};
  const bound=resolvePresentation(deck,options).slides[0],expected=bound.geometry.items.flatMap(item=>item.field==='title'&&item.text.placement.lines.length>1?[{item,placed:item.text.placement.lines[0],index:0,title:true}]:item.text.placement.lines.map((placed,index)=>({item,placed,index})));
  // RR-105 (opf#1291): a wrapped title is one Title placeholder: natively wrapped (wrap square) where its lines are verified, else its
  // measured lines joined by line breaks (wrap none); either way it starts where its first measured line starts.
  const bytes=await toPptx(deck,options),xml=new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const shapes=array(parser.parse(xml)['p:sld']['p:cSld']['p:spTree']['p:sp']).filter(shape=>nativeText(shape));
  assert.equal(shapes.length,expected.length,'One editable native shape per nonblank accepted line, one per wrapped title');
  for(const [i,shape] of shapes.entries()) {
    const {item,placed,index,title}=expected[i],rich=item.text.richLines?.[index],transform=shape['p:spPr']['a:xfrm'];
    const x=Number(transform['a:off'].x)/9525,y=Number(transform['a:off'].y)/9525,width=Number(transform['a:ext'].cx)/9525;
    const factor=alignment==='end'?1:alignment==='center'?.5:0;
    if(title){
      const soft=shape['p:txBody']['a:bodyPr'].wrap==='square';
      assert.equal(shape['p:nvSpPr']['p:nvPr']['p:ph']?.type,'title','A wrapped title is the Title placeholder');
      if(!soft)assert.equal(shape['p:txBody']['a:bodyPr'].wrap,'none','A title of fixed lines does not wrap');
      const paragraphs=array(shape['p:txBody']['a:p']);
      // A title of fixed lines is one paragraph per line, each starting where its measured box started it (its margins) and spaced to
      // core's pitch at single spacing (1.2 sizes a line); a natively wrapped one is one paragraph at single spacing.
      assert.equal(paragraphs.length,soft?1:item.text.lines.length,'Accepted native title paragraphs');
      const lineAnchor=index=>{const p=paragraphs[soft?0:index]['a:pPr'],marL=Number(p.marL??0)/9525,marR=Number(p.marR??0)/9525;return factor===0?x+marL:factor===1?x+width-marR:x+marL+(width-marL-marR)/2;};
      near(lineAnchor(0),soft?item.box.x+item.box.width*factor:placed.x+placed.width*factor,'Accepted native title alignment anchor');
      if(!soft)item.text.placement.lines.forEach((line,index)=>assert.ok(Math.abs(lineAnchor(index)-(line.x+line.width*factor))<.002+1e-6,'Accepted native title line anchor'));
      near(y,placed.baseline-item.text.fontSize,'Accepted native title top');
      for(const [index,paragraph] of paragraphs.entries()){
        assert.equal(Number(paragraph['a:pPr']['a:lnSpc']['a:spcPct'].val),100000,'Accepted native title single spacing');
        if(index)assert.ok(Math.abs(Number(paragraph['a:pPr']['a:spcBef']['a:spcPts'].val)/100-(item.text.placement.lines[index].baseline-item.text.placement.lines[index-1].baseline-1.2*item.text.fontSize)*.75)<.006,'Accepted native title space before');
      }
      assert.equal(nativeText(shape).replaceAll('\n',''),item.text.lines.join(''));
      for(const paragraph of array(shape['p:txBody']['a:p']))assert.equal(paragraph['a:pPr'].algn,{start:'l',center:'ctr',end:'r'}[alignment]);
      for(const auto of ['a:normAutofit','a:spAutoFit'])assert.ok(!Object.hasOwn(shape['p:txBody']['a:bodyPr'],auto),'PowerPoint must not silently refit a title');
      for(const run of array(shape['p:txBody']['a:p']).flatMap(p=>array(p['a:r']))){
        assert.equal(run['a:rPr']['a:latin'].typeface,item.textStyle.fontFamily);
        assert.equal(run['a:rPr'].b==='1',item.textStyle.fontWeight>=600);
        assert.ok(Math.abs(Number(run['a:rPr'].sz)/100-item.text.fontSize*.75)<.011);
      }
      lines+=item.text.lines.length;
      continue;
    }
    near(x+width*factor,placed.x+placed.width*factor,'Accepted native alignment anchor');
    near(y,rich?placed.y:placed.baseline-item.text.fontSize,'Accepted native line top');
    near(Number(transform['a:ext'].cy)/9525,placed.height,'Accepted native line height');
    assert.equal(nativeText(shape),item.text.lines[index]);
    for(const paragraph of array(shape['p:txBody']['a:p']))assert.equal(paragraph['a:pPr'].algn,{start:'l',center:'ctr',end:'r'}[alignment]);
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
  // Boundary tags recover authored separators while current native text wins.
  for(const field of ['title','subtitle','tag'])assert.equal(imported.slides[0][field],deck.slides[0][field]);
  if(typeof text==='string'){assert.equal(imported.slides[0].text,text,'the root text payload returns as authored');assert.equal(imported.slides[0].blocks,undefined);}
  const nativeWords=shapes.map(nativeText).join(' ').match(/\S+/g);
  const collect=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(collect):value&&typeof value==='object'?Object.entries(value).flatMap(([key,item])=>key==='text'||key==='title'||key==='subtitle'||key==='tag'||key==='blocks'?collect(item):[]):[];
  assert.deepEqual(collect(imported.slides[0]).join(' ').match(/\S+/g),nativeWords);
  assert.deepEqual(deck,original);
  if(out){const file=`case-${String(cases).padStart(2,'0')}.pptx`;await writeFile(path.join(out,file),bytes);records.push({file,sha256:hash(bytes),source:deck,geometry:bound.geometry,imported});}
  cases++;
}
if(out)await writeFile(path.join(out,'report.json'),JSON.stringify({node:process.version,scope:'Editable DrawingML geometry and current-text reimport; native application raster/save/reopen not exercised.',cases,lines,records},null,2)+'\n');
console.log(`Accepted text PPTX: ${cases} cases / ${lines} editable lines retain shared anchors, sizes, styles, no-refit and words through import. Native raster and original OPF structure are separate gates.`);
