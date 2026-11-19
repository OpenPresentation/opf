// LH-27: a varied comparison corpus of about 1000 slides for the layout harvest (docs/programs/layout-harvest), split into
// batches of 50. Each batch is an OPF deck (records embedded) and a content-only brief for Claude Design: the brief carries the
// words, numbers and pictures of each slide in reading order and no layout name, region or arrangement.
//
//   node scripts/layout-harvest-corpus.mjs <out dir> [--batch-size 50]
//
// Needs the workspace built (`pnpm build`). Nothing in CI runs it: run it by hand after a change to the layouts or the examples.
//
// Content comes from the example decks (text, lists, metrics, charts, tables, quotes, timelines and code), so slides read like
// real ones. The corpus covers every default layout at 1 to 6 blocks of short and long content, dynamic compositions in every
// mode with mixed kinds, one slide of each structure the examples use, long titles, and dark-theme variants.
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {gallery} from '@openpresentation/gallery';
import {embed} from '@openpresentation/opf';
import {examples} from '@openpresentation/opf/examples';
import {layoutTemplate} from '@openpresentation/opf/composition';
import {promotedRegionKeys} from '@openpresentation/opf/validator';
import {toPng} from '@openpresentation/opf-render';

const out = path.resolve(process.argv[2] ?? 'artifacts/layout-harvest-corpus');
const sizeAt = process.argv.indexOf('--batch-size');
const batchSize = sizeAt > 0 ? Number(process.argv[sizeAt + 1]) : 50;
// A slide's promoted regions (`top`, `start`, `top:start+center`, ...).
const PROMOTED = new Set(promotedRegionKeys);
const KINDS = ['text', 'items', 'bullets', 'metric', 'chart', 'table', 'quote', 'timeline', 'code'];

// --- content pools from the examples ---
const pools = Object.fromEntries(KINDS.map(kind => [kind, []]));
const titles = [];
const seen = new Set();
// Each gallery example deck is a topic: a slide takes its title and content from one topic first, so it reads as one slide.
const topics = [];
let topic;
const keep = (kind, value) => {
  if (topic) topic.pools[kind].push(value);
  const key = `${kind}:${JSON.stringify(value)}`;
  if (seen.has(key)) return;
  seen.add(key);
  pools[kind].push(value);
};
const plainText = value => Array.isArray(value) ? value.map(run => (typeof run === 'string' ? run : run.text ?? '')).join('') : value;
const harvest = block => {
  if (!block || typeof block !== 'object') return;
  if (Array.isArray(block.blocks)) block.blocks.forEach(harvest);
  for (const kind of KINDS) {
    const value = block[kind];
    if (value === undefined) continue;
    if (kind === 'text' && typeof plainText(value) === 'string' && plainText(value).trim()) keep(kind, plainText(value));
    else if (kind === 'chart' && value?.data?.rows) keep(kind, value);
    else if (kind === 'table' && value?.rows) keep(kind, value);
    else if (['items', 'bullets'].includes(kind) && Array.isArray(value) && value.every(entry => typeof entry === 'string' || typeof entry?.text === 'string')) keep(kind, value);
    else if (['metric', 'quote', 'timeline', 'code'].includes(kind)) keep(kind, value);
  }
};
for (const {file, deck} of examples) {
  topic = file.includes('/gallery/') ? {name: deck.name, titles: [], pools: Object.fromEntries(KINDS.map(kind => [kind, []]))} : undefined;
  if (topic) topics.push(topic);
  for (const slide of deck.slides) {
    if (typeof slide.title === 'string' && slide.title.length > 3) { titles.push(slide.title); topic?.titles.push(slide.title); }
    harvest(slide);
    for (const [key, value] of Object.entries(slide)) if (PROMOTED.has(key)) harvest(value);
  }
}
const uniqueTitles = [...new Set(titles)];
const sized = (kind, long) => {
  const list = pools[kind];
  const measure = value => JSON.stringify(value).length;
  const sorted = [...list].sort((a, b) => measure(a) - measure(b));
  const half = Math.floor(sorted.length / 2);
  return long ? sorted.slice(half) : sorted.slice(0, Math.max(1, half));
};
let cursor = 0;
const current = () => topics[slides.length % topics.length];
// A slide never repeats a block: its topic's unused content first (longest first for long slides), then the shared pool.
let used = new Set();
const pick = (kind, long) => {
  const own = current().pools[kind].filter(value => !used.has(JSON.stringify(value)));
  const shared = sized(kind, long).filter(value => !used.has(JSON.stringify(value)));
  const sorted = [...own].sort((a, b) => JSON.stringify(a).length - JSON.stringify(b).length);
  const value = sorted.length ? (long ? sorted[sorted.length - 1] : sorted[0]) : shared.length ? shared[(cursor++ * 7) % shared.length] : sized(kind, long)[cursor++ % sized(kind, long).length];
  used.add(JSON.stringify(value));
  return structuredClone(value);
};

// --- pictures: landscapes, a portrait, a screen and three logo marks, as SVG data URIs ---
const svg = body => `data:image/svg+xml;base64,${Buffer.from(body).toString('base64')}`;
const landscape = (sky, hill, deep) => svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="1600" height="1000"><rect width="160" height="100" fill="${sky}"/><path d="M0 62 Q40 40 80 58 T160 50 V100 H0 Z" fill="${hill}"/><path d="M0 78 Q50 64 100 76 T160 72 V100 H0 Z" fill="${deep}"/></svg>`);
const PICTURES = [
  {src: landscape('#9cc3ee', '#3f8a55', '#2f6b42'), alt: 'Green hills under a pale blue sky'},
  {src: landscape('#f3d2b3', '#b96b50', '#854b48'), alt: 'Warm earth hills at sunset'},
  {src: landscape('#d9d2ea', '#756b96', '#514767'), alt: 'Purple hills in evening light'},
  {src: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="1000" height="1400"><rect width="100" height="140" fill="#e8eef5"/><circle cx="50" cy="52" r="22" fill="#8aa2bd"/><path d="M14 140 Q50 84 86 140 Z" fill="#8aa2bd"/></svg>'), alt: 'Portrait silhouette on a light background'},
  {src: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="1600" height="1000"><rect width="160" height="100" fill="#f4f6f8"/><rect x="8" y="8" width="144" height="12" fill="#2874a6"/><rect x="8" y="28" width="44" height="64" fill="#dce3ea"/><rect x="60" y="28" width="92" height="28" fill="#c9d6e2"/><rect x="60" y="62" width="92" height="30" fill="#e3e9ef"/></svg>'), alt: 'Screenshot of a dashboard with a header bar and three panels'},
];
const LOGOS = ['M220 170V70l160 100V70', 'M230 60h140v24H254v34h96v24h-96v38h-24z', 'M260 120h80M300 80v80'].map((d, index) => ({
  src: svg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240"><rect width="600" height="240" fill="#f0f0f0"/><path d="${d}" fill="${index === 1 ? '#263445' : 'none'}" stroke="#263445" stroke-width="22"/></svg>`),
  alt: `${['NORTH', 'FIELD', 'STUDIO'][index]}, fictional logo`,
}));
let pictureCursor = 0;
const picture = () => ({image: structuredClone(PICTURES[pictureCursor++ % PICTURES.length])});

// --- the payload of one block of a kind ---
const block = (kind, long) => {
  if (kind === 'image') return picture();
  if (kind === 'video') return picture();
  if (kind === 'list') return {items: pick('items', long)};
  if (kind === 'group') return {text: pick('text', long)};
  if (!KINDS.includes(kind)) return {text: pick('text', long)};
  return {[kind]: pick(kind, long)};
};
const titleFor = (index, long) => {
  const own = current().titles;
  if (own.length) return long ? `${current().name}: ${own[index % own.length].toLowerCase()}` : own[index % own.length];
  const sortedTitles = [...uniqueTitles].sort((a, b) => a.length - b.length);
  const list = long ? sortedTitles.slice(-Math.ceil(sortedTitles.length / 4)) : sortedTitles.slice(0, Math.ceil(sortedTitles.length * 3 / 4));
  return list[(index * 13) % list.length];
};

const slides = [];
const add = (slide, tags) => { slides.push({slide, tags}); used = new Set(); };

// 1. Every default layout at 1 to 6 blocks of short and long content (up to 9 where a layout lists entries).
const MANY = new Set(['list', 'agenda', 'faq', 'process', 'pillars', 'team', 'metrics', 'scorecard', 'gallery', 'logos']);
const regionKinds = record => {
  const template = layoutTemplate(record);
  // layoutTemplate reads a region without a role as primary (OPF 0.35: the records leave `role: "primary"` out).
  const regions = [...template.regions].sort((a, b) => (a.role === 'primary' ? 0 : 1) - (b.role === 'primary' ? 0 : 1));
  return regions.map(region => region.accepts.find(kind => kind !== 'group' && kind !== 'video') ?? 'text');
};
for (const [id, record] of Object.entries(gallery.layouts)) {
  const kinds = regionKinds(record);
  if (!kinds.length) {
    for (const long of [false, true]) add({layout: id, title: titleFor(slides.length, long), ...(long ? {subtitle: pick('text', false)} : {})}, ['layout', id, long ? 'long' : 'short']);
    continue;
  }
  for (const long of [false, true]) {
    for (let count = 1; count <= (MANY.has(id) ? 9 : 6); count++) {
      if (id === 'logos') {
        add({layout: id, title: titleFor(slides.length, long), blocks: Array.from({length: count}, (_, index) => ({image: structuredClone(LOGOS[index % LOGOS.length])}))}, ['layout', id, `n${count}`]);
        continue;
      }
      const blocks = Array.from({length: count}, (_, index) => block(id === 'gallery' ? 'image' : kinds[index % kinds.length], long));
      add({layout: id, title: titleFor(slides.length, long && count > 3), blocks}, ['layout', id, `n${count}`, long ? 'long' : 'short']);
    }
  }
}

// 2. Dynamic compositions: each mode with 2 to 6 blocks of mixed kinds.
const MIXES = [['text', 'chart'], ['chart', 'items'], ['metric', 'metric', 'metric'], ['table', 'text'], ['quote', 'image'], ['chart', 'metric', 'quote'], ['text', 'text', 'text', 'text'], ['image', 'text', 'quote'], ['code', 'text'], ['timeline', 'metric'], ['metric', 'chart', 'table', 'quote'], ['items', 'items', 'items'], ['chart', 'chart'], ['text', 'metric', 'metric', 'image']];
for (const mode of [undefined, 'auto', 'row', 'column', 'grid']) {
  for (const [index, mix] of MIXES.entries()) {
    for (const long of [false, true]) {
      const blocks = mix.map(kind => block(kind, long));
      add({title: titleFor(slides.length, false), ...(mode ? {composition: {mode}} : {}), blocks}, ['dynamic', mode ?? 'default', `mix${index}`, long ? 'long' : 'short']);
    }
  }
}

// 3. One slide of each structure the examples use, with its own content. A slide whose picture is not an SVG or PNG data URI
// (an asset reference, a file path, a URL, another format) is left out: the brief hands each picture over as a PNG file.
const imageSource = image => (typeof image === 'string' ? image : image?.src);
const INLINE_PICTURE = /^data:image\/(svg\+xml|png)[;,]/;
const picturesInline = value => {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(picturesInline);
  if (value.image !== undefined && !INLINE_PICTURE.test(String(imageSource(value.image)))) return false;
  return Object.values(value).every(picturesInline);
};
const signatures = new Set();
for (const {file, deck} of examples) {
  for (const slide of deck.slides) {
    const kinds = [];
    const collect = value => { if (!value || typeof value !== 'object') return; if (value.blocks) value.blocks.forEach(collect); for (const kind of [...KINDS, 'image', 'video']) if (value[kind] !== undefined) kinds.push(kind); };
    collect(slide);
    for (const [key, value] of Object.entries(slide)) if (PROMOTED.has(key)) collect(value);
    const signature = `${slide.layout ?? 'auto'}|${kinds.sort().join(',')}|${Object.keys(slide).filter(key => PROMOTED.has(key)).sort().join(',')}`;
    if (signatures.has(signature) || !picturesInline(slide)) continue;
    signatures.add(signature);
    const copy = structuredClone(slide);
    delete copy.id;
    delete copy.notes;
    delete copy.beat;
    if (copy.layout && !gallery.layouts[copy.layout]) delete copy.layout;
    add(copy, ['example', file.replace(/^examples\//, '')]);
  }
}

// 4. Dark-theme variants of every third slide so far.
const lightCount = slides.length;
for (let index = 0; index < lightCount; index += 3) add(structuredClone(slides[index].slide), [...slides[index].tags, 'dark']);

// --- batches ---
mkdirSync(out, {recursive: true});
const order = slides.map((entry, index) => ({...entry, index})).sort((a, b) => ((a.index * 37) % slides.length) - ((b.index * 37) % slides.length));
const light = order.filter(entry => !entry.tags.includes('dark')), dark = order.filter(entry => entry.tags.includes('dark'));
const batches = [];
for (const [list, theme] of [[light, 'light'], [dark, 'dark']]) for (let start = 0; start < list.length; start += batchSize) batches.push({theme, entries: list.slice(start, start + batchSize)});
const fmt = (value, format) => typeof value === 'number' && format?.includes('%') ? `${Math.round(value * 100)}%` : String(value);
const describe = (blockValue, images) => {
  if (blockValue.blocks) return `a group of: ${blockValue.blocks.map(child => describe(child, images)).join('; ')}`;
  const text = value => typeof value === 'string' ? value : plainText(value);
  if (blockValue.text !== undefined) return `text: "${text(blockValue.text)}"`;
  if (blockValue.bullets) return `bullet points: ${blockValue.bullets.map(entry => `"${text(typeof entry === 'object' && entry && !Array.isArray(entry) ? entry.text : entry)}"`).join(', ')}`;
  if (blockValue.items) return `list: ${blockValue.items.map(entry => typeof entry === 'string' || Array.isArray(entry) ? `"${text(entry)}"` : `"${text(entry.text)}"${entry.description ? ` (description: "${String(entry.description).replace(/\n/g, ' — ')}")` : ''}`).join(', ')}`;
  if (blockValue.metric) { const metric = typeof blockValue.metric === 'object' ? blockValue.metric : {value: blockValue.metric}; return `key number: ${metric.value}${metric.unit ? ` ${metric.unit}` : ''}${metric.label ? `, label "${metric.label}"` : ''}${metric.description ? `, note "${metric.description}"` : ''}${metric.delta ? `, change "${metric.delta}"` : ''}${metric.trend ? `, trend ${metric.trend}` : ''}`; }
  if (blockValue.quote) { const quote = typeof blockValue.quote === 'string' ? {text: blockValue.quote} : blockValue.quote; return `quotation: "${text(quote.text)}"${quote.attribution ? ` — ${quote.attribution}` : ''}`; }
  if (blockValue.chart) {
    const chart = blockValue.chart, columns = chart.data.columns.map(column => typeof column === 'string' ? {name: column} : column);
    return `${chart.type ?? 'column'} chart: ${columns.slice(1).map(column => column.name).join(', ')} by ${columns[0].name}; ${chart.data.rows.map(row => `${row[0]}: ${row.slice(1).map((value, index) => fmt(value, columns[index + 1]?.format)).join(' / ')}`).join(', ')}`;
  }
  if (blockValue.table) { const columns = (blockValue.table.columns ?? []).map(column => typeof column === 'string' ? {name: column} : column); return `table${columns.length ? ` with columns ${columns.map(column => `"${column.name}"`).join(', ')}` : ''}; rows: ${blockValue.table.rows.map(row => `[${row.map((value, index) => fmt(typeof value === 'object' && value ? value.value ?? value.text : value, columns[index]?.format)).join(', ')}]`).join('; ')}`; }
  if (blockValue.timeline) { const events = Array.isArray(blockValue.timeline) ? blockValue.timeline : blockValue.timeline.events; return `timeline: ${events.map(event => `${event.when}: ${event.what}`).join(' → ')}`; }
  if (blockValue.code) { const code = typeof blockValue.code === 'string' ? {source: blockValue.code} : blockValue.code; return `code${code.language ? ` (${code.language})` : ''}:\n\`\`\`\n${code.source}\n\`\`\``; }
  if (blockValue.image) {
    const key = imageSource(blockValue.image);
    if (!images.has(key)) images.set(key, `image-${images.size + 1}.png`);
    return `picture (file images/${images.get(key)}; alt: "${blockValue.image.alt ?? ''}")`;
  }
  return `content: ${JSON.stringify(blockValue).slice(0, 200)}`;
};
const PALETTES = {
  light: 'background #FFFFFF (alternate surface #F0F0F0), text #000000, secondary text #595959, accent #2874A6, dark #011842',
  dark: 'background #011842 (alternate surface #0B2A5C), text #FFFFFF, secondary text #C9D3E0, accent #5499C7, light #F0F0F0',
};
const manifest = [];
for (const [number, {theme, entries}] of batches.entries()) {
  const name = `batch-${String(number + 1).padStart(2, '0')}`;
  const dir = path.join(out, name);
  mkdirSync(path.join(dir, 'brief', 'images'), {recursive: true});
  const deck = {
    $schema: 'https://openpresentation.org/schema/opf/v1', name: `Layout harvest ${name}`, language: 'en',
    design: {background: theme === 'dark' ? 'dark2' : 'light1'},
    slides: entries.map((entry, index) => ({...entry.slide, id: `s${String(index + 1).padStart(2, '0')}`})),
  };
  const {document} = embed(deck, {catalogs: [gallery]});
  writeFileSync(path.join(dir, 'deck.opf.json'), `${JSON.stringify(document, null, 2)}\n`);
  const images = new Map();
  let brief = `# Content for a ${entries.length}-slide deck\n\nBrand colors: ${PALETTES[theme]}. Typeface: Roboto (Roboto Mono for code).\n\nOne slide per entry, in this order. Each entry lists the slide's title, subtitle and content in reading order.\n\n`;
  for (const [index, entry] of entries.entries()) {
    const slide = entry.slide, parts = [];
    for (const child of slide.blocks ?? []) parts.push(describe(child, images));
    for (const [key, value] of Object.entries(slide)) if (PROMOTED.has(key)) parts.push(describe(value, images));
    for (const kind of [...KINDS, 'image']) if (slide[kind] !== undefined && !slide.blocks) parts.push(describe({[kind]: slide[kind]}, images));
    brief += `## s${String(index + 1).padStart(2, '0')}\n\n- Title: "${plainText(slide.title) ?? ''}"\n${slide.subtitle ? `- Subtitle: "${plainText(slide.subtitle)}"\n` : ''}${parts.map(part => `- ${part}`).join('\n')}\n\n`;
  }
  for (const [src, file] of images) {
    const comma = src.indexOf(',');
    const bytes = src.slice(0, comma).endsWith(';base64') ? Buffer.from(src.slice(comma + 1), 'base64') : Buffer.from(decodeURIComponent(src.slice(comma + 1)));
    writeFileSync(path.join(dir, 'brief', 'images', file), src.startsWith('data:image/png') ? bytes : await toPng(bytes.toString(), {scale: 1}));
  }
  writeFileSync(path.join(dir, 'brief', 'content.md'), brief);
  manifest.push({batch: name, theme, slides: entries.map((entry, index) => ({id: `s${String(index + 1).padStart(2, '0')}`, tags: entry.tags}))});
}
writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${slides.length} slides in ${batches.length} batches -> ${out}`);
