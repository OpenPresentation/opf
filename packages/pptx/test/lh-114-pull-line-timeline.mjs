// LH-114, LH-121: a pull-line quote exports its accent rule as a native rectangle where core placed it, in the primary color, and a
// timeline with status its progress line and status words; an unchanged export imports back as the same quote and timeline payloads
// (the rule, the progress line and the generated words are consumed, never imported as text).
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx, fromPptx, resolvePresentation, catalogs} from './helpers/default-catalog.mjs';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),decode=bytes=>new TextDecoder().decode(bytes),array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const shapesOf=bytes=>array(parser.parse(decode(unzipSync(bytes)['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree']['p:sp']);
const nameOf=shape=>shape['p:nvSpPr']['p:cNvPr'].name,emu=inches=>Math.round(inches*914400);
const textOf=shape=>array(shape['p:txBody']['a:p']).map(p=>array(p['a:r']).map(run=>run['a:t']??'').join('')).join('\n');
const statusWords={en:{done:'Done',current:'Current',planned:'Planned'},ar:{done:'مكتمل',current:'حالي',planned:'مخطط'}};
const quote={text:'We re-sourced the three top Corvid parts right after this review.',attribution:'Sofia Brandt',role:'Head of procurement'};
const table={columns:['Vendor','On-time delivery','Rating'],rows:[['Northwind Parts','97%','A'],['Delta Fasteners','91%','B'],['Corvid Plastics','84%','C']]};
const events=[{when:'Jan',what:'Design freeze',status:'done'},{when:'Mar',what:'EU cutover',status:'done'},{when:'May',what:'US cutover',status:'current'},{when:'Aug',what:'APAC cutover',status:'planned'}];

for(const options of [{},{fonts:await loadFonts()}])for(const language of ['en','ar']){
  // The pull line: a short quote under a table.
  const deck={language,design:{fontScheme:'roboto'},slides:[{title:'Vendor scorecard summary',blocks:[{table},{quote}]}]};
  const layout=resolvePresentation(deck,options).slides[0].geometry.items.find(item=>item.quoteLayout).quoteLayout;
  assert.ok(layout.rule,`${language}: a pull line`);
  const bytes=await toPptx(deck,options),shapes=shapesOf(bytes);
  const rule=shapes.find(shape=>/^OPF quote rule /.test(nameOf(shape)));
  assert.ok(rule,'the rule is a native shape');
  assert.equal(rule['p:spPr']['a:prstGeom'].prst,'rect');
  assert.ok(rule['p:spPr']['a:solidFill'],'filled');
  const offset=rule['p:spPr']['a:xfrm']['a:off'],extent=rule['p:spPr']['a:xfrm']['a:ext'];
  assert.ok(Math.abs(Number(offset.x)-emu(layout.rule.x/96))<=1&&Math.abs(Number(offset.y)-emu(layout.rule.y/96))<=1,'where core placed it');
  assert.ok(Math.abs(Number(extent.cx)-emu(layout.rule.width/96))<=1&&Math.abs(Number(extent.cy)-emu(layout.rule.height/96))<=1);
  const diagnostics=[],imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
  assert.deepEqual(imported.slides[0].blocks.map(block=>block.quote).filter(Boolean),[quote],`${language}: the quote imports back with its attribution and role`);
  assert.ok(!diagnostics.some(d=>d.code==='invalid-quote-provenance'),JSON.stringify(diagnostics));

  // The timeline: progress to the current event, with editable generated words in the deck's language.
  const timelineDeck={language,design:{fontScheme:'roboto'},slides:[{title:'Platform migration roadmap',blocks:[{timeline:events}]}]};
  // A reused caller-owned font handle must prepare newly generated script text for this document.
  if(options.fonts){await options.fonts.ensure(timelineDeck,{renderOptions:{catalogs}});assert.deepEqual(options.fonts.pending(timelineDeck,{catalogs}),[],'all generated status text has prepared fonts');}
  const timeline=resolvePresentation(timelineDeck,options).slides[0].geometry.items.find(item=>item.timelineLayout).timelineLayout;
  const timelineBytes=await toPptx(timelineDeck,options),timelineShapes=shapesOf(timelineBytes);
  const progress=timelineShapes.filter(shape=>/^OPF timeline \d+ progress$/.test(nameOf(shape)));
  assert.equal(progress.length,1,'one progress line');
  assert.equal(progress[0]['p:spPr']['a:prstGeom'].prst,'line');
  const words=timelineShapes.filter(shape=>/^OPF timeline \d+ status \d+ line \d+$/.test(nameOf(shape)));
  const expectedWords=events.map(event=>statusWords[language][event.status]);
  assert.equal(words.length,events.length,`${language}: every event has a native status label`);
  assert.deepEqual(words.map(textOf),expectedWords,`${language}: native labels are the correct localized status words, in event order`);
  assert.deepEqual(timeline.statusLabels.map(label=>label.text),expectedWords,'core and native export agree on every localized status word');
  if(language==='ar')for(const word of words)for(const p of array(word['p:txBody']['a:p']))assert.equal(p['a:pPr'].rtl,'1','Arabic status labels use native RTL paragraphs');
  const timelineDiagnostics=[],back=await fromPptx(timelineBytes,{onDiagnostic:d=>timelineDiagnostics.push(d)});
  assert.deepEqual(back.slides[0].blocks?.[0]?.timeline??back.slides[0].timeline,events,`${language}: the timeline imports back without its generated words`);
  assert.ok(!timelineDiagnostics.some(d=>d.code==='invalid-timeline-provenance'),JSON.stringify(timelineDiagnostics));
}
console.log('lh-114 pull line and timeline progress: ok');
