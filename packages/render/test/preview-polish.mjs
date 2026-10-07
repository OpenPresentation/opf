import assert from 'node:assert/strict';
import {renderSlideSvg} from '../dist/svg.js';
import {colorSchemes} from '@openpresentation/opf';
import {PATTERN_PRESETS, patternBitmap, patternRuns, colorContrast, metricTrendColor, resolveCodeLanguage} from '@openpresentation/opf/composition';

// RR-07: the preview draws code.language syntax colours, metric.trend arrows and every DrawingML preset pattern.
// The shared tables live in core (tokenizeCode, metricTrendMark, patternRuns); opf-pptx test/rr-07-preview-polish.mjs
// checks that the PPTX export reads the same ones.
const decode = text => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&');
const PANEL = '#111827';

// ---------------------------------------------------------------- code
const SOURCE = 'def greet(name):\n    # say hi\n    return "Hello, " + name + str(42)\n';
const codeDeck = (code, design = {}) => ({design: {fontScheme: 'roboto', ...design}, slides: [{code}]});
const bodyLines = svg => [...svg.matchAll(/<text\b([^>]*data-opf-code-role="body"[^>]*)>([\s\S]*?)<\/text>/g)].map(([, , content]) => content);
// A line's runs: [text, fill] pairs for its coloured spans and its plain text, in order.
const runsOf = content => [...content.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)]
  .map(([, attrs, text]) => [decode(text), /\bfill="(#[0-9A-F]{6})"/.exec(attrs)?.[1]]);
const lineText = content => decode(content.replace(/<\/?tspan\b[^>]*>/g, ''));

{
  const svg = renderSlideSvg(codeDeck({source: SOURCE, language: 'python', filename: 'greet.py'}), 0, {trace: true});
  const lines = bodyLines(svg);
  assert.deepEqual(lines.map(lineText), ['def greet(name):', '    # say hi', '    return "Hello, " + name + str(42)'], 'Highlighting keeps the code text exact');
  const colours = new Map(lines.flatMap(runsOf).filter(([, fill]) => fill).map(([text, fill]) => [text, fill]));
  for (const text of ['def', 'return']) assert.ok(colours.has(text), `${text} is a coloured keyword`);
  assert.ok(colours.has('# say hi') && colours.has('"Hello, "') && colours.has('42') && colours.has('greet'), 'comment, string, number and definition are coloured');
  assert.notEqual(colours.get('def'), colours.get('# say hi'));
  assert.notEqual(colours.get('"Hello, "'), colours.get('42'));
  // The plain text keeps the panel foreground: only token spans carry a fill.
  // A coloured run is its own traced segment: it holds one text node and carries its source range, as the editor's caret mapping expects.
  const traced = [...svg.matchAll(/<tspan\b([^>]*\bfill="#[0-9A-F]{6}"[^>]*)>([^<]*)<\/tspan>/g)];
  assert.ok(traced.length >= 6);
  for (const [, attrs, text] of traced) {
    const start = Number(/data-opf-text-start="(\d+)"/.exec(attrs)[1]), end = Number(/data-opf-text-end="(\d+)"/.exec(attrs)[1]);
    assert.equal(decode(text), SOURCE.slice(start, end), 'the run text is its source range');
    assert.match(attrs, /data-opf-segment="text"/);
  }
}

// Unknown or missing languages are plain: no fill on any tspan, and the same markup as a deck without a language label.
for (const language of ['klingon', 'plaintext', undefined]) {
  const svg = renderSlideSvg(codeDeck(language ? {source: SOURCE, language} : SOURCE), 0, {trace: true});
  assert.ok(!/<tspan\b[^>]*\bfill=/.test(svg), `${language ?? 'no language'}: plain`);
}
assert.equal(resolveCodeLanguage('klingon'), undefined);

// Every catalog colour scheme (and a degenerate one) keeps every token colour at >= 4.5:1 on the code panel.
for (const scheme of [...colorSchemes.map(({id}) => id), {light1: '#000000', dark1: '#000000', accent1: '#000000', accent2: '#000000', accent3: '#000000'}, {light1: '#FFFFFF', dark1: '#FFFFFF', accent1: '#FFFFFF', accent2: '#FFFFFF', accent3: '#FFFFFF'}]) {
  const svg = renderSlideSvg(codeDeck({source: SOURCE + '\nclass Box(Base): pass\n@dec\nTrue', language: 'python'}, {colorScheme: scheme}), 0);
  const fills = new Set([...svg.matchAll(/<tspan fill="(#[0-9A-F]{6})"/g)].map(match => match[1]));
  assert.ok(fills.size >= 6, `${JSON.stringify(scheme)}: distinct token colours`);
  for (const fill of fills) assert.ok(colorContrast(fill, PANEL) >= 4.5, `${fill} on the code panel (${JSON.stringify(scheme)})`);
}

// A multi-line string and CRLF source split into per-line spans without changing the text.
{
  const source = 'x = """a\r\nb"""\r\n';
  const lines = bodyLines(renderSlideSvg(codeDeck({source, language: 'py'}), 0, {trace: true}));
  assert.deepEqual(lines.map(lineText), ['x = """a', 'b"""']);
  assert.ok(lines[1].includes('fill='), 'the string continues on the next line in colour');
}

// ---------------------------------------------------------------- metric trend
const metricDeck = (metric, design = {}) => ({design: {fontScheme: 'roboto', ...design}, slides: [{metric}]});
const arrows = svg => [...svg.matchAll(/<g aria-label="([^"]*)" role="img"><polygon fill="(#[0-9A-F]{6})" points="([^"]*)"\/><\/g>/g)]
  .map(([, label, fill, points]) => ({label, fill, points: points.split(' ').map(pair => pair.split(',').map(Number))}));
for (const [trend, geometry] of [['up', 'upArrow'], ['down', 'downArrow'], ['flat', 'rightArrow']]) {
  for (const design of [{colorScheme: 'cool-horizon', background: '#FFFFFF'}, {background: '#0F172A', colorScheme: {light1: '#F8FAFC', dark1: '#0F172A', accent1: '#38BDF8'}}]) {
    const svg = renderSlideSvg(metricDeck({value: 42, label: 'Latency', delta: '-3%', trend}, design), 0, {trace: true});
    const found = arrows(svg);
    assert.equal(found.length, 1, `${trend}: one arrow`);
    assert.equal(found[0].label, `Trend: ${trend}`);
    assert.equal(found[0].points.length, 7, geometry);
    const background = design.background;
    assert.ok(colorContrast(found[0].fill, background) >= 4.5, `${trend} ${found[0].fill} on ${background}`);
    assert.equal(found[0].fill, metricTrendColor(trend, {background}));
    // The trend word stays the visible source text; the trend and delta text take the arrow's colour.
    for (const role of ['trend', 'delta']) {
      const text = svg.match(new RegExp(`<text\\b[^>]*data-opf-metric-role="${role}"[^>]*>`))[0];
      assert.equal(/\bfill="([^"]*)"/.exec(text)[1], found[0].fill, `${trend} ${role} colour`);
    }
    assert.ok(svg.includes(`>${trend}</tspan>`), 'the trend word is still drawn');
  }
}
assert.notEqual(arrows(renderSlideSvg(metricDeck({value: 1, trend: 'up'}), 0))[0].fill, arrows(renderSlideSvg(metricDeck({value: 1, trend: 'down'}), 0))[0].fill);
assert.equal(arrows(renderSlideSvg(metricDeck({value: 42, label: 'Latency', delta: '+3'}), 0)).length, 0, 'no trend, no arrow');
assert.equal(arrows(renderSlideSvg(metricDeck(42), 0)).length, 0);

// ---------------------------------------------------------------- patterns
const patternDeck = (preset, extra = {}) => ({design: {fontScheme: 'roboto', background: {type: 'pattern', pattern: {preset, foregroundColor: '#112233', backgroundColor: '#FFEECC', ...extra}}}, slides: [{title: 'Pattern'}]});
const drawn = svg => {
  const tile = /<pattern\b[^>]*id="opf-s1-pattern"[^>]*>([\s\S]*?)<\/pattern>/.exec(svg)?.[1];
  const path = tile && /<path d="([^"]*)" fill="(#[0-9A-F]{6})" shape-rendering="crispEdges"\/>/.exec(tile);
  return path && {d: path[1], fill: path[2]};
};
assert.equal(PATTERN_PRESETS.length, 54);
for (const preset of [...PATTERN_PRESETS, 'diagStripe']) {
  const diagnostics = [];
  const svg = renderSlideSvg(patternDeck(preset), 0, {onDiagnostic: item => diagnostics.push(item)});
  assert.deepEqual(diagnostics.filter(item => item.code === 'unsupported-pattern'), [], `${preset} is drawn`);
  const found = drawn(svg);
  assert.ok(found, `${preset}: bitmap path`);
  assert.equal(found.fill, '#112233', `${preset}: foreground colour`);
  assert.equal(found.d, patternRuns(preset).map(run => `M${run.x} ${run.y}h${run.width}v1h-${run.width}z`).join(''), `${preset}: the core bitmap`);
  assert.ok(/<pattern\b[^>]*width="8"[^>]*height="8"|<pattern\b[^>]*height="8"[^>]*width="8"/.test(svg), `${preset}: 8 x 8 tile, one unit per 1/96 inch`);
  assert.ok(svg.includes('fill="#FFEECC"'), `${preset}: background colour`);
}
assert.deepEqual(patternBitmap('diagStripe'), patternBitmap('wdUpDiag'));
{
  const diagnostics = [];
  renderSlideSvg(patternDeck('engine-defined-id'), 0, {onDiagnostic: item => diagnostics.push(item)});
  assert.deepEqual(diagnostics.map(item => item.code), ['unsupported-pattern'], 'an unknown id still reports once and keeps the background colour');
}
console.log(`RR-07 preview polish: code syntax colours (exact text, contrast >= 4.5 on ${colorSchemes.length + 2} schemes), metric trend arrows and colours, ${PATTERN_PRESETS.length + 1} pattern presets drawn from the core bitmaps.`);
