// Exact nine-deck archive review. This module never promotes a fixture or invokes Office.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {strFromU8,unzipSync} from 'fflate';
import {chartexFallbackDecks} from '../test/helpers/chartex-fallback-decks.mjs';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const names=Object.keys(chartexFallbackDecks);
const json=value=>JSON.stringify(value,null,2)+'\n';
const put=(file,bytes)=>writeFileSync(file,bytes,{flag:'wx'});
export function validateFixture(fixture){
  assert.equal(fixture.source?.repository,'OpenPresentation/opf-pptx','Use the reviewed nine-deck fixture');
  assert.deepEqual(fixture.decks,chartexFallbackDecks,'Source decks must equal the authoritative generator');
  assert.deepEqual(Object.keys(fixture.entries),names,'Exactly the nine reviewed entries, in source order');
}
export function summarizeArchive(bytes,diagnostics){
  const parts=unzipSync(bytes),files=Object.keys(parts);
  for(const file of files)assert.ok(!file.includes('\\')&&!file.startsWith('/')&&!file.split('/').some(part=>part==='..')&&!/^[A-Za-z]:/.test(file),'Unsafe ZIP part name');
  assert.equal(files.filter(file=>/^ppt\/charts\/chartEx\d+\.xml$/.test(file)).length,0,'Fallback archive has no ChartEx parts');
  assert.ok(files.filter(file=>/^ppt\/slides\/slide\d+\.xml$/.test(file)).every(file=>!strFromU8(parts[file]).includes('AlternateContent')),'Fallback slides have no alternate content');
  return {sha256:sha256(bytes),bytes:bytes.length,diagnostics,
    layoutParts:files.filter(file=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(file)).length,
    layoutTagParts:files.filter(file=>/^ppt\/tags\/opfLayout\d+\.xml$/.test(file)).length};
}
export async function exportFallbackArchive(runtime,deck){
  const diagnostics=[];
  // Deliberately the exact chartex.mjs helper caller: no seed/date/font preparation or extra export options.
  const bytes=new Uint8Array(await runtime.toPptx(structuredClone(deck),{chartex:'fallback',catalogs:[runtime.catalog],onDiagnostic:d=>diagnostics.push(`${d.code}${d.adaptation?`/${d.adaptation}`:''}`)}));
  return {bytes,summary:summarizeArchive(bytes,diagnostics)};
}
function inventory(parts){return Object.entries(parts).map(([file,bytes])=>({file,bytes:bytes.length,sha256:sha256(bytes)}));}
/** Keep exact inventories and changed raw parts. Embedded XLSX archives receive their own unnormalized review. */
export function compareArchiveParts(before,after,directory,depth=0){
  assert.ok(depth<=3,'Embedded archive nesting limit');
  const a=before?unzipSync(before):{},b=after?unzipSync(after):{},changed=[];
  for(const file of [...new Set([...Object.keys(a),...Object.keys(b)])]){
    if(a[file]&&b[file]&&Buffer.from(a[file]).equals(Buffer.from(b[file])))continue;
    const number=String(changed.length+1).padStart(4,'0'),row={file,status:!a[file]?'added':!b[file]?'removed':'changed'};
    for(const[side,parts]of[['before',a],['after',b]])if(parts[file]){const target=number+'.'+side;put(path.join(directory,target),parts[file]);row[side]={file:target,bytes:parts[file].length,sha256:sha256(parts[file])};}
    if(/\.xlsx$/i.test(file)&&(a[file]||b[file])){const sub=number+'.xlsx';mkdirSync(path.join(directory,sub));row.embedded={directory:sub,...compareArchiveParts(a[file],b[file],path.join(directory,sub),depth+1)};}
    changed.push(row);
  }
  return {before:inventory(a),after:inventory(b),changed};
}
/** Synthetic runtimes are injectable for refusal controls; the command loads exact built checkouts. */
export async function reviewFallbackArchives({fixture,baseline,candidate,out,provenance,verifyProducers=()=>{}}){
  assert.ok(!existsSync(out),'Preserve previous evidence: choose a fresh output directory');
  validateFixture(fixture);
  const original=json(fixture),next=structuredClone(fixture),rows=[];
  mkdirSync(out);put(path.join(out,'provenance.json'),json(provenance));
  const before=new Map();
  // Complete locked-baseline reproduction precedes every candidate export and candidate fixture.
  for(const name of names){
    const result=await exportFallbackArchive(baseline,fixture.decks[name]),directory=path.join(out,name);mkdirSync(directory);put(path.join(directory,'before.pptx'),result.bytes);put(path.join(directory,'before.json'),json(result.summary));
    assert.deepEqual(result.summary,Object.fromEntries(Object.keys(result.summary).map(key=>[key,fixture.entries[name][key]])),name+': reproduce every locked baseline byte/diagnostic/layout count');
    before.set(name,result);
  }
  for(const name of names){
    const result=await exportFallbackArchive(candidate,fixture.decks[name]),old=before.get(name),directory=path.join(out,name);put(path.join(directory,'after.pptx'),result.bytes);put(path.join(directory,'after.json'),json(result.summary));
    const partsDirectory=path.join(directory,'parts');mkdirSync(partsDirectory);
    const parts=compareArchiveParts(old.bytes,result.bytes,partsDirectory);
    rows.push({name,baseline:old.summary,candidate:result.summary,parts});
    if(JSON.stringify(old.summary)!==JSON.stringify(result.summary)){
      const entry=next.entries[name];entry.rr20ArchivePrevious=[...(entry.rr20ArchivePrevious??[]),structuredClone(old.summary)];Object.assign(entry,result.summary);
    }
  }
  await verifyProducers();
  const review={...provenance,scope:'Separate nine-deck chartex:fallback family. All baseline hashes, sizes, ordered diagnostics and layout/tag counts reproduced; no XML normalization, automatic promotion or native acceptance.',entries:rows};
  const identity=record=>({head:record.head,...(record.catalogSha256?{catalogSha256:record.catalogSha256}:{}),...(record.dist?{distManifestSha256:sha256(json(record.dist))}:{})});
  next.source.rr20FallbackArchiveReviews=[...(next.source.rr20FallbackArchiveReviews??[]),{baseline:identity(provenance.baseline),candidate:identity(provenance.candidate),evidence:{file:'review.json',sha256:sha256(json(review))},scope:review.scope}];
  assert.equal(json(fixture),original,'Caller fixture remains unchanged');
  put(path.join(out,'review.json'),json(review));put(path.join(out,'candidate-fixture.json'),json(next));
  return review;
}
