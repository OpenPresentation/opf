// LH-63, LH-78: a text that opens with a short line the author broke exports that line as a bold run of the native text (the preview's
// runs), and a quote on a card exports its decorative mark as one native text box in the primary color where core placed it, tagged
// into the quote's group as decoration; an unchanged export imports back as the same quote (the mark is consumed, never imported as text).
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx, fromPptx, resolvePresentation} from './helpers/default-catalog.mjs';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),decode=bytes=>new TextDecoder().decode(bytes),array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const shapesOf=bytes=>array(parser.parse(decode(unzipSync(bytes)['ppt/slides/slide1.xml']))['p:sld']['p:cSld']['p:spTree']['p:sp']);
const nameOf=shape=>shape['p:nvSpPr']['p:cNvPr'].name,emu=inches=>Math.round(inches*914400);
const runsOf=shape=>array(shape['p:txBody']?.['a:p']).flatMap(paragraph=>array(paragraph['a:r']));
const chart={chart:{type:'column',data:{columns:['Quarter','Pilot','Baseline'],rows:[['Q1',19,16],['Q2',23,18],['Q3',26,20],['Q4',30,22]]}}};
const quotes={en:{text:'The rollout took six weeks, not six months, and every store manager was using it by the second Monday.',attribution:'Sofia Brandt',role:'Head of procurement'},
  ar:{text:'تم الإطلاق في ستة أسابيع وليس ستة أشهر، وكان كل مدير متجر يستخدمه بحلول الاثنين الثاني.',attribution:'سلمى الحداد',role:'رئيسة المشتريات'}};

let checkedMarks=0;
for(const measured of [false,true])for(const language of ['en','ar']){
  // The quote card: a chart and a quote.
  const quote=quotes[language],deck={language,design:{fontScheme:'roboto'},slides:[{title:'Signal trend',blocks:[chart,{quote}]}]};
  const options=measured?{fonts:await loadFonts({scripts:'auto',presentation:deck})}:{};
  const item=resolvePresentation(deck,options).slides[0].geometry.items.find(entry=>entry.quoteLayout),layout=item.quoteLayout;
  assert.ok(item.frameBox&&layout.mark,`${language}: a quote card with a mark`);
  const bytes=await toPptx(deck,options),shapes=shapesOf(bytes);
  const mark=shapes.find(shape=>/^OPF quote \d+ part \d+ line 0$/.test(nameOf(shape))&&runsOf(shape).map(run=>run['a:t']).join('')===layout.mark.text);
  assert.ok(mark,`${language}: the mark is a native text box holding the glyph`);
  assert.ok(Math.abs(Number(mark['p:spPr']['a:xfrm']['a:off'].y)-emu(layout.mark.box.y/96))<=emu(layout.mark.box.height/96),'near where core placed it');
  assert.ok(runsOf(mark).length&&runsOf(mark).every(run=>run['a:rPr'].b==='1'),'bold');
  // The mark stands for the quote's own opening mark: the first body line does not begin with it, and the closing mark is written.
  const body=layout.parts.find(part=>part.role==='body'),lines=shapes.filter(shape=>/^OPF quote \d+ part 0 line \d+$/.test(nameOf(shape))).map(shape=>runsOf(shape).map(run=>run['a:t']).join(''));
  assert.equal(layout.mark.hidden,language==='ar'?'«':'“');
  assert.ok(lines[0].length&&!lines[0].startsWith(layout.mark.hidden)&&lines.at(-1).endsWith(language==='ar'?'»':'”'),`${language}: ${JSON.stringify(lines)}`);
  assert.equal(lines.join('').replace(/\s/g,''),body.text.replace(/\s/g,''));
  const diagnostics=[],imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
  const found=imported.slides[0].blocks.map(block=>block.quote).filter(Boolean);
  assert.deepEqual(found,[quote],`${language}: the quote imports back without its mark`);
  assert.ok(!diagnostics.some(d=>d.code==='invalid-quote-provenance'),JSON.stringify(diagnostics));
}

// Every language's opening mark: the quote card imports back as the authored string, whatever its marks (low, guillemets, corner, right-only).
for(const [language,text] of [['de','Der Start dauerte sechs Wochen, nicht sechs Monate.'],['fr','Le déploiement a pris six semaines, pas six mois.'],['ja','展開には六週間かかりました。'],['sv','Utrullningen tog sex veckor, inte sex månader.'],['pl','Wdrożenie trwało sześć tygodni.'],['xx','The rollout took six weeks.']]){
  const quote={text,attribution:'A. Writer'},deck={language,design:{fontScheme:'roboto'},slides:[{title:'Signal trend',blocks:[chart,{quote}]}]};
  const item=resolvePresentation(deck,{}).slides[0].geometry.items.find(entry=>entry.quoteLayout);
  if(!item.quoteLayout.mark)continue;
  const diagnostics=[],imported=await fromPptx(await toPptx(deck,{}),{onDiagnostic:d=>diagnostics.push(d)});
  assert.deepEqual(imported.slides[0].blocks.map(block=>block.quote).filter(Boolean),[quote],`${language}: the quote imports back as authored`);
  assert.ok(!diagnostics.some(d=>d.code==='invalid-quote-provenance'),JSON.stringify(diagnostics));
  checkedMarks++;
}
assert.ok(checkedMarks>=4,'cards with marks were checked');

// A run-in heading: the preview's runs are the native text's runs, the heading bold; the document's text is unchanged.
for(const options of [{},{fonts:await loadFonts()}]){
  const text='Option A: focused pilot\nTwo teams, six weeks. Low setup cost and a clear baseline against which to read the result.';
  const deck={language:'en',design:{fontScheme:'roboto'},slides:[{title:'Choose the smallest useful test',blocks:[{text},{text:'Option B: broad rollout\nAll teams, three months. Wider reach with greater coordination needs and a longer path to a decision.'}]}]};
  const item=resolvePresentation(deck,options).slides[0].geometry.items.find(entry=>entry.field==='text');
  assert.ok(item.runs&&item.runs[0].bold===true&&item.runs.map(run=>run.text??run).join('')===text,'core draws the heading as a bold run of the same characters');
  const shapes=shapesOf(await toPptx(deck,options));
  const bold=shapes.flatMap(shape=>runsOf(shape).filter(run=>run['a:rPr']?.b==='1'&&/focused pilot/.test(run['a:t']))).length;
  assert.ok(bold>=1,'the heading is bold in the native text');
  // The bold run is core's, not the author's: an unchanged export imports back as the authored strings.
  const diagnostics=[],imported=await fromPptx(await toPptx(deck,options),{onDiagnostic:d=>diagnostics.push(d)});
  assert.deepEqual(imported.slides[0].blocks.map(block=>block.text),deck.slides[0].blocks.map(block=>block.text),'the texts import back as authored');
  assert.deepEqual(diagnostics.filter(d=>/provenance|reflow/.test(d.code)),[],JSON.stringify(diagnostics));
}
console.log('lh-63 run-in headings and lh-78 quote marks: ok');
