// NT-13: what an exported .pptx draws, per slide, as hashes that change only when the slide's content changes. A release
// candidate opens only the files with a slide whose hash differs from the last release's summary (select.mjs).
//
//   exportHashes(bytes) -> { deck, slides: [hash, ...] }   (slides in presentation order; HASH_DIGITS hex digits each)
//
// A slide's hash covers the slide part and every part it reaches through its relationships: charts (DrawingML chart and
// chartex parts with their cached values, style and color parts, and the embedded workbook's parts), diagrams (SmartArt
// data, layout, quick style, colors and drawing), pictures, media, the notes slide and tags. The parts all slides share are
// not followed from a slide: the slide layout, slide master, theme and notes master are named by their kind (and the
// layout by its name, which says which layout the slide uses); their content is in the deck hash.
// The deck hash covers the parts that change every slide's look: presentation.xml without its slide list and OPF's
// document tag (slide size, default text styles), presProps.xml, tableStyles.xml, every slide master with its theme, the
// slide layouts that slides use, and the notes master.
// What is not content is left out: docProps (titles, timestamps), viewProps.xml, [Content_Types].xml, relationship ids and
// part names. A part is hashed by its content with every relationship id it uses replaced by the hash of what the
// relationship reaches, so inserting a slide elsewhere (which renumbers chart5.xml, image3.png and rId4) changes no other
// slide's hash. A link to another slide is hashed as that slide's number in the deck.
// An embedded package (the chart's workbook, a zip) is hashed by its entries' names and content without docProps, so a zip
// timestamp does not count.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { unzipSync, strFromU8 } = createRequire(path.join(root, 'packages/pptx/package.json'))('fflate');

/** Stored hashes are the first HASH_DIGITS hex digits of a SHA-256 (64 bits: enough to tell a changed slide). */
export const HASH_DIGITS = 16;
/** Parts every slide shares: followed from the deck, named by kind from a slide. */
export const SHARED_TYPES = Object.freeze(['slideLayout', 'slideMaster', 'theme', 'notesMaster', 'handoutMaster']);
/** Parts that are not content: never hashed. */
const NOT_CONTENT = /^(docProps\/|\[Content_Types\]\.xml$|ppt\/viewProps\.xml$|customXml\/)/u;

const sha = (...chunks) => {
  const hash = createHash('sha256');
  for (const chunk of chunks) hash.update(chunk);
  return hash.digest('hex');
};
export const shortHash = (hex) => hex.slice(0, HASH_DIGITS);

function joinPath(base, target) {
  const parts = [];
  for (const part of `${base}/${target}`.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`, 'u').exec(tag)?.[1];
const fromXml = (text) => String(text ?? '').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&amp;/gu, '&');

/** A zip held in memory: parts by name, their relationships, and their XML text. */
class Package {
  constructor(bytes) {
    this.files = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }
  has(name) {
    return name in this.files;
  }
  text(name) {
    return strFromU8(this.files[name]);
  }
  /** [{ id, type, target, external }] of a part (target resolved to a part name unless external). */
  rels(part) {
    const directory = part.includes('/') ? part.slice(0, part.lastIndexOf('/')) : '';
    const name = `${directory ? `${directory}/` : ''}_rels/${part.slice(part.lastIndexOf('/') + 1)}.rels`;
    if (!this.has(name)) return [];
    return [...this.text(name).matchAll(/<Relationship\b[^>]*>/gu)].map(([tag]) => {
      const external = attribute(tag, 'TargetMode') === 'External';
      const target = fromXml(attribute(tag, 'Target'));
      return { id: fromXml(attribute(tag, 'Id')), type: String(attribute(tag, 'Type') ?? '').split('/').at(-1), target: external ? target : joinPath(directory, target), external };
    });
  }
}

const isZip = (bytes) => bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
const isXml = (name) => /\.(xml|rels|vml)$/iu.test(name);

/** An embedded package (a chart's workbook) by its entries, without docProps and zip timestamps. */
function zipContent(bytes) {
  let files;
  try {
    files = unzipSync(bytes);
  } catch {
    return sha(bytes);
  }
  const names = Object.keys(files)
    .filter((name) => !NOT_CONTENT.test(name))
    .sort();
  return sha(...names.flatMap((name) => [name, '\0', sha(files[name]), '\n']));
}

/**
 * The content hash of one part. `how.token(rel)` returns a fixed string for a relationship that is not followed (shared
 * parts, the slide itself, other slides), false to leave the relationship out, or null to follow it; `how.transform(name, text)` may drop what is not content.
 * A part already on the path is a cycle and is named by kind. `memo` keeps binary parts (by name, for the whole package)
 * and XML parts (for one walk: a part's tokens can depend on where the walk started).
 */
function partHash(pkg, name, how, memo, onPath = new Set()) {
  if (!pkg.has(name)) return `missing:${name.slice(name.lastIndexOf('.') + 1)}`;
  const bytes = pkg.files[name];
  if (!isXml(name)) {
    if (!memo.binary.has(name)) memo.binary.set(name, isZip(bytes) ? zipContent(bytes) : sha(bytes));
    return memo.binary.get(name);
  }
  if (memo.xml.has(name)) return memo.xml.get(name);
  onPath.add(name);
  const tokens = new Map();
  for (const rel of pkg.rels(name)) {
    let value = how.token(rel);
    if (value === false) continue;
    if (value === null) value = rel.external ? `external:${rel.target}` : onPath.has(rel.target) ? `cycle:${rel.type}` : `${rel.type}:${partHash(pkg, rel.target, how, memo, onPath)}`;
    tokens.set(rel.id, value);
  }
  onPath.delete(name);
  let text = pkg.text(name);
  if (how.transform) text = how.transform(name, text);
  // Relationship ids are attribute values with a prefix (r:id, r:embed, r:link, r:dm ...): each becomes what it reaches.
  text = text.replace(/(\s[A-Za-z_][\w.-]*:[A-Za-z_][\w.-]*=")([^"]*)(")/gu, (whole, head, value, tail) => (tokens.has(value) ? `${head}${tokens.get(value)}${tail}` : whole));
  const value = sha(text, '\0', [...tokens.values()].sort().join('\n'));
  // A part that closed a cycle hashes by where the walk entered it, so it is not kept.
  if (![...tokens.values()].some((item) => item.startsWith('cycle:'))) memo.xml.set(name, value);
  return value;
}

const newMemo = (binary = new Map()) => ({ binary, xml: new Map() });

const PRESENTATION = 'ppt/presentation.xml';

/** The slide parts in presentation order (p:sldIdLst). */
export function slideParts(pkg) {
  const byId = new Map(pkg.rels(PRESENTATION).map((rel) => [rel.id, rel]));
  const list = /<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/u.exec(pkg.text(PRESENTATION))?.[1] ?? '';
  return [...list.matchAll(/<p:sldId\b[^>]*>/gu)].map(([tag]) => byId.get(/\sr:id="([^"]*)"/u.exec(tag)?.[1])?.target).filter(Boolean);
}

/** The name a slide layout gives itself (p:cSld name), or its part name's kind when it has none. */
function layoutName(pkg, part) {
  if (!pkg.has(part)) return 'missing';
  return fromXml(/<p:cSld\b[^>]*\sname="([^"]*)"/u.exec(pkg.text(part))?.[1] ?? '') || 'unnamed';
}

/**
 * The hashes of an exported presentation.
 *   exportHashes(bytes) -> { deck, slides: [hash] }   (each HASH_DIGITS hex digits)
 */
export function exportHashes(bytes) {
  const pkg = new Package(bytes);
  if (!pkg.has(PRESENTATION)) throw new Error('not a presentation: there is no ppt/presentation.xml');
  const slides = slideParts(pkg);
  const position = new Map(slides.map((part, index) => [part, index + 1]));

  // Slides: shared parts by kind (a layout by its name), the slide itself and other slides by number.
  const usedLayouts = new Set();
  const binary = new Map();
  const slideHashes = slides.map((part) => {
    const token = (rel) => {
      if (rel.external) return null;
      if (rel.type === 'slideLayout') {
        usedLayouts.add(rel.target);
        return `slideLayout:${layoutName(pkg, rel.target)}`;
      }
      if (SHARED_TYPES.includes(rel.type)) return rel.type;
      if (rel.type === 'slide') return rel.target === part ? 'slide:self' : `slide:${position.get(rel.target) ?? 'missing'}`;
      return null;
    };
    return shortHash(partHash(pkg, part, { token }, newMemo(binary)));
  });

  // The deck: what every slide's look depends on. presentation.xml is followed to its masters (each with its theme),
  // notes master, presProps and tableStyles; its slide list, OPF's document tag and viewProps are left out, and a master's
  // layout list too: the layouts that slides use are counted below, each once.
  const deckToken = (rel) => {
    if (['slide', 'tags', 'viewProps', 'notesSlide'].includes(rel.type)) return false;
    if (rel.type === 'slideLayout') return 'slideLayout';
    if (rel.type === 'slideMaster') return 'slideMaster';
    return null;
  };
  const strip = (name, text) =>
    text
      .replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/u, '')
      .replace(/<p:sldLayoutIdLst>[\s\S]*?<\/p:sldLayoutIdLst>/u, '')
      .replace(name === PRESENTATION ? /<p:custDataLst>[\s\S]*?<\/p:custDataLst>/u : /$^/u, '');
  const masterToken = (rel) => (rel.type === 'slideMaster' ? null : deckToken(rel));
  const parts = [`presentation:${partHash(pkg, PRESENTATION, { token: masterToken, transform: strip }, newMemo(binary))}`];
  for (const layout of [...usedLayouts].sort()) parts.push(`slideLayout:${layoutName(pkg, layout)}:${partHash(pkg, layout, { token: deckToken }, newMemo(binary))}`);
  const deck = shortHash(sha(parts.sort().join('\n')));
  return { deck, slides: slideHashes };
}

/** exportHashes of a file on disk. */
export function exportHashesOfFile(file) {
  return exportHashes(readFileSync(file));
}

export const _internal = { Package, partHash, NOT_CONTENT };
