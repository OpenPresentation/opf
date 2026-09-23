// Explicit maintenance command (FF-31): snapshot the authoritative OPF font policy table from a
// core checkout into src/font-policy.js. The renderer takes replacement families from it; core
// owns the data (spec/reference/font-policy.json), licensing sources and measurement evidence.
//   node scripts/update-font-policy.mjs [path/to/opf/spec/reference/font-policy.json]
//   node scripts/update-font-policy.mjs --check [path]   fail when the snapshot differs
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2), check = args.includes('--check');
const source = path.resolve(args.find(arg => !arg.startsWith('--')) ?? fileURLToPath(new URL('../../opf/spec/reference/font-policy.json', import.meta.url)));
const bytes = await readFile(source), table = JSON.parse(bytes.toString('utf8'));
// Apply the provisional owner decisions exactly as core applyFontPolicyDecisions() does.
const decisions = table.provisionalDecisions?.decisions ?? {};
for (const row of table.families) {
  const id = row.replacement?.decision;
  if (!id) continue;
  if (!decisions[id]) throw new Error(`${row.family}: unknown decision ${id}`);
  Object.assign(row.replacement, {family: decisions[id].replacement, compatibility: decisions[id].compatibility});
  if (decisions[id].metricModeFallback) row.replacement.metricModeFallback = true;
  if (row.replacement.measured && row.replacement.measured.replacement !== decisions[id].replacement) row.replacement.measured = null;
}
// Keep what renderers and exporters decide with; sources and notes stay in core.
const families = table.families.map(row => ({
  family: row.family, licenseClass: row.licenseClass, license: row.license, availability: row.availability,
  embeddableByOpf: row.embeddableByOpf, replacement: row.replacement, ...(row.alternates ? {alternates: row.alternates} : {}),
}));
const snapshot = {version: table.version, decisions: {status: table.provisionalDecisions?.status, ...decisions}, source: {path: 'spec/reference/font-policy.json', sha256: createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex')}, families};
const contents = `// Generated deliberately by scripts/update-font-policy.mjs from opf spec/reference/font-policy.json; never during build/install.
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const SNAPSHOT=freeze(${JSON.stringify(snapshot, null, 1)});
/** The OPF font policy rows (FF-31): license class, viewer availability and the open replacement. */
export const FONT_POLICY=SNAPSHOT.families;
/** Which core table this snapshot came from. */
export const FONT_POLICY_SOURCE=freeze({version:SNAPSHOT.version,...SNAPSHOT.source});
/** Provisional owner decisions applied to this snapshot (owner may revise). */
export const FONT_POLICY_DECISIONS=SNAPSHOT.decisions;
const byFamily=new Map(FONT_POLICY.map(row=>[row.family.toLowerCase(),row]));
/** The policy row for a family (case-insensitive), or undefined. */
export function fontPolicyFor(family){return typeof family==='string'?byFamily.get(family.trim().toLowerCase()):undefined;}
`;
const target = new URL('../src/font-policy.js', import.meta.url);
if (check) {
  const current = (await readFile(target, 'utf8')).replace(/\r\n/g, '\n');
  if (current !== contents) { console.error(`src/font-policy.js differs from ${source}; run scripts/update-font-policy.mjs.`); process.exit(1); }
  console.log(`src/font-policy.js matches ${source}.`);
} else {
  await writeFile(target, contents);
  console.log(`Updated src/font-policy.js from ${source} (${families.length} families). Review replacement changes and their font packs before committing.`);
}
