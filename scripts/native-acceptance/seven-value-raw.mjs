// Conservative current-archive style/resource guard. Unknown Office rewrites
// refuse with a part/path finding; no subtree or relationship is discarded.
import assert from 'node:assert/strict';
import path from 'node:path';
import {digest} from './identity.mjs';
import {archiveDependencies,inspectSevenArchive} from './seven-chart-archive.mjs';
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const tag=node=>Object.keys(node).find(key=>key!==':@'&&key!=='#text');
const children=(nodes,name)=>nodes.filter(node=>Object.hasOwn(node,name));
const one=(nodes,name)=>{const found=children(nodes,name);assert.equal(found.length,1,'Exactly one '+name);return found[0][name];};
const text=nodes=>{assert.equal(nodes.length,1);assert.deepEqual(Object.keys(nodes[0]),['#text']);return String(nodes[0]['#text']);};
function normalize(nodes){
 // No element-only whitelist is qualified yet. Keep EVERY text node, including
 // indentation, unknown mixed content and inherited xml:space='preserve'.
 return nodes.map(node=>Object.fromEntries(Object.entries(node).map(([key,value])=>[key,key===':@'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):Array.isArray(value)?normalize(value):value])));
}
function formulaIndex(formula,action){
 const match=/^(?:'([^']+)'|([^'!]+))!\$([A-Z]+)\$([1-9][0-9]*):\$([A-Z]+)\$([1-9][0-9]*)$/u.exec(formula);
 if(!match||(match[1]??match[2])!==action.worksheet||match[3]!==match[5])return -1;
 const selected=action.workbookCells[action.pointIndex-1];
 const start=Number(match[4]),length=Number(match[6])-start+1;
 assert.ok(Number.isSafeInteger(start)&&Number.isSafeInteger(length)&&length>0&&length<=4,'Bounded current cache range');
 const cells=Array.from({length},(_,index)=>match[3]+(start+index));return cells.indexOf(selected);
}
function maskPoint(nodes,prefix,index,expected){
 const point=children(nodes,prefix+':pt').filter(node=>String(node[':@']?.['@_idx'])===String(index));
 assert.equal(point.length,1,'Exact selected numeric cache point required');const value=prefix==='cx'?point[0]['cx:pt']:one(point[0]['c:pt'],'c:v');
 assert.equal(Number(text(value)),expected,'Unexpected selected raw numeric cache');value[0]['#text']='@one-bound-value';
}
function maskChart(tree,family,action,expected){
 let count=0;
 function walk(nodes){for(const node of nodes){const name=tag(node),body=node[name];if(!Array.isArray(body))continue;
  if(family==='chartEx'&&name==='cx:numDim'){
   const index=formulaIndex(text(one(body,'cx:f')),action);if(index>=0){maskPoint(one(body,'cx:lvl'),'cx',index,expected);count++;}
  }else if(family==='classic'&&name==='c:val'){
   const ref=one(body,'c:numRef'),index=formulaIndex(text(one(ref,'c:f')),action);if(index>=0){maskPoint(one(ref,'c:numCache'),'c',index,expected);count++;}
  }
  walk(body);
 }}walk(tree);assert.ok(count>0,'No source-bound raw numeric leaf');return count;
}
function protectedParts(parts,deps){
 const parser=new deps.XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),seen=new Set(),pending=Object.keys(parts).filter(name=>name.startsWith('ppt/')&&!name.endsWith('/'));
 while(pending.length){const file=pending.pop();if(seen.has(file))continue;assert.ok(seen.size<4096);assert.ok(parts[file],'Missing protected resource '+file);seen.add(file);
  const rel=path.posix.join(path.posix.dirname(file),'_rels',path.posix.basename(file)+'.rels');if(!parts[rel])continue;seen.add(rel);
  const xml=deps.strFromU8(parts[rel]);assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(xml));assert.equal(deps.XMLValidator.validate(xml),true);const rows=list(parser.parse(xml).Relationships?.Relationship);
  assert.equal(new Set(rows.map(row=>row.Id)).size,rows.length);
  for(const row of rows){assert.equal(row.TargetMode,undefined,'External style/resource relationships require review');assert.equal(typeof row.Target,'string');assert.ok(!row.Target.startsWith('/')&&!row.Target.includes('\\'));const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),row.Target));assert.ok(!target.startsWith('../')&&!target.includes(':'));assert.ok(parts[target],'Missing reached resource');pending.push(target);}
 }return[...seen].sort();
}
// Pure signatures only: no data projection, workbook masking or admission.
// The new literal contract validates its one branch before supplying part views.
export function sevenRawPartSignatures(parts,deps){
 const names=protectedParts(parts,deps),parser=new deps.XMLParser({preserveOrder:true,ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false});
 return{names,records:names.map(file=>{
  if(!/\.xml$|\.rels$/u.test(file))return[file,digest(parts[file])];
  const xml=deps.strFromU8(parts[file]);assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(xml));assert.equal(deps.XMLValidator.validate(xml),true);
  return[file,digest(JSON.stringify(normalize(parser.parse(xml))))];
 })};
}
export function assertSevenValueRawPreservation({input,saved,action,deps=archiveDependencies(),archiveContext}){
 const before=inspectSevenArchive(input,deps,archiveContext),after=inspectSevenArchive(saved,deps,archiveContext),archives=[deps.unzipSync(input),deps.unzipSync(saved)],signatures=[],leafCounts=[];
 const parser=new deps.XMLParser({preserveOrder:true,ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false});
 function parsed(bytes){const xml=deps.strFromU8(bytes);assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(xml));assert.equal(deps.XMLValidator.validate(xml),true);return parser.parse(xml);}
 const names=protectedParts(archives[0],deps);assert.deepEqual(protectedParts(archives[1],deps),names,'Protected part/relationship inventory changed; retain for review');
 for(const [phase,parts]of archives.entries()){
  const archive=phase?after:before,expected=(phase?action.newValues:action.expectedValues)[action.pointIndex-1],charts=new Map(archive.slides.flatMap(slide=>slide.shapes.filter(shape=>shape.kind==='chart').map(shape=>[shape.chartPart,shape.chart]))),records=[];let masked=0;
  // First route deliberately refuses part renames instead of guessing aliases.
  const selectedBooks=new Set([action.workbookPart]);assert.ok(parts[action.workbookPart]);
  for(const file of names){
   const chart=charts.get(file);
   if(/\.xml$|\.rels$/u.test(file)){
    const tree=parsed(parts[file]);if(chart&&selectedBooks.has(chart.workbook.part))masked+=maskChart(tree,chart.family,action,expected);
    records.push([file,digest(JSON.stringify(normalize(tree)))]);
   }else if(selectedBooks.has(file)){
    const nested=deps.unzipSync(parts[file]);assert.ok(Object.keys(nested).length<=4096);let cells=0;const nestedRecords=[];
    for(const name of Object.keys(nested).sort()){
     if(/\.xml$|\.rels$/u.test(name)){
      const tree=parsed(nested[name]);if(/^xl\/worksheets\/[^/]+\.xml$/u.test(name)){
       function walk(nodes){for(const node of nodes){const kind=tag(node),body=node[kind];if(kind==='c'&&node[':@']?.['@_r']===action.workbookCells[action.pointIndex-1]){assert.ok(!children(body,'f').length);const value=one(body,'v');assert.equal(Number(text(value)),expected);value[0]['#text']='@one-bound-value';cells++;}if(Array.isArray(body))walk(body);}}walk(tree);
      }nestedRecords.push([name,digest(JSON.stringify(normalize(tree)))]);
     }else nestedRecords.push([name,digest(nested[name])]);
    }assert.equal(cells,1,'Exactly one selected worksheet leaf required');records.push([file,nestedRecords]);masked+=cells;
   }else records.push([file,digest(parts[file])]);
  }signatures.push(records);leafCounts.push(masked);
 }
 assert.equal(leafCounts[0],leafCounts[1]);assert.deepEqual(signatures[1],signatures[0],'Unknown raw style/resource/relationship difference; retain archives and review (no waiver)');
 return{protectedParts:names.length,maskedValueLeaves:leafCounts[0],sha256:digest(JSON.stringify(signatures[0]))};
}
