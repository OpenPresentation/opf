// RR-52: the renderer golden is stored one file per deck, so two pull requests that move different decks
// never touch the same file (and git merges them without a textual conflict).
//
// Layout of one baseline directory, e.g. test/golden/opf-examples-png.cover-centering/:
//   _baseline.json                           every manifest field except `entries` (version, source, format, scale, ...)
//   gallery/business-functions/foo.sha256.json   { "deck": "gallery/business-functions/foo.opf.json", "entries": { "<deck>#<slide>": { sha256, bytes } } }
//
// `readBaseline()` reassembles the exact manifest the single-file layout used to hold, so the comparison in
// golden.mjs (and its tolerances: none, the hashes are exact) is unchanged. A legacy single-file manifest still
// loads, which keeps older pins (and older OPF_GOLDEN_BASELINE values) working.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const META_FILE = '_baseline.json';
const DECK_SUFFIX = '.sha256.json';
const LEGACY_SUFFIX = '.sha256.json';

export function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
export function deckOfKey(key) { return key.slice(0, key.lastIndexOf('#')); }
export function deckFileName(deck) { return deck.replace(/\.opf\.json$/, '') + DECK_SUFFIX; }

// OPF_GOLDEN_BASELINE (or a default) names either a baseline directory or a legacy manifest file. A legacy
// `<name>.sha256.json` path that no longer exists as a file selects the directory `<name>/`, so every existing
// selection (renderer CI, core ecosystem CI, opf-pptx and opf-editor CI) keeps working after the migration.
export function resolveBaseline(selection) {
  const target = path.resolve(selection);
  if (existsSync(target)) return { kind: statSync(target).isDirectory() ? 'directory' : 'file', path: target };
  if (target.endsWith(LEGACY_SUFFIX)) {
    const directory = target.slice(0, -LEGACY_SUFFIX.length);
    if (existsSync(directory) && statSync(directory).isDirectory()) return { kind: 'directory', path: directory };
  }
  return { kind: 'missing', path: target };
}

export function readBaseline(selection) {
  const resolved = resolveBaseline(selection);
  if (resolved.kind === 'file') return JSON.parse(readFileSync(resolved.path, 'utf8'));
  if (resolved.kind === 'missing') readFileSync(resolved.path, 'utf8'); // throws ENOENT, as a missing manifest always did
  return assembleBaseline(resolved.path);
}

export function listDeckFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listDeckFiles(path.join(directory, entry.name), relative);
    return entry.isFile() && entry.name.endsWith(DECK_SUFFIX) ? [relative] : [];
  });
}

export function assembleBaseline(directory) {
  const meta = JSON.parse(readFileSync(path.join(directory, META_FILE), 'utf8'));
  const decks = listDeckFiles(directory).map(file => {
    const record = JSON.parse(readFileSync(path.join(directory, file), 'utf8'));
    if (deckFileName(record.deck) !== file) throw new Error(`${file}: names deck ${record.deck}, expected file ${deckFileName(record.deck)}`);
    return record;
  }).sort((a, b) => compare(a.deck, b.deck));
  const entries = {};
  for (const record of decks) for (const [key, value] of Object.entries(record.entries)) {
    if (deckOfKey(key) !== record.deck) throw new Error(`${record.deck}: entry ${key} belongs to another deck`);
    entries[key] = value;
  }
  return { ...meta, entries };
}

// Split a manifest into the metadata record and one record per deck (keys keep their manifest order).
export function splitManifest(manifest) {
  const { entries, ...meta } = manifest;
  const decks = new Map();
  for (const [key, value] of Object.entries(entries)) {
    const deck = deckOfKey(key);
    if (!decks.has(deck)) decks.set(deck, { deck, entries: {} });
    decks.get(deck).entries[key] = value;
  }
  const files = new Map();
  for (const deck of [...decks.keys()].sort(compare)) {
    const file = deckFileName(deck);
    if (files.has(file)) throw new Error(`Two decks map to ${file}`);
    files.set(file, decks.get(deck));
  }
  return { meta, files };
}

export function serialize(value) { return JSON.stringify(value, null, 2) + '\n'; }

// Write a manifest as a baseline directory. Only files whose bytes differ are rewritten, and files of decks that
// left the manifest are removed, so a regeneration touches exactly the decks that moved.
export function writeBaseline(directory, manifest) {
  const { meta, files } = splitManifest(manifest);
  const wanted = new Map([[META_FILE, serialize(meta)], ...[...files].map(([file, record]) => [file, serialize(record)])]);
  const result = { written: [], removed: [], unchanged: 0 };
  mkdirSync(directory, { recursive: true });
  for (const [file, text] of wanted) {
    const target = path.join(directory, file);
    if (existsSync(target) && readFileSync(target, 'utf8') === text) { result.unchanged++; continue; }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
    result.written.push(file);
  }
  for (const file of listDeckFiles(directory)) {
    if (wanted.has(file)) continue;
    rmSync(path.join(directory, file));
    result.removed.push(file);
  }
  return result;
}

// Decks (manifest `deck` paths) whose entries differ between two manifests, plus the slide keys that differ.
export function diffManifests(expected, next) {
  const keys = [...new Set([...Object.keys(expected.entries), ...Object.keys(next.entries)])];
  const changedSlides = keys.filter(key => JSON.stringify(expected.entries[key]) !== JSON.stringify(next.entries[key]));
  return { changedSlides, changedDecks: [...new Set(changedSlides.map(deckOfKey))].sort(compare) };
}
