// Observe exact-weight selection and native style flags without changing source or baselines.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {create} from 'fontkit';
import {prepareNodeFonts} from '../dist/fonts-node.js';
import {toPptx} from '../../opf-pptx/dist/index.js';

const output=path.resolve(process.argv[2]??'artifacts/font-variants');
await mkdir(output,{recursive:true});
const {registry,options}=await prepareNodeFonts(),faces=[];
for(const [index,file]of options.fontFiles.entries()){
  const data=await readFile(file),font=create(data);
  faces.push({family:font.familyName,preferredFamily:font.getName('preferredFamily','en')??font.familyName,
    weight:options.embeddedFonts[index].weight,italic:!!options.embeddedFonts[index].italic,
    styleLink:{bold:font['OS/2'].fsSelection.bold,italic:font['OS/2'].fsSelection.italic},
    sha256:createHash('sha256').update(data).digest('hex')});
}
const resolutions=[];
for(const weight of [400,500,600,700,800]){
  const requested={fontFamily:'Roboto',fontWeight:weight,path:`weights.${weight}`};
  const expected=faces.find(face=>face.preferredFamily==='Roboto'&&face.weight===weight&&!face.italic);
  assert.ok(expected,'The requested exact face must actually be installed');
  const actual=registry.resolveFont(requested);
  resolutions.push({requested,actual,expected,exactWeightSelected:actual.resolvedWeight===weight&&actual.resolvedFamily===expected.family});
}

// Explicit legacy-family requests expose the existing native bold-bit risk
// independently of a future change to preferred-family lookup.
const source={design:{fontScheme:{id:'variant-audit',major:'Roboto ExtraBold',minor:'Roboto SemiBold'}},
  slides:[{metric:{value:123,label:'Exact weight metadata',description:'Existing explicit family request'}}]};
const original=JSON.stringify(source),bytes=await toPptx(source,options);
assert.equal(JSON.stringify(source),original);
const require=createRequire(new URL('../../opf-pptx/package.json',import.meta.url));
const {unzipSync}=require('fflate'),{XMLParser}=require('fast-xml-parser');
const xml=new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
const tree=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',trimValues:false,parseTagValue:false}).parse(xml),nativeRuns=[];
function visit(value){
  if(!value||typeof value!=='object')return;
  if(value['a:rPr']&&value['a:t']){
    const props=value['a:rPr'],family=props['a:latin']?.typeface;
    const face=faces.find(face=>face.family===family&&!face.italic);
    nativeRuns.push({text:value['a:t'],family,bold:props.b==='1',italic:props.i==='1',
      expectedStyleLink:face?.styleLink,styleLinkMatches:!!face&&(props.b==='1')===face.styleLink.bold&&(props.i==='1')===face.styleLink.italic});
  }
  for(const child of Object.values(value))visit(child);
}
visit(tree);
const report={node:process.version,faces,resolutions,nativeRuns,
  selectionGaps:resolutions.filter(item=>!item.exactWeightSelected).length,
  nativeStyleGaps:nativeRuns.filter(item=>!item.styleLinkMatches).length,
  scope:'Installed exact font bytes and serialized DrawingML only. A mismatched native style flag is a synthesis/fallback risk, not observed PowerPoint paint.'};
await writeFile(path.join(output,'source.opf.json'),JSON.stringify(source,null,2)+'\n');
await writeFile(path.join(output,'native.pptx'),bytes);
await writeFile(path.join(output,'native.xml'),xml);
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({selectionGaps:report.selectionGaps,nativeStyleGaps:report.nativeStyleGaps,output}));
