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
export function assertSnapshotRawPreservation(options){
 const deps=options.deps??archiveDependencies();
 // Apply the maintained archive's entry/expanded-byte bounds before ANY unzip or XML scan.
 inspectSevenArchive(options.input,deps,options.archiveContext);inspectSevenArchive(options.saved,deps,options.archiveContext);
 const archives=[deps.unzipSync(options.input),deps.unzipSync(options.saved)],projection=[];assert.deepEqual(Object.keys(archives[0]).sort(),Object.keys(archives[1]).sort(),'Snapshot ZIP part inventory changed');
 // The v1 guard owns all reached ppt resources. This route additionally refuses
 // every other package part's changed bytes (including unknown metadata).
 for(const name of Object.keys(archives[0]).filter(name=>!name.startsWith('ppt/')))assert.deepEqual(archives[1][name],archives[0][name],'Unreviewed native package part changed: '+name);
 for(const name of Object.keys(archives[0]).filter(name=>/^ppt\/slides\/slide[1-9][0-9]*\.xml$/u.test(name))){const pair=projectSnapshotNamespacePair(deps.strFromU8(archives[0][name]),deps.strFromU8(archives[1][name]));if(pair.changes.length){archives[0][name]=deps.strToU8(pair.before);archives[1][name]=deps.strToU8(pair.after);projection.push({part:name,changes:pair.changes});}}
 const projected=projection.length?[deps.zipSync(archives[0]),deps.zipSync(archives[1])]:[options.input,options.saved];
 const evidence={inputSha256:digest(options.input),savedSha256:digest(options.saved),projection};
 try{return{...assertSevenValueRawPreservation({...options,deps,input:projected[0],saved:projected[1]}),namespacePlacement:evidence};}catch(error){error.snapshotNamespacePlacement=evidence;throw error;}
}
