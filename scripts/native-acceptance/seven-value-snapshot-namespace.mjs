// One causally reviewed MC Requires declaration-placement equivalence, snapshot route only.
// Actual archive bytes are never overwritten. All unrecognized differences remain strict.
import assert from 'node:assert/strict';
import {digest} from './identity.mjs';
import {archiveDependencies,inspectSevenArchive} from './seven-chart-archive.mjs';
import {assertSevenValueRawPreservation} from './seven-value-raw.mjs';
const uris={cx1:'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex',cx2:'http://schemas.microsoft.com/office/drawing/2015/10/21/chartex'};
const route='p:sld/p:cSld/p:spTree/mc:AlternateContent';
function decode(value){return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/giu,(_m,key)=>key[0]==='#'?String.fromCodePoint(key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[key.toLowerCase()]);}
function nodes(xml){
 const all=[],stack=[];const token=/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w.:-]*(?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"]*"|'[^']*'))*\s*\/?>/gu;
 for(const match of xml.matchAll(token)){const raw=match[0];if(raw.startsWith('<!--')||raw.startsWith('<!')||raw.startsWith('<?'))continue;const name=/^<\/?([^\s/>]+)/u.exec(raw)[1];if(raw.startsWith('</')){const node=stack.pop();assert.ok(node&&node.name===name,'Namespace token stack differs');node.end=match.index+raw.length;continue;}
  const parent=stack.at(-1),attributes=[];for(const attr of raw.matchAll(/\s+([A-Za-z_][\w.:-]*)\s*=\s*(["'])([\s\S]*?)\2/gu))attributes.push({name:attr[1],value:decode(attr[3]),start:match.index+attr.index,end:match.index+attr.index+attr[0].length});
  assert.equal(new Set(attributes.map(a=>a.name)).size,attributes.length,'Duplicate XML attribute');const node={name,parent,children:[],attributes,start:match.index,openEnd:match.index+raw.length,end:raw.endsWith('/>')?match.index+raw.length:null,path:parent?parent.path+'/'+name:name};parent?.children.push(node);all.push(node);if(!raw.endsWith('/>'))stack.push(node);
 }assert.equal(stack.length,0,'Unclosed namespace token stack');return all;
}
const attribute=(node,name)=>node.attributes.find(a=>a.name===name);
function effective(node,prefix){for(let current=node;current;current=current.parent){const value=attribute(current,'xmlns:'+prefix);if(value)return value.value;}return undefined;}
function candidate(node){assert.deepEqual(node.children.map(child=>child.name),['mc:Choice','mc:Fallback'],'Unknown MC topology');const choice=node.children[0],requires=attribute(choice,'Requires')?.value;assert.ok(Object.hasOwn(uris,requires),'One known unchanged Requires token required');assert.equal(effective(choice,requires),uris[requires],'Foreign/unbound effective Requires namespace');return{node,choice,prefix:requires,uri:uris[requires]};}
function outsideMention(xml,candidate){const {node,choice,prefix}=candidate,parentDeclaration=attribute(node,'xmlns:'+prefix);let opening=xml.slice(node.start,node.openEnd);if(parentDeclaration)opening=opening.slice(0,parentDeclaration.start-node.start)+opening.slice(parentDeclaration.end-node.start);const outside=opening+xml.slice(node.openEnd,choice.start)+xml.slice(choice.end,node.end);assert.ok(!decode(outside).includes(prefix),'Namespace scope use/mention outside Choice requires review');}
export function projectSnapshotNamespacePair(before,after){
 if(before===after)return{before,after,changes:[]};const trees=[nodes(before),nodes(after)],parents=trees.map(tree=>tree.filter(node=>node.path===route));assert.equal(parents[0].length,parents[1].length,'MC topology changed');const edits=[[],[]],changes=[];
 for(let index=0;index<parents[0].length;index++){
  const aNode=parents[0][index],bNode=parents[1][index],aChoice=aNode.children.find(c=>c.name==='mc:Choice'),bChoice=bNode.children.find(c=>c.name==='mc:Choice');
  const selected=attribute(aChoice??aNode,'Requires')?.value;if(!Object.hasOwn(uris,selected)){assert.ok(typeof selected!=='string'||!/(?:^|\s)cx[12](?:\s|$)/u.test(selected),'Whitespace/multiple Requires token is not admitted');continue;}
  const a=candidate(aNode),b=candidate(bNode);assert.equal(a.prefix,b.prefix,'Requires token changed');
  const placements=[a,b].map(c=>{const local=attribute(c.choice,'xmlns:'+c.prefix),parent=attribute(c.node,'xmlns:'+c.prefix);return{local,parent};});
  const same=placements[0].local?.value===placements[1].local?.value&&placements[0].parent?.value===placements[1].parent?.value;if(same)continue;
  for(const [i,c]of [a,b].entries()){const p=placements[i];assert.equal(Number(!!p.local)+Number(!!p.parent),1,'Shadow/redundant/foreign declaration change is not a hoist');assert.equal((p.local??p.parent).value,c.uri);outsideMention(i?after:before,c);for(let ancestor=c.node.parent;ancestor;ancestor=ancestor.parent)assert.equal(attribute(ancestor,'xmlns:'+c.prefix),undefined,'Ancestor redeclaration/shadow requires review');const nested=[...c.choice.children];while(nested.length){const child=nested.pop();assert.equal(attribute(child,'xmlns:'+c.prefix),undefined,'Nested redeclaration/shadow requires review');nested.push(...child.children);}}
  assert.notEqual(!!placements[0].local,!!placements[1].local,'Only direct parent/Choice placement delta is admitted');
  const moved=placements[0].parent?0:1,c=moved?b:a,parent=placements[moved].parent;
  edits[moved].push({start:parent.start,end:parent.end,text:''},{start:c.choice.start+1+c.choice.name.length,end:c.choice.start+1+c.choice.name.length,text:' xmlns:'+c.prefix+'="'+c.uri+'"'});
  changes.push({path:route+'['+index+']/mc:Choice',prefix:a.prefix,effectiveUri:a.uri,beforeDeclaration:placements[0].local?'Choice':'AlternateContent',afterDeclaration:placements[1].local?'Choice':'AlternateContent',beforeLocation:(placements[0].local??placements[0].parent).start,afterLocation:(placements[1].local??placements[1].parent).start});
 }
 const apply=(xml,changes)=>{for(const change of changes.sort((a,b)=>b.start-a.start))xml=xml.slice(0,change.start)+change.text+xml.slice(change.end);return xml;};return{before:apply(before,edits[0]),after:apply(after,edits[1]),changes};
}
// First native Save is a model/role admission, never raw-style acceptance.
// Keep both archives immutable and enumerate every package difference for review.
export function snapshotSourceBeforeRawFindings(input,before,deps=archiveDependencies(),archiveContext){
 inspectSevenArchive(input,deps,archiveContext);inspectSevenArchive(before,deps,archiveContext);
 const parts=[deps.unzipSync(input),deps.unzipSync(before)],identity=bytes=>bytes?{bytes:bytes.length,sha256:digest(bytes)}:null,changes=[];
 for(const part of [...new Set([...Object.keys(parts[0]),...Object.keys(parts[1])])].sort()){
  const a=identity(parts[0][part]),b=identity(parts[1][part]);if(JSON.stringify(a)===JSON.stringify(b))continue;
  changes.push({part,kind:a===null?'added':b===null?'removed':'changed',source:a,before:b});
 }
 return{policy:'first-native-save-raw-findings-open-v1',qualification:'OPEN',sourceSha256:digest(input),beforeSha256:digest(before),sourceParts:Object.keys(parts[0]).length,beforeParts:Object.keys(parts[1]).length,changes};
}

// Later saves: only these two scalar core-property values may vary. All other
// properties/attributes/unknown content remain exact parsed XML. Whitespace is
// ignored solely in the known element-only metadata containers below.
export function snapshotMetadataView(bytes,file,deps){
 const xml=deps.strFromU8(bytes);assert.ok(!/<!DOCTYPE|<!ENTITY/u.test(xml));assert.equal(deps.XMLValidator.validate(xml),true);
 const tree=new deps.XMLParser({preserveOrder:true,ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false,commentPropName:'#comment',cdataPropName:'#cdata'}).parse(xml),recorded={};
 const containers=new Set(['cp:coreProperties','Properties','Properties/HeadingPairs','Properties/HeadingPairs/vt:vector','Properties/HeadingPairs/vt:vector/vt:variant','Properties/TitlesOfParts','Properties/TitlesOfParts/vt:vector']);
 const root=file==='docProps/core.xml'?'cp:coreProperties':'Properties';assert.equal(tree.filter(node=>Object.hasOwn(node,root)).length,1,'Exact metadata root required');
 function walk(nodes,path='',preserved=false){
  const out=[];
  for(const node of nodes){
   if(Object.hasOwn(node,'#text')&&containers.has(path)&&!preserved&&typeof node['#text']==='string'&&/^[ \t\r\n]*$/u.test(node['#text']))continue;
   const item={},keep=preserved||node[':@']?.['@_xml:space']==='preserve';
   for(const [key,value]of Object.entries(node)){
    if(key===':@'){item[key]=Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));continue;}
    if(!Array.isArray(value)){item[key]=value;continue;}
    const child=path?path+'/'+key:key;
    if(file==='docProps/core.xml'&&(child==='cp:coreProperties/dcterms:modified'||child==='cp:coreProperties/cp:lastModifiedBy')){
     assert.equal(recorded[key],undefined,'Duplicate volatile metadata field');assert.ok(value.length<=1&&value.every(row=>Object.keys(row).length===1&&typeof row['#text']==='string'),'Scalar core metadata required');
     const text=value[0]?.['#text']??'';
     if(key==='dcterms:modified'){
      assert.deepEqual(node[':@'],{'@_xsi:type':'dcterms:W3CDTF'});assert.match(text,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u);
      const stamp=new Date(text);assert.ok(Number.isFinite(stamp.getTime())&&stamp.toISOString().slice(0,19)===text.slice(0,19),'Valid UTC modified timestamp required');
     }else assert.ok(node[':@']===undefined||Object.keys(node[':@']).length===0,'Unknown lastModifiedBy attribute');
     const raw=[...xml.matchAll(new RegExp('<'+key+'(?:\\s[^<>]*?)?(?:\\s*/>|>[\\s\\S]*?</'+key+'\\s*>)','gu'))];assert.equal(raw.length,1,'One raw core metadata field required');
     recorded[key]={value:text,raw:raw[0][0]};item[key]=[{'#text':'@recorded-native-save-metadata'}];
    }else item[key]=walk(value,child,keep);
   }
   out.push(item);
  }
  return out;
 }
 const protectedXml=walk(tree);
 if(file==='docProps/core.xml')assert.deepEqual(Object.keys(recorded).sort(),['cp:lastModifiedBy','dcterms:modified']);
 return{protectedXml,recorded};
}
function assertLaterMetadata(before,after,file,deps){
 const a=snapshotMetadataView(before,file,deps),b=snapshotMetadataView(after,file,deps);assert.deepEqual(b.protectedXml,a.protectedXml,'Unreviewed later-save metadata difference: '+file);
 return{part:file,beforeSha256:digest(before),afterSha256:digest(after),recorded: Object.fromEntries(Object.keys(a.recorded).map(field=>[field,{before:a.recorded[field],after:b.recorded[field]}]))};
}
export function assertSnapshotRawPreservation(options){
 const deps=options.deps??archiveDependencies();
 // Apply the maintained archive's entry/expanded-byte bounds before ANY unzip or XML scan.
 inspectSevenArchive(options.input,deps,options.archiveContext);inspectSevenArchive(options.saved,deps,options.archiveContext);
 const archives=[deps.unzipSync(options.input),deps.unzipSync(options.saved)],projection=[];assert.deepEqual(Object.keys(archives[0]).sort(),Object.keys(archives[1]).sort(),'Snapshot ZIP part inventory changed');
 // The v1 guard owns all reached ppt resources. This route additionally refuses
 // other package parts, with only the closed recorded core-property exception.
 const metadata=[];for(const name of Object.keys(archives[0]).filter(name=>!name.startsWith('ppt/'))){if(name==='docProps/core.xml'||name==='docProps/app.xml')metadata.push(assertLaterMetadata(archives[0][name],archives[1][name],name,deps));else assert.deepEqual(archives[1][name],archives[0][name],'Unreviewed native package part changed: '+name);}
 for(const name of Object.keys(archives[0]).filter(name=>/^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(name))){const pair=projectSnapshotNamespacePair(deps.strFromU8(archives[0][name]),deps.strFromU8(archives[1][name]));if(pair.changes.length){archives[0][name]=deps.strToU8(pair.before);archives[1][name]=deps.strToU8(pair.after);projection.push({part:name,changes:pair.changes});}}
 const projected=projection.length?[deps.zipSync(archives[0]),deps.zipSync(archives[1])]:[options.input,options.saved];
 const evidence={inputSha256:digest(options.input),savedSha256:digest(options.saved),projection};
 try{return{...assertSevenValueRawPreservation({...options,deps,input:projected[0],saved:projected[1]}),namespacePlacement:evidence,metadata};}catch(error){error.snapshotNamespacePlacement=evidence;throw error;}
}
