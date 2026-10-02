// Explicit maintenance command (FF-45): snapshot the authoritative OPF symbol font encodings (core
// spec/reference/symbol-font-encodings.json: the reversible code-to-Unicode tables for Symbol, Wingdings,
// Wingdings 2, Wingdings 3 and Webdings, verified against named Windows font versions) into
// src/symbol-encodings.js. The renderer keeps only what previews need: per family and code the Unicode
// equivalent (or the reason there is none) and the verified font's advance. Core owns the data and sources.
//   node scripts/update-symbol-encodings.mjs [path/to/opf/spec/reference/symbol-font-encodings.json]
//   node scripts/update-symbol-encodings.mjs --check [path]   fail when the snapshot differs
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2), check = args.includes('--check');
const source = path.resolve(args.find(arg => !arg.startsWith('--')) ?? fileURLToPath(new URL('../../opf/spec/reference/symbol-font-encodings.json', import.meta.url)));
const bytes = await readFile(source), table = JSON.parse(bytes.toString('utf8'));
const families = table.families.map(entry => ({
  family: entry.family,
  version: entry.verifiedAgainst.version,
  unitsPerEm: entry.verifiedAgainst.unitsPerEm,
  mapped: entry.summary.mapped,
  // codes[i] is code 0x20 + i: [unicode hex (code points joined with '+') or null, advance in font units or null, reason when unmapped]
  codes: entry.codes.map(row => [row.unicode, row.installed ? row.installed.advance : null, ...(row.unicode === null ? [row.reason] : [])]),
}));
const snapshot = {version: table.version, source: {path: 'spec/reference/symbol-font-encodings.json', sha256: createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex')}, families};
const contents = `// Generated deliberately by scripts/update-symbol-encodings.mjs from opf spec/reference/symbol-font-encodings.json; never during build/install.
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const SNAPSHOT=freeze(${JSON.stringify(snapshot)});
/** Per symbol-encoded family (FF-45): the verified font version and, for codes 0x20..0xFF in order, [unicode, advance, reason?]. */
export const SYMBOL_ENCODINGS=SNAPSHOT.families;
/** Which core table this snapshot came from. */
export const SYMBOL_ENCODINGS_SOURCE=freeze({version:SNAPSHOT.version,...SNAPSHOT.source});
`;
const target = new URL('../src/symbol-encodings.js', import.meta.url);
if (check) {
  const current = (await readFile(target, 'utf8')).replace(/\r\n/g, '\n');
  if (current !== contents) { console.error(`src/symbol-encodings.js differs from ${source}; run scripts/update-symbol-encodings.mjs.`); process.exit(1); }
  console.log(`src/symbol-encodings.js matches ${source}.`);
} else {
  await writeFile(target, contents);
  console.log(`Updated src/symbol-encodings.js from ${source} (${families.map(entry => `${entry.family} ${entry.mapped}/224`).join(', ')}).`);
}
