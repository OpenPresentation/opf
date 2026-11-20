// SH20/22 diagnostic experiment only. The native-shape controls remain byte-exact; no eligibility or threshold change.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const {unzipSync,zipSync,strFromU8,strToU8}=createRequire(new URL('../../../packages/pptx/package.json',import.meta.url))('fflate');
const [source,out]=process.argv.slice(2);
if(!source||!out)throw Error('Usage: node spacing-variant.mjs <source-sweep> <new-output>');
if(fs.existsSync(out))throw Error('Preserve earlier experiment: output already exists');
const names=['cycle-4-short-square','matrix-4-cjk-wide','matrix-4-rtl-wide'],records=[];
for(const kind of ['pptx','pptx-shapes']){
 fs.mkdirSync(path.join(out,kind),{recursive:true});
 for(const name of names){
  const input=path.join(source,kind,name+'.pptx'),before=fs.readFileSync(input);let after=before,partsChanged=[];
  if(kind==='pptx'){
   const entries=unzipSync(before);
   for(const part of Object.keys(entries).filter(p=>/^ppt\/diagrams\/(data|drawing)\d+\.xml$/.test(p))){
    const xml=strFromU8(entries[part]),next=xml.replace(/<a:lnSpc><a:spcPts val="\d+"\/><\/a:lnSpc>/g,'<a:lnSpc><a:spcPct val="100000"/></a:lnSpc>');
    if(next!==xml){entries[part]=strToU8(next);partsChanged.push(part);}
   }
   if(partsChanged.length<2)throw Error('Expected active data and cached drawing pitch changes');
   after=zipSync(entries,{level:6,mtime:new Date('2026-11-07T00:00:00Z')});
  }
  const output=path.join(out,kind,name+'.pptx');fs.writeFileSync(output,after);
  records.push({input,output,partsChanged,beforeSha256:createHash('sha256').update(before).digest('hex'),afterSha256:createHash('sha256').update(after).digest('hex')});
 }
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({scope:'Diagnostic spacing experiment only; no eligibility claim.',records},null,2));
console.log('Wrote 3 live spacing variants and 3 byte-exact native controls');
