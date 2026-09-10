import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {renderSvgDeck} from '@openpresentation/opf-render';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {toPptx, fromPptx} from '../dist/index.js';

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const all = (node, name) => {
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) => [...(key === name ? [value].flat() : []), ...all(value, name)]);
};
const content = value => typeof value === 'string' ? value : value?.['#text'] ?? '';
const fonts = await loadOfficeFontRegistry({fallbackFamily: 'Roboto', strictGlyphs: false});
let checkedText = 0;
for (const dimensions of [{widthInches: 1280 / 96, heightInches: 720 / 96}, {widthInches: 1920 / 96, heightInches: 1080 / 96}]) {
  const deck = {design: {fontScheme: 'roboto', dimensions}, slides: [
    {title: 'Metric', metric: {value: '42%', label: 'Measured outcome', description: 'Keep supporting context.', delta: '+11 pts'}},
    {title: 'Quote', quote: {text: 'Keep the source visible.', attribution: 'A reviewer', source: 'Interview'}},
    {title: 'Code', code: {language: 'python', filename: 'decision.py', source: 'approve(change)'}},
    {title: 'Timeline', timeline: {events: [{when: 'Q1', what: 'Pilot', description: 'Start small.'}, {when: 'Q2', what: 'Expand'}, {when: 'Q3', what: 'Measure'}]}},
    {title: 'Single event', timeline: {events: [{when: 'Now', what: 'One event'}]}},
  ]};
  const options = {textMeasurement: fonts.textMeasurement};
  const svgSlides = renderSvgDeck(deck, options);
  const pptx = await toPptx(deck, options), entries = unzipSync(pptx);
  const imported = await fromPptx(pptx);
  assert.deepEqual(imported.slides[2].blocks,[{type:'code',code:deck.slides[2].code}],'Code source and metadata survive export/import');
  assert.ok(JSON.stringify(imported).includes('A reviewer - Interview'), 'Quote attribution and source must survive export/import');
  for (let index = 0; index < deck.slides.length; index++) {
    const svg = parser.parse(svgSlides[index]);
    const native = parser.parse(new TextDecoder().decode(entries[`ppt/slides/slide${index + 1}.xml`]));
    const nativeShapes = all(native, 'p:sp');
    for (const text of all(svg, 'text')) {
      const value = text.tspan ? all(text,'tspan').map(content).join('') : content(text);
      if (!value || value === deck.slides[index].title) continue;
      const shape = nativeShapes.find(item => all(item, 'a:t').map(content).join('') === value);
      assert.ok(shape, `Native payload text must match preview: ${value}`);
      const properties = all(shape, 'a:rPr')[0];
      assert.ok(properties, 'Native run formatting required');
      assert.ok(Math.abs(Number(properties.sz) / 100 - Number(text['font-size']) * .75) < .02, `Font size follows fitted SVG text: ${value}`);
      const family=text['font-family'].split(',')[0].trim().replace(/^['"]|['"]$/g,'');
      const face=fonts.resolveFont({fontFamily:family,fontWeight:Number(text['font-weight']),italic:text['font-style']==='italic'}).fontFace;
      assert.equal(properties.b === '1', face.bold, `Physical bold style: ${value}`);
      assert.equal(properties.i === '1', face.italic, `Physical italic style: ${value}`);
      assert.equal(properties['a:latin'].typeface,face.family,`Physical family: ${value}`);
      const color = all(properties, 'a:srgbClr')[0]?.val;
      assert.equal(color?.toUpperCase(), text.fill.replace('#', '').toUpperCase(), `Color: ${value}`);
      const transform = all(shape, 'a:xfrm')[0], offset = transform['a:off'], extent = transform['a:ext'];
      const anchor = text['text-anchor'];
      const x = Number(offset.x) / 9525 + (anchor === 'middle' ? Number(extent.cx) / 9525 / 2 : anchor === 'end' ? Number(extent.cx) / 9525 : 0);
      assert.ok(Math.abs(x - Number(text.x)) < .02, `Horizontal layout: ${value}`);
      assert.ok(Math.abs(Number(offset.y) / 9525 - (Number(text.y) - Number(text['font-size']))) < .02, `Measured line box: ${value}`);
      checkedText++;
    }
    if (index === 2) {
      const fills = all(native, 'a:srgbClr').map(value => value.val);
      assert.ok(fills.includes('111827') && fills.includes('334155'), 'Native code panel background and border match preview');
    }
    if (index === 3 || index === 4) {
      assert.equal(all(native, 'a:prstGeom').filter(value => value.prst === 'ellipse').length, index === 3 ? 3 : 1, 'Every event has an editable native marker');
    }
  }
}
assert.ok(checkedText > 30);
let separatedQuotes = 0, overflowQuotes = 0;
for (const dimensions of [{width:1280,height:720},{width:540,height:960}]) for (const repeats of [12,16,20,24,80]) {
  const deck = {design:{dimensions:{widthInches:dimensions.width/96,heightInches:dimensions.height/96},fontScheme:'roboto'},slides:[{title:'A quote and its source',quote:{text:'A shared layout keeps the evidence readable when the words change. '.repeat(repeats),attribution:'A reviewer',source:'Recorded interview'}}]};
  const diagnostics = [];
  const bytes = await toPptx(deck,{textMeasurement:fonts.textMeasurement,onDiagnostic:value=>diagnostics.push(value)});
  const size = all(parser.parse(new TextDecoder().decode(unzipSync(bytes)['ppt/presentation.xml'])),'p:sldSz')[0];
  assert.equal(Number(size.cx),dimensions.width*9525);
  assert.equal(Number(size.cy),dimensions.height*9525);
  if (diagnostics.some(value=>value.code==='text-overflow')) {
    deck.slides[0].composition = {overflow:'error'};
    await assert.rejects(()=>toPptx(deck,{textMeasurement:fonts.textMeasurement}),{code:'layout-overflow'});
    overflowQuotes++;
    continue;
  }
  const slide = parser.parse(new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']));
  const shapes = all(slide,'p:sp').filter(shape=>all(shape,'a:t').length);
  const value = shape=>all(shape,'a:t').map(content).join('');
  const footer = shapes.find(shape=>value(shape)==='A reviewer - Recorded interview');
  assert.ok(footer,'Native footer text retained');
  const footerTop = Number(all(footer,'a:xfrm')[0]['a:off'].y);
  const body = shapes.filter(shape=>shape!==footer && value(shape)!=='A quote and its source');
  assert.ok(body.length>1);
  for (const shape of body) {
    const transform = all(shape,'a:xfrm')[0];
    assert.ok(Number(transform['a:off'].y)+Number(transform['a:ext'].cy)<=footerTop,'Fitted native quote lines cannot overlap attribution');
  }
  separatedQuotes++;
}
assert.ok(separatedQuotes>=4&&overflowQuotes>=1,'Native long quotes cover fitting and explicit overflow');
const chartDeck = {slides: [{title: 'Readable native axes', chart: {type: 'line', data: {columns: ['Quarter', 'Value'], rows: [['Q1', 10], ['Q2', 20]]}}}]};
const chartOptions = {textMeasurement: fonts.textMeasurement};
const chartSvg = parser.parse(renderSvgDeck(chartDeck, chartOptions)[0]);
const axisLabel = all(chartSvg, 'text').find(value => content(value) === 'Q1');
assert.ok(axisLabel, 'Published renderer axis label required');
const chartEntries = unzipSync(await toPptx(chartDeck, chartOptions));
const chartFile = Object.keys(chartEntries).find(file => /^ppt\/charts\/chart\d+\.xml$/.test(file));
assert.ok(chartFile, 'Chart stays an editable native Office chart');
const chartXml = parser.parse(new TextDecoder().decode(chartEntries[chartFile]));
for (const kind of ['c:catAx', 'c:valAx']) {
  const axis = all(chartXml, kind)[0];
  const properties = all(axis, 'a:defRPr')[0];
  assert.equal(all(properties, 'a:srgbClr')[0]?.val.toUpperCase(), axisLabel.fill.replace('#', '').toUpperCase(), 'Native axis labels follow readable preview colors');
}
console.log(`Native content layout passed: ${checkedText} payload text lines match actual renderer typography/geometry; ${separatedQuotes} long quotes preserve footer separation and ${overflowQuotes} oversized quotes reject in strict mode; code styling, quote source and editable timeline markers across two canvas sizes.`);
