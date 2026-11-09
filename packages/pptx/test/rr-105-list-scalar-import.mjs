import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx,fromPptx} from '../dist/index.js';
import {validateListScalars,MAX_LIST_BREAKS} from '../dist/content-topology.js';
const phrase='البند: Release 1 remains available';
const fixture=value=>({language:'ar-SA',slides:[{title:'نص مختلط موروث',items:[value],numbering:'arabic'}]});
const exportDeck=async(source,options={})=>toPptx(source,{catalogs:[gallery],fonts:await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source}),...options});
const importDeck=async(bytes,diagnostics=[])=>fromPptx(bytes,{catalogs:[gallery],onDiagnostic:d=>diagnostics.push(d)});
const editSlide=(bytes,change)=>{const parts=unzipSync(bytes),part='ppt/slides/slide1.xml',before=strFromU8(parts[part]),after=change(before);assert.notEqual(after,before,'edit changes actual native XML');parts[part]=strToU8(after);return zipSync(parts);};
const editTag=(bytes,change)=>{const parts=unzipSync(bytes),part='ppt/tags/opfSlide1.xml';assert.ok(parts[part]);const xml=strFromU8(parts[part]);parts[part]=strToU8(xml.replace(/val="([^"]+)"/,(_all,hex)=>{const value=JSON.parse(Buffer.from(hex,'hex').toString('utf8'));change(value);return 'val="'+Buffer.from(JSON.stringify(value)).toString('hex').toUpperCase()+'"';}));return zipSync(parts);};
const runs=value=>Array.isArray(value)?value.flatMap(runs):value&&typeof value==='object'?[...(typeof value.text==='string'?[value]:[]),...Object.values(value).filter(v=>v&&typeof v==='object').flatMap(runs)]:[];

test('contrast7 inherited scalar survives automatic RTL run splitting with exact source identity',async()=>{
 const source=fixture(phrase);assert.deepEqual(await importDeck(await exportDeck(source)),source);
});
test('authored plain-run arrays retain their distinct boundaries',async()=>{
 for(const value of [['a','b'],['البند: ','Release 1 remains available']]){const source=fixture(value);assert.deepEqual(await importDeck(await exportDeck(source)),source);}
});
test('scalar script-split recovery preserves hard newlines and description identity',async()=>{
 for(const value of [phrase+'\nتفاصيل: Release 2 remains available',{text:'عنصر',description:phrase}]){const source=fixture(value);assert.deepEqual(await importDeck(await exportDeck(source)),source);}
});
test('native words remain current when scalar fragments are recovered',async()=>{
 const source=fixture(phrase),bytes=await exportDeck(source),edited=editSlide(bytes,xml=>xml.replace('Release 1 remains available','Release 2 is current'));
 const restored=await importDeck(edited);assert.equal(restored.slides[0].items[0],'البند: Release 2 is current');
});
test('native language and appearance edits remain rich and are never flattened',async()=>{
 const source=fixture(phrase),bytes=await exportDeck(source);
 for(const kind of ['language','alternate','bold','color']){
  const edited=editSlide(bytes,xml=>xml.replace(/<a:r>[\s\S]*?<\/a:r>/g,run=>!run.includes('<a:t>Release 1 remains available</a:t>')?run:kind==='language'?run.replace(/lang="en-US"/,'lang="fr-FR" altLang="en-US"'):kind==='alternate'?run.replace(/lang="en-US"/,'lang="en-US" altLang="ar-SA"'):kind==='bold'?run.replace(/<a:rPr\b([^>]*)>/,(_all,attrs)=>'<a:rPr'+attrs.replace(/\sb="[^"]*"/g,'')+' b="1">'):run.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/,'<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>')));
  const restored=await importDeck(edited),actual=runs(restored.slides[0].items[0]);assert.ok(actual.some(run=>run.text.includes('Release 1')&&(kind==='language'?run.lang==='fr-FR':kind==='alternate'?run.lang==='en-US':kind==='bold'?run.bold===true:run.color==='#FF0000')),'current native '+kind+' retained');
 }
});
test('named color slots after a split scalar retain their source identities',async()=>{
 const source=fixture(phrase);source.slides[0].items.push([{text:'inherited role',color:'text'}],[{text:'accent role',color:'accent2'}]);const diagnostics=[];const restored=await importDeck(await exportDeck(source),diagnostics);assert.deepEqual(restored,source);assert.ok(!diagnostics.some(d=>d.code==='color-reference-changed'));
});
test('explicit authored rich boundaries survive beside scalar recovery',async()=>{
 for(const value of [['البند: ',{text:'Bonjour 1',lang:'fr-FR'}],['البند: ',{text:'Release 1',bold:true}],[{text:'الروابط: ',color:'text'},{text:'Release 1',link:'https://example.com'}]]){const source=fixture(value);assert.deepEqual(await importDeck(await exportDeck(source)),source);}
});

const tagOf=bytes=>{const file=unzipSync(bytes)['ppt/tags/opfSlide1.xml'];return file?JSON.parse(Buffer.from(strFromU8(file).match(/val="([^"]+)"/)[1],'hex').toString('utf8')):undefined;};
const characters=value=>typeof value==='string'?value:Array.isArray(value)?value.map(part=>typeof part==='string'?part:part.text).join(''):characters(value.text);
test('source scalar proof is bounded, word-free, full-only and omitted for unaffected values',async()=>{
 const source=fixture(phrase),tag=tagOf(await exportDeck(source));assert.deepEqual(tag.listScalars,[['slides.0.items',[[0,'text']]]]);assert.match(tag.native.listIdentity,/^[a-f0-9]{14}$/);assert.doesNotMatch(JSON.stringify(tag.listScalars),/Release|البند/);
 for(const input of [{slides:[{items:['Ordinary English text.']}]},fixture('نص عربي كامل'),fixture(['البند: ','Release 1 remains available']),fixture([{text:phrase,lang:'ar-SA'}])])assert.equal(tagOf(await exportDeck(input))?.listScalars,undefined);
 for(const provenance of ['references-only',false])assert.equal(tagOf(await exportDeck(source,{provenance}))?.listScalars,undefined);
 assert.doesNotThrow(()=>validateListScalars([['slides.0.items',[[0,'text'],[0,'description'],[1,'text']]]]));
 for(const bad of [[],{},[['items',[[0,'text']]]],[['slides.0.items',[]]],[['slides.0.items',[[0,'other']]]],[['slides.0.items',[[0,'text'],[0,'text']]]],[['slides.0.items',[[1,'text'],[0,'text']]]],[['slides.0.items',[[MAX_LIST_BREAKS,'text']]]]])assert.throws(()=>validateListScalars(bad));
});
test('missing stale malformed and unmatched scalar proof never guesses away current boundaries',async()=>{
 const bytes=await exportDeck(fixture(phrase));
 const cases=[['missing',editTag(bytes,tag=>{delete tag.listScalars;})],['stale',editTag(bytes,tag=>{tag.native.listIdentity='00000000000000';})],['invalid',editTag(bytes,tag=>{tag.listScalars[0][1][0][1]='other';})],['unmatched',editTag(bytes,tag=>{tag.listScalars[0][1][0][0]=99;})],['renamed',editSlide(bytes,xml=>xml.replace('OPF list slides.0.items line 0','OPF list slides.0.items line 9'))]];
 for(const [kind,input]of cases){const diagnostics=[],restored=await importDeck(input,diagnostics),values=restored.slides[0].items??restored.slides[0].blocks?.find(block=>block.items)?.items;assert.ok(Array.isArray(values?.[0]),kind+' keeps observed run boundaries');assert.equal(characters(values[0]),phrase);if(kind==='stale'||kind==='unmatched'||kind==='renamed')assert.ok(diagnostics.some(d=>d.code==='list-scalar-reference-changed'));if(kind==='invalid')assert.ok(diagnostics.some(d=>d.code==='invalid-document-provenance'));}
});
test('contradictory scalar intent cannot consume an authored color slot',async()=>{
 const source=fixture(phrase);source.slides[0].items.push([{text:'visible accent',color:'accent2'}]);const bytes=await exportDeck(source),forged=editTag(bytes,tag=>tag.listScalars[0][1].push([1,'text'])),diagnostics=[],restored=await importDeck(forged,diagnostics);assert.ok(diagnostics.some(d=>d.code==='list-scalar-reference-changed'));assert.ok(Array.isArray(restored.slides[0].items[0]));assert.ok(runs(restored.slides[0].items[1]).some(run=>run.text==='visible accent'&&/^#[0-9A-F]{6}$/i.test(run.color)),'current native color remains visible when contradictory source proof is refused');
});

test('unowned alternate retains current native language beside named color slots',async()=>{
 const source=fixture(phrase);source.slides[0].items.push([{text:'inherited role',color:'text'}],[{text:'accent role',color:'accent2'}]);const bytes=await exportDeck(source);assert.ok(tagOf(bytes).listScalars);
 const edited=editSlide(bytes,xml=>xml.replace(/<a:r>[\s\S]*?<\/a:r>/g,run=>!run.includes('<a:t>Release 1 remains available</a:t>')?run:run.replace(/lang="en-US"/,'lang="en-US" altLang="ar-SA"'))),diagnostics=[],restored=await importDeck(edited,diagnostics);
 assert.equal(restored.language,'ar-SA');assert.ok(runs(restored.slides[0].items[0]).some(run=>run.lang==='en-US'&&run.text==='Release 1 remains available'));assert.equal(characters(restored.slides[0].items[0]),phrase);assert.deepEqual(restored.slides[0].items.slice(1),source.slides[0].items.slice(1));assert.ok(diagnostics.some(d=>d.code==='native-language-unowned'));assert.ok(!diagnostics.some(d=>d.code==='color-reference-changed'));
});
test('predominant foreign and no-base-vote proofing remain observed rather than replaced by scalar intent',async()=>{
 const source={language:'ar-SA',slides:[{items:[phrase,[{text:'inherited role',color:'text'}]],numbering:'arabic'}]},bytes=await exportDeck(source);assert.ok(tagOf(bytes).listScalars);
 for(const [lang,altLang]of [['en-US','ar-SA'],['fr-FR','en-US']]){
  const edited=editSlide(bytes,xml=>xml.replace(/<a:rPr\b[^>]*>/g,run=>run.replace(/\s(?:lang|altLang)="[^"]*"/g,'').replace(/>$/,' lang="'+lang+'" altLang="'+altLang+'">'))),diagnostics=[],restored=await importDeck(edited,diagnostics);
  assert.equal(characters(restored.slides[0].items[0]),phrase);assert.ok(runs(restored.slides[0].items[1]).some(run=>run.color==='text'));assert.ok(!diagnostics.some(d=>d.code==='color-reference-changed'));
  if(lang==='en-US')assert.equal(restored.language,'en-US','current native base carries the predominant unowned language');
  else {assert.equal(restored.language,'ar-SA','full source base remains while every current override is protected');assert.ok(runs(restored.slides[0].items[0]).every(run=>run.lang==='fr-FR'));assert.ok(runs(restored.slides[0].items[0]).length>0);}
 }
});
