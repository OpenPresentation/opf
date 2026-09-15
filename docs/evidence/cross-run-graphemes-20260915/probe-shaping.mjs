// Run from the installed consumer with node --input-type=module < this-file.
// This records an unresolved layout dependency; it is not a passing fidelity test.
import {fitRichText} from '@openpresentation/opf/composition';
import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {loadHarfBuzzShaper} from '@openpresentation/opf-render/font-shaping';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.env.NODE_OPTIONS||process.execArgv.some(arg=>/^(--import|--loader|--experimental-loader|--require|-r)(=|$)/.test(arg)))
  throw Error('The installed shaping probe must not use runtime aliases.');
const modulesRoot=await realpath(path.resolve('node_modules'));
const hash=data=>createHash('sha256').update(data).digest('hex');
const prepared=await prepareNodeFonts({pack:'office',fontShaper:await loadHarfBuzzShaper()}),results=[];
try {
  for(const [family,text,pieces]of [['Arimo','AV',['A','V']],['Gelasio','office',['of','fice']],['Arimo','A\u0301B',['A','\u0301B']]]){
    const options={style:{fontFamily:family,fontWeight:400},textMeasurement:prepared.options.textMeasurement};
    const fit=value=>fitRichText(value.map(text=>({text,color:'#123456'})),{x:0,y:0,width:1000,height:200},32,32,options).richLines[0];
    const whole=fit([text]),split=fit(pieces);
    const fragments=line=>line.fragments.map(fragment=>({text:fragment.text,x:fragment.x,width:fragment.width}));
    results.push({family,text,pieces,wholeWidth:whole.width,splitWidth:split.width,delta:split.width-whole.width,wholeFragments:fragments(whole),splitFragments:fragments(split)});
  }
  const files=['@openpresentation/opf/composition','@openpresentation/opf-render/fonts-node','@openpresentation/opf-render/font-shaping','@openpresentation/opf-render/harfbuzz.wasm'];
  const modules=Object.fromEntries(await Promise.all(files.map(async name=>{
    const file=await realpath(fileURLToPath(import.meta.resolve(name)));
    if(!file.startsWith(modulesRoot+path.sep))throw Error('The shaping probe loaded a checkout module: '+file);
    return [name,{file,sha256:hash(await readFile(file))}];
  })));
  const fonts=prepared.registry.embeddedFonts.filter(face=>['Arimo','Gelasio'].includes(face.family)&&face.weight===400&&!face.italic)
    .map(face=>({family:face.family,weight:face.weight,italic:face.italic,sha256:hash(Buffer.from(face.dataUrl.split(',')[1],'base64'))}));
  console.log(JSON.stringify({node:process.version,modules,fonts,results},null,2));
} finally {prepared.registry.dispose();}
