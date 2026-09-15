import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx} from '../dist/index.js';
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';
import {resolvePresentation} from '../../opf-render/dist/svg.js';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),decode=bytes=>new TextDecoder().decode(bytes),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const hash=value=>createHash('sha256').update(value).digest('hex'),{options:fontOptions}=await prepareNodeFonts(),results=[];
const imageBytes=await readFile(new URL('fixtures/images/wide.png',import.meta.url));
const image={src:`data:image/png;base64,${imageBytes.toString('base64')}`,alt:'Header image with text'};
for(const measured of [false,true])for(const [width,height]of [[1280,720],[720,1280]])for(const floor of [16,32])for(const local of [false,true]){
 const source={organization:{id:'primary',name:'Organization'},design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96},header:{left:{text:' Authored\twords \r\n\r\nlast  \r'},center:{organization:true},right:{section:true}},footer:{left:{date:' 2026-09-10 '},right:{slideNumber:true}}},slides:[{title:'Furniture',section:'Section',text:'Keep body words.',composition:{minFontSize:floor,overflow:'error'},...(local?{design:{header:{left:{image,text:''},right:{text:'Local'}}}}:{})}]};
 const before=structuredClone(source),options=measured?fontOptions:{},layout=resolvePresentation(source,options).slides[0].geometry.furniture;
 const bytes=await toPptx(source,{...options,strictAssets:true}),entries=unzipSync(bytes),tree=parser.parse(decode(entries['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree'];
 const shapes=array(tree['p:sp']).filter(shape=>shape['p:nvSpPr']?.['p:cNvPr']?.name.startsWith('OPF furniture '));
 assert.equal(shapes.length,layout.parts.filter(part=>part.type==='text').reduce((count,part)=>count+part.fit.sourceLines.length,0));
 for(const [partIndex,part]of layout.parts.entries()){
  if(part.type==='image')continue;
  for(const [index,line]of part.fit.sourceLines.entries()){
   const shape=shapes.find(shape=>shape['p:nvSpPr']['p:cNvPr'].name===`OPF furniture 0 part ${partIndex} line ${index}`);assert.ok(shape);
   const text=array(shape['p:txBody']['a:p']).map(p=>array(p['a:r']).map(run=>run['a:t']??'').join('')).join('\n');assert.equal(text,part.text.slice(line.start,line.end));
   const fit=part.fit,placed=fit.placement?.lines[index],factor=part.alignment==='right'?1:part.alignment==='center'?.5:0;
   const area=placed?{x:placed.x+placed.width*factor-part.box.width*factor,y:placed.baseline-fit.fontSize,width:part.box.width,height:placed.height}:{x:part.box.x,y:part.box.y+index*fit.lineHeight,width:part.box.width,height:fit.lineHeight};
   const transform=shape['p:spPr']['a:xfrm'];for(const [actual,expected]of [[transform['a:off'].x,area.x],[transform['a:off'].y,area.y],[transform['a:ext'].cx,area.width],[transform['a:ext'].cy,area.height]])assert.equal(Number(actual),Math.round(expected*9525));
   for(const paragraph of array(shape['p:txBody']['a:p']))for(const run of array(paragraph['a:r']))assert.equal(Number(run['a:rPr'].sz),Math.round(fit.fontSize*.75*100));
   for(const auto of ['a:normAutofit','a:spAutoFit'])assert.ok(!Object.hasOwn(shape['p:txBody']['a:bodyPr'],auto));
  }
 }
 const pictures=array(tree['p:pic']);assert.equal(pictures.length,local?1:0);
 if(local){const picture=pictures[0],box=layout.parts.find(part=>part.type==='image').box,transform=picture['p:spPr']['a:xfrm'];
  const x=Number(transform['a:off'].x)/9525,y=Number(transform['a:off'].y)/9525,w=Number(transform['a:ext'].cx)/9525,h=Number(transform['a:ext'].cy)/9525;
  assert.ok(Math.abs(w/h-2)<.002);assert.ok(w<=box.width+.002&&h<=box.height+.002);assert.ok(Math.abs(x+w/2-box.x-box.width/2)<.002&&Math.abs(y+h/2-box.y-box.height/2)<.002);
  assert.equal(picture['p:nvPicPr']['p:cNvPr'].descr,image.alt);
 }
 assert.deepEqual(source,before);assert.equal(hash(await toPptx(source,{...options,strictAssets:true})),hash(bytes));
 results.push({measured,width,height,floor,local,parts:layout.parts.length,textShapes:shapes.length,pictures:pictures.length,sha256:hash(bytes)});
}
const disabled={design:{fontScheme:'roboto',header:{left:{text:'Disabled'}},footer:{right:{text:'Disabled'}}},slides:[{text:'Body',design:{header:false,footer:false}}]};
assert.ok(!decode(unzipSync(await toPptx(disabled))['ppt/slides/slide1.xml']).includes('Disabled'));
await assert.rejects(toPptx({design:{header:{left:{text:'Line\n'.repeat(100)}}},slides:[{text:'Body',composition:{overflow:'error'}}]}),{code:'layout-overflow'});
if(process.argv[2]){await mkdir(path.dirname(path.resolve(process.argv[2])),{recursive:true});await writeFile(process.argv[2],JSON.stringify({node:process.version,verifierSha256:hash(await readFile(new URL(import.meta.url))),results,scope:'16 deterministic PPTX exports match accepted core furniture text, fonts, tab source, boxes and fitted images. No semantic reimport or native Office claim; provenance remains separate pending work.'},null,2)+'\n');}
console.log('16 furniture exports match accepted editable text boxes, fonts, source lines and images; explicit disabling and strict overflow controls pass.');
