import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {validate} from '@openpresentation/opf';
import {toPptx,fromPptx} from './helpers/default-catalog.mjs';

const hidden = ['Global header must be suppressed.','Global footer must be suppressed.'];
const flags = {
  design:{fontScheme:'roboto',header:{left:{text:hidden[0]}},footer:{right:{text:hidden[1]}}},
  slides:[
    {title:'False and empty',text:'Body one',design:{header:false,footer:{}}},
    {title:'Empty and false',text:'Body two',design:{header:{},footer:false}},
    {title:'Inactive fields',text:'Body three',design:{header:{left:{text:''},center:{date:false}},footer:{right:{text:''}}}}
  ]
};
const assertNoHidden = (bytes, document) => {
  const entries = unzipSync(bytes);
  for(const [path,data] of Object.entries(entries)) {
    if(!/\.(xml|rels)$/.test(path))continue;
    const xml = strFromU8(data);
    for(const word of hidden)assert.ok(!xml.includes(word),`${path}: no hidden native words`);
    if(path.startsWith('ppt/tags/'))for(const [,hex] of xml.matchAll(/\bval="([0-9a-f]+)"/gi)) {
      const decoded=Buffer.from(hex,'hex').toString('utf8');
      for(const word of hidden)assert.ok(!decoded.includes(word),`${path}: no cached hidden words in decoded tag`);
    }
  }
  for(const word of hidden)assert.ok(!JSON.stringify(document).includes(word),'no hidden source words restored');
};
const original = structuredClone(flags);
const bytes = await toPptx(flags,{seed:1});assert.deepEqual(flags,original);
const imported = await fromPptx(bytes);
assert.equal(validate(imported,{only:['format']}).valid,true);
assert.equal(imported.design.header,undefined);assert.equal(imported.design.footer,undefined);
assert.deepEqual(imported.slides.map(slide=>slide.design),flags.slides.map(slide=>slide.design));
assertNoHidden(bytes,imported);
const replay=await toPptx(imported,{seed:1});const reimported=await fromPptx(replay);
assert.deepEqual(reimported.slides.map(slide=>slide.design),flags.slides.map(slide=>slide.design));
assertNoHidden(replay,reimported);

// An actual newly added native footer placeholder wins; deleting it restores
// the still-suppressed baseline, never either unrendered global definition.
const addedText='New native footer';
const control=unzipSync(await toPptx({slides:[{title:'Control',text:'Body',design:{footer:{right:{text:addedText}}}}]},{seed:1}));
const footerShape=[...strFromU8(control['ppt/slides/slide1.xml']).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match=>match[0]).find(shape=>shape.includes(`<a:t>${addedText}</a:t>`));
assert.ok(footerShape);assert.match(footerShape,/<p:ph\b[^>]*type="ftr"/);
const untaggedFooter=footerShape.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g,'').replace(/(<p:cNvPr\b[^>]*\bid=")\d+"/, (_, prefix) => `${prefix}999"`)
// A shape without provenance is placed by its box centre (zoneOf). Since RR-91 a lone zone spans the content width, so the
// user-added footer is given the narrow box a person drops into the right third of the slide.
const rightThird=untaggedFooter.replace(/<a:off x="-?\d+"/,'<a:off x="8168640"').replace(/<a:ext cx="\d+"/,'<a:ext cx="3200400"');
assert.notEqual(rightThird,untaggedFooter);

const added=unzipSync(bytes);const baselineXml=strFromU8(added['ppt/slides/slide1.xml']);
added['ppt/slides/slide1.xml']=strToU8(baselineXml.replace('</p:spTree>',`${rightThird}</p:spTree>`));
const addedBytes=zipSync(added);const withFooter=await fromPptx(addedBytes);
assert.equal(withFooter.slides[0].design.footer.right.text,addedText);
assert.deepEqual(withFooter.slides.slice(1).map(slide=>slide.design),flags.slides.slice(1).map(slide=>slide.design));
assertNoHidden(addedBytes,withFooter);
added['ppt/slides/slide1.xml']=strToU8(strFromU8(added['ppt/slides/slide1.xml']).replace(rightThird,''));
assert.equal(strFromU8(added['ppt/slides/slide1.xml']),baselineXml);
const deletedBytes=zipSync(added);const afterDeletion=await fromPptx(deletedBytes);
assert.deepEqual(afterDeletion.slides.map(slide=>slide.design),flags.slides.map(slide=>slide.design));
assertNoHidden(deletedBytes,afterDeletion);

const fixture=JSON.parse(readFileSync(new URL('./fixtures/chartex-fallback-main.json',import.meta.url),'utf8'));
const chartOf=slide=>slide.chart??slide.blocks?.find(block=>block.chart)?.chart;
for(const name of ['world-category','all-seven'])for(const mode of ['auto','fallback']){
  const source=fixture.decks[name], diagnostics=[];
  const exported=await toPptx(source,{seed:1,chartex:mode,onDiagnostic:issue=>diagnostics.push(issue)});
  assert.ok(diagnostics.some(issue=>issue.code==='chart-data-adapted'&&issue.adaptation==='chartex-fallback'));
  for(const stripped of [false,true]){
    const entries=unzipSync(exported);
    if(stripped)for(const path of Object.keys(entries))if(path.startsWith('ppt/tags/'))delete entries[path];
    const result=await fromPptx(zipSync(entries));assert.equal(result.slides.length,source.slides.length);
    for(const [index,slide] of source.slides.entries()){
      const actual=chartOf(result.slides[index]);assert.ok(actual);
      const expectedType=mode==='fallback'||slide.chart.type==='world'?'column':slide.chart.type;
      assert.equal(actual.type,expectedType,`${name}/${mode}/stripped${stripped}/slide${index+1}`);
      assert.deepEqual(actual.data,slide.chart.data,`${name}/${mode}/stripped${stripped}: every authored category/series/value survives`);
    }
  }
}
console.log('All-suppressed furniture stays suppressed without cached global words; native addition/deletion stays authoritative. World/all-seven tagged and stripped auto/fallback native types and exact data PASS.');
