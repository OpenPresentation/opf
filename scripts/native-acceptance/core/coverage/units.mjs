// NT-12: the coverage units of the native-test corpus, computed from the repository alone (no application, no .pptx).
// A unit is one thing a corpus file can show an application; the corpus is honest when every unit is on some slide of
// it, no deck is there without a unit of its own, and every known difference has a place a tier runs. Kinds:
//   schema:<location>     a schema location a deck uses (key, enum or const value, oneOf/anyOf branch, default layout),
//                         walked along spec/schemas/opf.schema.json with scripts/check-format-coverage.mjs;
//   feature:<id>          a manifest feature the file carries (on its slides, or on the whole file without `slides`);
//   script:<Name>         a Unicode script of the deck's text (Latin, Arabic, Han, ...);
//   variant:<name>        the export variant of the file;
//   known:<app>:<id>      a known difference of known/<app>.json whose `where` names the slide (a place's variant
//                         "native" is the corpus's "native-body": classify.mjs sameExport).
// Units are slide-local where the source says which slide; the rest (deck-level schema keys, a feature without slides,
// the variant) belong to the file.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLocations, createWalker, defaultLayoutIds, LAYOUT_LOCATION, label } from '../../../check-format-coverage.mjs';
import { sameExport } from '../classify/classify.mjs';
import { decksForTier, sourcesForTier, TIERS } from '../../qualification/tiers.mjs';
import { fileId } from '../result/result.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
export const MANIFEST_FILE = path.join(ROOT, 'scripts/native-acceptance/qualification/manifest.json');
export const KNOWN_DIR = path.join(ROOT, 'scripts/native-acceptance/known');
export const SCHEMA_FILE = path.join(ROOT, 'spec/schemas/opf.schema.json');
export const LAYOUTS_DIR = path.join(ROOT, 'packages/gallery/catalog/layouts');
export const EXAMPLES_DIR = path.join(ROOT, 'examples');
export { TIERS };

export const kindOf = (unit) => unit.slice(0, unit.indexOf(':'));
export const variantsOf = (deck) => (deck.variants ?? [{ name: 'default' }]).map((variant) => variant.name);

// ---------------------------------------------------------------------------------------------------- scripts of text

/** Scripts a letter can belong to, tried in this order (common first); a letter in none of them is "Other". */
const SCRIPT_NAMES = [
  'Latin', 'Greek', 'Cyrillic', 'Arabic', 'Hebrew', 'Han', 'Hiragana', 'Katakana', 'Hangul', 'Devanagari', 'Bengali', 'Gurmukhi',
  'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala', 'Thai', 'Lao', 'Tibetan', 'Myanmar', 'Khmer',
  'Georgian', 'Armenian', 'Ethiopic', 'Syriac', 'Thaana', 'Nko', 'Tifinagh', 'Mongolian', 'Bopomofo', 'Yi', 'Cherokee',
  'Canadian_Aboriginal', 'Javanese', 'Balinese', 'Vai', 'Adlam', 'Ol_Chiki', 'Coptic', 'Runic', 'Ogham', 'Braille',
];
const SCRIPT_TESTS = SCRIPT_NAMES.map((name) => [name, new RegExp(`\\p{Script=${name}}`, 'u')]);
const LETTER = /\p{L}/u;
/** Letters that several scripts share (the long-vowel mark of Japanese, for one) name no script of their own. */
const SHARED = /[\p{Script=Common}\p{Script=Inherited}]/u;
const scriptCache = new Map();
function scriptOf(character) {
  let script = scriptCache.get(character);
  if (script === undefined) {
    script = SHARED.test(character) ? null : (SCRIPT_TESTS.find(([, test]) => test.test(character))?.[0] ?? 'Other');
    scriptCache.set(character, script);
  }
  return script;
}

/** Values of these keys are names, ids, paths or colors, not text a slide shows. */
const NOT_TEXT = new Set(['$schema', 'id', 'src', 'href', 'source', 'url', 'font', 'fonts', 'color', 'type', 'layout']);

/** The Unicode scripts of the letters in a value (a deck, a slide or Markdown text). */
export function scriptsOf(value, out = new Set()) {
  if (typeof value === 'string') {
    for (const character of value) {
      if (!LETTER.test(character)) continue;
      const script = scriptOf(character);
      if (script) out.add(script);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) scriptsOf(item, out);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) if (!NOT_TEXT.has(key)) scriptsOf(item, out);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------- deck sources

/**
 * The slides of a Markdown deck (the OPF Markdown dialect): the text after the front matter split at `---` lines outside
 * fenced code. Enough to count slides and read their text; the schema walk takes JSON decks only.
 */
export function markdownSlides(text) {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) start = end + 1;
  }
  const slides = [[]];
  let fence = null;
  for (const line of lines.slice(start)) {
    const marker = /^\s*(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker && (fence === null || marker.startsWith(fence))) fence = fence === null ? marker : null;
    else if (fence === null && /^---\s*$/u.test(line)) {
      slides.push([]);
      continue;
    }
    slides.at(-1).push(line);
  }
  return slides.map((slide) => slide.join('\n')).filter((slide) => slide.trim() !== '');
}

/** Reads a deck source: { format: 'json'|'markdown', document?, slides: [slide JSON or Markdown text] }. */
export function readDeck(source, root = ROOT) {
  const text = readFileSync(path.resolve(root, source), 'utf8');
  if (source.endsWith('.json')) {
    const document = JSON.parse(text);
    return { format: 'json', document, slides: document.slides ?? [] };
  }
  if (source.endsWith('.md')) return { format: 'markdown', slides: markdownSlides(text) };
  throw new Error(`${source}: a corpus deck is .json or .md`);
}

// ---------------------------------------------------------------------------------------------------- inputs

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** known/<application>.json files: { application: records }. */
export function readKnownFiles(directory = KNOWN_DIR) {
  const out = {};
  for (const name of readdirSync(directory).sort()) {
    if (!name.endsWith('.json') || name.endsWith('.schema.json')) continue;
    const data = readJson(path.join(directory, name));
    if (!Array.isArray(data.records)) continue;
    out[data.target ?? name.slice(0, -'.json'.length)] = data.records;
  }
  return out;
}

/** The schema's countable locations, the default layouts included: Map label -> kind. */
export function schemaLocations(schema, layoutIds) {
  const locations = collectLocations(schema);
  for (const id of layoutIds) locations.set(`${LAYOUT_LOCATION}=${JSON.stringify(id)}`, { kind: 'layout' });
  return locations;
}

/**
 * Every input the units come from, read once. Pass parts to replace them in tests:
 * { root, manifest, known: {application: records}, schema, layoutIds, readDeck }.
 */
export function loadInputs(overrides = {}) {
  const root = overrides.root ?? ROOT;
  return {
    root,
    manifest: overrides.manifest ?? readJson(MANIFEST_FILE),
    known: overrides.known ?? readKnownFiles(),
    schema: overrides.schema ?? readJson(SCHEMA_FILE),
    layoutIds: overrides.layoutIds ?? defaultLayoutIds(LAYOUTS_DIR),
    readDeck: overrides.readDeck ?? ((source) => readDeck(source, root)),
  };
}

// ---------------------------------------------------------------------------------------------------- units

/**
 * The units of every corpus file. Returns
 *   { locations: Map label -> kind,
 *     decks: Map id -> { id, source, format, slideCount, variants },
 *     files: [{ id, deck, variant, slideCount, fileUnits: Set, slideUnits: [Set per slide] }] }.
 */
export function computeUnits(inputs = loadInputs()) {
  const { manifest, known, schema, layoutIds } = inputs;
  const locationIds = schemaLocations(schema, layoutIds);
  const countable = new Map([...locationIds.keys()].map((id) => [id, label(id)]));
  const locations = new Map([...locationIds].map(([id, { kind }]) => [label(id), kind]));
  const walk = createWalker(schema);
  const schemaUnits = (used) => [...used].filter((id) => countable.has(id)).map((id) => `schema:${countable.get(id)}`);

  const decks = new Map();
  const files = [];
  for (const entry of manifest.decks) {
    const source = inputs.readDeck(entry.source);
    const deck = { id: entry.id, source: entry.source, format: source.format, slideCount: source.slides.length, variants: variantsOf(entry) };
    decks.set(entry.id, deck);

    // What every variant of the deck shares: the deck-level schema units and per slide the schema units and scripts.
    const deckUnits = new Set();
    const shared = source.slides.map(() => new Set());
    if (source.format === 'json') {
      const { slides: _slides, ...rest } = source.document;
      for (const unit of schemaUnits(walk([{ ...rest, slides: [] }]))) deckUnits.add(unit);
      for (const unit of scriptsOf(rest)) deckUnits.add(`script:${unit}`);
      source.slides.forEach((slide, index) => {
        const used = walk([{ slides: [slide] }]);
        if (typeof slide?.layout === 'string') used.add(`${LAYOUT_LOCATION}=${JSON.stringify(slide.layout)}`);
        for (const unit of schemaUnits(used)) shared[index].add(unit);
        for (const script of scriptsOf(slide)) shared[index].add(`script:${script}`);
      });
    } else {
      source.slides.forEach((text, index) => {
        for (const script of scriptsOf(text)) shared[index].add(`script:${script}`);
      });
    }

    for (const variant of deck.variants) {
      const fileUnits = new Set([...deckUnits, `variant:${variant}`]);
      const slideUnits = shared.map((units) => new Set(units));
      for (const feature of manifest.features) {
        if (feature.deck !== entry.id || (feature.variant ?? 'default') !== variant) continue;
        const unit = `feature:${feature.id}`;
        if (!feature.slides?.length) fileUnits.add(unit);
        else for (const slide of feature.slides) slideUnits[slide - 1]?.add(unit);
      }
      for (const [application, records] of Object.entries(known)) {
        for (const record of records) {
          for (const place of record.where ?? []) {
            if (place.deck !== entry.id || !sameExport(place.variant, variant)) continue;
            slideUnits[place.slide - 1]?.add(`known:${application}:${record.id}`);
          }
        }
      }
      files.push({ id: fileId(entry.id, variant), deck: entry.id, variant, slideCount: deck.slideCount, fileUnits, slideUnits });
    }
  }
  return { locations, decks, files };
}

/** Every unit of a file (its own and its slides'). */
export function unitsOfFile(file) {
  const out = new Set(file.fileUnits);
  for (const units of file.slideUnits) for (const unit of units) out.add(unit);
  return out;
}

/** The files a tier runs from the corpus (its decks and variants), in the tier's order. */
export function filesForTier(units, manifest, tier) {
  const byId = new Map(units.files.map((file) => [file.id, file]));
  return decksForTier(manifest, tier).flatMap(({ deck, variants }) => variants.map((variant) => byId.get(fileId(deck, variant))));
}

/**
 * The example decks the `examples` source adds to a tier: every deck under examples/ that the manifest does not name,
 * in its default variant. Returns [{ source, slideCount }].
 */
export function exampleDecks(manifest, root = ROOT, read = (source) => readDeck(source, root)) {
  const named = new Set(manifest.decks.map((deck) => path.normalize(deck.source)));
  const out = [];
  const visit = (directory) => {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(relative);
      else if (/\.opf\.(json|md)$/u.test(entry.name) && !named.has(path.normalize(relative))) out.push({ source: relative.split(path.sep).join('/'), slideCount: read(relative).slides.length });
    }
  };
  visit('examples');
  return out;
}

/**
 * The files and slides a tier opens per application: the corpus files plus the sources that can be counted from the
 * repository (examples; gallery layouts at three sizes, one slide per layout). A source that has no decks in the
 * repository yet (languages) or depends on a release's fragments (native-fragments) is listed in `notModeled`.
 */
export function tierSize(units, inputs, tier) {
  const corpus = filesForTier(units, inputs.manifest, tier);
  let files = corpus.length;
  let slides = corpus.reduce((sum, file) => sum + file.slideCount, 0);
  const notModeled = [];
  const parts = [{ name: 'corpus', files, slides }];
  for (const source of sourcesForTier(inputs.manifest, tier)) {
    if (source === 'examples') {
      const examples = exampleDecks(inputs.manifest, inputs.root);
      const part = { name: 'examples', files: examples.length, slides: examples.reduce((sum, deck) => sum + deck.slideCount, 0) };
      parts.push(part);
      files += part.files;
      slides += part.slides;
    } else if (source === 'gallery-layouts') {
      const part = { name: 'gallery-layouts', files: 3, slides: 3 * inputs.layoutIds.length };
      parts.push(part);
      files += part.files;
      slides += part.slides;
    } else notModeled.push(source);
  }
  return { tier, files, slides, parts, notModeled };
}
