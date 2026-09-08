// Generate and inspect local native PowerPoint evidence using an isolated consumer.
// Usage: node scripts/test-native-powerpoint.mjs <consumer> [generate|compare]
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const consumer = path.resolve(process.argv[2] ?? 'artifacts/native-powerpoint');
const mode = process.argv[3] ?? 'generate';
assert.ok(['generate', 'compare'].includes(mode), 'Expected generate or compare');
const require = createRequire(path.join(consumer, 'package.json'));
const load = async name => {
  const parts=name.split('/'), packageName=parts.slice(0,2).join('/');
  const manifestPath=require.resolve(packageName+'/package.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  const entry=manifest.exports[parts.length===2?'.':'./'+parts.slice(2).join('/')];
  const target=typeof entry==='string'?entry:entry.import??entry.default;
  assert.equal(typeof target,'string','Expected a Node ESM package export');
  return import(pathToFileURL(path.resolve(path.dirname(manifestPath),target)).href);
};
const {validatePresentation} = await load('@openpresentation/opf');
const {renderSvgDeck, svgToPng} = await load('@openpresentation/opf-render');
const {createFontRegistry} = await load('@openpresentation/opf-render/fonts');
const {toPptx, fromPptx} = await load('@openpresentation/opf-pptx');
const output = path.join(consumer, 'evidence');
await mkdir(output, {recursive:true});
const writeJson = (name, value) => writeFile(path.join(output, name), JSON.stringify(value,null,2)+'\n');
  const packages = Object.fromEntries(await Promise.all(['opf','opf-render','opf-pptx'].map(async name => [name,JSON.parse(await readFile(require.resolve('@openpresentation/'+name+'/package.json'),'utf8')).version])));
if (mode === 'generate') {
  // Installed Microsoft fonts are local test inputs, never committed or distributed.
  const fontDir = process.env.OPF_NATIVE_FONT_DIR ?? path.join(process.env.WINDIR ?? 'C:/Windows','Fonts');
  const faces = [['calibri.ttf',400,false],['calibrib.ttf',700,false],['calibrii.ttf',400,true],['calibriz.ttf',700,true]];
  const fontFiles = faces.map(([file]) => path.join(fontDir,file));
  const fonts = createFontRegistry(await Promise.all(faces.map(async ([file,weight,italic]) => ({data:new Uint8Array(await readFile(path.join(fontDir,file))),family:'Calibri',weight,italic}))),{substitutionPolicy:'none'});
  const document = {design:{fontScheme:{id:'calibri',code:{family:'Calibri'}},dimensions:{widthInches:1280/96,heightInches:720/96}},slides:[
    {title:'Native text verification',text:'PowerPoint keeps this content editable. Calibri uses the same installed font bytes for measurement and the SVG raster comparison.'},
    {title:'Styled and merged table',table:{columns:['Team','Stage','Status'],rows:[
      [{value:['Mixed ',{text:'bold',bold:true},' text'],rowSpan:2,style:{fill:'#DDEEFF',verticalAlign:'bottom',align:'right',padding:{left:12,right:18,top:4,bottom:8},borders:{right:{color:'#225588',width:3,dash:'dash'}}}},'Editable cell',{value:'Ready',style:{fill:'#E5F5EA',align:'center'}}],
      [null,'Editing',{value:'Review',style:{borders:{bottom:{color:'#AA3300',width:2,dash:'dot'}}}}]
    ]}},
    {title:'Border ownership and covered rows',table:{rows:[
      [{value:'Merged anchor',rowSpan:2,colSpan:2,style:{fill:'#12345680',color:'#FFFFFF',borders:{top:{color:'#334455',width:3},bottom:{color:'#000000',width:0}}}},null,'Neighbor'],
      [null,null,{value:'Explicit edge',style:{borders:{left:{color:'#BB3300',width:2,dash:'dash'}}}}],
      ['Bottom left','Bottom middle','Bottom right']
    ]}}
  ]};
  const validation = validatePresentation(document);
  assert.equal(validation.valid,true,JSON.stringify(validation));
  const diagnostics=[];
  const options={textMeasurement:fonts.textMeasurement,onDiagnostic:d=>diagnostics.push(d)};
  const slides=renderSvgDeck(document,options);
  for(let index=0;index<slides.length;index++) {
    // No embedded proprietary font bytes in evidence SVGs.
    await writeFile(path.join(output,`renderer-${index+1}.svg`),slides[index]);
    await writeFile(path.join(output,`renderer-${index+1}.png`),await svgToPng(slides[index],{fontFiles,useBundledFonts:false,loadSystemFonts:false}));
  }
  await writeFile(path.join(output,'source.pptx'),await toPptx(document,options));
  await writeJson('source.opf.json',document);
  assert.deepEqual(fonts.substitutions,[],'Exact local fonts required');
  await writeJson('generation.json',{packages,slides:slides.length,fontFamily:'Calibri',fontFiles:faces.map(([file])=>file),fontSubstitutions:fonts.substitutions,diagnostics,scope:'Registry core/renderer plus installed PPTX package; consult consumer lockfile for candidate versus registry provenance.'});
  console.log(`Generated ${slides.length} native fixtures in ${output}`);
} else {
  const sharp = require('sharp');
  const native = JSON.parse((await readFile(path.join(output,'native.json'),'utf8')).replace(/^\uFEFF/,''));
  assert.equal(native.slides,3);
  assert.equal(native.tableCount,2);
  assert.equal(native.editReopened,true);
  const comparisons=[], nativeFeatures=[];
  for(let index=1;index<=native.slides;index++) {
    const expected=await sharp(path.join(output,`renderer-${index}.png`)).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const actual=await sharp(path.join(output,`native-${index}.png`)).removeAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual(actual.info,expected.info,'Raster dimensions/channels must match');
    let total=0,max=0,over10=0;
    const difference=Buffer.alloc(expected.data.length);
    for(let i=0;i<difference.length;i++) {const delta=Math.abs(expected.data[i]-actual.data[i]);total+=delta;max=Math.max(max,delta);if(delta>10)over10++;difference[i]=delta;}
    await sharp(difference,{raw:expected.info}).png().toFile(path.join(output,`difference-${index}.png`));
    comparisons.push({slide:index,meanAbsoluteChannelDifference:total/difference.length,maxChannelDifference:max,channelFractionOver10:over10/difference.length});
    const countColor=(color,[left,right,top,bottom])=>{
      let count=0;
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
        const offset=(y*actual.info.width+x)*3;
        if(color.every((channel,i)=>Math.abs(actual.data[offset+i]-channel)<30))count++;
      }
      return count;
    };
    // Independent raster observations at fixed 1280x720 fixture coordinates.
    // Global mean error hides thin missing borders in mostly empty slides.
    if(index===2){
      const pixels=countColor([34,85,136],[443,449,270,300]);
      assert.ok(pixels>=15,'Dashed merge border must reach the lower covered row');
      nativeFeatures.push({feature:'Lower merged-cell dash',coloredPixels:pixels,minimum:15});
    }
    if(index===3){
      const pixels=countColor([58,198,122],[500,750,253,257]);
      assert.equal(pixels,0,'An implicit neighbor must not restore a zero-width merge border');
      nativeFeatures.push({feature:'Hidden lower merge border',unexpectedGreenPixels:pixels,maximum:0});
    }
  }
  const imports=[];
  for(const name of ['source','native-saved','native-edited']) {
    const diagnostics=[];
    const document=await fromPptx(new Uint8Array(await readFile(path.join(output,name+'.pptx'))),{onDiagnostic:d=>diagnostics.push(d)});
    assert.equal(validatePresentation(document).valid,true);
    assert.equal(document.slides.length,3);
    const tables=document.slides.flatMap(slide=>(slide.blocks??[]).filter(block=>block.table).map(block=>block.table));
    assert.equal(tables.length,2,'Tables remain structured OPF tables after native save');
    assert.equal(tables[0].rows[0][0].rowSpan,2,'Vertical merge survives native save');
    assert.equal(tables[1].rows[0][0].rowSpan,2);
    assert.equal(tables[1].rows[0][0].colSpan,2,'Rectangular merge survives native save');
    if(name==='native-edited')assert.match(JSON.stringify(document),/Edited in native PowerPoint/);
    await writeJson(name+'.reimport.opf.json',document);
    imports.push({name,valid:true,tables:tables.length,mergesPreserved:true,diagnostics});
  }
  await writeJson('comparison.json',{packages,native,nativeFeatures,comparisons,imports,scope:'Measured native PowerPoint rendering, editable native tables and save/reopen/reimport. Two targeted border raster assertions pass; global pixel differences are observations, not a passing equivalence threshold.'});
  console.log(JSON.stringify({nativeFeatures,comparisons,imports},null,2));
}
