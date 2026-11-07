// node sweep.mjs <sweep-dir> [--only <prefix>]: write the SH-09 sweep decks (one slide each), and export each with the worktree's CLI
// to its preview PNG and its PPTX. Then: com-probe.ps1 on <sweep-dir>/pptx, and gate.mjs <sweep-dir>.
//   pyramid 1 to 8 entries, matrix 1 to 4; short, medium and long entries; three slide sizes (16:9, 4:3, 1:1), so three frame
//   proportions per arrangement; an Arabic (right to left) and a Japanese case of each.
import { mkdirSync, writeFileSync, existsSync, renameSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = process.argv[2], only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;
const font = process.argv.includes('--font') ? process.argv[process.argv.indexOf('--font') + 1] : 'source-sans-3';
const extra = process.argv.includes('--flags') ? process.argv[process.argv.indexOf('--flags') + 1].split(' ') : [];
for (const sub of ['decks', 'preview', 'pptx', 'pptx-shapes']) mkdirSync(`${dir}/${sub}`, { recursive: true });
const CLI = 'C:/opf-work/sh-09-smartart-tier1/packages/cli/dist/index.js';
const TEXT = {
  short: ['Vision', 'Plan', 'Build', 'Ship', 'Learn', 'Grow', 'Scale', 'Serve'],
  medium: ['Clear purpose', 'Shared goals', 'Team habits', 'Weekly reviews', 'Open roadmap', 'Fast feedback', 'Steady delivery', 'Happy customers'],
  long: ['Why we exist and who we serve', 'The few goals that matter this year', 'How teams plan, decide and ship', 'The reviews that keep plans honest', 'Data everyone can see and trust', 'Feedback loops measured in days', 'Releases that land every single week', 'Customers who stay and refer others'],
};
const SCRIPTS = {
  rtl: { language: { bcp47: 'ar', name: 'Arabic', direction: 'rtl', script: 'Arab', fontScheme: 'noto-sans-arabic' }, title: 'استراتيجيتنا', items: ['الرؤية', 'الأهداف', 'البرامج', 'الفرق والمنصة'] },
  cjk: { language: 'ja', title: '私たちの戦略', items: ['ビジョン', '目標と計画', 'プログラム', 'チームと基盤'] },
};
const SIZES = { wide: '16:9', standard: '4:3', square: '1:1' };
const instances = [];
for (const [kind, max] of [['pyramid', 8], ['matrix', 4]]) for (const [aspect, preset] of Object.entries(SIZES)) for (const text of ['short', 'medium', 'long']) for (let count = 1; count <= max; count++)
  instances.push({ id: `${kind}-${count}-${text}-${aspect}`, kind, count, text, aspect, preset, items: TEXT[text].slice(0, count), title: kind === 'pyramid' ? 'Our strategy' : 'Four markets' });
for (const kind of ['pyramid', 'matrix']) for (const [script, value] of Object.entries(SCRIPTS))
  instances.push({ id: `${kind}-4-${script}-wide`, kind, count: 4, text: script, aspect: 'wide', preset: '16:9', items: value.items, title: value.title, script, language: value.language });
const meta = {};
for (const instance of instances) {
  if (only && !instance.id.startsWith(only)) continue;
  // Latin instances use Source Sans 3, which OPF bundles and this machine has installed, so the preview and PowerPoint draw one font.
  const own = !instance.language && font === 'source-sans-3';
  const deck = { $schema: 'https://openpresentation.org/schema/opf/v1', name: instance.id, ...(instance.language ? { language: instance.language } : {}),
    ...(own ? { catalogs: { custom: { fontSchemes: { 'source-sans-3': { name: 'Source Sans 3', major: 'Source Sans 3', minor: 'Source Sans 3', type: 'sans-serif' } } } } } : {}),
    design: { dimensions: instance.preset, ...(own ? { fontScheme: 'source-sans-3' } : {}) }, slides: [{ layout: instance.kind, title: instance.title, items: instance.items }] };
  const file = `${dir}/decks/${instance.id}.opf.json`;
  writeFileSync(file, JSON.stringify(deck, null, 2));
  meta[`${instance.id}-1`] = { kind: instance.kind, count: instance.count, text: instance.text, aspect: instance.aspect, script: instance.script ?? 'latin' };
  for (const [out, flags] of [[`${dir}/preview/${instance.id}-1.png`, []], [`${dir}/pptx/${instance.id}.pptx`, extra], [`${dir}/pptx-shapes/${instance.id}.pptx`, ['--smart-art', 'shapes']]]) {
    let report;
    try { report = execFileSync('node', [CLI, 'convert', file, out, '--force', ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { report = error.stdout || String(error); }
    try { const r = JSON.parse(report); meta[`${instance.id}-1`].findings = [...new Set([...(meta[`${instance.id}-1`].findings ?? []), ...(r.findings ?? []).filter(f => !/typeface-not-office-safe/.test(f.ruleId)).map(f => `${f.ruleId}: ${f.message}`)])]; if (!r.ok) console.log(instance.id, r.error); }
    catch { console.log(instance.id, report.slice(0, 300)); }
  }
  process.stdout.write('.');
}
writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 2));
console.log(`\n${Object.keys(meta).length} instances`);
