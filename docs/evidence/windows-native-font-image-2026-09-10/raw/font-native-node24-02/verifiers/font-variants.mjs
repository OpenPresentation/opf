import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx,fromPptx} from '../dist/index.js';

const require=createRequire(new URL('../../opf-render/package.json',import.meta.url)),{create}=require('fontkit');
const {options}=await prepareNodeFonts(),allowed=new Map();
const key=(family,bold,italic)=>JSON.stringify([family,!!bold,!!italic]);
for(const file of options.fontFiles){
  const font=create(await readFile(file)),style=font['OS/2'].fsSelection;
  allowed.set(key(font.getName('fontFamily','en'),style.bold,style.italic),{family:font.familyName,weight:font['OS/2'].usWeightClass});
}
const source={design:{fontScheme:'roboto'},slides:[
  {title:'Heading',subtitle:'Subtitle',tag:'Tag',text:'Scalar text stays editable.'},
  {text:['Regular ',{text:'bold ',bold:true},{text:'italic ',italic:true},{text:'both',bold:true,italic:true}]},
  {table:{columns:[['Header ',{text:'normal',bold:false}]],rows:[[['Cell ',{text:'emphasis',italic:true}]]] }},
  {quote:{text:'Quote body',attribution:'Quote author',source:'Original source'}},
  {code:{filename:'example.js',language:'JavaScript',source:'const count = 123;'}},
  {metric:{value:123,label:'Weight 500 label',description:'Regular description',delta:'+2'}},
  {items:[{text:['List ',{text:'bold',bold:true}]},{text:'Second item'}]},
]};
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const original=JSON.stringify(source),bytes=await toPptx(source,options);
assert.equal(JSON.stringify(source),original);
assert.deepEqual(await toPptx(source,options),bytes,'Physical face selection must replay deterministically');
const zip=unzipSync(bytes),seen=new Set(),runs=[];
function visit(value,slide){
  if(!value||typeof value!=='object')return;
  if(value['a:rPr']&&Object.hasOwn(value,'a:t')){
    const props=value['a:rPr'],family=props['a:latin']?.typeface;
    if(family){
      const selection=key(family,props.b==='1',props.i==='1');
      assert.ok(allowed.has(selection),`Slide ${slide}: native style must select a real registered face: ${selection}`);
      seen.add(selection);runs.push({slide,text:value['a:t'],family,bold:props.b==='1',italic:props.i==='1'});
    }
  }
  for(const child of Object.values(value))visit(child,slide);
}
for(let index=0;index<source.slides.length;index++)visit(parser.parse(new TextDecoder().decode(zip[`ppt/slides/slide${index+1}.xml`])),index);
for(const family of ['Roboto Medium','Roboto SemiBold','Roboto ExtraBold'])assert.ok(seen.has(key(family,false,false)),`${family} stays regular within its physical legacy family`);
for(const [bold,italic]of [[false,false],[true,false],[false,true],[true,true]])assert.ok(seen.has(key('Roboto',bold,italic)));
for(const bold of [false,true])assert.ok(seen.has(key('Roboto Mono',bold,false)));
const imported=await fromPptx(bytes);
assert.equal(imported.slides[0].title,'Heading');
assert.deepEqual(imported.slides[4].blocks,[{type:'code',code:source.slides[4].code}]);
assert.ok(JSON.stringify(imported).includes('Weight 500 label'));
// Providers without physical metadata keep the historical numeric-weight contract.
const legacy={...options,textMeasurement:{...options.textMeasurement,resolveStyle(style){const resolved=options.textMeasurement.resolveStyle(style);delete resolved.fontFace;return resolved;}}};
const fallbackZip=unzipSync(await toPptx({design:{fontScheme:'roboto'},slides:[{title:'Legacy provider'}]},legacy));
assert.match(new TextDecoder().decode(fallbackZip['ppt/slides/slide1.xml']),/b="1"/);
const invalid={...options,textMeasurement:{...options.textMeasurement,resolveStyle(style){return {...options.textMeasurement.resolveStyle(style),fontFace:{family:'Roboto',bold:'invalid',italic:false}};}}};
await assert.rejects(()=>toPptx({design:{fontScheme:'roboto'},slides:[{text:'Invalid provider metadata'}]},invalid),{code:'invalid-font-selection'});
const output=path.resolve(process.argv[2]??'artifacts/font-variants.json');
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify({node:process.version,slides:source.slides.length,physicalFaces:seen.size,runs,scope:'Actual serialized native font selections, source and reimport. Office paint remains separate.'},null,2)+'\n');
await writeFile(output.replace(/\.json$/,'.opf.json'),JSON.stringify(source,null,2)+'\n');
await writeFile(output.replace(/\.json$/,'.pptx'),bytes);
console.log(`${source.slides.length} payload slides use all nine real physical font styles; deterministic output, source, reimport and provider controls pass.`);
