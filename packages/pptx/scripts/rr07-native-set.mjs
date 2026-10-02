#!/usr/bin/env node
// Build the RR-07 native-check set: decks, preview PNGs and a manifest for comparing PowerPoint with the preview.
//
//   node scripts/rr07-native-set.mjs <outDir>
//
// Writes, under <outDir>:
//   rr07-patterns.pptx   one slide per DrawingML preset pattern (black on white, full-slide background) plus two coloured slides
//   rr07-code.pptx       one slide per highlighted language (code.language syntax colours as native runs)
//   rr07-trend.pptx      metric.trend slides: up, down, flat, left/centre/right alignment, light and dark backgrounds
//   preview/             the preview PNG of every slide (1280 x 720), named like the manifest's `preview` entries
//   manifest.json        what to compare per slide, the decisions behind the visuals, and how to derive pattern tiles
// It never opens PowerPoint. The native comparison (export each slide to PNG at 1280 x 720, then look, or run
// opf-render `scripts/derive-pattern-bitmaps.mjs` on the pattern exports) is a separate step.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {svgToPng, renderSvgDeck} from '@openpresentation/opf-render';
import {loadOfficeFontRegistry} from '@openpresentation/opf-render/fonts-node';
import {PATTERN_PRESETS, PATTERN_TILE_SIZE, patternBitmap, tokenizeCode, codeSyntaxPaletteForScheme} from '@openpresentation/opf';
import {toPptx} from '../dist/index.js';

const outDir = path.resolve(process.argv[2] ?? 'rr07-native');
mkdirSync(path.join(outDir, 'preview'), {recursive: true});
const fonts = await loadOfficeFontRegistry({fallbackFamily: 'Roboto', strictGlyphs: false});
const pad = number => String(number).padStart(2, '0');
const tile = preset => [...patternBitmap(preset)].map(row => [...Array(8)].map((_, x) => row & (0x80 >> x) ? '#' : '.').join(''));
const version = name => JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8')).version;

async function build(name, deck, describe) {
  const svgs = renderSvgDeck(deck, {textMeasurement: fonts.textMeasurement, embeddedFonts: fonts.embeddedFonts});
  writeFileSync(path.join(outDir, `${name}.pptx`), await toPptx(deck, {seed: 1, textMeasurement: fonts.textMeasurement}));
  const slides = [];
  for (const [index, svg] of svgs.entries()) {
    const info = describe(index);
    const preview = `preview/${info.preview ?? `${name}-${pad(index + 1)}`}.png`;
    writeFileSync(path.join(outDir, preview), await svgToPng(svg, {fonts}));
    slides.push({index: index + 1, ...info, preview});
  }
  return {file: `${name}.pptx`, slides};
}

// ---- patterns
const patternSlides = [...PATTERN_PRESETS.map(preset => ({preset, foreground: '#000000', background: '#FFFFFF'})),
  {preset: 'pct50', foreground: '#1F4E79', background: '#FFF2CC', note: 'colour mapping: foreground blue on cream'},
  {preset: 'wdUpDiag', foreground: '#C00000', background: '#FFFFFF', note: 'colour mapping: foreground red on white'}];
const patterns = await build('rr07-patterns', {design: {fontScheme: 'roboto', dimensions: 'widescreen'},
  slides: patternSlides.map(({preset, foreground, background}) => ({design: {background: {type: 'pattern', pattern: {preset, foregroundColor: foreground, backgroundColor: background}}}}))},
index => {
  const slide = patternSlides[index], plain = index < PATTERN_PRESETS.length;
  return {preset: slide.preset, kind: plain ? 'pattern-tile' : 'pattern-colour', preview: plain ? `pattern-${pad(index + 1)}-${slide.preset}` : `pattern-colour-${pad(index + 1)}-${slide.preset}`,
    expected: {foreground: slide.foreground, background: slide.background, tile: plain ? tile(slide.preset) : undefined, note: slide.note},
    compare: plain ? ['Export the slide to PNG at 1280 x 720 as pattern-<nn>-<preset>.png and run derive-pattern-bitmaps.mjs, or compare the tile by eye with expected.tile',
      'cell size: one pattern pixel should be one 1/96 inch unit (one pixel at 1280 x 720); report the size PowerPoint draws',
      'phase: the tile is anchored at the slide top-left; report any shift'] : ['foreground and background colours match the preview PNG'],
  };
});

// ---- code
const SAMPLES = {
  python: 'def greet(name: str) -> str:\n    """Say hello."""\n    # build the message\n    return f"Hello, {name}!" if name else None\n\nclass Greeter(Base):\n    count = 0x2A + 3.5\n',
  typescript: '// load the deck\nexport async function load(path: string): Promise<Deck> {\n  const text = await readFile(path, "utf8");\n  return JSON.parse(text) as Deck;\n}\n',
  json: '{\n  "name": "opf",\n  "version": 1,\n  "tags": ["slides", true, null],\n  "nested": {"k": "v"}\n}\n',
  yaml: '# deck settings\nname: demo\nenabled: true\nretries: 3\nitems:\n  - id: 1\n    text: "quoted"\n',
  bash: '#!/bin/bash\nset -e\nNAME="$1"\nif [ -z "${NAME}" ]; then\n  echo \'usage: run <name>\' >&2\nfi\n',
  rust: 'use std::fmt;\n\n/// A point.\nstruct Point { x: i32, y: i32 }\n\nfn main() {\n    let p = Point { x: 1, y: 2 };\n    println!("{}", p.x);\n}\n',
  css: '/* card */\n.card, #hero > a {\n  color: #1f4e79;\n  margin: -2.5rem 10px !important;\n}\n',
  html: '<!-- page -->\n<div class="box" id="a">text &amp; more</div>\n',
  sql: '-- active users\nSELECT id, name FROM users WHERE age >= 18 AND name = \'x\' ORDER BY id LIMIT 10;\n',
};
const codeLanguages = Object.keys(SAMPLES);
const code = await build('rr07-code', {design: {fontScheme: 'roboto', colorScheme: 'cool-horizon'},
  slides: codeLanguages.map(language => ({code: {source: SAMPLES[language], language, filename: `sample.${language}`}}))},
index => {
  const language = codeLanguages[index], source = SAMPLES[language];
  const tokens = tokenizeCode(source, language);
  return {language, kind: 'code-syntax', preview: `code-${pad(index + 1)}-${language}`,
    expected: {panel: '#111827', plainText: '#E5E7EB', palette: codeSyntaxPaletteForScheme({primary: '#2874A6'}), tokens: tokens.map(token => ({text: source.slice(token.start, token.end), kind: token.kind})).slice(0, 24)},
    compare: ['each token kind has the colour in expected.palette (see the preview PNG); plain text stays #E5E7EB', 'the code is editable text: select a line and confirm the characters are the source exactly (tabs, spaces, quotes)', 'colours stay readable on the #111827 panel (>= 4.5:1 by construction)'],
  };
});

// ---- trend
const trendCases = [];
for (const background of ['light', 'dark']) for (const trend of ['up', 'down', 'flat']) for (const align of ['left', 'center', 'right']) trendCases.push({background, trend, align});
const trend = await build('rr07-trend', {design: {fontScheme: 'roboto'}, slides: trendCases.map(({background, trend, align}) => ({
  composition: {minFontSize: 16}, design: {contentAlignment: align, background: background === 'dark' ? '#0F172A' : '#FFFFFF', ...(background === 'dark' ? {colorScheme: {light1: '#F8FAFC', dark1: '#0F172A', accent1: '#38BDF8'}} : {colorScheme: 'cool-horizon'})},
  metric: {value: 42, unit: 'ms', label: 'Median latency', description: 'Last 30 days', delta: trend === 'up' ? '+3.2%' : trend === 'down' ? '-3.2%' : '0.0%', trend}}))},
index => {
  const {background, trend, align} = trendCases[index];
  return {kind: 'metric-trend', trend, alignment: align, background, preview: `trend-${pad(index + 1)}-${background}-${trend}-${align}`,
    expected: {arrow: {up: 'upArrow', down: 'downArrow', flat: 'rightArrow'}[trend], textColour: 'delta and trend text share the arrow colour', altText: `Trend: ${trend}`},
    compare: ['the arrow is a native shape (upArrow / downArrow / rightArrow) beside the word, on its baseline, after it for left alignment and before it for centre and right', 'the arrow, delta and trend word share one colour (up green, down red, flat neutral)', 'selecting the arrow shows the alt text; the trend word stays editable text'],
  };
});

const manifest = {
  generated: 'rr07-native-set.mjs',
  versions: {core: version('@openpresentation/opf'), renderer: version('@openpresentation/opf-render'), pptx: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version},
  slideSize: {widthInches: 13.333, heightInches: 7.5, exportPixels: '1280 x 720'},
  decisions: {
    patterns: `All ${PATTERN_PRESETS.length} ST_PresetPatternVal presets are drawn from core's 8 x 8 tiles (${PATTERN_TILE_SIZE} pixels, one pixel per 1/96 inch, anchored at the slide top-left) and exported as native a:pattFill. ECMA-376 does not define the pixels: the tiles are measured from desktop PowerPoint (Office 365, Windows, 2026-10-01); rerunning this set and derive-pattern-bitmaps.mjs re-verifies them.`,
    code: 'Token colours come from the deck theme (keyword = primary, string = accent, number = secondary; comment, function, type, property fixed slate, blue, cyan, pink), each lightened until it is >= 4.5:1 on the #111827 code panel. Languages are tokenized by a small deterministic scanner; an unknown language stays plain. The export writes the same colours as native runs in the same text boxes (one per source line).',
    trend: 'A trend draws one arrow (preset upArrow / downArrow / rightArrow) beside the trend word, in green (up), red (down) or a neutral (flat), kept >= 4.5:1 on the slide background; the delta text takes the same colour and the arrow carries "Trend: <direction>" as alt text. The colour is the usual rising/falling convention, not a verdict.',
  },
  decks: [patterns, code, trend],
  deriveTiles: 'Export the rr07-patterns.pptx slides to PNG at 1280 x 720 named pattern-<nn>-<preset>.png, then: node scripts/derive-pattern-bitmaps.mjs <dir> --json derived.json (in opf-render). It prints each measured tile, its confidence and whether it equals core\'s tile.',
};
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`RR-07 native set: ${patterns.slides.length} pattern, ${code.slides.length} code and ${trend.slides.length} trend slides written to ${outDir}`);
