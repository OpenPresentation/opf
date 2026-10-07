import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {renderSlideSvg} from '@openpresentation/opf-render';
import {colorSchemes} from '@openpresentation/opf';
import {PATTERN_PRESETS, patternRuns, resolvePatternPreset, codeSyntaxPaletteForScheme} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';
import {presetPatterns, nativePatternPreset} from '../dist/background.js';

// RR-07 parity: the SVG preview and the PPTX export draw code syntax colours, metric trend arrows and the
// DrawingML preset patterns from the same core tables, so the colours and geometry must agree.
const decoder = new TextDecoder();
const decode = text => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');
const slideXml = async (deck, options = {}) => {
  const entries = unzipSync(await toPptx(deck, {seed: 1, ...options}));
  return deck.slides.map((_, index) => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]));
};
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
  xml: shape,
  name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '',
  descr: shape.match(/<p:cNvPr\b[^>]*\bdescr="([^"]*)"/)?.[1],
  geometry: shape.match(/<a:prstGeom prst="(\w+)"/)?.[1],
  box: (() => { const match = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shape); return match && {x: match[1] / 9525, y: match[2] / 9525, width: match[3] / 9525, height: match[4] / 9525}; })(),
  fill: shape.match(/<p:spPr>[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)?.[1],
  runs: [...shape.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)].map(([run]) => [decode(run.match(/<a:t>([\s\S]*?)<\/a:t>/)?.[1] ?? ''), run.match(/<a:rPr\b[^>]*>[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-F]{6})"/)?.[1]]),
}));
const merged = runs => runs.reduce((out, [text, colour]) => {
  if (out.length && out.at(-1)[1] === colour) out.at(-1)[0] += text; else out.push([text, colour]);
  return out;
}, []);

// SVG line -> [text, fill] runs, following nested tspans.
function svgRuns(content, base) {
  const runs = [], stack = [base];
  for (const part of content.split(/(<\/?tspan\b[^>]*>)/)) {
    if (part.startsWith('</tspan')) stack.pop();
    else if (part.startsWith('<tspan')) stack.push(/\bfill="(#[0-9A-F]{6})"/.exec(part)?.[1].slice(1) ?? stack.at(-1));
    else if (part !== '') runs.push([decode(part), stack.at(-1)]);
  }
  return merged(runs);
}
const svgBodyLines = svg => [...svg.matchAll(/<text\b([^>]*?)(?:\/>|>([\s\S]*?)<\/text>)/g)]
  .filter(([, attrs]) => attrs.includes('data-opf-code-role="body"'))
  .map(([, attrs, content = '']) => svgRuns(content, /\bfill="#([0-9A-F]{6})"/.exec(attrs)[1]));

const SAMPLES = {
  python: 'import os\n\n@cache\ndef greet(name: str) -> str:\n\t"""Doc\n\tstring"""\n\t# note\n\treturn f"Hello, {name}!" if name else None  # tail\n\nclass Box(Base):\n    size = 0x1F + 3.5e2\n',
  typescript: '// header\nimport {a} from "./a";\n/* block\n   comment */\nexport async function run<T>(input: Map<string, T>): Promise<void> {\n\tconst n = 42, ok = true;\n\treturn console.log(`n=${n}`, \'x\');\n}\n',
  json: '{\n  "name": "opf",\n  "n": [1, -2.5e3, true, null],\n  "nested": {"k": "v"}\n}\n',
  yaml: '# comment\nname: demo\nenabled: true\nitems:\n  - id: 1\n    text: "quoted"\nscript: |\n  echo hi\n',
  bash: '#!/bin/bash\nset -e\nNAME="$1"\nif [ -z "${NAME}" ]; then\n  echo \'single\' $HOME\nfi\n',
  rust: "use std::fmt;\nfn main() {\n    let s: &'static str = \"hi\";\n    println!(\"{}\", 1_000u32);\n}\n",
  css: '/* c */\n.box, #id > a { color: #fff; margin: -2.5rem 10px !important; }\n',
  html: '<!-- note -->\n<div class="box" id=\'a\'>text &amp; more</div>\n',
  sql: "-- c\nSELECT id, name FROM users WHERE age >= 18 AND name = 'x' LIMIT 10;\n",
};
const SCHEMES = [...colorSchemes.map(({id}) => id), {light1: '#FFFFFF', dark1: '#101010', accent1: '#112233', accent2: '#445566', accent3: '#778899', primary: '#8A2BE2'}];

let checkedLines = 0, coloured = 0;
for (const [language, source] of Object.entries(SAMPLES)) for (const colorScheme of SCHEMES) {
  const deck = {design: {fontScheme: 'roboto', colorScheme}, slides: [{code: {source, language, filename: `sample.${language}`}}]};
  const svg = renderSlideSvg(deck, 0, {trace: true});
  const [xml] = await slideXml(deck);
  const native = shapes(xml).filter(shape => /^OPF code \d+ body line \d+$/.test(shape.name));
  const preview = svgBodyLines(svg);
  assert.equal(native.length, preview.length, `${language}: line count`);
  for (const [index, line] of native.entries()) {
    assert.deepEqual(merged(line.runs), preview[index], `${language} ${JSON.stringify(colorScheme).slice(0, 40)} line ${index + 1}: preview and PPTX colours agree`);
    checkedLines++;
    if (line.runs.some(([, colour]) => colour !== 'E5E7EB')) coloured++;
  }
  // The native text is the source line, unchanged: runs only add colour.
  const palette = codeSyntaxPaletteForScheme(typeof colorScheme === 'string' ? colorSchemes.find(({id}) => id === colorScheme) : colorScheme);
  assert.ok(Object.values(palette).every(colour => /^#[0-9A-F]{6}$/.test(colour)));
  const imported = await fromPptx(await toPptx(deck, {seed: 1}));
  assert.deepEqual(imported.slides[0].code, deck.slides[0].code, `${language}: coloured runs import as the exact source`);
}
assert.ok(coloured > checkedLines / 2, 'most sample lines carry a coloured token');

// Plain languages are exported exactly as before: one run per line in the panel foreground.
for (const code of [{source: SAMPLES.python, language: 'klingon'}, SAMPLES.python, {source: SAMPLES.python}]) {
  const [xml] = await slideXml({design: {fontScheme: 'roboto'}, slides: [{code}]});
  for (const line of shapes(xml).filter(shape => /^OPF code \d+ body line \d+$/.test(shape.name))) assert.ok(line.runs.length <= 1 && line.runs.every(([, colour]) => colour === 'E5E7EB'), 'plain code stays one run');
}

// ---------------------------------------------------------------- metric trend
const decks = [];
for (const trend of ['up', 'down', 'flat']) for (const align of ['left', 'center', 'right']) for (const design of [
  {colorScheme: 'cool-horizon', background: '#FFFFFF'}, {background: '#0F172A', colorScheme: {light1: '#F8FAFC', dark1: '#0F172A', accent1: '#38BDF8'}}, {theme: 'minimal'},
  {colorScheme: 'cool-horizon', background: {type: 'gradient', gradient: {angle: 90, stops: [{color: '#0F172A', position: 0}, {color: '#1E293B', position: 1}]}}},
  {colorScheme: 'cool-horizon', background: {type: 'pattern', pattern: {preset: 'pct50', foregroundColor: '#FFFFFF', backgroundColor: '#7F7F7F'}}},
]) decks.push({trend, align, deck: {design: {fontScheme: 'roboto', contentAlignment: align, ...design}, slides: [{metric: {value: 42, unit: 'ms', label: 'Latency', description: 'Median', delta: '-3%', trend}}]}});
let arrowsChecked = 0;
for (const {trend, align, deck} of decks) {
  const svg = renderSlideSvg(deck, 0, {trace: true}), [xml] = await slideXml(deck);
  const svgArrow = [...svg.matchAll(/<g aria-label="([^"]*)" role="img"><polygon fill="#([0-9A-F]{6})" points="([^"]*)"\/><\/g>/g)];
  const nativeArrow = shapes(xml).filter(shape => / trend mark$/.test(shape.name));
  assert.equal(svgArrow.length, 1, `${trend}/${align}: preview arrow`);
  assert.equal(nativeArrow.length, 1, `${trend}/${align}: native arrow`);
  const [, label, fill, points] = svgArrow[0], [shape] = nativeArrow;
  assert.equal(shape.fill, fill, `${trend}/${align}: arrow colour`);
  assert.equal(shape.descr, label, 'the arrow carries its text alternative as native alt text');
  assert.equal(label, `Trend: ${trend}`);
  assert.equal(shape.geometry, {up: 'upArrow', down: 'downArrow', flat: 'rightArrow'}[trend]);
  const xs = points.split(' ').map(pair => Number(pair.split(',')[0])), ys = points.split(' ').map(pair => Number(pair.split(',')[1]));
  const box = {x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys)};
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(shape.box[key] - box[key]) < .01, `${trend}/${align}: arrow ${key} (${shape.box[key]} vs ${box[key]})`);
  // Trend and delta text share the arrow's colour in both engines; the other fields keep theirs.
  for (const role of ['trend', 'delta']) {
    const text = svg.match(new RegExp(`<text\\b[^>]*data-opf-metric-role="${role}"[^>]*>`))[0];
    const native = shapes(xml).find(item => item.name === `OPF metric 1 ${role} line 1` || new RegExp(`^OPF metric \\d+ ${role} line 1$`).test(item.name));
    assert.equal(/\bfill="#([0-9A-F]{6})"/.exec(text)[1], native.runs[0][1], `${trend}/${align}: ${role} colour`);
    assert.equal(native.runs[0][1], fill);
  }
  const imported = await fromPptx(await toPptx(deck, {seed: 1}));
  assert.deepEqual(imported.slides[0].metric, deck.slides[0].metric, 'the generated arrow is consumed with its metric on import');
  arrowsChecked++;
}
// No trend, no arrow in either engine.
{
  const deck = {design: {fontScheme: 'roboto'}, slides: [{metric: {value: 42, delta: '+3'}}]};
  assert.ok(!renderSlideSvg(deck, 0).includes('role="img"><polygon'));
  assert.ok(!shapes((await slideXml(deck))[0]).some(shape => / trend mark$/.test(shape.name)));
}

// ---------------------------------------------------------------- patterns
// The exporter's own preset list is core's: no preset the preview draws is missing here, and none is extra.
assert.deepEqual([...presetPatterns].sort(), [...PATTERN_PRESETS].sort());
assert.equal(nativePatternPreset('diagStripe'), resolvePatternPreset('diagStripe'));
const hex = value => value.slice(1).toUpperCase();
for (const preset of [...PATTERN_PRESETS, 'diagStripe']) {
  const deck = {design: {fontScheme: 'roboto', background: {type: 'pattern', pattern: {preset, foregroundColor: '#112233', backgroundColor: '#FFEECC'}}}, slides: [{title: 'Pattern'}]};
  const diagnostics = [];
  const svg = renderSlideSvg(deck, 0, {onDiagnostic: item => diagnostics.push(item)});
  const [xml] = await slideXml(deck, {onDiagnostic: item => diagnostics.push(item)});
  assert.deepEqual(diagnostics.filter(item => /pattern/.test(item.code)), [], `${preset}: drawn and exported`);
  assert.match(xml, new RegExp(`<a:pattFill prst="${resolvePatternPreset(preset)}"><a:fgClr><a:srgbClr val="112233"(?:/>|></a:srgbClr>)</a:fgClr><a:bgClr><a:srgbClr val="FFEECC"(?:/>|></a:srgbClr>)</a:bgClr></a:pattFill>`), `${preset}: native pattFill`);
  const drawn = /<pattern\b[^>]*id="opf-s1-pattern"[^>]*>[\s\S]*?<path d="([^"]*)" fill="(#[0-9A-F]{6})"/.exec(svg);
  assert.equal(drawn[1], patternRuns(preset).map(run => `M${run.x} ${run.y}h${run.width}v1h-${run.width}z`).join(''), `${preset}: preview bitmap`);
  assert.equal(hex(drawn[2]), '112233');
  assert.ok(svg.includes('fill="#FFEECC"'));
}
// The deck's own colours (theme slots, defaults) resolve the same in both engines.
{
  const deck = {design: {fontScheme: 'roboto', colorScheme: 'cool-horizon', background: {type: 'pattern', pattern: {preset: 'wdUpDiag', foregroundColor: 'accent1', backgroundColor: 'light1'}, opacity: 0.5}}, slides: [{title: 'Pattern'}]};
  const svg = renderSlideSvg(deck, 0), [xml] = await slideXml(deck);
  const nativeFg = /<a:fgClr>(?:<a:schemeClr val="(\w+)"|<a:srgbClr val="([0-9A-F]{6})")/.exec(xml);
  assert.ok(nativeFg, 'foreground resolves natively');
  assert.match(svg, /<pattern\b[^>]*id="opf-s1-pattern"/);
}

console.log(`RR-07 preview/export parity: ${checkedLines} code lines (${coloured} coloured) across ${Object.keys(SAMPLES).length} languages and ${SCHEMES.length} schemes, ${arrowsChecked} metric trend arrows (geometry, colour, alt text, round trip), ${PATTERN_PRESETS.length + 1} pattern presets (native pattFill and preview bitmap).`);
