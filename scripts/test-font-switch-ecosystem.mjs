// FF-09 offline font-switch matrix (font-fidelity-everywhere).
//
// A seeded pairwise covering array over the 14 gallery dimensions, plus fixed
// must-have cases, is switched A -> B -> A. Every state is rendered by the
// coordinated opf-render preview and exported by opf-pptx, then checked:
//   1. the FF-08 typeface inventory (`checkPptxTypefaces`) passes, the fonts the
//      package lists equal the fonts the document uses, and the theme major and
//      minor latin fonts equal the catalog record's literal values;
//   2. the PPTX is structurally valid (all parts, nested workbooks included);
//   3. the preview re-rendered with the chosen fonts (every substitution the
//      pinned registry made is recorded and asserted);
//   4. the export re-imports as a valid OPF with the same slide count.
// Switching back must reproduce state A byte for byte. No browser, Office/COM,
// system font or network is used.
//
// VALUE CLASSES. A value class is a group of catalog values that take the same
// path through the engines, derived from the bundled catalogs (asserted below, so
// a catalog change that adds a class fails here):
//   fontScheme   catalog scheme by language family (ea, cs), else by licensing and
//                preview policy: sans or serif Office metric, sans or serif Office
//                visual-only, monospace, and open Google (roboto and the Google
//                schemes without a pinned preview face yet).
//   theme        every theme record.
//   language     one language per script family (Latin-slot: Latn, Cyrl, Grek; East
//                Asian: Jpan, Hans, Hant, Kore; RTL: Arab, Hebr; Indic: Deva, Beng,
//                Taml; Thai; Khmr) in the pairwise array, and one language for every
//                other script in the catalog in a unary language chain, so every
//                catalog script is covered.
//   layout       the layout families (blank, chart, code, image, list, media, number,
//                quote, table, text, timeline, title), each with its catalog records
//                in rotation.
//   block        bullets, cards, table, timeline, metric, quote, code, chart.
//   chart        every distinct chart export path of the non-deprecated chart types
//                (element, bar direction, chartex extension): column, bar, line, pie,
//                doughnut, area, scatter, radar, treemap, histogram, pareto,
//                waterfall, funnel, box-and-whisker, world.
//   headerFooter off, slide number, date, text.
//   background   theme slot, solid, gradient, pattern, image.
//   image        none and the slide-image treatments by geometry: full-bleed
//                background, side, strip, circular crop, duotone recolor.
//   colorScheme, narrative, tone, audience   the first and last catalog record; they
//                take no font path, so the class is only "a distinct record".
//   socials      none, or speaker and organization profiles with the header field.
// Factors marked with slots (font scheme A and B, layouts, blocks, charts,
// backgrounds and images) take several values per deck: a deck has that many
// slides (or, for the font scheme, states) carrying them, and a pair counts as
// covered when any slot holds the value. Deck-wide factors take one value.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';
import {createScriptTextMeasurement, designatedFamilies, detectScripts, fontPolicyFor} from '../../opf-render/dist/fonts.js';
import {renderSvgDeck} from '../../opf-render/dist/index.js';
import {checkPptxTypefaces, fromPptx, toPptx} from '../../opf-pptx/dist/index.js';
import {createEditorSession} from '../../opf-editor/dist/index.js';
import {catalogs} from '@openpresentation/opf/catalogs';
import {resolveFontFamilies, resolveFontSchemeReference} from '@openpresentation/opf/composition';
import {resolveScriptFonts, validatePresentation} from '@openpresentation/opf';

const started = Date.now();
const MAX_SECONDS = 420;
const require = createRequire(new URL('../../opf-pptx/package.json', import.meta.url));
const {strToU8, unzipSync, zipSync} = require('fflate');
const {XMLValidator} = require('fast-xml-parser');
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Pinned preview registry. Substitution is `visual`, so a chosen Office font
// draws with an open replacement; the PPTX keeps the chosen name (FF-31). Every
// substitution a state triggers must appear here, exactly, and every entry must
// be exercised.
// ---------------------------------------------------------------------------
const {registry} = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'all'});
const EXPECTED_SUBSTITUTIONS = Object.freeze({
  'Aptos Display': 'Intos Display', Aptos: 'Intos', Calibri: 'Carlito', Georgia: 'Gelasio', Consolas: 'Cousine', 'Courier New': 'Cousine',
  Meiryo: 'Noto Sans JP', 'Yu Gothic': 'Noto Sans JP', 'Microsoft YaHei': 'Noto Sans SC', 'Malgun Gothic': 'Noto Sans KR', 'Microsoft JhengHei': 'Noto Sans TC',
  Mangal: 'Noto Sans Devanagari', 'Arabic Typesetting': 'Noto Naskh Arabic', David: 'Noto Serif Hebrew', 'Angsana New': 'Noto Sans Thai',
  Tahoma: 'Arimo', Verdana: 'Arimo', 'Times New Roman': 'Tinos', Garamond: 'Tinos', Constantia: 'Caladea',
  'Tenorite Display': 'Roboto', Tenorite: 'Roboto', 'Seaford Display': 'Carlito', Seaford: 'Carlito', Impact: 'Carlito', Grandview: 'Roboto',
  'Shonar Bangla': 'Noto Sans Bengali', Latha: 'Noto Sans Tamil', DaunPenh: 'Noto Sans Khmer', Nyala: 'Noto Sans Ethiopic', Sylfaen: 'Noto Sans',
  Tunga: 'Noto Sans Kannada', Shruti: 'Noto Sans Gujarati', Raavi: 'Noto Sans Gurmukhi', Kartika: 'Noto Sans Malayalam', Kalinga: 'Noto Sans Oriya', Gautami: 'Noto Sans Telugu'
});
const substitutionLog = new Map();

// ---------------------------------------------------------------------------
// Catalog-derived classes.
// ---------------------------------------------------------------------------
const byId = (kind, id) => catalogs[kind].find((entry) => entry.id === id);
const isAvailable = (family) => {
  try {
    registry.resolveFont({fontFamily: family, fontWeight: 400});
    return true;
  } catch (error) {
    if (error.code === 'font-unavailable') return false;
    throw error;
  }
};
const schemeAvailable = (id) => [byId('fontSchemes', id).major, byId('fontSchemes', id).minor].every(isAvailable);
function schemeClass(scheme) {
  if (scheme.languageFamily === 'ea') return 'east-asian';
  if (scheme.languageFamily === 'cs') return 'complex-script';
  if (scheme.type === 'monospace') return 'monospace';
  const policies = [scheme.major, scheme.minor].map((family) => fontPolicyFor(family));
  if (policies.every((policy) => policy?.licenseClass === 'open')) return 'open-google';
  const shape = scheme.type === 'serif' ? 'serif' : 'sans';
  return policies.every((policy) => policy?.replacement?.compatibility === 'metric') ? `${shape}-metric` : `${shape}-visual`;
}
// Members rotate within a class so the sample covers more catalog records. A member the pinned
// registry cannot preview yet is not drawn; its named expected failure below says why.
const SCHEME_CLASSES = [
  {id: 'sans-metric', members: ['calibri', 'aptos']},
  {id: 'serif-metric', members: ['times-new-roman']},
  {id: 'sans-visual', members: ['tahoma', 'verdana']},
  {id: 'serif-visual', members: ['georgia', 'garamond', 'constantia']},
  {id: 'monospace', members: ['consolas', 'courier-new']},
  {id: 'open-google', members: ['roboto', 'open-sans', 'montserrat', 'poppins', 'raleway', 'pt-serif']},
  {id: 'east-asian', members: ['meiryo', 'yu-gothic', 'microsoft-yahei', 'malgun-gothic']},
  {id: 'complex-script', members: ['mangal', 'arabic-typesetting', 'david', 'angsana-new']}
];
for (const entry of SCHEME_CLASSES) for (const member of entry.members) assert.equal(schemeClass(byId('fontSchemes', member)), entry.id, `${member} is a ${entry.id} scheme`);
for (const scheme of catalogs.fontSchemes) assert.ok(SCHEME_CLASSES.some((entry) => entry.id === schemeClass(scheme)), `font scheme ${scheme.id} belongs to a known class`);
// Preview faces that lack Cyrillic or Greek glyphs cannot draw Latin-slot text in those scripts (see the expected
// failures below). A scheme is not drawn with a language it cannot show, and a class none of whose members can show a
// language is left out of the array for that language; the expected failures cover the pair instead.
const SCHEME_LANGUAGE_GAPS = {
  georgia: ['russian', 'greek'], constantia: ['russian', 'greek'],
  meiryo: ['greek'], 'yu-gothic': ['greek'], 'microsoft-yahei': ['greek'], 'malgun-gothic': ['greek'],
  mangal: ['russian', 'greek'], 'arabic-typesetting': ['russian', 'greek'], david: ['russian', 'greek'], 'angsana-new': ['russian', 'greek']
};
const classMembers = (entry, language) => entry.members.filter((member) => schemeAvailable(member) && !SCHEME_LANGUAGE_GAPS[member]?.includes(language));
const forbiddenClassLanguage = (entry, language) => classMembers(entry, language).length === 0;
const pendingSchemes = SCHEME_CLASSES.flatMap((entry) => entry.members.filter((member) => !schemeAvailable(member)));

const CHART_CLASSES = new Map();
const chartClassKey = (record) => {
  const openxml = record.mappings.openxml;
  return [openxml.element, openxml.barDir, openxml.extension].filter(Boolean).join('/');
};
for (const record of catalogs.chartTypes.filter((entry) => !entry.deprecation)) {
  const key = chartClassKey(record);
  CHART_CLASSES.set(key, [...(CHART_CLASSES.get(key) ?? []), record.id]);
}
// Representative first, then the other records of the class (stacked, markers, ...) in rotation.
const CHART_LEVELS = ['column', 'bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'radar', 'treemap', 'histogram', 'pareto', 'waterfall', 'funnel', 'box-and-whisker', 'world'];
const chartMembers = new Map(CHART_LEVELS.map((level) => {
  const members = [...CHART_CLASSES.values()].find((ids) => ids.includes(level));
  assert.ok(members, `chart class ${level} exists in the catalog`);
  return [level, [level, ...members.filter((id) => id !== level)]];
}));
assert.equal(CHART_CLASSES.size, CHART_LEVELS.length, `the catalog has ${CHART_CLASSES.size} chart export paths: ${[...CHART_CLASSES.keys()]}`);
const chartData = (record) => {
  const width = Math.max(record.columns.length, 2);
  return {columns: ['Quarter', ...Array.from({length: width - 1}, (_, index) => `Series ${index + 1}`)], rows: ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, row) => [quarter, ...Array.from({length: width - 1}, (_, column) => (row + 1) * (column + 2) + column)])};
};

// Languages: one per script family in the pairwise array, one per remaining script in the chain.
const PAIRWISE_LANGUAGES = ['english', 'russian', 'greek', 'japanese', 'chinese-simplified', 'chinese-traditional', 'korean', 'arabic', 'hebrew', 'hindi', 'bengali', 'tamil', 'thai', 'khmer'];
const catalogScripts = [...new Set(catalogs.languages.map((language) => language.script))].sort();
const pairwiseScripts = PAIRWISE_LANGUAGES.map((id) => byId('languages', id).script);
assert.equal(new Set(pairwiseScripts).size, PAIRWISE_LANGUAGES.length, 'each pairwise language is its own script');
const CHAIN_LANGUAGES = catalogScripts.filter((script) => !pairwiseScripts.includes(script)).map((script) => catalogs.languages.filter((language) => language.script === script).map((language) => language.id).sort()[0]);
assert.deepEqual([...pairwiseScripts, ...CHAIN_LANGUAGES.map((id) => byId('languages', id).script)].sort(), catalogScripts, 'the matrix covers every script in the languages catalog');

const TEXT = {
  english: {title: 'Quarterly review', subtitle: 'Results and next steps', body: 'Revenue grew while costs stayed flat across every region', items: ['Revenue up', 'Costs flat', 'Margin improved'], cells: ['Region', 'Result', 'North', 'Up']},
  russian: {title: 'Квартальный обзор', subtitle: 'Результаты и дальнейшие шаги', body: 'Выручка выросла, а расходы остались прежними', items: ['Рост выручки', 'Расходы без изменений', 'Маржа улучшилась'], cells: ['Регион', 'Итог', 'Север', 'Рост']},
  greek: {title: 'Τριμηνιαία ανασκόπηση', subtitle: 'Αποτελέσματα και επόμενα βήματα', body: 'Τα έσοδα αυξήθηκαν ενώ τα έξοδα έμειναν σταθερά', items: ['Αύξηση εσόδων', 'Σταθερά έξοδα', 'Βελτίωση περιθωρίου'], cells: ['Περιοχή', 'Αποτέλεσμα', 'Βόρεια', 'Αύξηση']},
  japanese: {title: '四半期レビュー', subtitle: '結果と次のステップ', body: '売上は伸び、コストは横ばいでした', items: ['売上増加', 'コスト横ばい', '利益率向上'], cells: ['地域', '結果', '北部', '増加']},
  'chinese-simplified': {title: '季度回顾', subtitle: '成果与后续步骤', body: '收入增长而成本保持不变', items: ['收入增加', '成本持平', '利润改善'], cells: ['地区', '结果', '北部', '增长']},
  'chinese-traditional': {title: '季度回顧', subtitle: '成果與後續步驟', body: '收入增長而成本保持不變', items: ['收入增加', '成本持平', '利潤改善'], cells: ['地區', '結果', '北部', '增長']},
  korean: {title: '분기 검토', subtitle: '결과와 다음 단계', body: '매출은 늘었고 비용은 그대로였습니다', items: ['매출 증가', '비용 동결', '마진 개선'], cells: ['지역', '결과', '북부', '증가']},
  arabic: {title: 'مراجعة ربع سنوية', subtitle: 'النتائج والخطوات التالية', body: 'ارتفعت الإيرادات بينما بقيت التكاليف ثابتة', items: ['ارتفاع الإيرادات', 'ثبات التكاليف', 'تحسن الهامش'], cells: ['المنطقة', 'النتيجة', 'الشمال', 'ارتفاع']},
  hebrew: {title: 'סקירה רבעונית', subtitle: 'תוצאות והצעדים הבאים', body: 'ההכנסות עלו בעוד העלויות נשארו יציבות', items: ['עליית הכנסות', 'עלויות יציבות', 'שיפור ברווחיות'], cells: ['אזור', 'תוצאה', 'צפון', 'עלייה']},
  hindi: {title: 'त्रैमासिक समीक्षा', subtitle: 'परिणाम और अगले कदम', body: 'राजस्व बढ़ा जबकि लागत स्थिर रही', items: ['राजस्व में वृद्धि', 'लागत स्थिर', 'मार्जिन बेहतर'], cells: ['क्षेत्र', 'परिणाम', 'उत्तर', 'वृद्धि']},
  bengali: {title: 'ত্রৈমাসিক পর্যালোচনা', subtitle: 'ফলাফল ও পরবর্তী পদক্ষেপ', body: 'আয় বেড়েছে কিন্তু খরচ অপরিবর্তিত', items: ['আয় বৃদ্ধি', 'খরচ স্থির', 'মার্জিন উন্নত'], cells: ['অঞ্চল', 'ফলাফল', 'উত্তর', 'বৃদ্ধি']},
  tamil: {title: 'காலாண்டு மதிப்பாய்வு', subtitle: 'முடிவுகள் மற்றும் அடுத்த படிகள்', body: 'வருவாய் உயர்ந்தது செலவுகள் மாறவில்லை', items: ['வருவாய் உயர்வு', 'செலவு நிலையானது', 'இலாபம் மேம்பட்டது'], cells: ['பகுதி', 'முடிவு', 'வடக்கு', 'உயர்வு']},
  thai: {title: 'ทบทวนรายไตรมาส', subtitle: 'ผลลัพธ์และขั้นตอนต่อไป', body: 'รายได้เพิ่มขึ้นขณะที่ต้นทุนคงที่', items: ['รายได้เพิ่มขึ้น', 'ต้นทุนคงที่', 'อัตรากำไรดีขึ้น'], cells: ['ภูมิภาค', 'ผลลัพธ์', 'เหนือ', 'เพิ่มขึ้น']},
  khmer: {title: 'ការពិនិត្យប្រចាំត្រីមាស', subtitle: 'លទ្ធផល និងជំហានបន្ទាប់', body: 'ប្រាក់ចំណូលកើនឡើង ខណៈចំណាយនៅដដែល', items: ['ចំណូលកើន', 'ចំណាយថេរ', 'ប្រាក់ចំណេញប្រសើរ'], cells: ['តំបន់', 'លទ្ធផល', 'ខាងជើង', 'កើន']}
};
// Scripts outside the pairwise array use the catalog's own text sample for their language.
for (const id of CHAIN_LANGUAGES) {
  const language = byId('languages', id);
  const scheme = catalogs.fontSchemes.find((entry) => entry.textSample && entry.languages?.some((name) => name.toLowerCase() === language.name.toLowerCase()));
  assert.ok(scheme, `the catalog has a text sample for ${language.name}`);
  const sample = scheme.textSample;
  TEXT[id] = {title: sample, subtitle: sample, body: `${sample} ${sample}`, items: [sample, sample, sample], cells: [sample, sample, sample, sample]};
}
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGNgGAWjYBSMglEAAAQAAAEXrdKAAAAAAElFTkSuQmCC';
const CLIP = 'data:video/mp4;base64,AAAA';
const CHART_DATA = {columns: ['Quarter', 'North', 'South'], rows: [['Q1', 4, 6], ['Q2', 7, 5], ['Q3', 9, 8]]};
const CODE = 'const score = urgency * confidence;\nreturn score > 0.5;';

// Content blocks (slides of one content type).
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
// Layout families and one slide builder that fills a layout record's placeholders.
const layoutFamily = (record) => record.id.replace(/-(?:\d+x|bleed|subtitle)$/, '');
const LAYOUT_FAMILIES = [...new Set(catalogs.layouts.map(layoutFamily))].sort();
const layoutMembers = (family) => catalogs.layouts.filter((record) => layoutFamily(record) === family).map((record) => record.id);
const placeholderBlock = {
  text: (text) => ({text: text.body}),
  list: (text) => ({bullets: text.items}),
  metric: (text) => ({metric: {value: 42, label: text.items[0], unit: 'ms'}}),
  chart: () => ({chart: {type: 'column', data: CHART_DATA}}),
  table: (text) => ({table: {columns: [text.cells[0], text.cells[1]], rows: [[text.cells[2], text.cells[3]]]}}),
  code: () => ({code: {source: 'let x = 1;', language: 'ts'}}),
  quote: (text) => ({quote: {text: text.body, attribution: text.cells[0]}}),
  timeline: (text) => ({timeline: {events: [{when: 'Q1', what: text.items[0]}, {when: 'Q2', what: text.items[1]}]}}),
  picture: () => ({image: 'asset:hero'}),
  media: () => ({video: 'asset:clip'})
};
function layoutSlide(id, layoutId, text) {
  const types = byId('layouts', layoutId).placeholders.map((placeholder) => placeholder.type);
  const content = types.filter((type) => type !== 'title' && type !== 'subtitle');
  return {id, layout: layoutId, ...(types.includes('title') ? {title: text.title} : {}), ...(types.includes('subtitle') ? {subtitle: text.subtitle} : {}), ...(content.length ? {blocks: content.map((type) => placeholderBlock[type](text))} : {})};
}
assert.deepEqual(LAYOUT_FAMILIES, ['blank', 'chart', 'code', 'image', 'list', 'media', 'number', 'quote', 'table', 'text', 'timeline', 'title'], 'the catalog has the expected layout families');

const FOOTERS = {
  off: () => ({header: false, footer: false}),
  number: () => ({footer: {right: {slideNumber: true}}}),
  date: () => ({footer: {left: {date: '2026-09-29', dateFormat: 'yyyy-MM-dd'}}}),
  text: () => ({footer: {center: {text: 'Confidential'}}})
};
const BACKGROUNDS = {
  theme: {type: 'theme', slot: 'dark1'},
  solid: '#12355B',
  gradient: {type: 'gradient', gradient: {angle: 90, stops: [{color: '#12355B', position: 0}, {color: '#7FB2E5', position: 1}]}},
  pattern: {type: 'pattern', pattern: {preset: 'diagStripe', foregroundColor: '#12355B', backgroundColor: '#FFFFFF'}},
  image: {type: 'image', image: {src: 'asset:hero', fit: 'cover'}}
};
const imageTreatments = JSON.parse(await readFile(new URL('../docs/fixtures/image-treatments.opf.json', import.meta.url), 'utf8'));
const treatment = (id) => {
  const slide = imageTreatments.slides.find((entry) => entry.id === id);
  assert.ok(slide?.design?.slideImage, `the image-treatment fixture has ${id}`);
  return slide.design.slideImage;
};
const IMAGES = {
  none: null,
  'full-bleed': treatment('full-bleed'),
  side: treatment('side-by-side'),
  strip: treatment('image-strip'),
  'circular-crop': treatment('circular-crop'),
  duotone: treatment('duotone')
};
const edgeRecords = (kind) => {
  const ids = catalogs[kind].map((record) => record.id).sort();
  return [ids[0], ids.at(-1)];
};
const FACTORS = [
  {id: 'fontScheme', levels: SCHEME_CLASSES.map((entry) => entry.id), slots: 2},
  {id: 'theme', levels: catalogs.themes.map((theme) => theme.id).sort(), slots: 1},
  {id: 'language', levels: PAIRWISE_LANGUAGES, slots: 1},
  {id: 'layout', levels: LAYOUT_FAMILIES, slots: 3},
  {id: 'block', levels: ['bullets', 'cards', 'table', 'timeline', 'metric', 'quote', 'code', 'chart'], slots: 3},
  {id: 'chart', levels: CHART_LEVELS, slots: 4},
  {id: 'headerFooter', levels: Object.keys(FOOTERS), slots: 1},
  {id: 'colorScheme', levels: edgeRecords('colorSchemes'), slots: 1},
  {id: 'background', levels: Object.keys(BACKGROUNDS), slots: 2},
  {id: 'image', levels: Object.keys(IMAGES), slots: 2},
  {id: 'narrative', levels: edgeRecords('narratives'), slots: 1},
  {id: 'tone', levels: edgeRecords('tones'), slots: 1},
  {id: 'audience', levels: edgeRecords('audiences'), slots: 1},
  {id: 'socials', levels: ['none', 'profiles'], slots: 1}
];
assert.equal(FACTORS.length, 14, 'the matrix covers the 14 gallery dimensions');
assert.equal(FACTORS[1].levels.length, 4, 'the catalog has four themes');

// ---------------------------------------------------------------------------
// Seeded pairwise covering array (AETG-style greedy, best of several restarts),
// generalised to factors that take several values per row.
// ---------------------------------------------------------------------------
const SEED = 0x0f0d9;
const RESTARTS = 6;
const CANDIDATES = 12;
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
const pairKey = (a, i, b, j) => (a < b ? `${a}:${i}|${b}:${j}` : `${b}:${j}|${a}:${i}`);
function allPairs(sizes) {
  const pairs = new Set();
  for (let a = 0; a < sizes.length; a++) for (let b = a + 1; b < sizes.length; b++) for (let i = 0; i < sizes[a]; i++) for (let j = 0; j < sizes[b]; j++) pairs.add(pairKey(a, i, b, j));
  return pairs;
}
function coveringArray(factors, seed, forbidden = new Set()) {
  const random = mulberry32(seed);
  const sizes = factors.map((factor) => factor.levels.length);
  const columns = factors.flatMap((factor, index) => Array.from({length: factor.slots}, () => index));
  const firstColumn = factors.map((_, index) => columns.indexOf(index));
  const uncovered = allPairs(sizes);
  for (const key of forbidden) uncovered.delete(key);
  let pending = [...uncovered];
  const rows = [];
  while (uncovered.size) {
    let best = null;
    let bestClaimed = -1;
    for (let attempt = 0; attempt < CANDIDATES; attempt++) {
      const row = columns.map(() => -1);
      const claimed = new Set();
      const gain = (column, level) => {
        let count = 0;
        for (let other = 0; other < columns.length; other++) {
          if (row[other] === -1 || columns[other] === columns[column]) continue;
          const key = pairKey(columns[column], level, columns[other], row[other]);
          if (uncovered.has(key) && !claimed.has(key)) count++;
        }
        return count;
      };
      const place = (column, level) => {
        for (let other = 0; other < columns.length; other++) {
          if (row[other] === -1 || columns[other] === columns[column]) continue;
          const key = pairKey(columns[column], level, columns[other], row[other]);
          if (uncovered.has(key)) claimed.add(key);
        }
        row[column] = level;
      };
      // Seed the candidate with an uncovered pair, then fill the remaining columns greedily in random order.
      const [first, second] = pending[Math.floor(random() * pending.length)].split('|').map((part) => part.split(':').map(Number));
      place(firstColumn[first[0]], first[1]);
      place(firstColumn[second[0]], second[1]);
      const order = columns.map((_, column) => column).filter((column) => row[column] === -1);
      for (let index = order.length - 1; index > 0; index--) {
        const swap = Math.floor(random() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
      for (const column of order) {
        const factor = columns[column];
        const used = new Set(columns.flatMap((other, index) => (other === factor && row[index] !== -1 ? [row[index]] : [])));
        const levels = Array.from({length: sizes[factor]}, (_, level) => level);
        const open = levels.filter((level) => !used.has(level));
        let bestLevels = [];
        let most = -1;
        const allowed = (level) => !columns.some((other, index) => row[index] !== -1 && other !== factor && forbidden.has(pairKey(factor, level, other, row[index])));
        const choices = (open.length ? open : levels).filter(allowed);
        for (const level of choices.length ? choices : levels.filter(allowed)) {
          const g = gain(column, level);
          if (g > most) {
            most = g;
            bestLevels = [level];
          } else if (g === most) bestLevels.push(level);
        }
        place(column, bestLevels[Math.floor(random() * bestLevels.length)]);
      }
      if (claimed.size > bestClaimed) {
        bestClaimed = claimed.size;
        best = row;
      }
    }
    rows.push(best);
    for (let a = 0; a < columns.length; a++) for (let b = a + 1; b < columns.length; b++) if (columns[a] !== columns[b]) uncovered.delete(pairKey(columns[a], best[a], columns[b], best[b]));
    pending = pending.filter((key) => uncovered.has(key));
  }
  return rows.map((row) => factors.map((factor, index) => columns.flatMap((owner, column) => (owner === index ? [factor.levels[row[column]]] : []))));
}
function assertPairwise(rows, factors, forbidden) {
  const missing = allPairs(factors.map((factor) => factor.levels.length));
  for (const key of forbidden) missing.delete(key);
  for (const row of rows) for (let a = 0; a < factors.length; a++) for (let b = a + 1; b < factors.length; b++) for (const left of row[a]) for (const right of row[b]) assert.ok(!forbidden.has(pairKey(a, factors[a].levels.indexOf(left), b, factors[b].levels.indexOf(right))), `row pairs ${left} with ${right}, which the engines cannot show`);
  for (const row of rows) {
    for (let a = 0; a < factors.length; a++) {
      for (let b = a + 1; b < factors.length; b++) {
        for (const left of row[a]) for (const right of row[b]) missing.delete(pairKey(a, factors[a].levels.indexOf(left), b, factors[b].levels.indexOf(right)));
      }
    }
  }
  assert.equal(missing.size, 0, `${missing.size} value-class pairs are not covered`);
  for (const [index, factor] of factors.entries()) {
    assert.deepEqual([...new Set(rows.flatMap((row) => row[index]))].sort(), [...factor.levels].sort(), `${factor.id}: every value class appears`);
  }
}
// Pairs of a font scheme class and a language that no member of the class can show.
const FORBIDDEN = new Set();
for (const [classIndex, entry] of SCHEME_CLASSES.entries()) {
  for (const [languageIndex, language] of PAIRWISE_LANGUAGES.entries()) if (forbiddenClassLanguage(entry, language)) FORBIDDEN.add(pairKey(0, classIndex, 2, languageIndex));
}
function generateMatrix() {
  let best = null;
  let bestSeed = SEED;
  for (let restart = 0; restart < RESTARTS; restart++) {
    const rows = coveringArray(FACTORS, SEED + restart, FORBIDDEN);
    if (best === null || rows.length < best.length) {
      best = rows;
      bestSeed = SEED + restart;
    }
  }
  assertPairwise(best, FACTORS, FORBIDDEN);
  const rows = best.map((row) => Object.fromEntries(FACTORS.map((factor, index) => [factor.id, factor.slots === 1 ? row[index][0] : row[index]])));
  return {seed: bestSeed, rows};
}

// ---------------------------------------------------------------------------
// Deck construction.
// ---------------------------------------------------------------------------
function buildDeck(name, row, index) {
  const text = TEXT[row.language];
  const rotate = (list, slot) => list[(index + slot) % list.length];
  const schemes = row.fontScheme.map((level, slot) => rotate(classMembers(SCHEME_CLASSES.find((entry) => entry.id === level), row.language), slot));
  const slides = [
    ...row.layout.map((family, slot) => layoutSlide(`layout-${slot + 1}`, rotate(layoutMembers(family), slot), text)),
    ...row.block.map((type, slot) => ({id: `block-${slot + 1}`, title: text.title, ...(slot === 0 ? {notes: text.body} : {}), ...contentBlocks[type](text)})),
    ...row.chart.map((level, slot) => {
      const record = byId('chartTypes', rotate(chartMembers.get(level), slot));
      return {id: `chart-${slot + 1}`, layout: 'chart-1x', title: text.title, chart: {type: record.id, data: chartData(record)}, text: text.body};
    })
  ];
  // Second background and image slots ride on slide-level design; the first ride on the deck and the first slide.
  const perSlide = (slideIndex, extra) => {
    slides[slideIndex].design = {...slides[slideIndex].design, ...extra};
  };
  const image = (level) => (IMAGES[level] ? {slideImage: IMAGES[level]} : {});
  perSlide(0, image(row.image[0]));
  perSlide(row.layout.length, {...image(row.image[1]), background: BACKGROUNDS[row.background[1]]});
  const deck = {
    name: `Font switch matrix ${name}`,
    language: row.language,
    narrative: row.narrative,
    tone: row.tone,
    audience: [row.audience],
    design: {
      theme: row.theme,
      fontScheme: schemes[0],
      colorScheme: row.colorScheme,
      background: BACKGROUNDS[row.background[0]],
      ...FOOTERS[row.headerFooter](),
      ...(row.socials === 'profiles' ? {header: {right: {socials: true}}} : {})
    },
    assets: {hero: {src: PIXEL, alt: 'Illustration'}, clip: {src: CLIP, alt: 'Clip'}},
    slides
  };
  for (const slide of slides) if (slide.design && Object.keys(slide.design).length === 0) delete slide.design;
  if (row.socials === 'profiles') {
    deck.organization = {id: 'acme', name: 'Acme', socials: {linkedin: 'https://linkedin.com/company/acme', x: '@acme'}};
    deck.speaker = {id: 'ava', name: 'Ava Chen', socials: {linkedin: 'https://linkedin.com/in/ava-chen', github: 'avachen'}};
  }
  return {deck, schemeA: schemes[0], schemeB: schemes[1]};
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
const compareNames = (a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : a < b ? -1 : a > b ? 1 : 0);
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
  return {chosen: [...chosen], used: [...used].sort(compareNames), monospace: [...monospace], roles};
}
// The theme's major and minor latin fonts straight from the catalog record, not through the resolver, when
// the design names a plain catalog scheme (directly or through its theme).
function catalogTheme(presentation) {
  const design = presentation.design ?? {};
  const reference = design.fontScheme ?? record('themes', referenceId(design.theme) ?? 'minimal', presentation)?.fontScheme;
  if (typeof reference === 'object' && ['heading', 'body', 'major', 'minor'].some((key) => reference[key] !== undefined)) return null;
  const scheme = record('fontSchemes', referenceId(reference), presentation);
  return scheme ? {major: scheme.major, minor: scheme.minor} : null;
}

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
// The renderer's bundled Roboto ships static Medium, SemiBold and ExtraBold files, and the exporter names the physical
// face the resolver picked for a weight (renderer 0.8.0 fontFace metadata). A state admits exactly those faces.
const WEIGHT_SELECTOR = /^(.+) (Thin|Light|Medium|SemiBold|ExtraBold|Black)$/;
const CJK = ['Jpan', 'Hans', 'Hant', 'Kore'];
const stateReports = [];
const overlaps = (faces, drawn) => drawn.some((family) => faces.has(family));

async function verifyState(label, presentation) {
  const document = structuredClone(presentation);
  assert.equal(validatePresentation(document).valid, true, `${label}: valid OPF`);
  const fonts = chosenFonts(document);
  const measured = engineOptions(document);

  // Preview and export share one registry, so both record what they resolved.
  registry.clearSubstitutions();
  const diagnostics = [];
  const svgs = renderSvgDeck(document, {...measured, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)});
  assert.deepEqual(diagnostics, [], `${label}: preview diagnostics`);
  assert.equal(svgs.length, document.slides.length, `${label}: one preview per slide`);
  const bytes = await toPptx(document, measured);
  // A replacement face is recorded under its weight selector name (Aptos -> Roboto Medium); the table names the family.
  const made = registry.substitutions.map((entry) => ({requested: entry.requestedFamily, resolved: entry.resolvedFamily, family: entry.substitute ? entry.resolvedFamily.replace(WEIGHT_SELECTOR, '$1') : entry.resolvedFamily, compatibility: entry.compatibility, substitute: entry.substitute}));
  const drawn = svgFamilies(svgs);
  const substitutions = [...new Map(made.filter((entry) => entry.substitute).map((entry) => [`${entry.requested}>${entry.family}`, entry])).values()];
  for (const entry of made.filter((candidate) => !candidate.substitute)) {
    // A face of the requested family (Roboto Medium is Roboto, Noto Sans Thai is itself) is not a substitute.
    assert.ok(entry.resolved.startsWith(entry.requested), `${label}: ${entry.requested} resolved to ${entry.resolved} without being flagged as a substitute`);
  }
  for (const entry of substitutions) {
    assert.equal(EXPECTED_SUBSTITUTIONS[entry.requested], entry.family, `${label}: unexpected substitution ${entry.requested} -> ${entry.family}`);
    assert.ok(fonts.chosen.includes(entry.requested), `${label}: substituted ${entry.requested}, which the document did not choose`);
    substitutionLog.set(`${entry.requested}>${entry.family}`, entry.compatibility);
  }
  const selectors = [...new Set(made.filter((entry) => !entry.substitute && WEIGHT_SELECTOR.exec(entry.resolved)?.[1] === entry.requested).map((entry) => entry.resolved))];

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
  if (['Latn', 'Cyrl', 'Grek'].includes(profile.script)) assert.ok(overlaps(previewFaces(roles.heading), drawn), `${label}: preview draws the heading font ${roles.heading}`);
  for (const [index, slide] of document.slides.entries()) {
    if (hasCode(slide)) assert.ok(overlaps(previewFaces(fonts.roles[index + 1].families.code), drawn), `${label}: preview draws the code font of slide ${index + 1}`);
  }

  // FF-08 typeface inventory, theme fonts against the catalog literals, package structure and re-import.
  const check = checkPptxTypefaces(bytes, {fonts: [...fonts.chosen, ...selectors], monospace: fonts.monospace});
  assert.deepEqual(check.violations, [], `${label}: typeface inventory`);
  assert.deepEqual(check.fontsUsed.filter((family) => !selectors.includes(family)), fonts.used, `${label}: exported fonts equal the chosen fonts`);
  const entries = unzipSync(bytes);
  const literal = catalogTheme(document);
  if (literal) {
    const theme = decoder.decode(entries['ppt/theme/theme1.xml']);
    assert.equal(/<a:majorFont><a:latin typeface="([^"]*)"/.exec(theme)?.[1], literal.major, `${label}: theme major font is the catalog record's`);
    assert.equal(/<a:minorFont><a:latin typeface="([^"]*)"/.exec(theme)?.[1], literal.minor, `${label}: theme minor font is the catalog record's`);
  }
  assert.deepEqual(packageProblems(entries), [], `${label}: package structure`);
  const slideParts = Object.keys(entries).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slideParts.length, document.slides.length, `${label}: one slide part per slide`);
  const reimported = await fromPptx(bytes);
  assert.equal(reimported.slides.length, document.slides.length, `${label}: re-import keeps every slide`);
  assert.equal(validatePresentation(reimported).valid, true, `${label}: re-imported OPF validates`);

  stateReports.push({label, chosen: [...fonts.chosen].sort(compareNames), exported: check.fontsUsed, weightSelectors: check.fontsUsed.filter((family) => selectors.includes(family)), preview: drawn, scripts, substitutions: substitutions.map((entry) => `${entry.requested}>${entry.family}`)});
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
    for (const family of step.expectDrawn ?? []) assert.ok(next.drawn.includes(family), `${name} ${step.label}: preview draws ${family} (${next.drawn})`);
    for (const family of step.expectAbsent ?? []) assert.ok(!next.drawn.includes(family), `${name} ${step.label}: preview no longer draws ${family} (${next.drawn})`);
    for (const family of step.expectUsed ?? []) assert.ok(next.fonts.used.includes(family), `${name} ${step.label}: the package uses ${family}`);
    for (const family of step.expectUnused ?? []) assert.ok(!next.fonts.used.includes(family), `${name} ${step.label}: the package no longer uses ${family}`);
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
console.log(`Pairwise covering array: ${matrix.rows.length} decks over ${FACTORS.length} dimensions (${FACTORS.map((factor) => `${factor.levels.length}${factor.slots > 1 ? `x${factor.slots}` : ''}`).join(' ')} classes and slots), seed ${matrix.seed}, every value-class pair covered (generated in ${generationMilliseconds} ms).`);
if (process.argv.includes('--plan')) process.exit(0);
assert.ok(matrix.rows.length >= 50 && matrix.rows.length <= 80, `the covering array has ${matrix.rows.length} decks`);

let switches = 0;
for (const [index, row] of matrix.rows.entries()) {
  const name = `pairwise-${String(index + 1).padStart(2, '0')}`;
  const {deck, schemeA, schemeB} = buildDeck(name, row, index);
  await runSwitch(name, deck, [
    {label: `B (${schemeB})`, apply: setScheme('design.fontScheme', schemeB)},
    {label: 'A again', apply: setScheme('design.fontScheme', schemeA), returnsToStart: true}
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
  // The chain visits every script in the languages catalog: the pairwise languages first, then one language per other script.
  const languageSlide = (language) => ({id: 'all', title: TEXT[language].title, bullets: TEXT[language].items, text: TEXT[language].body, notes: TEXT[language].body});
  const languages = {name: 'language switch', language: 'english', design: {theme: 'minimal', fontScheme: 'aptos'}, slides: [languageSlide('english')]};
  const change = (language) => (editor) => {
    setLanguage(language)(editor);
    replaceSlide(0, languageSlide(language))(editor);
  };
  const order = [...PAIRWISE_LANGUAGES, ...CHAIN_LANGUAGES];
  const steps = order.slice(1).map((language) => ({label: language, apply: change(language), payload: true}));
  steps.push({label: 'english again', apply: change('english'), payload: true, returnsToStart: true});
  await runSwitch('language', languages, steps);
  switches += 2;
}

// ---------------------------------------------------------------------------
// Chart export and preview paths. Every non-deprecated chart type is exported and
// previewed alone; the tables pin what the coordinated engines do today. A type
// that gains a native path fails here, so its gap entry gets deleted.
// ---------------------------------------------------------------------------
// The preview draws these natively (axes, legend or arcs). Every other type is approximated by a plain row of bars with one
// category-label line and no axis, so it is the same picture whatever the type.
const PREVIEW_NATIVE = ['area', 'bar', 'column', 'doughnut', 'line', 'pie'];
// Types whose PPTX is not the element the catalog names (chartex families export as a bar chart).
const EXPORT_FALLBACK = {'box-and-whisker': 'barChart', funnel: 'barChart', histogram: 'barChart', pareto: 'barChart', treemap: 'barChart', waterfall: 'barChart', world: 'barChart'};
const marks = (svg) => ({text: (svg.match(/<text\b/g) ?? []).length, shapes: (svg.match(/<(?:path|rect|circle|line|polygon|polyline)\b/g) ?? []).length});
const chartPaths = [];
for (const chart of catalogs.chartTypes.filter((entry) => !entry.deprecation)) {
  const slide = {id: 'chart', layout: 'chart-1x', title: 'Chart', chart: {type: chart.id, data: chartData(chart)}, text: 'Body'};
  const deck = {name: chart.id, language: 'english', design: {fontScheme: 'calibri'}, slides: [slide]};
  const bare = {...deck, slides: [{...slide, chart: undefined}]};
  delete bare.slides[0].chart;
  const measured = engineOptions(deck);
  const withChart = marks(renderSvgDeck(deck, measured)[0]);
  const without = marks(renderSvgDeck(bare, measured)[0]);
  const native = withChart.text - without.text > 1;
  assert.equal(native, PREVIEW_NATIVE.includes(chart.id), `${chart.id}: the preview ${native ? 'now draws this chart natively: limitation resolved, add it to PREVIEW_NATIVE' : 'no longer draws it natively, though PREVIEW_NATIVE lists it'}`);
  const exported = unzipSync(await toPptx(deck, measured));
  const part = Object.keys(exported).find((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  assert.ok(part, `${chart.id}: the export carries a chart part`);
  const element = /<c:(\w+Chart)>/.exec(decoder.decode(exported[part]))?.[1];
  const nominal = chart.mappings.openxml.element;
  assert.equal(element, EXPORT_FALLBACK[chart.id] ?? nominal, `${chart.id}: exported as ${element}${EXPORT_FALLBACK[chart.id] || element === nominal ? '' : '; limitation resolved: delete its EXPORT_FALLBACK entry'}`);
  if (EXPORT_FALLBACK[chart.id]) assert.notEqual(element, nominal, `${chart.id}: limitation resolved, delete its EXPORT_FALLBACK entry`);
  assert.deepEqual(checkPptxTypefaces(exported, {fonts: ['Calibri', 'Roboto Mono'], monospace: ['Roboto Mono']}).violations, [], `${chart.id}: chart parts name only the chosen fonts`);
  chartPaths.push({id: chart.id, nominal, exported: element, previewNative: native});
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
  // The theme literal check catches a theme that names another catalog font.
  const themed = {...original};
  edited(themed, 'ppt/theme/theme1.xml', /<a:minorFont><a:latin typeface="Calibri"/, '<a:minorFont><a:latin typeface="Aptos"');
  assert.notEqual(/<a:minorFont><a:latin typeface="([^"]*)"/.exec(decoder.decode(themed['ppt/theme/theme1.xml']))?.[1], catalogTheme(deck).minor, 'the catalog literal differs from a swapped theme font');
}

// ---------------------------------------------------------------------------
// Named expected failures. These are not weakened assertions: each entry pins a
// known engine limitation exactly (preview and measured-export error codes), and
// the check fails with a "limitation resolved" message when the limitation goes
// away, so the entry gets deleted. An unmeasured export must still name only the
// chosen fonts.
// ---------------------------------------------------------------------------
async function expectLimitation(id, what, run, code) {
  let error;
  try {
    await run();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `${id}: ${what} no longer fails. Limitation resolved: delete the ${id} expected-failure entry (and move its scheme into positive coverage).`);
  assert.equal(error.code, code, `${id}: ${what} now fails with ${error.code}, not the pinned ${code}. Update or delete the ${id} entry.`);
}
const providedSample = (scheme) => byId('fontSchemes', scheme).textSample;
const GOOGLE_PENDING = ['open-sans', 'montserrat', 'poppins', 'raleway', 'pt-serif'];
assert.ok(pendingSchemes.every((scheme) => GOOGLE_PENDING.includes(scheme)), `schemes the registry cannot preview need an expected-failure entry: ${pendingSchemes}`);
const EXPECTED_FAILURES = [
  ...GOOGLE_PENDING.map((scheme) => ({
    id: `open-google-font-without-pinned-preview-face:${scheme}`,
    reason: 'The office and base packs ship no face for this OFL family, so the preview reports font-unavailable. The PPTX still names the chosen family. The scheme is a member of the open-google class and is drawn in the matrix as soon as the registry bundles it.',
    deck: {name: scheme, language: 'english', design: {fontScheme: scheme}, slides: [{id: 'a', title: providedSample(scheme), text: providedSample(scheme)}]},
    preview: 'font-unavailable',
    measuredExport: 'font-unavailable'
  })),
  ...Object.entries(SCHEME_LANGUAGE_GAPS).flatMap(([scheme, languages]) => languages.map((language) => ({
    id: `preview-face-lacks-${language === 'russian' ? 'cyrillic' : 'greek'}-glyphs:${scheme}+${language}`,
    reason: `The preview face that ${scheme} resolves to (${byId('fontSchemes', scheme).major}) has no ${language === 'russian' ? 'Cyrillic' : 'Greek'} glyphs, and Latin-slot ${language} text is drawn and measured with the scheme's face without a fallback, so the preview and the measured export report missing-glyph. Latin, and the schemes whose face covers the script, are unaffected.`,
    deck: {name: `${scheme} ${language}`, language, design: {fontScheme: scheme}, slides: [{id: 'a', title: TEXT[language].title, text: TEXT[language].body}]},
    preview: 'missing-glyph',
    measuredExport: 'missing-glyph'
  }))),
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
  await expectLimitation(failure.id, 'the preview', () => renderSvgDeck(failure.deck, measured), failure.preview);
  await expectLimitation(failure.id, 'the measured export', () => toPptx(failure.deck, measured), failure.measuredExport);
  const fonts = chosenFonts(failure.deck);
  const bytes = await toPptx(failure.deck);
  const check = checkPptxTypefaces(bytes, {fonts: fonts.chosen, monospace: fonts.monospace});
  assert.deepEqual(check.violations, [], `${failure.id}: an unmeasured export still names only the chosen fonts`);
}
// A one-column histogram loses its chart silently: no chart part, no graphic frame and no diagnostic.
{
  const id = 'single-series-histogram-chart-silently-dropped';
  const histogram = byId('chartTypes', 'histogram');
  assert.equal(histogram.columns.length, 1, 'the catalog histogram has one data column');
  const deck = {name: id, language: 'english', design: {fontScheme: 'calibri'}, slides: [{id: 'a', layout: 'chart-1x', title: 'Histogram', chart: {type: 'histogram', data: {columns: ['Value'], rows: [[3], [5], [8], [13]]}}, text: 'Body'}]};
  const exportDiagnostics = [];
  const exported = unzipSync(await toPptx(deck, {...engineOptions(deck), onDiagnostic: (diagnostic) => exportDiagnostics.push(diagnostic)}));
  const dropped = !Object.keys(exported).some((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name)) && !decoder.decode(exported['ppt/slides/slide1.xml']).includes('graphicFrame');
  assert.ok(dropped, `${id}: the chart is now exported. Limitation resolved: delete this entry.`);
  assert.deepEqual(exportDiagnostics, [], `${id}: the export now reports something. Update or delete this entry.`);
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
await writeFile(new URL('../artifacts/font-switch-matrix/report.json', import.meta.url), `${JSON.stringify({seed: matrix.seed, decks: matrix.rows.length, factors: FACTORS, rows: matrix.rows, chainLanguages: CHAIN_LANGUAGES, pendingSchemes, chartPaths, previewApproximatedCharts: chartPaths.filter((path) => !path.previewNative).map((path) => path.id), exportFallbackCharts: Object.keys(EXPORT_FALLBACK), expectedFailures: EXPECTED_FAILURES.map(({id, reason, preview, measuredExport}) => ({id, reason, preview, measuredExport})), substitutions: substitutionsSeen, unusedExpectations, states: stateReports}, null, 1)}\n`);
console.log(`Font switch matrix passed: ${matrix.rows.length} pairwise decks and ${switches - matrix.rows.length} fixed switches, ${stateReports.length} verified states, ${chartPaths.length} chart paths, ${Object.keys(substitutionsSeen).length} recorded substitutions, ${EXPECTED_FAILURES.length + 1} named expected failures, ${seconds.toFixed(1)} s.`);
