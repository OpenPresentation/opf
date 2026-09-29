import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// FF-05 E7 offline input preparation only: no Office, subprocess or font API.
// The only accepted input is the reviewed E6 Calibri control. Outputs must be
// in an exclusive new directory; this adapter changes only location handling.
const here=path.dirname(fileURLToPath(import.meta.url));
assert.equal(process.argv.length,3,'Supply one fresh output subdirectory.');
const outputRoot=path.resolve(process.argv[2]);
// Portable adapter: allow an external fresh output directory; never reuse it.
const source=new URL('../fixture/parent/source.pptx',import.meta.url);
const dependency=new URL('./fflate/index.mjs',import.meta.url);
const dependencyPackage=new URL('./fflate/package.json',import.meta.url);
const expectedSourceSha256='776147ddfd2a35ceca4480b66d58c82c9255609b5abe245a2b3bb342651ebce5';
const expectedDependencySha256='8d75534a30a0580608e1271c13d70943ed4cd3589fddff7b1197748036a5116e';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const original=await readFile(source);
assert.equal(hash(original),expectedSourceSha256,'Only the exact accepted E6 input may generate E7.');
const dependencyBytes=await readFile(dependency),packageBytes=await readFile(dependencyPackage);
assert.equal(hash(dependencyBytes),expectedDependencySha256,'Exact reviewed fflate source required.');
assert.equal(JSON.parse(packageBytes).version,'0.8.3');
const {unzipSync,zipSync}=await import(dependency.href);
const before=unzipSync(original),names=Object.keys(before).sort();
assert.equal(names.length,41,'Exact finite ZIP entry count.');
const after=Object.fromEntries(names.map(name=>[name,before[name]]));
const themePart='ppt/theme/theme1.xml';
const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}),encoder=new TextEncoder();
const originalTheme=decoder.decode(before[themePart]);
assert.deepEqual(encoder.encode(originalTheme),before[themePart],'Lossless UTF-8 theme decoding.');

function typefaces(xml){
  const result=[],stack=[],root={children:new Map(),path:''};
  for(const token of xml.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>/g)){
    const tag=token[0];
    if(/^<\//.test(tag)){assert.equal(stack.pop()?.name,tag.match(/^<\/([^\s>]+)/)?.[1]);continue;}
    const name=tag.match(/^<([A-Za-z_][\w.:-]*)\b/)?.[1];if(!name)continue;
    const parent=stack.at(-1)??root,index=(parent.children.get(name)??0)+1;
    parent.children.set(name,index);const xmlPath=`${parent.path}/${name}[${index}]`;
    for(const attribute of tag.matchAll(/\s(typeface)(\s*=\s*)(["'])([^"']*)\3/g)){
      const value=attribute[4],offset=token.index+attribute.index+attribute[0].length-value.length-1;
      result.push({path:xmlPath,element:name,attribute:'typeface',value,valueCharacterOffset:offset,
        valueByteOffset:Buffer.byteLength(xml.slice(0,offset)),attributeText:attribute[0].trimStart(),openingTag:tag});
    }
    if(!/\/\s*>$/.test(tag))stack.push({name,path:xmlPath,children:new Map()});
  }
  assert.equal(stack.length,0,'Balanced theme markup.');return result;
}
const expectedPaths=['majorFont','minorFont'].flatMap(kind=>['ea','cs'].map(slot=>`/a:theme[1]/a:themeElements[1]/a:fontScheme[1]/a:${kind}[1]/a:${slot}[1]`));
const originalAttributes=typefaces(originalTheme);
const edits=originalAttributes.filter(item=>expectedPaths.includes(item.path));
assert.deepEqual(edits.map(item=>item.path),expectedPaths,'Exactly the four reviewed theme script slots.');
assert(edits.every(item=>item.value===''),'All four starting script slots must be empty.');
assert.equal(originalAttributes.filter(item=>['a:ea','a:cs'].includes(item.element)&&item.value==='').length,4);
let modified=originalTheme;
for(const edit of [...edits].reverse())modified=modified.slice(0,edit.valueCharacterOffset)+'Calibri'+modified.slice(edit.valueCharacterOffset);
after[themePart]=encoder.encode(modified);
const modifiedAttributes=typefaces(modified);
assert.deepEqual(modifiedAttributes.map(item=>[item.path,item.value]),originalAttributes.map(item=>[item.path,expectedPaths.includes(item.path)?'Calibri':item.value]),'Only listed attribute values change.');
assert.equal(modifiedAttributes.filter(item=>['a:ea','a:cs'].includes(item.element)&&item.value==='').length,0,'No empty theme ea/cs slots remain.');
const changes=edits.map(edit=>{
  const changed=modifiedAttributes.find(item=>item.path===edit.path);
  return {part:themePart,path:edit.path,attribute:'typeface',beforeValue:'',afterValue:'Calibri',
    beforeValueCharacterOffset:edit.valueCharacterOffset,afterValueCharacterOffset:changed.valueCharacterOffset,
    beforeValueByteOffset:edit.valueByteOffset,afterValueByteOffset:changed.valueByteOffset,
    beforeAttribute:edit.attributeText,afterAttribute:changed.attributeText,
    beforeOpeningTag:edit.openingTag,afterOpeningTag:changed.openingTag};
});
assert.equal(changes.length,4);

function inspect(entries){
  const literalOccurrences=[];
  for(const name of names){
    const text=Buffer.from(entries[name]).toString('utf8');
    for(const match of text.matchAll(/Carlito|Aptos/gi))literalOccurrences.push({entry:name,literal:match[0],characterOffset:match.index});
  }
  const fontEntries=names.filter(name=>/^ppt\/fonts(?:\/|$)|\.(?:ttf|otf|ttc|fntdata|odttf|woff2?)$/i.test(name));
  const fontRelationships=names.filter(name=>/\.rels$/i.test(name)).flatMap(part=>[...Buffer.from(entries[part]).toString('utf8').matchAll(/<Relationship\b[^>]*\bType=["'][^"']*\/(?:font|fontData)["'][^>]*>/gi)].map(match=>({part,xml:match[0]})));
  const fontContentTypes=[...Buffer.from(entries['[Content_Types].xml']).toString('utf8').matchAll(/<(?:Override|Default)\b[^>]*\bContentType=["'][^"']*(?:fontdata|opentype|font-sfnt|obfuscatedFont)[^"']*["'][^>]*>/gi)].map(match=>match[0]);
  assert.deepEqual(literalOccurrences,[],'No literal Carlito or Aptos in ZIP entry contents.');
  assert.deepEqual(fontEntries,[]);assert.deepEqual(fontRelationships,[]);assert.deepEqual(fontContentTypes,[]);
  return {literalOccurrences,fontEntries,fontRelationships,fontContentTypes};
}
const beforeInventory=inspect(before),afterInventory=inspect(after);
const zip=()=>zipSync(Object.fromEntries(names.map(name=>[name,[after[name],{mtime:new Date(2000,0,1,0,0,0),level:9,os:0}]])),{level:9});
const generated=zip();assert.deepEqual(generated,zip(),'Deterministic repeated ZIP generation.');
const reopened=unzipSync(generated);assert.deepEqual(Object.keys(reopened).sort(),names,'Exact entry set retained.');
for(const name of names)assert.deepEqual(reopened[name],after[name],`${name}: exact output entry content`);
const entries=names.map(entry=>({entry,beforeSha256:hash(before[entry]),afterSha256:hash(reopened[entry]),
  beforeBytes:before[entry].byteLength,afterBytes:reopened[entry].byteLength,changedAttributes:changes.filter(change=>change.part===entry).length}));
const changedEntries=entries.filter(entry=>entry.beforeSha256!==entry.afterSha256);
assert.equal(changedEntries.length,1);assert.equal(changedEntries[0].entry,themePart);
assert.equal(changedEntries[0].afterBytes-changedEntries[0].beforeBytes,28);
for(const entry of entries)if(entry.entry!==themePart)assert.deepEqual(before[entry.entry],reopened[entry.entry],`${entry.entry}: unchanged content`);
for(const name of names.filter(name=>/\.rels$/i.test(name)))assert.deepEqual(before[name],reopened[name],`${name}: relationships unchanged`);
assert.equal(hash(await readFile(source)),expectedSourceSha256,'Accepted E6 source remains unchanged.');
const output=path.join(outputRoot,'calibri-explicit-slots-control.pptx');
const manifest={
  purpose:'FF-05 E7 offline four-slot Calibri input preparation only; no native result or root-cause claim.',
  finiteControlGuard:{expectedSourceSha256,expectedDependencySha256,expectedEntries:41,expectedChangedAttributes:4,expectedChangedEntries:1,expectedRemainingEmptyThemeScriptSlots:0,expectedLiteralCarlitoOccurrences:0,expectedLiteralAptosOccurrences:0},
  source:{path:fileURLToPath(source),sha256:expectedSourceSha256,bytes:original.byteLength,
    provenance:'Accepted FF-05 E6 public evidence fixture; canonical ancestor SHA256 f505236ecef4fad838a198449adede1f4afa39d7bac74613626eee2f2a419aeb.'},
  output:{path:output,sha256:hash(generated),bytes:generated.byteLength},
  generator:{path:fileURLToPath(import.meta.url),sha256:hash(await readFile(fileURLToPath(import.meta.url)))},
  dependency:{name:'fflate',version:'0.8.3',path:fileURLToPath(dependency),sha256:hash(dependencyBytes),packagePath:fileURLToPath(dependencyPackage),packageSha256:hash(packageBytes)},
  sourceGraph:{core:'0e81a407f57e5106ad607a9617c571d86b5428da',pptx:'7fca9a2eb5088ee2325fb686d1ff84332af2b8d9',render:'6c7d7818e40d0f9c519e4b34f7a24e9150c1787f',editor:'d0c95a16b50eccb3eee695ace44cc6c3a6754f2f',editorScope:'Dependency-only; not used to derive this control.'},
  zipPolicy:{entryOrder:'lexicographic',compressionLevel:9,localCalendarTimestamp:'2000-01-01 00:00:00',os:0,note:'Container metadata normalized like E6; unmodified entry contents remain byte-identical.'},
  counts:{entries:names.length,changedEntries:changedEntries.length,changedTypefaceAttributes:changes.length,unchangedEntryContents:entries.length-changedEntries.length,remainingEmptyThemeScriptSlots:0},
  verified:{sourceUnchanged:true,deterministicRepeatedOutput:true,exactEntrySet:true,onlyListedAttributesChanged:true,allOtherEntryContentsUnchanged:true,allRelationshipsUnchanged:true,noEmbeddedFonts:true,noLiteralCarlitoOrAptos:true},
  changes,changedEntries,entries,beforeInventory,afterInventory,nativeResult:null,
};
// Only after all finite-input checks pass, create a new output directory.
// Existing output directories and files are never reused or overwritten.
await mkdir(outputRoot);
await writeFile(output,generated,{flag:'wx'});
assert.equal(hash(await readFile(output)),manifest.output.sha256);
await writeFile(path.join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
const diff=changes.map(change=>`${change.part} ${change.path}/@typeface\n(before byte ${change.beforeValueByteOffset}; after byte ${change.afterValueByteOffset})\n- ${change.beforeAttribute}\n+ ${change.afterAttribute}`).join('\n\n')+'\n';
await writeFile(path.join(outputRoot,'xml-attribute-diff.txt'),diff,{flag:'wx'});
console.log(JSON.stringify({sourceSha256:expectedSourceSha256,outputSha256:manifest.output.sha256,generatorSha256:manifest.generator.sha256,counts:manifest.counts,verified:manifest.verified,nativeResult:null},null,2));
