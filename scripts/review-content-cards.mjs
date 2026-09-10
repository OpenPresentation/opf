import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {examples} from '../packages/javascript/dist/examples.js';
import {renderSvg,svgToPng} from '../../opf-render/dist/index.js';
const [beforeDir,currentDir,secondDir,output]=process.argv.slice(2).map(value=>path.resolve(value));
assert.ok(beforeDir&&currentDir&&secondDir&&output,'Pass previous/current/second-runtime corpus directories and a new output directory.');
const hash=value=>createHash('sha256').update(value).digest('hex'),json=async file=>JSON.parse(await readFile(file,'utf8'));
const before=await json(path.join(beforeDir,'candidate.json')),current=await json(path.join(currentDir,'candidate.json')),second=await json(path.join(secondDir,'candidate.json'));
assert.deepEqual(current,second);assert.deepEqual(current.source,before.source);
const keys=Object.keys(current.entries);assert.equal(keys.length,805);assert.deepEqual(keys,Object.keys(before.entries));
const corpus=new Map(examples.map(({file,deck})=>[file.replace(/^examples\//,''),deck]));
const changed=[];
for(const [index,key]of keys.entries()){
  const file=`${String(index).padStart(4,'0')}.png`;
  for(const [directory,manifest]of [[beforeDir,before],[currentDir,current],[secondDir,second]])assert.equal(hash(await readFile(path.join(directory,file))),manifest.entries[key].sha256,`${directory}/${file}`);
  if(before.entries[key].sha256===current.entries[key].sha256)continue;
  const [source,slide]=key.split('#'),deck=corpus.get(source);
  assert.equal(deck.slides[Number(slide)].design?.contentBox??deck.design?.contentBox,true,`${key}: an unframed slide changed`);
  changed.push({index,key,file,before:before.entries[key].sha256,after:current.entries[key].sha256});
}
await mkdir(output,{recursive:true});const sheets=[];
for(let offset=0;offset<changed.length;offset+=24){
  const entries=[];
  for(const [index,item]of changed.slice(offset,offset+24).entries()){
    const x=index%4*360,y=Math.floor(index/4)*132;
    for(const [side,directory]of [beforeDir,currentDir].entries()){
      const png=await readFile(path.join(directory,item.file));
      entries.push(`<image x="${x+side*180}" y="${y}" width="176" height="108" href="data:image/png;base64,${png.toString('base64')}"/>`);
    }
    entries.push(`<text x="${x+5}" y="${y+123}" font-size="11" font-family="Roboto">${item.index}: previous / padded</text>`);
  }
  const png=await svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="792"><rect width="100%" height="100%" fill="#ddd"/>${entries.join('')}</svg>`),file=`pairs-${offset/24}.png`;
  await writeFile(path.join(output,file),png);sheets.push({file,sha256:hash(png),indices:changed.slice(offset,offset+24).map(item=>item.index)});
}
const selected=[];
for(const type of ['quote','code','table','chart']){
  const item=changed.find(({key})=>{const [file,slide]=key.split('#');return JSON.stringify(corpus.get(file).slides[Number(slide)]).includes(`"${type}":`);});
  if(!item)continue;
  const [source,slide]=item.key.split('#'),svg=renderSvg(corpus.get(source),{slideIndex:Number(slide),trace:true}),png=await svgToPng(svg,{loadSystemFonts:false}),file=`full-${item.index}.png`;
  await writeFile(path.join(output,file),png);selected.push({...item,type,full:file,fullSha256:hash(png),svgSha256:hash(svg)});
}
const report={source:current.source,verifierSha256:hash(await readFile(new URL(import.meta.url))),verifiedImages:keys.length*3,changed,unchanged:keys.length-changed.length,sheets,selected,
  scope:'The authored corpus digest is unchanged. All previous/current Node24/current Node20 hashes verify and both current manifests agree exactly. Every changed slide explicitly enables content cards. Pair sheets show every changed raster; selected full-size images support payload inspection. This does not approve a golden baseline or certify glyph containment, readability, native fidelity or arbitrary content.'};
await writeFile(path.join(output,'review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({changed:changed.length,sheets:sheets.length,fullSize:selected.length,verifiedImages:report.verifiedImages,output}));
