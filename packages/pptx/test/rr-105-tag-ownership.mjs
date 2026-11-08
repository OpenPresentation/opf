import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx,fromPptx} from '../dist/index.js';
import {observeLanguage} from '../dist/script-fonts.js';
const fixture=new URL('./fixtures/rr105-tag-ownership/',import.meta.url);
const read=name=>readFile(new URL(name,fixture));
const importDeck=async(bytes,diagnostics=[])=>fromPptx(bytes,{catalogs:[gallery],onDiagnostic:d=>diagnostics.push(d)});
const exportDeck=async(source,options={})=>toPptx(source,{catalogs:[gallery],fonts:await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:source}),...options});
const edit=(bytes,change)=>{const parts=unzipSync(bytes);change(parts);return zipSync(parts);};
const changeSlide=(parts,index,change)=>{const name='ppt/slides/slide'+index+'.xml',before=strFromU8(parts[name]),after=change(before);assert.notEqual(after,before);parts[name]=strToU8(after);};
const changeTag=(parts,change)=>{const name='ppt/tags/opfSlide1.xml';parts[name]=strToU8(strFromU8(parts[name]).replace(/val="([^"]+)"/,(_all,hex)=>{const record=JSON.parse(Buffer.from(hex,'hex').toString('utf8'));change(record);return 'val="'+Buffer.from(JSON.stringify(record)).toString('hex').toUpperCase()+'"';}));};
const renameTags=bytes=>edit(bytes,parts=>{
 const names=Object.keys(parts).filter(name=>/^ppt\/tags\/[^/]+\.xml$/.test(name)),renames=names.map((name,i)=>[name,'ppt/tags/nativeTag'+(i+1)+'.xml']);
 for(const [before,after]of renames){parts[after]=parts[before];delete parts[before];}
 for(const [part,bytes]of Object.entries(parts))if(/\.(?:xml|rels)$/.test(part)){let text=strFromU8(bytes);for(const[before,after]of renames)text=text.replaceAll(before.slice(9),after.slice(9));parts[part]=strToU8(text);}
 assert.ok(!Object.keys(parts).some(name=>/^ppt\/tags\/opf/i.test(name)));
});
const runs=value=>Array.isArray(value)?value.flatMap(runs):value&&typeof value==='object'?[...(typeof value.text==='string'?[value]:[]),...Object.values(value).filter(v=>v&&typeof v==='object').flatMap(runs)]:[];
const characters=value=>typeof value==='string'?value:Array.isArray(value)?value.map(characters).join(''):value&&typeof value==='object'?characters(value.text):'';
const source11=JSON.parse(await read('11-source.json'));

test('retained Office inputs and saved archives are exact immutable fixtures',async()=>{
 const receipt=JSON.parse(await read('receipt.json'));
 for(const[name,record]of Object.entries(receipt.files)){const bytes=await read(name);assert.equal(bytes.length,record.bytes,name);assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,name);}
});
test('actual saved11 retains authored deck base, scalar title and explicit French list language',async()=>{
 for(const phase of ['input','saved'])assert.deepEqual(await importDeck(await read('11-'+phase+'.pptx')),source11,phase+' exact source');
});
test('actual old07 scalar split remains strict observed import before and after native save',async()=>{
 const expected=JSON.parse(await read('07-source.json'));expected.slides[0].items=[['البند: ','Release 1 remains available']];
 for(const phase of ['input','saved'])assert.deepEqual(await importDeck(await read('07-'+phase+'.pptx')),expected,phase+' old archives have no scalar-intent proof');
});
test('renaming every OPF tag part and relationship preserves explicit body and list languages',async()=>{
 const text=source11.slides[0].items[0];
 for(const field of ['items','text']){const source={language:'ar-SA',slides:[{title:'عنوان عربي',...(field==='items'?{items:[text],numbering:'arabic'}:{text})}]};const bytes=await exportDeck(source);assert.deepEqual(await importDeck(bytes),source);assert.deepEqual(await importDeck(renameTags(bytes)),source);}
});

test('unowned foreign and misleading unreferenced tags do not suppress actual override votes',async()=>{
 const foreign=await exportDeck(source11,{provenance:false}),owned=unzipSync(await exportDeck(source11));
 for(const candidate of [foreign,edit(foreign,parts=>{parts['ppt/tags/opfDecoy.xml']=owned['ppt/tags/opfSlide1.xml'];})]){
  const result=await importDeck(candidate);assert.equal(result.language,'fr-FR');assert.ok(runs(result.slides[0]).some(run=>run.lang==='fr-FR'&&run.text.includes('Item 1')));
 }
});
for(const kind of ['foreign-name','unreferenced','malformed','stale','moved','duplicate','external'])test(kind+' slide tag cannot authorize base-vote protection',async()=>{
 const bytes=await exportDeck(source11),candidate=edit(bytes,parts=>{
  if(kind==='foreign-name'){const key='ppt/tags/opfSlide1.xml';parts[key]=strToU8(strFromU8(parts[key]).replace('name="OPF_SLIDE_V1"','name="FOREIGN_SLIDE_V1"'));}
  if(kind==='unreferenced')changeSlide(parts,1,xml=>xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g,''));
  if(kind==='malformed')changeTag(parts,record=>{record.v=999;});
  if(kind==='stale')changeTag(parts,record=>{record.native.structure='00000000000000';});
  if(kind==='moved')changeSlide(parts,1,xml=>xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/,shape=>shape.replace(/<a:off x="(\d+)"/,(_all,x)=>'<a:off x="'+(Number(x)+1)+'"')));
  if(kind==='duplicate'){const key='ppt/tags/opfSlide1.xml',xml=strFromU8(parts[key]),tag=xml.match(/<p:tag\s+name="OPF_SLIDE_V1"[^>]*\/>/)[0];parts[key]=strToU8(xml.replace('</p:tagLst>',tag+'</p:tagLst>'));}
  if(kind==='external'){const key='ppt/slides/_rels/slide1.xml.rels',xml=strFromU8(parts[key]);parts[key]=strToU8(xml.replace(/<Relationship\b[^>]*Target="\.\.\/tags\/opfSlide1\.xml"[^>]*\/>/,rel=>rel.replace('/>',' TargetMode="External"/>')));assert.notEqual(strFromU8(parts[key]),xml);}
 });
 const result=await importDeck(candidate);assert.equal(result.language,'fr-FR');assert.ok(runs(result.slides[0]).some(run=>run.lang==='fr-FR'&&run.text.includes('Item 1')));
});
test('a genuine foreign alternate proofing pair remains current even beside valid OPF structure',async()=>{
 const bytes=await exportDeck(source11),candidate=edit(bytes,parts=>changeSlide(parts,1,xml=>xml.replaceAll('lang="fr-FR" altLang="en-US"','lang="en-US" altLang="ar-SA"'))),diagnostics=[],result=await importDeck(candidate,diagnostics);
 assert.equal(result.language,'en-US');assert.equal(characters(result.slides[0].items),source11.slides[0].items[0][0].text);assert.ok(diagnostics.some(d=>d.code==='native-language-unowned'));
 // With sufficient current Arabic base votes, English must stay an explicit override.
 const surrounded=structuredClone(source11);surrounded.slides[0].subtitle='عنوان عربي إضافي';surrounded.slides[0].tag='لغة عربية';
 const mixed=edit(await exportDeck(surrounded),parts=>changeSlide(parts,1,xml=>xml.replaceAll('lang="fr-FR" altLang="en-US"','lang="en-US" altLang="ar-SA"'))),mixedDiagnostics=[],mixedResult=await importDeck(mixed,mixedDiagnostics);
 assert.equal(mixedResult.language,'ar-SA');assert.ok(runs(mixedResult.slides[0]).some(run=>run.lang==='en-US'&&run.text.includes('Item 1')));assert.ok(mixedDiagnostics.some(d=>d.code==='native-language-unowned'));
});
test('pasted unowned slide uses its own actual vote while owned slide keeps its base',async()=>{
 const source={language:'ar-SA',slides:[source11.slides[0],source11.slides[0]]},bytes=await exportDeck(source),candidate=edit(bytes,parts=>changeSlide(parts,2,xml=>xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g,''))),result=await importDeck(candidate);
 assert.equal(result.language,'ar-SA');assert.equal(result.slides[1].language,'fr-FR');assert.ok(runs(result.slides[1]).some(run=>run.lang==='fr-FR'));
});
test('per-slide vote ownership never changes diagnostic all-run counts or global boolean compatibility',()=>{
 const xml='<a:p><a:pPr/><a:r><a:rPr lang="ar-SA"/><a:t>عنوان</a:t></a:r><a:r><a:rPr lang="fr-FR" altLang="en-US"/><a:t>a</a:t></a:r><a:r><a:rPr lang="fr-FR" altLang="en-US"/><a:t>b</a:t></a:r></a:p>',owned=observeLanguage({slides:[xml,xml],preferBaseRuns:[true,false]}),plain=observeLanguage({slides:[xml,xml]}),global=observeLanguage({slides:[xml,xml],preferBaseRuns:true});
 assert.equal(owned.slides[0].lang,'ar-SA');assert.equal(owned.slides[1].lang,'fr-FR');assert.equal(global.slides[1].lang,'ar-SA');assert.equal(plain.slides[0].lang,'fr-FR');assert.deepEqual(owned.ranked,plain.ranked);
});

test('current native base-language edits remain authoritative after tag parts are renamed',async()=>{
 const bytes=renameTags(await exportDeck(source11)),candidate=edit(bytes,parts=>changeSlide(parts,1,xml=>xml.replaceAll('lang="ar-SA"','lang="he-IL"'))),expected=structuredClone(source11);expected.language='he-IL';assert.deepEqual(await importDeck(candidate),expected);
});
