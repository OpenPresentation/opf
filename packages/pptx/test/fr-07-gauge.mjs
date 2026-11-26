// FR-07, part 3 (core docs/content-payloads.md, "Gauges"): a metric with a gauge exports its arc as native blockArc preset shapes (the
// track, each band segment and the value arc, all on one center), its target as a straight line and its ends' labels as text boxes, each
// tagged into the metric's group as generated decoration (role 'mark', with a part name). The metric's OPF_METRIC_V1 manifest stores the
// metric as authored, with `gauge` inside it, and the evidence of each part; import restores the gauge while that evidence is unchanged.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';

const nps = {label: 'Net Promoter Score', value: 41, gauge: {min: -100, max: 100, bands: [{to: 0, label: 'Detractors lead', color: 'accent2'}, {to: 30}, {to: 100, label: 'Strong', color: 'accent3'}], target: 40}};
const utilization = {label: 'Utilization', value: 0.72, format: '0%', gauge: {max: 1}};
const deck = {name: 'Gauges', language: 'en-US', slides: [{id: 'nps', title: 'NPS', metric: nps}, {id: 'utilization', title: 'Utilization', metric: utilization}]};

const exported = async (source, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(source), {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {bytes, parts: unzipSync(bytes), diagnostics};
};
const imported = async bytes => {
  const diagnostics = [];
  const result = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {deck: result, diagnostics};
};
const tagsOf = parts => Object.entries(parts).filter(([path]) => /^ppt\/tags\/.*\.xml$/.test(path)).flatMap(([, bytes]) => [...strFromU8(bytes).matchAll(/<p:tag name="OPF_METRIC_V1" val="([0-9A-F]+)"/g)].map(match => JSON.parse(Buffer.from(match[1], 'hex').toString('utf8'))));
const anchors = parts => tagsOf(parts).filter(tag => tag.role === 'anchor').sort((left, right) => Number(left.group) - Number(right.group));
const shapesOf = xml => [...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map(match => match[1]);
const nameOf = shape => /<p:cNvPr\b[^>]*\bname="([^"]+)"/.exec(shape)?.[1];
const gd = (shape, name) => Number(new RegExp(`<a:gd name="${name}" fmla="val (-?\\d+)"`).exec(shape)?.[1]);
const frameOf = shape => { const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(shape), ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shape); return {x: Number(off[1]), y: Number(off[2]), cx: Number(ext[1]), cy: Number(ext[2])}; };
const metricOf = (presentation, index) => { const slide = presentation.slides[index]; return slide.metric ?? slide.blocks?.find(block => block.metric)?.metric; };

// --- the native parts ----------------------------------------------------------------------------------------------------------------

{
  const {parts, diagnostics} = await exported(deck);
  assert.deepEqual(diagnostics.filter(entry => /metric|gauge/.test(entry.code)), [], JSON.stringify(diagnostics));
  const xml = strFromU8(parts['ppt/slides/slide1.xml']), shapes = shapesOf(xml), named = new Map(shapes.map(shape => [nameOf(shape), shape]));
  const arcs = ['gauge band 1', 'gauge band 2', 'gauge band 3', 'gauge value'].map(part => named.get(`OPF metric 1 ${part}`));
  assert.ok(arcs.every(Boolean), `every arc is a native shape: ${[...named.keys()].join(', ')}`);
  for (const arc of arcs) assert.match(arc, /<a:prstGeom prst="blockArc">/);
  // Bands from -100 to 0, 0 to 30 (297 degrees) and 30 to 100: angles clockwise from east in 60000ths of a degree, from 180 (min) through 270 to 0 (max).
  assert.deepEqual(arcs.slice(0, 3).map(arc => [gd(arc, 'adj1'), gd(arc, 'adj2')]), [[10800000, 16200000], [16200000, 17820000], [17820000, 0]]);
  // The value 41 fills 70.5% of the arc: 180 + 0.705 x 180 = 306.9 degrees.
  assert.deepEqual([gd(arcs[3], 'adj1'), gd(arcs[3], 'adj2')], [10800000, 18414000]);
  // One center: every frame is a square around it. The track is 18% of the radius thick (adj3 9000 of the frame); the value arc 60% of that, centered.
  const frames = arcs.map(frameOf), center = frame => [frame.x + frame.cx / 2, frame.y + frame.cy / 2];
  for (const frame of frames) { assert.ok(Math.abs(frame.cx - frame.cy) <= 1, 'square frame'); assert.ok(Math.abs(center(frame)[0] - center(frames[0])[0]) <= 1 && Math.abs(center(frame)[1] - center(frames[0])[1]) <= 1, 'one center'); }
  for (const arc of arcs.slice(0, 3)) assert.equal(gd(arc, 'adj3'), 9000);
  const outer = frames[0].cx / 2, thickness = .18 * outer, valueOuter = frames[3].cx / 2;
  assert.ok(Math.abs(valueOuter - (outer - .2 * thickness)) <= 2, 'the value arc is inset by a fifth of the track');
  assert.ok(Math.abs(gd(arcs[3], 'adj3') / 100000 * frames[3].cx - .6 * thickness) <= frames[3].cx / 100000, 'the value arc is 60% of the track thick');
  // Fills: computed colors, no outline. The value 41 falls in the Strong band (accent3): the value arc takes accent3 in full.
  // No outline: a line without a fill on a shape without a style (as the delta pill writes it).
  for (const arc of arcs) { assert.match(arc, /<a:solidFill><a:(srgbClr|schemeClr) val="/); assert.match(arc, /<a:ln><\/a:ln>/); assert.doesNotMatch(arc, /<p:style>/); }
  const target = named.get('OPF metric 1 gauge target');
  assert.match(target, /<a:prstGeom prst="line">/);
  assert.ok(named.get('OPF metric 1 gauge min')?.includes('<a:t>-100</a:t>') && named.get('OPF metric 1 gauge max')?.includes('<a:t>100</a:t>'), 'the ends are labeled');
  // The arcs are drawn under the metric's text.
  const order = shapes.map(nameOf);
  assert.ok(order.indexOf('OPF metric 1 gauge value') < order.indexOf('OPF metric 1 value line 1'), 'the arcs come before the text');
  // A plain gauge: the track whole, the ends written with the value's format.
  const second = new Map(shapesOf(strFromU8(parts['ppt/slides/slide2.xml'])).map(shape => [nameOf(shape)?.replace(/^OPF metric \d+ /, ''), shape]));
  const track = second.get('gauge track');
  assert.deepEqual([gd(track, 'adj1'), gd(track, 'adj2')], [10800000, 0]);
  assert.ok(second.get('gauge min')?.includes('<a:t>0%</a:t>') && second.get('gauge max')?.includes('<a:t>100%</a:t>'));
  assert.equal(second.has('gauge target'), false);

  // The manifest stores the metric as authored, gauge inside, and the evidence of the parts.
  const [first, plain] = anchors(parts);
  assert.deepEqual(first.value, nps);
  assert.deepEqual(first.gauge.arcs.map(entry => entry.slice(0, 4)), [['gauge band 1', 'blockArc', 10800000, 16200000], ['gauge band 2', 'blockArc', 16200000, 17820000], ['gauge band 3', 'blockArc', 17820000, 0], ['gauge value', 'blockArc', 10800000, 18414000]]);
  assert.equal(first.gauge.target.length, 4);
  assert.deepEqual(plain.value, {label: 'Utilization', value: '72%', gauge: {max: 1}}, 'the 0.36 form of what is drawn, with the gauge');
  const marks = tagsOf(parts).filter(tag => tag.role === 'mark' && tag.group === first.group).map(tag => tag.part).sort();
  assert.deepEqual(marks, ['gauge band 1', 'gauge band 2', 'gauge band 3', 'gauge max', 'gauge min', 'gauge target', 'gauge value']);
}

// --- import restores the gauge, and a gauge with a trend arrow keeps both marks -------------------------------------------------------

{
  const withTrend = {...deck, slides: [...deck.slides, {id: 'trend', title: 'Trend', metric: {...nps, delta: 4, trend: 'up'}}]};
  const {bytes} = await exported(withTrend);
  const {deck: back, diagnostics} = await imported(bytes);
  assert.deepEqual(diagnostics.filter(entry => /metric|gauge/.test(entry.code)), [], JSON.stringify(diagnostics));
  assert.deepEqual(metricOf(back, 0), nps, 'the gauge with bands and a target comes back');
  assert.deepEqual(metricOf(back, 1), utilization, 'the plain gauge comes back with its number value and format');
  assert.deepEqual(metricOf(back, 2), {...nps, delta: 4, trend: 'up'}, 'a trend arrow and a gauge: any number of marks');
  for (const index of [0, 1, 2]) assert.equal(back.slides[index].shapes, undefined, 'no stray shape');
}

// --- an edited arc: the metric comes back without its gauge, the arcs as shapes -----------------------------------------------------------

{
  const {parts} = await exported(deck);
  const path = 'ppt/slides/slide1.xml', xml = strFromU8(parts[path]);
  const value = shapesOf(xml).find(shape => nameOf(shape) === 'OPF metric 1 gauge value');
  const edited = {...parts, [path]: strToU8(xml.replace(value, value.replace(/<a:gd name="adj2" fmla="val \d+"/, '<a:gd name="adj2" fmla="val 19000000"')))};
  const {deck: back, diagnostics} = await imported(zipSync(edited));
  assert.ok(diagnostics.some(entry => entry.code === 'metric-gauge-not-restored'), JSON.stringify(diagnostics));
  const {gauge: _gauge, ...rest} = nps;
  assert.deepEqual(metricOf(back, 0), rest, 'the metric without its gauge');
  // The remaining parts are the slide's shapes: the four arcs and the target line, so the edited drawing stays.
  assert.deepEqual((back.slides[0].shapes ?? []).map(shape => shape.shape), ['blockArc', 'blockArc', 'blockArc', 'blockArc', 'line']);
  assert.deepEqual(metricOf(back, 1), utilization, 'the other slide keeps its gauge');
}

// --- an angle written another way round (270 degrees as -90, as PowerPoint reports it) is the same angle ------------------------------

{
  const {parts} = await exported(deck);
  const path = 'ppt/slides/slide1.xml', xml = strFromU8(parts[path]);
  const band = shapesOf(xml).find(shape => nameOf(shape) === 'OPF metric 1 gauge band 1');
  const turned = {...parts, [path]: strToU8(xml.replace(band, band.replace('<a:gd name="adj2" fmla="val 16200000"', '<a:gd name="adj2" fmla="val -5400000"')))};
  const {deck: back, diagnostics} = await imported(zipSync(turned));
  assert.deepEqual(diagnostics.filter(entry => /gauge/.test(entry.code)), []);
  assert.deepEqual(metricOf(back, 0), nps);
}

// --- a deleted arc and a recolored band: not restored either ---------------------------------------------------------------------------

{
  const {parts} = await exported(deck);
  const path = 'ppt/slides/slide1.xml', xml = strFromU8(parts[path]);
  const band = shapesOf(xml).find(shape => nameOf(shape) === 'OPF metric 1 gauge band 2');
  const recolored = {...parts, [path]: strToU8(xml.replace(band, band.replace(/<a:srgbClr val="[0-9A-F]{6}"/, '<a:srgbClr val="FF0000"')))};
  assert.ok((await imported(zipSync(recolored))).diagnostics.some(entry => entry.code === 'metric-gauge-not-restored'));
  const deleted = {...parts, [path]: strToU8(xml.replace(`<p:sp>${band}</p:sp>`, ''))};
  const {deck: back, diagnostics} = await imported(zipSync(deleted));
  assert.ok(diagnostics.some(entry => entry.code === 'metric-gauge-not-restored'), JSON.stringify(diagnostics));
  assert.equal(metricOf(back, 0).gauge, undefined);
}

// --- a metric without a gauge exports byte for byte as before: no gauge part, no gauge key ----------------------------------------------

{
  const plain = {name: 'Plain', language: 'en-US', slides: [{title: 'Metric', metric: {label: 'Users', value: 1234.5, delta: '+3%', trend: 'up'}}]};
  const {parts} = await exported(plain);
  const [tag] = anchors(parts);
  assert.equal(Object.hasOwn(tag, 'gauge'), false);
  assert.equal(/gauge/.test(strFromU8(parts['ppt/slides/slide1.xml'])), false);
}

console.log('fr-07 gauge: ok');
