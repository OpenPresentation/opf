import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {renderSvg,resolvePresentation} from '../../opf-render/src/svg.js';
import {loadOfficeFontRegistry} from '../../opf-render/src/fonts-node.js';
import {toPptx} from '../../opf-pptx/src/index.js';
const require=createRequire(new URL('../../opf-pptx/package.json',import.meta.url));
const {unzipSync}=require('fflate'),{XMLParser}=require('fast-xml-parser');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',trimValues:false,parseTagValue:false}),array=value=>Array.isArray(value)?value:value?[value]:[];
const document={name:'Measured lists',design:{fontScheme:'roboto'},slides:[{title:'Lists keep their structure',composition:{mode:'row',weights:[3,2]},blocks:[{items:[
 {text:['A ',{text:'bold recommendation',bold:true},' that wraps with a hanging indent when space is limited.'],description:['With ',{text:'an italic explanation',italic:true},' and a ',{text:'source link',link:'https://openpresentation.org',underline:true}]},
 {text:'Supporting evidence',level:1},
 {text:[{text:'Color and emphasis',color:'#2563EB',fontSize:22}],description:'A smaller description shares the text indent.',level:2},
 {text:['H',{text:'2',subscript:true},'O and x',{text:'2',superscript:true}],level:4}
 ]},{type:'text',bullets:['Text-style bullets',{text:[{text:'Also editable',italic:true}],level:1},'A final point']}]}]};
const fonts=await loadOfficeFontRegistry(),options={textMeasurement:fonts.textMeasurement};
const bound=resolvePresentation(document,options).slides[0],svg=renderSvg(document,{...options,embeddedFonts:fonts.embeddedFonts,trace:true});
assert.equal(bound.geometry.diagnostics.length,0);
for(const pattern of [/font-weight="700"/,/font-style="italic"/,/#2563EB/,/href="https:\/\/openpresentation.org"/,/data-opf-path="slides.0.blocks.0.items.0.description"/,/data-opf-path="slides.0.blocks.1.bullets.1.text"/])assert.match(svg,pattern);
const bytes=await toPptx(document,options),files=unzipSync(bytes),raw=new TextDecoder().decode(files['ppt/slides/slide1.xml']),xml=parser.parse(raw);
for(const pattern of [/b="1"/,/i="1"/,/baseline="-/,/hlinkClick/,/lvl="4"/])assert.match(raw,pattern);
const shapes=array(xml['p:sld']['p:cSld']['p:spTree']['p:sp']).slice(1);
let shapeIndex=0,bullets=0;
for(const item of bound.geometry.items.filter(i=>i.text?.listEntries))for(const entry of item.text.listEntries){
 for(const [fit,box,isBody] of [[entry.text,entry.textBox,true],[entry.description,entry.descriptionBox,false]]){
  if(!fit)continue;
  for(const [lineIndex,line] of fit.richLines.entries()){
   const shape=shapes[shapeIndex++],transform=shape['p:spPr']['a:xfrm'],paragraph=array(shape['p:txBody']['a:p'])[0],props=paragraph['a:pPr'];
   const first=isBody&&lineIndex===0;
   assert.ok(!Array.isArray(props),'Paragraph properties must appear only once');
   assert.equal(!!props['a:buChar'],first,'Only first body line has a native bullet');
   if(first){assert.equal(Number(props['a:buSzPts'].val),Math.round(entry.marker.fontSize*.75*100));assert.equal(props['a:buFont'].typeface,entry.marker.style.fontFamily);bullets++;assert.equal(props['a:buChar'].char,`&#x${entry.marker.text.codePointAt(0).toString(16)};`);}
   assert.ok(Math.abs((Number(transform['a:off'].x)+Number(props.marL??0))/9525-box.x)<.002,'PPTX paragraph start agrees with measured hanging indent');
   assert.ok(Math.abs(Number(transform['a:off'].y)/9525-(box.y+line.y))<.002,'PPTX line top agrees with measured layout');
   const text=array(paragraph['a:r']).map(run=>String(run['a:t']??'')).join('');
   assert.equal(text,line.fragments.map(f=>f.text).join(''),'Native text runs retain content and whitespace');
  }
 }
}
assert.equal(shapeIndex,shapes.length);assert.equal(bullets,7);
await mkdir('artifacts/lists',{recursive:true});
await writeFile('artifacts/lists/reference.opf.json',JSON.stringify(document,null,2)+'\n');
await writeFile('artifacts/lists/reference.svg',svg);await writeFile('artifacts/lists/reference.pptx',bytes);
console.log(`List ecosystem passed: ${bullets} native bullets, ${shapeIndex} measured lines, rich runs, descriptions and SVG/PPTX indent coordinates.`);
