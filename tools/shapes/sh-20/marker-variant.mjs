// Diagnostic only: match the ordinary native line's explicit end-paragraph size/language in SmartArt. Exact pitch is retained.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const {unzipSync,zipSync,strFromU8,strToU8}=createRequire(new URL('../../../packages/pptx/package.json',import.meta.url))('fflate');
const[source,out]=process.argv.slice(2);if(!source||!out||fs.existsSync(out))throw Error('Supply source sweep and a fresh output directory');
const names=['cycle-4-short-square','matrix-4-cjk-wide','matrix-4-rtl-wide'],records=[];
for(const kind of ['pptx','pptx-shapes']){
 fs.mkdirSync(path.join(out,kind),{recursive:true});
 for(const name of names){
  const input=path.join(source,kind,name+'.pptx'),before=fs.readFileSync(input);let after=before;const partsChanged=[];
  if(kind==='pptx'){
   const entries=unzipSync(before);
   for(const part of Object.keys(entries).filter(p=>/^ppt\/diagrams\/(data|drawing)\d+\.xml$/.test(p))){
    const xml=strFromU8(entries[part]),next=xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g,(all,body)=>{
     if(body.includes('<a:endParaRPr')||!body.includes('<a:r>'))return all;
     const props=[...body.matchAll(/<a:rPr\b([^>]*?)(?:\/>|>)/g)].at(-1)?.[1],lang=/\blang="([^"]+)"/.exec(props??'')?.[1],size=/\bsz="(\d+)"/.exec(props??'')?.[1];
     if(!lang||!size)throw Error('No explicit native run language/size');
     return `<a:p>${body}<a:endParaRPr lang="${lang}" sz="${size}" dirty="0"/></a:p>`;
    });
    if(next!==xml){entries[part]=strToU8(next);partsChanged.push(part);}
   }
   if(partsChanged.length<2)throw Error('Expected active data and cached drawing marker changes');after=zipSync(entries,{level:6,mtime:new Date('2026-11-07T00:00:00Z')});
  }
  const output=path.join(out,kind,name+'.pptx');fs.writeFileSync(output,after);records.push({input,output,partsChanged,beforeSha256:createHash('sha256').update(before).digest('hex'),afterSha256:createHash('sha256').update(after).digest('hex')});
 }
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({scope:'Diagnostic only; explicit end-paragraph style, exact pitch unchanged.',records},null,2));console.log('Three live marker variants and three byte-exact native controls written');
