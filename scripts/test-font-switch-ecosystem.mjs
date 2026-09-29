// FF-09 offline font-switch matrix (font-fidelity-everywhere).
//
// A seeded pairwise covering array over the 14 gallery dimensions, plus fixed
// must-have cases, is switched A -> B -> A. Every state is rendered by the
// coordinated opf-render preview and exported by opf-pptx, then checked:
//   1. the FF-08 typeface inventory (`checkPptxTypefaces`) passes and the fonts
//      the package lists equal the fonts the document chose;
//   2. the PPTX is structurally valid (all parts, nested workbooks included);
//   3. the preview re-rendered with the chosen fonts (every substitution the
//      pinned registry made is recorded and asserted);
//   4. the export re-imports as a valid OPF with the same slide count.
// Switching back must reproduce state A byte for byte. No browser, Office/COM,
// system font or network is used.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';
import {createScriptTextMeasurement, detectScripts, designatedFamilies} from '../../opf-render/dist/fonts.js';
import {renderSvgDeck} from '../../opf-render/dist/index.js';
import {checkPptxTypefaces, fromPptx, toPptx} from '../../opf-pptx/dist/index.js';
import {createEditorSession} from '../../opf-editor/dist/index.js';
import {catalogs} from '@openpresentation/opf/catalogs';
import {resolveFontFamilies, resolveFontSchemeReference} from '@openpresentation/opf/composition';
import {resolveScriptFonts, validatePresentation} from '@openpresentation/opf';

const started = Date.now();
const MAX_SECONDS = 300;
const require = createRequire(new URL('../../opf-pptx/package.json', import.meta.url));
const {strToU8, unzipSync, zipSync} = require('fflate');
const {XMLValidator} = require('fast-xml-parser');
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Pinned preview registry. Substitution is `visual`, so a chosen Office font
// draws with an open replacement; the PPTX keeps the chosen name (FF-31). Every
// substitution a state triggers must appear here, exactly.
// ---------------------------------------------------------------------------
const {registry} = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'all'});
const EXPECTED_SUBSTITUTIONS = Object.freeze({
  'Aptos Display': 'Carlito', Aptos: 'Roboto', Calibri: 'Carlito', Georgia: 'Gelasio', Consolas: 'Cousine', 'Courier New': 'Cousine',
  Meiryo: 'Noto Sans JP', 'Yu Gothic': 'Noto Sans JP', 'Microsoft YaHei': 'Noto Sans SC', 'Malgun Gothic': 'Noto Sans KR',
  Mangal: 'Noto Sans Devanagari', 'Arabic Typesetting': 'Noto Naskh Arabic', David: 'Noto Serif Hebrew', 'Angsana New': 'Noto Sans Thai',
  Tahoma: 'Arimo', Verdana: 'Arimo', 'Times New Roman': 'Tinos', Garamond: 'Tinos', Constantia: 'Caladea',
  'Tenorite Display': 'Roboto', Tenorite: 'Roboto', 'Seaford Display': 'Carlito', Seaford: 'Carlito', Impact: 'Carlito', Grandview: 'Roboto'
});
const substitutionLog = new Map();

// ---------------------------------------------------------------------------
// The 14 gallery dimensions and their value classes.
// ---------------------------------------------------------------------------
const TEXT = {
  english: {title: 'Quarterly review', subtitle: 'Results and next steps', body: 'Revenue grew while costs stayed flat across every region', items: ['Revenue up', 'Costs flat', 'Margin improved'], cells: ['Region', 'Result', 'North', 'Up']},
  japanese: {title: '四半期レビュー', subtitle: '結果と次のステップ', body: '売上は伸び、コストは横ばいでした', items: ['売上増加', 'コスト横ばい', '利益率向上'], cells: ['地域', '結果', '北部', '増加']},
  'chinese-simplified': {title: '季度回顾', subtitle: '成果与后续步骤', body: '收入增长而成本保持不变', items: ['收入增加', '成本持平', '利润改善'], cells: ['地区', '结果', '北部', '增长']},
  arabic: {title: 'مراجعة ربع سنوية', subtitle: 'النتائج والخطوات التالية', body: 'ارتفعت الإيرادات بينما بقيت التكاليف ثابتة', items: ['ارتفاع الإيرادات', 'ثبات التكاليف', 'تحسن الهامش'], cells: ['المنطقة', 'النتيجة', 'الشمال', 'ارتفاع']},
  hebrew: {title: 'סקירה רבעונית', subtitle: 'תוצאות והצעדים הבאים', body: 'ההכנסות עלו בעוד העלויות נשארו יציבות', items: ['עליית הכנסות', 'עלויות יציבות', 'שיפור ברווחיות'], cells: ['אזור', 'תוצאה', 'צפון', 'עלייה']},
  hindi: {title: 'त्रैमासिक समीक्षा', subtitle: 'परिणाम और अगले कदम', body: 'राजस्व बढ़ा जबकि लागत स्थिर रही', items: ['राजस्व में वृद्धि', 'लागत स्थिर', 'मार्जिन बेहतर'], cells: ['क्षेत्र', 'परिणाम', 'उत्तर', 'वृद्धि']},
  thai: {title: 'ทบทวนรายไตรมาส', subtitle: 'ผลลัพธ์และขั้นตอนต่อไป', body: 'รายได้เพิ่มขึ้นขณะที่ต้นทุนคงที่', items: ['รายได้เพิ่มขึ้น', 'ต้นทุนคงที่', 'อัตรากำไรดีขึ้น'], cells: ['ภูมิภาค', 'ผลลัพธ์', 'เหนือ', 'เพิ่มขึ้น']}
};
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNgGAWjYBSMglEAAAQAAAEXrdKAAAAAAElFTkSuQmCC';
const CHART_DATA = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 4, 6], ['Q2', 7, 5], ['Q3', 9, 8]]};
const CODE = 'const score = urgency * confidence;\nreturn score > 0.5;';

// Representative font schemes per class, and alternates the B state draws from.
const SCHEME_CLASSES = [
  {id: 'latin-sans', value: 'calibri', alternates: ['tahoma', 'aptos', 'verdana']},
  {id: 'latin-serif', value: 'georgia', alternates: ['times-new-roman', 'garamond', 'constantia']},
  {id: 'monospace', value: 'consolas', alternates: ['courier-new']},
  {id: 'google-open', value: 'roboto', alternates: ['noto-sans']},
  {id: 'east-asian', value: 'meiryo', alternates: ['yu-gothic', 'microsoft-yahei', 'malgun-gothic']},
  {id: 'complex-script', value: 'mangal', alternates: ['arabic-typesetting', 'david', 'angsana-new']}
];
const contentBlocks = {
  bullets: (text) => ({layout: 'list-1x', blocks: [{bullets: text.items}]}),
  cards: (text) => ({layout: 'number-2x', design: {contentBox: true}, blocks: [{metric: {value: 42, unit: '%', label: text.items[0]}}, {metric: {value: 7, label: text.items[1], delta: '+2'}}]}),
  table: (text) => ({layout: 'table-1x', table: {columns: [text.cells[0], text.cells[1]], rows: [[text.cells[2], text.cells[3]], [text.cells[3], text.cells[2]]]}, text: text.body}),
  timeline: (text) => ({layout: 'timeline-1x', timeline: {events: [{when: 'Q1', what: text.items[0]}, {when: 'Q2', what: text.items[1]}, {when: 'Q3', what: text.items[2]}]}}),
  metric: (text) => ({layout: 'number-1x', metric: {value: 128, unit: 'ms', label: text.items[0], description: text.body, delta: '+4', trend: 'up'}}),
  quote: (text) => ({layout: 'quote-1x', quote: {text: text.body, attribution: text.cells[0], source: text.cells[1]}}),
  code: (text) => ({layout: 'code-1x', code: {source: CODE, language: 'ts'}, text: text.body}),
  chart: (text) => ({layout: 'chart-1x', chart: {type: 'column', data: CHART_DATA}, text: text.body}),
  text: (text) => ({layout: 'text-1x', text: [text.body, text.body].join(' ')})
};
const LAYOUTS = {
  'title-subtitle': (text) => ({subtitle: text.subtitle}),
  'text-1x': (text) => ({text: text.body}),
  'text-2x': (text) => ({blocks: [{text: text.body}, {text: text.subtitle}]}),
  'list-3x': (text) => ({blocks: [{bullets: [text.items[0]]}, {bullets: [text.items[1]]}, {bullets: [text.items[2]]}]}),
  'number-2x': (text) => ({blocks: [{metric: {value: 12, label: text.items[0]}}, {metric: {value: 34, label: text.items[1]}}]}),
  blank: (text) => ({text: text.body})
};
const FOOTERS = {
  off: () => ({header: false, footer: false}),
  number: () => ({footer: {right: {slideNumber: true}}}),
  date: () => ({footer: {left: {date: '2026-09-29', dateFormat: 'yyyy-MM-dd'}}}),
  text: () => ({footer: {center: {text: 'Confidential'}}})
};
const BACKGROUNDS = {
  solid: () => ({background: '#12355B'}),
  gradient: () => ({background: {type: 'gradient', gradient: {angle: 90, stops: [{color: '#12355B', position: 0}, {color: '#7FB2E5', position: 1}]}}})
};
const DIMENSIONS = [
  {id: 'fontScheme', levels: SCHEME_CLASSES.map((entry) => entry.id)},
  {id: 'theme', levels: ['minimal', 'classic', 'dark', 'bold']},
  {id: 'language', levels: Object.keys(TEXT)},
  {id: 'layout', levels: Object.keys(LAYOUTS)},
  {id: 'block', levels: ['bullets', 'cards', 'table', 'timeline', 'metric', 'quote', 'code', 'chart']},
  {id: 'chart', levels: ['bar', 'pie', 'line', 'scatter']},
  {id: 'headerFooter', levels: Object.keys(FOOTERS)},
  {id: 'colorScheme', levels: ['cool-horizon', 'burnt-orange']},
  {id: 'background', levels: Object.keys(BACKGROUNDS)},
  {id: 'image', levels: ['none', 'slide-image']},
  {id: 'narrative', levels: ['problem-solution', 'scqa']},
  {id: 'tone', levels: ['formal', 'casual']},
  {id: 'audience', levels: ['executives', 'investors']},
  {id: 'socials', levels: ['none', 'profiles']}
];
assert.equal(DIMENSIONS.length, 14, 'the matrix covers the 14 gallery dimensions');

// ---------------------------------------------------------------------------
// Seeded pairwise covering array (AETG-style greedy, best of several restarts).
// ---------------------------------------------------------------------------
const SEED = 0x0f0d9;
const RESTARTS = 24;
const CANDIDATES = 24;
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pairKey(a, i, b, j) {
  return `${a}:${i}|${b}:${j}`;
}
function allPairs(sizes) {
  const pairs = new Set();
  for (let a = 0; a < sizes.length; a++) for (let b = a + 1; b < sizes.length; b++) for (let i = 0; i < sizes[a]; i++) for (let j = 0; j < sizes[b]; j++) pairs.add(pairKey(a, i, b, j));
  return pairs;
}
function coveringArray(sizes, seed) {
  const random = mulberry32(seed);
  const uncovered = allPairs(sizes);
  let pending = [...uncovered];
  const rows = [];
  const gain = (row, factor, level) => {
    let count = 0;
    for (let other = 0; other < sizes.length; other++) {
      if (other === factor || row[other] === -1) continue;
      const key = other < factor ? pairKey(other, row[other], factor, level) : pairKey(factor, level, other, row[other]);
      if (uncovered.has(key)) count++;
    }
    return count;
  };
  while (uncovered.size) {
    let best = null;
    let bestGain = -1;
    for (let attempt = 0; attempt < CANDIDATES; attempt++) {
      const row = sizes.map(() => -1);
      // Seed the candidate with a level of an uncovered pair, then fill greedily in random factor order.
      const seedKey = pending[Math.floor(random() * pending.length)];
      const [first, second] = seedKey.split('|').map((part) => part.split(':').map(Number));
      row[first[0]] = first[1];
      row[second[0]] = second[1];
      const order = sizes.map((_, factor) => factor).filter((factor) => row[factor] === -1);
      for (let index = order.length - 1; index > 0; index--) {
        const swap = Math.floor(random() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
      for (const factor of order) {
        let bestLevels = [];
        let most = -1;
        for (let level = 0; level < sizes[factor]; level++) {
          const g = gain(row, factor, level);
          if (g > most) {
            most = g;
            bestLevels = [level];
          } else if (g === most) bestLevels.push(level);
        }
        row[factor] = bestLevels[Math.floor(random() * bestLevels.length)];
      }
      let total = 0;
      for (let a = 0; a < sizes.length; a++) for (let b = a + 1; b < sizes.length; b++) if (uncovered.has(pairKey(a, row[a], b, row[b]))) total++;
      if (total > bestGain) {
        bestGain = total;
        best = row;
      }
    }
    rows.push(best);
    for (let a = 0; a < sizes.length; a++) for (let b = a + 1; b < sizes.length; b++) uncovered.delete(pairKey(a, best[a], b, best[b]));
    pending = pending.filter((key) => uncovered.has(key));
  }
  return rows;
}
function assertPairwise(rows, sizes) {
  const missing = allPairs(sizes);
  for (const row of rows) for (let a = 0; a < sizes.length; a++) for (let b = a + 1; b < sizes.length; b++) missing.delete(pairKey(a, row[a], b, row[b]));
  assert.equal(missing.size, 0, `${missing.size} value-class pairs are not covered`);
}
function generateMatrix() {
  const sizes = DIMENSIONS.map((dimension) => dimension.levels.length);
  let best = null;
  let bestSeed = SEED;
  for (let restart = 0; restart < RESTARTS; restart++) {
    const rows = coveringArray(sizes, SEED + restart);
    if (best === null || rows.length < best.length) {
      best = rows;
      bestSeed = SEED + restart;
    }
  }
  assertPairwise(best, sizes);
  return {sizes, seed: bestSeed, rows: best.map((row) => Object.fromEntries(DIMENSIONS.map((dimension, index) => [dimension.id, dimension.levels[row[index]]])))};
}

// ---------------------------------------------------------------------------
// Deck construction.
// ---------------------------------------------------------------------------
function buildDeck(id, levels, fontScheme) {
  const text = TEXT[levels.language];
  const design = {
    theme: levels.theme,
    fontScheme,
    colorScheme: levels.colorScheme,
    ...BACKGROUNDS[levels.background](),
    ...FOOTERS[levels.headerFooter](),
    ...(levels.image === 'slide-image' ? {slideImage: {src: 'asset:hero', position: 'right', size: 0.3, fill: 'crop', alt: 'Illustration'}} : {})
  };
  if (levels.socials === 'profiles') design.header = {right: {socials: true}};
  const blockSlide = {id: 'block', title: text.title, notes: text.body, ...contentBlocks[levels.block](text)};
  const deck = {
    name: `Font switch matrix ${id}`,
    language: levels.language,
    narrative: levels.narrative,
    tone: levels.tone,
    audience: [levels.audience],
    design,
    assets: {hero: {src: PIXEL, alt: 'Illustration'}},
    slides: [
      {id: 'layout', layout: levels.layout, title: text.title, ...LAYOUTS[levels.layout](text)},
      blockSlide,
      {id: 'chart', layout: 'chart-1x', title: text.title, chart: {type: levels.chart, data: CHART_DATA}, text: text.body}
    ],
  };
  if (levels.socials === 'profiles') {
    deck.organization = {id: 'acme', name: 'Acme', socials: {linkedin: 'https://linkedin.com/company/acme', x: '@acme'}};
    deck.speaker = {id: 'ava', name: 'Ava Chen', socials: {linkedin: 'https://linkedin.com/in/ava-chen', github: 'avachen'}};
  }
  return deck;
}

// ---------------------------------------------------------------------------
// Chosen fonts: what the document's design selects, resolved from the catalogs.
// ---------------------------------------------------------------------------
const record = (kind, id, presentation) => [...(presentation.catalogs?.[kind]?.records ?? []), ...catalogs[kind]].find((entry) => entry.id === id);
const referenceId = (reference) => (typeof reference === 'string' ? reference : reference?.id);
function schemeOf(presentation, design) {
  const theme = record('themes', referenceId(design.theme) ?? 'minimal', presentation);
  const reference = design.fontScheme ?? theme?.fontScheme;
  return resolveFontSchemeReference(reference, (id) => record('fontSchemes', id, presentation)).scheme;
}
const runFamilies = (value) => (!value || typeof value !== 'object' ? [] : Object.entries(value).flatMap(([key, child]) => (key === 'fontFamily' && typeof child === 'string' ? [child] : runFamilies(child))));
const hasCode = (slide) => Boolean(slide.code) || (slide.blocks ?? []).some((block) => block.code);
function chosenFonts(presentation) {
  const chosen = new Set();
  const used = new Set();
  const monospace = new Set();
  const roles = [];
  for (const [index, slide] of [undefined, ...presentation.slides].entries()) {
    const design = {...presentation.design, ...slide?.design};
    const scheme = schemeOf(presentation, design);
    const families = resolveFontFamilies(scheme);
    roles.push({slide: index - 1, families, scheme});
    for (const family of Object.values(families)) chosen.add(family);
    monospace.add(families.code);
    if (scheme.type === 'monospace') for (const family of [scheme.major, scheme.minor]) monospace.add(family);
    // The theme carries the deck's heading and body; a slide adds its own roles, and code only when it has code.
    used.add(families.heading);
    used.add(families.body);
    if (slide && hasCode(slide)) used.add(families.code);
  }
  for (const slideIndex of [undefined, ...presentation.slides.keys()]) {
    const resolved = resolveScriptFonts(presentation, slideIndex === undefined ? {} : {slideIndex});
    const slots = [resolved.heading, resolved.body].flatMap((slot) => [slot.latin, slot.eastAsian, slot.complexScript]);
    const supplement = resolved.supplement ? [resolved.supplement.heading, resolved.supplement.body] : [];
    for (const font of [...slots, ...supplement].filter(Boolean)) {
      chosen.add(font);
      // A per-script supplement is a chosen font but not a font in use (PowerPoint lists only the theme and run fonts).
      if (slots.includes(font)) used.add(font);
    }
  }
  for (const family of runFamilies(presentation.slides)) {
    chosen.add(family);
    used.add(family);
  }
  return {chosen: [...chosen], used: [...used].sort(compareNames), monospace: [...monospace], roles, selectors: weightSelectors([...chosen])};
}
// The renderer's bundled Roboto ships static Medium, SemiBold and ExtraBold files, and the exporter names those physical
// faces (renderer 0.8.0 fontFace metadata). They belong to the chosen family but are separate names in the package, so a
// package check that admits only the author's family names would flag them; they are enumerated here instead.
const WEIGHT_SELECTOR = /^(.+) (Thin|Light|Medium|SemiBold|ExtraBold|Black)$/;
const weightSelectors = (chosen) => [...new Set(registry.describeFaces().map((face) => face.family))].filter((family) => chosen.includes(WEIGHT_SELECTOR.exec(family)?.[1]));
const compareNames = (a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------------------
// Package structure: every part well formed, content types and relationships
// resolve, nested packages (chart workbooks) included. This is a structural
// check, not the OpenXML SDK validator or native PowerPoint.
// ---------------------------------------------------------------------------
function packageProblems(entries, prefix = '') {
  const problems = [];
  const names = Object.keys(entries);
  const contentTypes = entries['[Content_Types].xml'] ? decoder.decode(entries['[Content_Types].xml']) : '';
  if (!contentTypes) problems.push(`${prefix}[Content_Types].xml missing`);
  const defaults = new Set([...contentTypes.matchAll(/<Default\b[^>]*\bExtension="([^"]+)"/g)].map((match) => match[1].toLowerCase()));
  const overrides = new Set([...contentTypes.matchAll(/<Override\b[^>]*\bPartName="([^"]+)"/g)].map((match) => match[1]));
  for (const override of overrides) if (!entries[override.slice(1)]) problems.push(`${prefix}content type override without part ${override}`);
  for (const name of names) {
    if (name === '[Content_Types].xml' || name.endsWith('/')) continue;
    const extension = name.split('.').pop().toLowerCase();
    if (!overrides.has(`/${name}`) && !defaults.has(extension)) problems.push(`${prefix}${name} has no content type`);
    if (/\.(xml|rels)$/i.test(name)) {
      const valid = XMLValidator.validate(decoder.decode(entries[name]));
      if (valid !== true) problems.push(`${prefix}${name} is not well formed: ${valid.err?.msg}`);
    }
    if (/\.(xlsx|docx|pptx)$/i.test(name)) problems.push(...packageProblems(unzipSync(entries[name]), `${prefix}${name}!/`));
  }
  for (const part of names.filter((name) => name.endsWith('.rels'))) {
    const base = part === '_rels/.rels' ? '' : part.replace(/_rels\/[^/]+$/, '');
    const ids = new Set();
    for (const [, attributes] of decoder.decode(entries[part]).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const id = /\bId="([^"]*)"/.exec(attributes)?.[1];
      if (ids.has(id)) problems.push(`${prefix}${part} repeats relationship ${id}`);
      ids.add(id);
      if (/\bTargetMode="External"/.test(attributes)) continue;
      const target = decodeURIComponent((/\bTarget="([^"]*)"/.exec(attributes)?.[1] ?? '').split('#')[0]);
      const resolved = new URL(target.startsWith('/') ? target : `/${base}${target}`, 'http://opc.invalid/').pathname.slice(1);
      if (!entries[resolved]) problems.push(`${prefix}${part} targets missing part ${resolved}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// One state: render, export, check.
// ---------------------------------------------------------------------------
const GENERIC = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
const svgFamilies = (svgs) => [...new Set(svgs.flatMap((svg) => [...svg.matchAll(/font-family="([^"]*)"/g)].flatMap((match) => match[1].split(',').map((family) => family.trim().replace(/^&quot;|&quot;$|^["']|["']$/g, '')))))].filter((family) => family && !GENERIC.has(family)).sort(compareNames);
const textOf = (value) => (typeof value === 'string' ? value : Array.isArray(value) ? value.map(textOf).join(' ') : value && typeof value === 'object' ? Object.values(value).map(textOf).join(' ') : '');
const engineOptions = (presentation) => ({textMeasurement: createScriptTextMeasurement(registry.textMeasurement, resolveScriptFonts(presentation))});
// Every face the preview may draw for a chosen family: its own weights, or the pinned registry's replacement.
const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];
function previewFaces(family) {
  const faces = new Set();
  for (const fontWeight of WEIGHTS) {
    for (const italic of [false, true]) {
      try {
        faces.add(registry.resolveFont({fontFamily: family, fontWeight, italic}).resolvedFamily);
      } catch (error) {
        // Not every family ships every style (Roboto Mono has no italic).
        if (error.code !== 'font-style-unavailable') throw error;
      }
    }
  }
  return faces;
}
const CJK = ['Jpan', 'Hans', 'Hant', 'Kore'];
const stateReports = [];
const overlaps = (faces, drawn) => drawn.some((family) => faces.has(family));

async function verifyState(label, presentation) {
  const document = structuredClone(presentation);
  assert.equal(validatePresentation(document).valid, true, `${label}: valid OPF`);
  const fonts = chosenFonts(document);
  const measured = engineOptions(document);

  // Preview, with every substitution the pinned registry makes recorded and asserted.
  registry.clearSubstitutions();
  const diagnostics = [];
  const svgs = renderSvgDeck(document, {...measured, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)});
  assert.deepEqual(diagnostics, [], `${label}: preview diagnostics`);
  assert.equal(svgs.length, document.slides.length, `${label}: one preview per slide`);
  const drawn = svgFamilies(svgs);
  const made = registry.substitutions.map((entry) => ({requested: entry.requestedFamily, resolved: entry.resolvedFamily, compatibility: entry.compatibility, substitute: entry.substitute}));
  const substitutions = [...new Map(made.filter((entry) => entry.substitute).map((entry) => [`${entry.requested}>${entry.resolved}`, entry])).values()];
  for (const entry of made.filter((candidate) => !candidate.substitute)) {
    // A face of the requested family (Roboto Medium is Roboto, Noto Sans Thai is itself) is not a substitute.
    assert.ok(entry.resolved.startsWith(entry.requested), `${label}: ${entry.requested} resolved to ${entry.resolved} without being flagged as a substitute`);
  }
  for (const entry of substitutions) {
    assert.equal(EXPECTED_SUBSTITUTIONS[entry.requested], entry.resolved, `${label}: unexpected substitution ${entry.requested} -> ${entry.resolved}`);
    assert.ok(fonts.chosen.includes(entry.requested), `${label}: substituted ${entry.requested}, which the document did not choose`);
    substitutionLog.set(`${entry.requested}>${entry.resolved}`, entry.compatibility);
  }
  // The preview draws the resolved faces of the chosen fonts, plus the designated face of any other script in its text.
  const profile = resolveScriptFonts(document);
  const scripts = detectScripts(textOf(document.slides), profile);
  // Han text can draw with any CJK face: the deck language, not the text, decides between Simplified, Japanese and the others.
  const drawnScripts = scripts.some((script) => CJK.includes(script)) ? [...new Set([...scripts, ...CJK])] : scripts;
  const scriptFaces = new Set(drawnScripts.flatMap((script) => [...designatedFamilies(script, false), ...designatedFamilies(script, true)]));
  const chosenFaces = new Set(fonts.chosen.flatMap((family) => [...previewFaces(family)]));
  for (const family of drawn) assert.ok(chosenFaces.has(family) || scriptFaces.has(family), `${label}: preview drew ${family}, which no chosen font resolves to`);
  const roles = fonts.roles[0].families;
  assert.ok(overlaps(previewFaces(roles.body), drawn), `${label}: preview draws the body font ${roles.body}`);
  if (profile.script === 'Latn') assert.ok(overlaps(previewFaces(roles.heading), drawn), `${label}: preview draws the heading font ${roles.heading}`);

  // Export, FF-08 typeface inventory, package structure and re-import.
  const bytes = await toPptx(document, measured);
  const check = checkPptxTypefaces(bytes, {fonts: [...fonts.chosen, ...fonts.selectors], monospace: fonts.monospace});
  assert.deepEqual(check.violations, [], `${label}: typeface inventory`);
  assert.deepEqual(check.fontsUsed.filter((family) => !fonts.selectors.includes(family)), fonts.used, `${label}: exported fonts equal the chosen fonts`);
  const entries = unzipSync(bytes);
  assert.deepEqual(packageProblems(entries), [], `${label}: package structure`);
  const slideParts = Object.keys(entries).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slideParts.length, document.slides.length, `${label}: one slide part per slide`);
  const reimported = await fromPptx(bytes);
  assert.equal(reimported.slides.length, document.slides.length, `${label}: re-import keeps every slide`);
  assert.equal(validatePresentation(reimported).valid, true, `${label}: re-imported OPF validates`);

  stateReports.push({label, chosen: [...fonts.chosen].sort(compareNames), exported: check.fontsUsed, weightSelectors: check.fontsUsed.filter((family) => fonts.selectors.includes(family)), preview: drawn, scripts, substitutions: substitutions.map((entry) => `${entry.requested}>${entry.resolved}`)});
  return {bytes: new Uint8Array(bytes), svgs, drawn, fonts, faces: [...chosenFaces].sort(compareNames).join('|')};
}

// ---------------------------------------------------------------------------
// Switching: an editor session applies the switch, the deck is verified in each
// state, and going back must reproduce the first state exactly.
// ---------------------------------------------------------------------------
async function runSwitch(name, deck, steps) {
  const editor = createEditorSession(deck, {rejectInvalid: true});
  const original = structuredClone(deck);
  const first = await verifyState(`${name} A`, editor.document);
  let previous = first;
  const visited = [first];
  for (const [index, step] of steps.entries()) {
    step.apply(editor);
    const next = await verifyState(`${name} ${step.label}`, editor.document);
    assert.notEqual(Buffer.compare(next.bytes, previous.bytes), 0, `${name} ${step.label}: the export changed`);
    // The preview draws the registry's replacement, so two chosen fonts that share one (Tahoma and Verdana) preview alike.
    if (step.payload || next.faces !== previous.faces) assert.notDeepEqual(next.svgs, previous.svgs, `${name} ${step.label}: the preview re-rendered`);
    if (step.expectDrawn) for (const family of step.expectDrawn) assert.ok(next.drawn.includes(family), `${name} ${step.label}: preview draws ${family} (${next.drawn})`);
    if (step.expectAbsent) for (const family of step.expectAbsent) assert.ok(!next.drawn.includes(family), `${name} ${step.label}: preview no longer draws ${family} (${next.drawn})`);
    if (step.expectUsed) for (const family of step.expectUsed) assert.ok(next.fonts.used.includes(family), `${name} ${step.label}: the package uses ${family}`);
    if (step.expectUnused) for (const family of step.expectUnused) assert.ok(!next.fonts.used.includes(family), `${name} ${step.label}: the package no longer uses ${family}`);
    if (index === steps.length - 1 && step.returnsToStart) {
      assert.deepEqual(editor.document, original, `${name}: switching back restores the document`);
      assert.equal(Buffer.compare(next.bytes, first.bytes), 0, `${name}: switching back restores the PPTX bytes`);
      assert.deepEqual(next.svgs, first.svgs, `${name}: switching back restores the preview`);
    }
    previous = next;
    visited.push(next);
  }
  // The editor's history returns to the original document too.
  while (editor.canUndo) editor.undo();
  assert.deepEqual(editor.document, original, `${name}: undo restores the document`);
  return visited;
}
const setScheme = (path, id) => (editor) => editor.setCatalog(path, 'fontSchemes', id);
const setTheme = (id) => (editor) => editor.setCatalog('design.theme', 'themes', id);
const setLanguage = (id) => (editor) => editor.setCatalog('language', 'languages', id);
const replaceSlide = (index, slide) => (editor) => editor.applyPatch([{op: 'replace', path: `/slides/${index}`, value: structuredClone(slide)}]);

// ---------------------------------------------------------------------------
// Pairwise decks.
// ---------------------------------------------------------------------------
const generationStarted = Date.now();
const matrix = generateMatrix();
const generationMilliseconds = Date.now() - generationStarted;
console.log(`Pairwise covering array: ${matrix.rows.length} decks over ${DIMENSIONS.length} dimensions (${matrix.sizes.join('x')}), seed ${matrix.seed}, every value-class pair covered (generated in ${generationMilliseconds} ms).`);
if (process.argv.includes('--plan')) process.exit(0);
assert.ok(matrix.rows.length >= 50 && matrix.rows.length <= 66, `the covering array has ${matrix.rows.length} decks`);
for (const dimension of DIMENSIONS) {
  const seen = new Set(matrix.rows.map((row) => row[dimension.id]));
  assert.deepEqual([...seen].sort(), [...dimension.levels].sort(), `${dimension.id}: every value class appears`);
}

let switches = 0;
for (const [index, levels] of matrix.rows.entries()) {
  const name = `pairwise-${String(index + 1).padStart(2, '0')}`;
  const schemeIndex = SCHEME_CLASSES.findIndex((entry) => entry.id === levels.fontScheme);
  const from = SCHEME_CLASSES[schemeIndex];
  // B comes from a different class; the alternate rotates so the sample covers more catalog records.
  const target = SCHEME_CLASSES[(schemeIndex + 1 + (index % (SCHEME_CLASSES.length - 1))) % SCHEME_CLASSES.length];
  const to = target.alternates[index % target.alternates.length];
  const deck = buildDeck(name, levels, from.value);
  await runSwitch(name, deck, [
    {label: `B (${to})`, apply: setScheme('design.fontScheme', to)},
    {label: 'A again', apply: setScheme('design.fontScheme', from.value), returnsToStart: true}
  ]);
  switches++;
}

// ---------------------------------------------------------------------------
// Fixed must-have cases.
// ---------------------------------------------------------------------------
const PROPORTIONAL = 'calibri';
const MONO = 'consolas';
// Every content type, proportional to monospace and back.
for (const type of Object.keys(contentBlocks)) {
  const text = TEXT.english;
  const deck = {name: `content ${type}`, language: 'english', design: {theme: 'minimal', fontScheme: PROPORTIONAL}, slides: [{id: type, title: text.title, notes: text.body, ...contentBlocks[type](text)}]};
  await runSwitch(`content-${type}`, deck, [
    {label: 'monospace', apply: setScheme('design.fontScheme', MONO), expectDrawn: ['Cousine'], expectAbsent: ['Carlito']},
    {label: 'proportional again', apply: setScheme('design.fontScheme', PROPORTIONAL), expectDrawn: ['Carlito'], expectAbsent: ['Cousine'], returnsToStart: true}
  ]);
  switches++;
}
// Content-type changes are block replacements (no conversion API exists): the fonts stay while the payload changes.
for (const scheme of [PROPORTIONAL, MONO]) {
  const text = TEXT.english;
  const slideFor = (type) => ({id: 'swap', title: text.title, notes: text.body, ...contentBlocks[type](text)});
  const order = Object.keys(contentBlocks);
  const deck = {name: `replace ${scheme}`, language: 'english', design: {theme: 'minimal', fontScheme: scheme}, slides: [slideFor(order[0])]};
  const steps = order.slice(1).map((type) => ({label: `replace with ${type}`, apply: replaceSlide(0, slideFor(type)), payload: true}));
  steps.push({label: `replace back with ${order[0]}`, apply: replaceSlide(0, slideFor(order[0])), payload: true, returnsToStart: true});
  await runSwitch(`replace-${scheme}`, deck, steps);
  switches++;
}
// Per-slide font override: the deck scheme and the slide's own scheme switch independently.
{
  const text = TEXT.english;
  const deck = {
    name: 'per-slide override', language: 'english', design: {theme: 'minimal', fontScheme: 'calibri'},
    slides: [
      {id: 'deck', title: text.title, notes: text.body, bullets: text.items},
      {id: 'override', title: text.title, notes: text.body, design: {fontScheme: 'georgia'}, layout: 'code-1x', code: {source: CODE, language: 'ts'}, text: text.body},
      {id: 'deck-again', title: text.title, text: text.body}
    ]
  };
  await runSwitch('per-slide-deck-scheme', deck, [
    {label: 'deck to verdana', apply: setScheme('design.fontScheme', 'verdana'), expectUsed: ['Verdana', 'Georgia'], expectUnused: ['Calibri']},
    {label: 'deck back to calibri', apply: setScheme('design.fontScheme', 'calibri'), expectUsed: ['Calibri', 'Georgia'], returnsToStart: true}
  ]);
  await runSwitch('per-slide-override-scheme', deck, [
    {label: 'override to times-new-roman', apply: setScheme('slides.1.design.fontScheme', 'times-new-roman'), expectUsed: ['Times New Roman', 'Calibri'], expectUnused: ['Georgia']},
    {label: 'override back to georgia', apply: setScheme('slides.1.design.fontScheme', 'georgia'), returnsToStart: true}
  ]);
  // The override reaches the slide that chose it and no other slide.
  const exported = unzipSync(await toPptx(deck, engineOptions(deck)));
  const faces = (part) => new Set([...decoder.decode(exported[part]).matchAll(/typeface="([^"+][^"]*)"/g)].map((match) => match[1]));
  assert.ok(faces('ppt/slides/slide2.xml').has('Georgia'), 'the overriding slide names its scheme');
  assert.ok(!faces('ppt/slides/slide1.xml').has('Georgia') && !faces('ppt/slides/slide3.xml').has('Georgia'), 'other slides do not name the override');
  switches += 2;
}
// An object font scheme keeps its overrides while the catalog id switches.
{
  const text = TEXT.english;
  const deck = {
    name: 'scheme overrides', language: 'english', design: {theme: 'minimal', fontScheme: {id: 'calibri', heading: {family: 'Georgia'}, code: {family: 'Courier New'}}},
    slides: [{id: 'a', title: text.title, notes: text.body, bullets: text.items}, {id: 'b', title: text.title, layout: 'code-1x', code: {source: CODE, language: 'ts'}, text: text.body}]
  };
  await runSwitch('scheme-overrides', deck, [
    {label: 'id to verdana', apply: setScheme('design.fontScheme', 'verdana'), expectUsed: ['Georgia', 'Verdana', 'Courier New'], expectUnused: ['Calibri']},
    {label: 'id back to calibri', apply: setScheme('design.fontScheme', 'calibri'), returnsToStart: true}
  ]);
  switches++;
}
// CJK text inside a Latin deck: the preview draws it with a designated script face; the PPTX names only the chosen families.
{
  const mixed = 'Revenue 収益 增长 grew across every region';
  const korean = 'Growth 성장 across regions';
  const deck = {
    name: 'CJK in Latin', language: 'english', design: {theme: 'minimal', fontScheme: 'calibri'},
    slides: [{id: 'mixed', title: mixed, notes: mixed, bullets: [mixed, korean, 'Plain Latin point'], text: mixed}]
  };
  const states = await runSwitch('cjk-in-latin', deck, [
    {label: 'georgia', apply: setScheme('design.fontScheme', 'georgia'), expectDrawn: ['Gelasio'], expectAbsent: ['Carlito']},
    {label: 'calibri again', apply: setScheme('design.fontScheme', 'calibri'), expectDrawn: ['Carlito'], returnsToStart: true}
  ]);
  for (const state of states) {
    assert.ok(state.drawn.some((family) => /^Noto Sans (JP|SC|TC|KR)$/.test(family)), 'the preview draws the CJK runs with a designated script face');
    assert.ok(!state.fonts.chosen.some((family) => /^Noto /.test(family)), 'a designated preview face is not a chosen font');
  }
  switches++;
}
// Indirect switches: theme (through its bundled scheme) and language (through script slots).
{
  const text = TEXT.english;
  const deck = {name: 'theme switch', language: 'english', design: {theme: 'minimal'}, slides: [{id: 'a', title: text.title, notes: text.body, bullets: text.items}, {id: 'b', title: text.title, layout: 'code-1x', code: {source: CODE, language: 'ts'}, text: text.body}]};
  await runSwitch('theme', deck, [
    {label: 'classic', apply: setTheme('classic'), expectUsed: ['Tenorite Display', 'Tenorite'], expectUnused: ['Aptos']},
    {label: 'dark', apply: setTheme('dark'), expectUsed: ['Seaford Display', 'Seaford']},
    {label: 'bold', apply: setTheme('bold'), expectUsed: ['Impact']},
    {label: 'minimal again', apply: setTheme('minimal'), expectUsed: ['Aptos Display', 'Aptos'], returnsToStart: true}
  ]);
  // A language switch comes with the slide's text in that language (a block replacement); the script fonts follow.
  const languageSlide = (language) => ({id: 'all', title: TEXT[language].title, bullets: TEXT[language].items, text: TEXT[language].body, notes: TEXT[language].body});
  const languages = {name: 'language switch', language: 'english', design: {theme: 'minimal', fontScheme: 'aptos'}, slides: [languageSlide('english')]};
  const order = Object.keys(TEXT);
  const change = (language) => (editor) => {
    setLanguage(language)(editor);
    replaceSlide(0, languageSlide(language))(editor);
  };
  const steps = order.slice(1).map((language) => ({label: language, apply: change(language), payload: true}));
  steps.push({label: 'english again', apply: change('english'), payload: true, returnsToStart: true});
  await runSwitch('language', languages, steps);
  switches += 2;
}

// ---------------------------------------------------------------------------
// Negative controls: the oracle above must catch a leaked font and a broken
// package, including inside a nested chart workbook.
// ---------------------------------------------------------------------------
{
  const text = TEXT.english;
  const deck = {name: 'controls', language: 'english', design: {theme: 'minimal', fontScheme: 'calibri'}, slides: [{id: 'a', title: text.title, notes: text.body, bullets: text.items}, {id: 'b', title: text.title, chart: {type: 'column', data: CHART_DATA}, text: text.body}]};
  const fonts = chosenFonts(deck);
  const original = unzipSync(await toPptx(deck, engineOptions(deck)));
  const audit = (edit) => {
    const entries = {...original};
    edit(entries);
    return {check: checkPptxTypefaces(zipSync(entries), {fonts: fonts.chosen, monospace: fonts.monospace}), problems: packageProblems(entries)};
  };
  const edited = (entries, part, pattern, replacement) => {
    const before = decoder.decode(entries[part]);
    const after = before.replace(pattern, replacement);
    assert.notEqual(after, before, `control edit changed ${part}`);
    entries[part] = strToU8(after);
  };
  const reasons = ({check}) => new Set(check.violations.map((violation) => violation.reason));
  const untouched = audit(() => {});
  assert.deepEqual(untouched.check.violations, [], 'controls start from a clean package');
  assert.deepEqual(untouched.problems, [], 'controls start from a valid package');
  const workbook = Object.keys(original).find((name) => name.endsWith('.xlsx'));
  assert.ok(workbook, 'the control deck embeds a chart workbook');
  assert.ok(reasons(audit((entries) => edited(entries, 'ppt/slides/slide1.xml', /<a:latin typeface="Calibri"/, '<a:latin typeface="Arial"'))).has('foreign-typeface'), 'a leaked slide font is caught');
  assert.ok(reasons(audit((entries) => edited(entries, 'ppt/theme/theme1.xml', /<a:minorFont><a:latin typeface="Calibri"/, '<a:minorFont><a:latin typeface="Aptos"'))).has('foreign-theme-reference'), 'a leaked theme font is caught');
  assert.ok(reasons(audit((entries) => {
    const nested = unzipSync(entries[workbook]);
    edited(nested, 'xl/styles.xml', /<name val="[^"]*"\/>/, '<name val="Geneva"/>');
    entries[workbook] = zipSync(nested);
  })).has('foreign-typeface'), 'a leaked chart workbook font is caught');
  assert.ok(reasons(audit((entries) => edited(entries, 'docProps/app.xml', /<vt:lpstr>Calibri<\/vt:lpstr>/, '<vt:lpstr>Arial</vt:lpstr>'))).has('foreign-fonts-used'), 'a stale Fonts Used entry is caught');
  assert.ok(audit((entries) => edited(entries, 'ppt/slides/slide1.xml', /<p:sld\b/, '<p:sld <')).problems.some((problem) => /not well formed/.test(problem)), 'malformed XML is caught');
  assert.ok(audit((entries) => delete entries['ppt/slides/slide2.xml']).problems.some((problem) => /missing part|without part/.test(problem)), 'a dangling relationship is caught');
  assert.ok(audit((entries) => {
    const nested = unzipSync(entries[workbook]);
    delete nested['xl/styles.xml'];
    entries[workbook] = zipSync(nested);
  }).problems.some((problem) => problem.includes(`${workbook}!/`)), 'a broken nested workbook is caught');
}

// ---------------------------------------------------------------------------
// Named expected failures. These are not weakened assertions: each entry pins a
// known engine limitation exactly (preview and measured export error codes), and
// the check fails when the limitation goes away so the entry gets removed. An
// unmeasured export must still name only the chosen fonts.
// ---------------------------------------------------------------------------
const providedSample = (scheme) => catalogs.fontSchemes.find((entry) => entry.id === scheme).textSample;
const EXPECTED_FAILURES = [
  ...['open-sans', 'montserrat', 'poppins', 'raleway', 'pt-serif'].map((scheme) => ({
    id: `open-google-font-without-pinned-preview-face:${scheme}`,
    reason: 'The office and base packs ship no face for this OFL family, so the preview reports font-unavailable. The PPTX still names the chosen family.',
    deck: {name: scheme, language: 'english', design: {fontScheme: scheme}, slides: [{id: 'a', title: providedSample(scheme), text: providedSample(scheme)}]},
    preview: 'font-unavailable',
    measuredExport: 'font-unavailable'
  })),
  {
    id: 'noto-sans-mongolian-cannot-shape-its-sample',
    reason: 'The bundled script face cannot shape the Mongolian sample, so the preview and the measured export report font-shaping-failed.',
    deck: {name: 'mongolian', language: 'mongolian', design: {fontScheme: 'noto-sans-mongolian'}, slides: [{id: 'a', title: providedSample('noto-sans-mongolian'), text: providedSample('noto-sans-mongolian')}]},
    preview: 'font-shaping-failed',
    measuredExport: 'font-shaping-failed'
  },
  {
    id: 'japanese-kanji-and-hangul-in-one-latin-deck-string',
    reason: 'In a Latin-language deck the renderer picks one CJK face per Han run. Japanese-only kanji (U+53CE) beside Hangul in the same string are drawn with a face that lacks the kanji, then fall back to the Latin face, so the preview and the measured export report missing-glyph. Each script on its own, or the same string in a Japanese deck, works.',
    deck: {name: 'kanji and hangul', language: 'english', design: {fontScheme: 'calibri'}, slides: [{id: 'a', title: 'Revenue 収益 성장', text: 'Revenue grew'}]},
    preview: 'missing-glyph',
    measuredExport: 'missing-glyph'
  },
  {
    id: 'simplified-hanzi-in-a-japanese-deck',
    reason: 'A Japanese deck draws Han text with the Japanese face only. A Simplified-only character (U+53D8) has no glyph there and no other CJK face is tried, so the preview and the measured export report missing-glyph.',
    deck: {name: 'hanzi in japanese', language: 'japanese', design: {fontScheme: 'meiryo'}, slides: [{id: 'a', title: TEXT['chinese-simplified'].title, text: TEXT['chinese-simplified'].body}]},
    preview: 'missing-glyph',
    measuredExport: 'missing-glyph'
  }
];
for (const failure of EXPECTED_FAILURES) {
  const measured = engineOptions(failure.deck);
  assert.throws(() => renderSvgDeck(failure.deck, measured), (error) => error.code === failure.preview, `${failure.id}: the preview fails with ${failure.preview}`);
  await assert.rejects(() => toPptx(failure.deck, measured), (error) => error.code === failure.measuredExport, `${failure.id}: the measured export fails with ${failure.measuredExport}`);
  const fonts = chosenFonts(failure.deck);
  const bytes = await toPptx(failure.deck);
  const check = checkPptxTypefaces(bytes, {fonts: fonts.chosen, monospace: fonts.monospace});
  assert.deepEqual(check.violations, [], `${failure.id}: an unmeasured export still names only the chosen fonts`);
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
const substitutionsSeen = Object.fromEntries([...substitutionLog].sort(([a], [b]) => compareNames(a, b)));
const unusedExpectations = Object.keys(EXPECTED_SUBSTITUTIONS).filter((family) => !Object.keys(substitutionsSeen).some((key) => key.startsWith(`${family}>`)));
assert.deepEqual(unusedExpectations, [], 'every pinned substitution is exercised');
const seconds = (Date.now() - started) / 1000;
assert.ok(seconds < MAX_SECONDS, `the matrix took ${seconds} s; its CI budget is ${MAX_SECONDS} s`);
await mkdir(new URL('../artifacts/font-switch-matrix/', import.meta.url), {recursive: true});
await writeFile(new URL('../artifacts/font-switch-matrix/report.json', import.meta.url), `${JSON.stringify({seed: matrix.seed, decks: matrix.rows.length, sizes: matrix.sizes, dimensions: DIMENSIONS, rows: matrix.rows, expectedFailures: EXPECTED_FAILURES.map(({id, reason, preview, measuredExport}) => ({id, reason, preview, measuredExport})), substitutions: substitutionsSeen, unusedExpectations, states: stateReports}, null, 1)}\n`);
console.log(`Font switch matrix passed: ${matrix.rows.length} pairwise decks and ${switches - matrix.rows.length} fixed switches, ${stateReports.length} verified states, ${Object.keys(substitutionsSeen).length} recorded substitutions, ${EXPECTED_FAILURES.length} named expected failures, ${seconds.toFixed(1)} s.`);
