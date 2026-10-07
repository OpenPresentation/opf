// FF-57: quote payloads survive PPTX re-import. An unchanged export re-imports as {type: 'quote', quote} exactly; an edited or damaged
// quote degrades to ordinary text blocks with a diagnostic; the tags hold topology only (no quote words).
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {unzipSync,zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx,fromPptx} from '../dist/index.js';
import {decodeTextTag} from '../dist/code-provenance.js';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false});
const decode=bytes=>new TextDecoder().decode(bytes),encode=text=>new TextEncoder().encode(text),array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const fontOptions = {fonts: await loadFonts()};
const OPTIONS={seed:1,timestamp:'2026-01-01T00:00:00Z',zipDate:'2026-01-01T00:00:00Z'};
const reflow=new Set(['quote-import-reflow','heading-import-reflow']);

const fixtures=[
 'Shorthand quote',
 {text:'Text only'},
 {text:'Make the important point easy to understand.',attribution:'Example speaker'},
 {text:'A quote with a citation.',source:'Customer interview, March 2026'},
 {text:'Both fields.',attribution:'VP Operations, Acme Corp',source:'https://acme.example/case-study'},
 {text:'Hard line break\nkept in the body, and “quoted” words, "straight" quotes and a trailing space ',attribution:'Z - y - x',source:'S'},
 {text:'Blank line\n\nbetween paragraphs',attribution:'A'},
 {text:' Leading and trailing whitespace preserved\t',attribution:' padded  '},
 {text:'A long quote body that wraps across several native lines because the cell is only so wide, and keeps every word in order. '.repeat(3),attribution:'Long attribution that also wraps '.repeat(2),source:'Recorded'},
];

const exportSource=(source,options=OPTIONS)=>toPptx(source,options);
const slideXml=entries=>decode(entries['ppt/slides/slide1.xml']);
const importBytes=async bytes=>{const diagnostics=[],imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});return {imported,diagnostics};};
// Content topology returns a root quote as the slide's own payload and blocks as authored (no implicit type).
const quoteBlocks=slide=>slide.quote!==undefined?[{quote:slide.quote}]:(slide.blocks??[]).filter(block=>block.quote!==undefined);
let cases=0;

// 1. Exact round trip for every payload shape, at two canvases, with and without loaded fonts.
for(const measured of [false,true])for(const [width,height] of [[1280,720],[720,1280]])for(const quote of fixtures){
 const source={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96}},slides:[{title:'Quote source',composition:{overflow:'warn'},quote}]},before=structuredClone(source);
 const bytes=await exportSource(source,measured?{...OPTIONS,...fontOptions}:OPTIONS),{imported,diagnostics}=await importBytes(bytes);
 assert.deepEqual(source,before,'export must not mutate its input');
 assert.equal(imported.slides[0].title,'Quote source');
 assert.deepEqual(imported.slides[0].quote,quote,JSON.stringify({measured,width,quote}));
 assert.equal(imported.slides[0].blocks,undefined);
 assert.ok(diagnostics.some(d=>d.code==='quote-import-reflow'));
 assert.ok(diagnostics.every(d=>reflow.has(d.code)),JSON.stringify(diagnostics));
 cases++;
}

// 2. Several quotes on one slide and on separate slides keep their order and identity.
const many={slides:[{title:'Grid',blocks:fixtures.slice(0,5).map(quote=>({quote}))},{title:'Second',quote:fixtures[4]}]};
const manyBytes=await exportSource(many),manyImported=await importBytes(manyBytes);
assert.deepEqual(quoteBlocks(manyImported.imported.slides[0]).map(block=>block.quote),fixtures.slice(0,5).map(quote=>quote));
assert.deepEqual(quoteBlocks(manyImported.imported.slides[1]).map(block=>block.quote),[fixtures[4]]);
assert.equal(manyImported.imported.slides[0].blocks.length,5,'no loose text blocks remain next to the quotes');

// 3. Layouts whose example carries a quote.
const layoutDeck=id=>({slides:[{layout:id,title:'Layout',quote:{text:'Make the important point easy to understand.',attribution:'Example speaker'}}]});
const layoutImported=await importBytes(await exportSource(layoutDeck('quote-1x')));
assert.deepEqual(quoteBlocks(layoutImported.imported.slides[0]).map(block=>block.quote),[{text:'Make the important point easy to understand.',attribution:'Example speaker'}]);
assert.equal(layoutImported.imported.slides[0].layout,'quote-1x');

// 4. Determinism: the same document exports the same bytes, and re-exporting the import keeps the same quote payload.
const twice=[await exportSource(many),await exportSource(many)];
assert.equal(createHash('sha256').update(twice[0]).digest('hex'),createHash('sha256').update(twice[1]).digest('hex'));
const again=await importBytes(await exportSource(manyImported.imported,OPTIONS));
assert.deepEqual(quoteBlocks(again.imported.slides[0]).map(block=>block.quote),fixtures.slice(0,5));

// 5. The tags hold topology only: no quote word is stored in an OPF_QUOTE_V1 tag.
const control={slides:[{title:'Tags',quote:{text:'Secret body words.',attribution:'Hidden attribution',source:'Hidden source'}}]};
const controlBytes=await exportSource(control),controlEntries=unzipSync(controlBytes);
const tags=Object.entries(controlEntries).filter(([name])=>name.startsWith('ppt/tags/')).flatMap(([,bytes])=>array(parser.parse(decode(bytes))['p:tagLst']?.['p:tag'])).filter(tag=>tag.name==='OPF_QUOTE_V1').map(tag=>decodeTextTag(tag.val));
assert.ok(tags.length>=2);
for(const word of ['Secret','words','Hidden'])assert.ok(!JSON.stringify(tags).includes(word),word);
assert.equal(tags.filter(tag=>tag.anchor).length,1,'exactly one manifest per quote');
for(const tag of tags)assert.equal(tag.group,tags[0].group);

// 6. Current native edits stay authoritative: edited words import, never the words the tags once described.
const rebuilt=async mutate=>{const entries=structuredClone(controlEntries);await mutate(entries);return importBytes(zipSync(entries));};
const editXml=(entries,change)=>{entries['ppt/slides/slide1.xml']=encode(change(slideXml(entries)));};
const edited=await rebuilt(entries=>editXml(entries,xml=>xml.replace('Secret body words.','Edited body words.')));
assert.deepEqual(quoteBlocks(edited.imported.slides[0]).map(block=>block.quote),[{text:'Edited body words.',attribution:'Hidden attribution',source:'Hidden source'}]);
const footerEdited=await rebuilt(entries=>editXml(entries,xml=>xml.replace('Hidden attribution - Hidden source','New name - New source')));
assert.deepEqual(quoteBlocks(footerEdited.imported.slides[0]).map(block=>block.quote),[{text:'Secret body words.',attribution:'New name',source:'New source'}]);
const merged=await rebuilt(entries=>editXml(entries,xml=>xml.replace('Hidden attribution - Hidden source','Just one edited line')));
assert.deepEqual(quoteBlocks(merged.imported.slides[0]).map(block=>block.quote),[{text:'Secret body words.',attribution:'Just one edited line'}]);
assert.ok(merged.diagnostics.some(d=>d.code==='quote-footer-merged'));
const cleared=await rebuilt(entries=>editXml(entries,xml=>xml.replace('Hidden attribution - Hidden source','')));
assert.deepEqual(quoteBlocks(cleared.imported.slides[0]).map(block=>block.quote),[{text:'Secret body words.'}]);
assert.ok(!JSON.stringify(cleared.imported).includes('Hidden'),'clearing a footer cannot restore its old words');
const unquoted=await rebuilt(entries=>editXml(entries,xml=>xml.replace('&quot;Secret body words.&quot;','Plain words.')));
assert.deepEqual(quoteBlocks(unquoted.imported.slides[0]).map(block=>block.quote)[0].text,'Plain words.');

// 7. Damaged or unknown shapes degrade to ordinary text blocks with a diagnostic and never invent a quote.
const mutateNamed=(xml,pattern,change)=>xml.replace(/<p:sp>[^]*?<\/p:sp>/g,shape=>pattern.test(shape)?change(shape):shape);
const footerLine='name="OPF quote 0 part 1 line 0"',bodyLine='name="OPF quote 0 part 0 line 0"';
const damages=[
 ['missing-footer',xml=>mutateNamed(xml,new RegExp(footerLine),()=>'')],
 ['missing-anchor-line',xml=>mutateNamed(xml,new RegExp(bodyLine),()=>'')],
 ['duplicate-line',xml=>mutateNamed(xml,new RegExp(footerLine),shape=>shape+shape)],
 ['native-bullet',xml=>mutateNamed(xml,new RegExp(footerLine),shape=>shape.replace('</a:pPr>','<a:buChar char="•"/></a:pPr>'))],
];
for(const [name,change] of damages){
 const result=await rebuilt(entries=>editXml(entries,change));
 assert.ok(result.diagnostics.some(d=>d.code==='invalid-quote-provenance'),name);
 assert.ok(!quoteBlocks(result.imported.slides[0]).length,name);
 const text=JSON.stringify(result.imported);
 assert.ok(text.includes(name==='missing-anchor-line'?'Hidden attribution - Hidden source':'Secret body words.'),`${name}: the remaining current native text is kept`);
 if(name==='missing-footer')assert.ok(!text.includes('Hidden'),'a deleted footer stays deleted');
}
// A corrupted manifest is rejected, and a tag from another format is ignored.
const badManifest=await rebuilt(entries=>{
 for(const [name,bytes] of Object.entries(entries)){
  if(!name.startsWith('ppt/tags/')||!decode(bytes).includes('OPF_QUOTE_V1'))continue;
  const tag=array(parser.parse(decode(bytes))['p:tagLst']['p:tag'])[0],data=decodeTextTag(tag.val);
  if(!data.anchor)continue;
  data.anchor.parts=[{role:'footer',lines:1}];
  entries[name]=encode(decode(bytes).replace(/val="[0-9a-f]+"/i,`val="${Buffer.from(JSON.stringify(data),'utf8').toString('hex')}"`));
 }
});
assert.ok(badManifest.diagnostics.some(d=>d.code==='invalid-quote-provenance'));
assert.ok(!quoteBlocks(badManifest.imported.slides[0]).length);
// A quote authored in PowerPoint (no tags) stays ordinary text.
const stripped=await rebuilt(entries=>{for(const name of Object.keys(entries))if(name.startsWith('ppt/tags/opfQuote'))delete entries[name];editXml(entries,xml=>xml.replace(/<p:custDataLst>[^]*?<\/p:custDataLst>/g,''));});
assert.ok(!quoteBlocks(stripped.imported.slides[0]).length);
assert.ok(JSON.stringify(stripped.imported).includes('Secret body words.'));

console.log(`Quote provenance: ${cases} exports (9 payload shapes, wide and portrait, default and loaded-font measurement) re-import as exact quote payloads; multiple quotes, quote layouts, determinism, topology-only tags, edited footers/bodies, ${damages.length+2} damaged-group controls degrade to text blocks with a diagnostic.`);
