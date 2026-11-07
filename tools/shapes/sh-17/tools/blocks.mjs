// node blocks.mjs <dir>: SH-17 list-block decks (two or more list blocks in a chevrons, flow or vertical-flow region), each exported to
// its preview PNG and its PPTX (native shapes: a SmartArt node holds no list). Then com-probe.ps1 on <dir>/pptx and sheets.
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = process.argv[2], CLI = 'C:/opf-work/sh-17-linear-smartart/packages/cli/dist/index.js';
for (const sub of ['decks', 'preview', 'pptx']) mkdirSync(`${dir}/${sub}`, { recursive: true });
const font = { catalogs: { custom: { fontSchemes: { 'source-sans-3': { name: 'Source Sans 3', major: 'Source Sans 3', minor: 'Source Sans 3', type: 'sans-serif' } } } } };
const sets = {
  short: [['Interview users', 'Map the journey'], ['Prototype', 'Test with five teams'], ['Decide', 'Plan the rollout'], ['Train', 'Support'], ['Measure', 'Report']],
  long: [['Interview the users who left', 'Map where onboarding stalls'], ['Prototype the new first week', 'Test it with five pilot teams'], ['Decide whether to scale it', 'Plan the rollout by region'], ['Train every team lead', 'Run weekly office hours'], ['Measure completion and churn', 'Report to the steering group']],
};
const meta = {};
for (const kind of ['chevrons', 'flow', 'vertical-flow']) for (const [aspect, preset] of [['wide', '16:9'], ['standard', '4:3']]) for (const [text, lists] of Object.entries(sets)) for (const count of [2, 3, 5]) {
  const id = `blocks-${kind}-${count}-${text}-${aspect}`;
  const deck = { $schema: 'https://openpresentation.org/schema/opf/v1', name: id, ...font, design: { dimensions: preset, fontScheme: 'source-sans-3' }, slides: [{ layout: kind, title: 'Three workstreams', blocks: lists.slice(0, count).map(items => ({ items })) }] };
  const file = `${dir}/decks/${id}.opf.json`;
  writeFileSync(file, JSON.stringify(deck, null, 2));
  meta[`${id}-1`] = { kind, count, text, aspect, script: 'latin', findings: [] };
  for (const out of [`${dir}/preview/${id}-1.png`, `${dir}/pptx/${id}.pptx`]) {
    let report;
    try { report = execFileSync('node', [CLI, 'convert', file, out, '--force'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { report = error.stdout || String(error); }
    try { const r = JSON.parse(report); meta[`${id}-1`].findings.push(...(r.findings ?? []).filter(f => !/typeface-not-office-safe/.test(f.ruleId)).map(f => `${f.ruleId}: ${f.message}`)); } catch { console.log(id, report.slice(0, 200)); }
  }
}
writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 2));
console.log(Object.keys(meta).length, 'block decks');
