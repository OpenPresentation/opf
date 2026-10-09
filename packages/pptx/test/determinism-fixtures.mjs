// Fixtures and suites for test/determinism.mjs. Imported by each child process
// only after the child installed its clock, locale and fs-audit patches, so
// nothing here may import the exporter at parent level.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {observeLanguage} from '../dist/script-fonts.js';
import {examples} from '@openpresentation/opf/examples';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const image = name => new Uint8Array(readFileSync(new URL(`./fixtures/images/${name}`, import.meta.url)));
const dataUri = (name, type) => `data:${type};base64,${Buffer.from(image(name)).toString('base64')}`;
const DEFAULT_TIMESTAMP = '1980-01-01T00:00:00Z';
const EXPLICIT = {seed: 7, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
const DATETIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g;

// ---- authored decks ------------------------------------------------------
// The same slide structure is filled with text of each script so that chart
// categories, workbook cells, table cells, notes, headers and footers all carry
// Latin, CJK or RTL text. Numbers are chosen to expose locale-formatted output.
const numbers = [1234.5678, 0.000001, 12345678901, -3.5, 0.1 + 0.2];
const scripts = {
  latin: {language: 'en-US', title: 'İstanbul ıi İİ Straße résumé', text: 'Dotted İ, dotless ı, ß, ﬁ ligature and Ǆ digraph: İSTANBUL ıspanak ISTANBUL Straße.',
    items: ['Ünïcödé résumé — ﬁne', 'Turkish I: İ ı I i', 'Grapheme test: 👨‍👩‍👧‍👦 🇩🇪 é क्ष'], categories: ['Zürich', 'İzmir', 'Ağrı', 'Ișık', 'ß'], cells: ['İ', 'ı', '1.234,5', '1,234.5'],
    notes: 'Notes: İstanbul — Straße — ﬁ — 1.234,5 / 1,234.5\nSecond paragraph.', header: 'İSTANBUL ıi', footer: 'v1.0 · 1.234,5'},
  japanese: {language: 'ja-JP', title: '日本語の見出しと東京都千代田区', text: '吾輩は猫である。名前はまだ無い。ｶﾀｶﾅ　全角ＡＢＣ、こんにちは世界。',
    items: ['東京タワー', '漢字とひらがなとカタカナ', '禁則処理（かっこ）、句読点。'], categories: ['東京', '大阪', '京都', '札幌', '福岡'], cells: ['東京', '大阪', '１２３', '４５６'],
    notes: 'ノート：日本語の発表者メモ。', header: '日本語ヘッダー', footer: '第１版'},
  chinese: {language: 'zh-CN', title: '简体中文标题与繁體中文', text: '汉字简体中文，繁體中文，標點符號：「引號」。',
    items: ['北京市朝阳区', '上海市浦东新区', '臺北市信義區'], categories: ['北京', '上海', '臺北', '香港', '深圳'], cells: ['北京', '上海', '１２３', '４５６'],
    notes: '备注：演讲者笔记。', header: '简体标题', footer: '第一版'},
  korean: {language: 'ko-KR', title: '한국어 제목', text: '안녕하세요 세계. 한글 텍스트는 공백으로 줄바꿈됩니다.',
    items: ['서울특별시', '부산광역시', '첫째, 둘째'], categories: ['서울', '부산', '대구', '인천', '광주'], cells: ['서울', '부산', '123', '456'],
    notes: '메모: 발표자 노트.', header: '한국어 머리글', footer: '제1판'},
  arabic: {language: 'ar-SA', title: 'مرحبا بالعالم العربي', text: 'النص العربي يُكتب من اليمين إلى اليسار ١٢٣٤٥ ثم English داخل الجملة.',
    items: ['القاهرة والرياض', 'أرقام: ١٢٣ 456', 'كلمة ‏RTL‏ mixed'], categories: ['القاهرة', 'الرياض', 'دبي', 'عمّان', 'بيروت'], cells: ['القاهرة', 'الرياض', '١٢٣', '٤٥٦'],
    notes: 'ملاحظات: ملاحظات المتحدث.', header: 'رأس الصفحة', footer: 'النسخة الأولى'},
  hebrew: {language: 'he-IL', title: 'שלום עולם בעברית', text: 'טקסט עברי נכתב מימין לשמאל עם English ומספרים 12345 באמצע.',
    items: ['תל אביב', 'ירושלים וחיפה', 'מספרים: 123 456'], categories: ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'אילת'], cells: ['תל אביב', 'ירושלים', '123', '456'],
    notes: 'הערות: הערות המרצה.', header: 'כותרת עליונה', footer: 'גרסה ראשונה'},
  mixed: {language: 'en-US', title: 'Latin title 日本語 עברית العربية 한국어', text: 'CJK inside Latin: 東京 and 北京 and 서울, with RTL עברית and العربية, then Straße and İstanbul.',
    items: ['Mixed 日本語 item', 'Mixed עברית item', 'Mixed العربية item'], categories: ['Tokyo 東京', 'Berlin', 'Cairo القاهرة', 'İzmir', 'Seoul 서울'], cells: ['東京 Tokyo', 'עברית', 'العربية', 'İ ı'],
    notes: 'Notes mix: Latin 日本語 עברית العربية.', header: 'Mixed İ 日本語', footer: 'Page ١ 1 一'}
};
function scriptDeck(key) {
  const s = scripts[key];
  return {
    $schema: 'https://openpresentation.org/schema/opf/v1', name: `Determinism ${key}`, language: s.language, author: 'Determinism', organization: {id: 'org', name: 'İstanbul Örg 日本'},
    design: {header: {left: {text: s.header}, center: {text: '{{organization.name}}'}}, footer: {left: {date: '2026-04-23', dateFormat: 'MMM d, yyyy'}, center: {text: s.footer}, right: {text: '{{slide.number}}'}}},
    assets: {photo: {src: dataUri('wide.png', 'image/png'), alt: s.title}},
    slides: [
      {title: s.title, subtitle: s.text, items: s.items, notes: s.notes},
      {title: s.title, text: s.text, notes: s.notes},
      {title: s.categories[0], chart: {type: 'column', data: {columns: [s.categories[1], s.categories[2], s.categories[3]], rows: s.categories.map((category, i) => [category, numbers[i], numbers[(i + 1) % 5]])}}, notes: s.notes},
      {title: s.categories[1], chart: {type: 'pie', data: {columns: [s.categories[1], s.categories[2]], rows: s.categories.map((category, i) => [category, Math.abs(numbers[i])])}}},
      {title: s.categories[2], table: {columns: [s.cells[0], s.cells[1]], rows: [[s.cells[2], s.cells[3]], [s.cells[0], s.cells[1]], [`${numbers[0]}`, `${numbers[3]}`]]}},
      {title: s.categories[3], image: 'asset:photo', notes: s.notes},
      {title: 'Code', layout: 'code-1x', code: {source: `const key = '${s.categories[0]}'; // ${s.header}`, language: 'ts'}},
      {title: 'Metric', metric: {value: numbers[0], label: s.categories[1], description: s.text, delta: '+1,5'}},
      {title: 'Quote', quote: {text: s.text, attribution: s.categories[0], source: s.header}},
      {title: 'Timeline', timeline: {events: s.categories.slice(0, 3).map((category, i) => ({when: `Q${i + 1}`, what: category}))}}
    ]
  };
}
function webpDeck() {
  const files = [['wide.webp', 'image/webp'], ['wide-lossy.webp', 'image/webp'], ['wide-alpha.webp', 'image/webp'], ['webp-orientation-6.webp', 'image/webp'],
    ['webp-orientation-7.webp', 'image/webp'], ['wide-animated.webp', 'image/webp'], ['wide.jpg', 'image/jpeg'], ['wide.gif', 'image/gif'], ['orientation-6.jpg', 'image/jpeg']];
  return {name: 'Determinism images', slides: files.map(([file, type]) => ({title: file, image: {src: dataUri(file, type), alt: file}, notes: file}))};
}

// ---- inspection ----------------------------------------------------------
// Independent ZIP header reader: every local and central timestamp must be the
// authored one, at every nesting level.
function zipStamps(bytes, expected, prefix, problems) {
  const b = Buffer.from(bytes), end = b.length - 22;
  const fields = expected.slice(0, 19).split(/[-T:]/).map(Number);
  const count = b.readUInt16LE(end + 10);
  let p = b.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    const local = b.readUInt32LE(p + 42), n = b.readUInt16LE(p + 28), name = b.subarray(p + 46, p + 46 + n).toString();
    for (const offset of [p + 12, local + 10]) {
      const time = b.readUInt16LE(offset), date = b.readUInt16LE(offset + 2);
      const actual = [1980 + (date >> 9), (date >> 5) & 15, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2];
      if (actual.join() !== fields.join()) problems.push(`${prefix}${name}: ZIP date ${actual.join(',')} != ${fields.join(',')}`);
    }
    p += 46 + n + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
}
function inspect(bytes, expected) {
  const parts = {}, problems = [];
  zipStamps(bytes, expected, '', problems);
  const walk = (data, prefix) => {
    for (const [name, value] of Object.entries(unzipSync(data))) {
      parts[prefix + name] = sha(value);
      if (name.endsWith('.xlsx')) { zipStamps(value, expected, prefix + name + '!', problems); walk(value, prefix + name + '!'); continue; }
      if (!/\.(?:xml|rels)$/.test(name)) continue;
      const text = strFromU8(value);
      // Any datetime other than the authored timestamp is host time leaking in.
      for (const [found] of text.matchAll(DATETIME)) if (found !== expected.slice(0, 19)) problems.push(`${prefix}${name}: unexpected datetime ${found}`);
      if (name === 'docProps/core.xml') {
        for (const tag of ['created', 'modified']) if (!text.includes(`<dcterms:${tag} xsi:type="dcterms:W3CDTF">${expected}</dcterms:${tag}>`)) problems.push(`${prefix}${name}: dcterms:${tag} is not ${expected}`);
      }
    }
  };
  walk(bytes, '');
  return {parts, problems};
}

async function exportCase(cases, name, deck, options = {}, imports = false) {
  const before = JSON.stringify(deck);
  const bytes = await toPptx(deck, options);
  if (JSON.stringify(deck) !== before) throw new Error(`${name}: export mutated its input`);
  const expected = options.timestamp ?? DEFAULT_TIMESTAMP;
  const {parts, problems} = inspect(bytes, expected);
  if (problems.length) throw new Error(`${name}: ${problems.slice(0, 5).join('; ')}`);
  cases[name] = {sha256: sha(bytes), bytes: bytes.length, parts};
  if (imports) {
    const imported = JSON.stringify(await fromPptx(bytes));
    cases[`import:${name}`] = {sha256: sha(imported), bytes: imported.length};
  }
  return bytes;
}

const pick = names => names.map(name => {
  const found = examples.find(item => item.file.endsWith(`/${name}.opf.json`));
  if (!found) throw new Error(`Core example ${name} is not installed.`);
  return [name, found.deck];
});
const coreExamples = () => pick(['full-feature-tour', 'chart-type-sampler', 'header-footer-logo-set', 'table-and-code', 'metrics-quotes-timeline', 'language-and-writing', 'media-and-follow-up', 'rich-text-runs']);
const imageResolver = async () => image('wide.png');

// Importer tie-breaks compare with code units, never a locale collation. Both
// inputs tie on their primary key, so a locale-sensitive comparison could order them
// differently under a Turkish default locale (I sorts before i there, after it in root).
async function importTieBreaks(cases) {
  const run = tag => `<a:rPr lang="${tag}"/>`;
  const observed = observeLanguage({slides: [run('id-ID') + run('Id-ID'), run('zz-ZZ') + run('zz-ZZ')], theme: '', catalogs: undefined});
  const ranked = observed.ranked.map(([tag, count]) => tag + ':' + count);
  if (ranked.join() !== 'zz-ZZ:2,Id-ID:1,id-ID:1') throw new Error('language tie-break is not code-unit order: ' + ranked.join());
  cases['import-language-tie'] = {sha256: sha(JSON.stringify(ranked)), bytes: ranked.length};
  // slide01.xml and slide1.xml tie on slide number; without a slide list the importer orders by path.
  const entries = unzipSync(await toPptx({name: 'Tie', slides: [{title: 'First'}, {title: 'Second'}]}));
  entries['ppt/presentation.xml'] = strToU8(strFromU8(entries['ppt/presentation.xml']).replace(/<p:sldIdLst>[^]*?<[/]p:sldIdLst>/, ''));
  entries['ppt/slides/slide01.xml'] = entries['ppt/slides/slide2.xml'];
  entries['ppt/slides/_rels/slide01.xml.rels'] = entries['ppt/slides/_rels/slide2.xml.rels'];
  delete entries['ppt/slides/slide2.xml'];
  delete entries['ppt/slides/_rels/slide2.xml.rels'];
  const imported = await fromPptx(zipSync(entries));
  const titles = imported.slides.map(slide => slide.title).join();
  if (titles !== 'Second,First') throw new Error('slide path tie-break is not code-unit order: ' + titles);
  cases['import-slide-path-tie'] = {sha256: sha(JSON.stringify(imported)), bytes: titles.length};
}

export const suites = {
  async plain() {
    const cases = {};
    for (const key of Object.keys(scripts)) {
      const imports = key === 'latin' || key === 'arabic';
      await exportCase(cases, `script-${key}`, scriptDeck(key), {}, imports);
      if (imports || key === 'japanese') await exportCase(cases, `script-${key}:explicit`, scriptDeck(key), {...EXPLICIT, date: '2026-04-23'});
    }
    for (const [name, deck] of coreExamples()) await exportCase(cases, `example-${name}`, deck, {imageResolver}, name === 'full-feature-tour' || name === 'language-and-writing');
    await importTieBreaks(cases);
    // Concurrent exports share one deterministic Math.random seed slot; they must
    // still equal sequential output.
    const [a, b, c] = await Promise.all([toPptx(scriptDeck('latin')), toPptx(scriptDeck('japanese')), toPptx(scriptDeck('latin'))]);
    for (const [name, bytes] of [['latin', a], ['japanese', b], ['latin-again', c]]) {
      const sequential = name === 'japanese' ? cases['script-japanese'] : cases['script-latin'];
      if (sha(bytes) !== sequential.sha256) throw new Error(`concurrent export ${name} differs from the sequential export`);
    }
    return cases;
  },
  async registry() {
    // Bundled, SHA-verified font packs: no system font discovery. Every measured
    // export still names the chosen families (see test/export-chosen-fonts.mjs).
    const {loadFonts} = await import('@openpresentation/opf-render/fonts-node');
    const cases = {};
    for (const [label, config] of [['base', {pack: 'base'}], ['office-metric', {pack: 'office', substitutionPolicy: 'metric'}], ['office-visual', {pack: 'office', substitutionPolicy: 'visual'}]].map(([label, config]) => [label, {...config, fallbackFamily: 'Roboto', strictGlyphs: false}])) {
      const fonts = await loadFonts(config);
      for (const key of ['latin', 'japanese', 'arabic', 'mixed']) await exportCase(cases, `${label}:${key}`, scriptDeck(key), {fonts, strictAssets: true});
      await exportCase(cases, `${label}:full-feature-tour`, pick(['full-feature-tour'])[0][1], {fonts, imageResolver});
    }
    return cases;
  },
  async webp() {
    // WebP is converted with the pinned sharp/libvips build (bytes-in, bytes-out).
    const cases = {};
    await exportCase(cases, 'images-default', webpDeck(), {}, true);
    await exportCase(cases, 'images-preserve', webpDeck(), {imageFormat: 'preserve'});
    await exportCase(cases, 'script-latin-images', scriptDeck('latin'), {});
    return cases;
  }
};
