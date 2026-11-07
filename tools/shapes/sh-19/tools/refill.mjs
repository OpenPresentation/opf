// node refill.mjs <sweep-dir> <id...>: export these decks live again and record their findings in meta.json (decks a concurrent build
// left without an export).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [dir, ...ids] = process.argv.slice(2), CLI = 'C:/opf-work/sh-19-smartart-layouts/packages/cli/dist/index.js';
const meta = JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8'));
for (const id of ids) {
  let report;
  try { report = execFileSync('node', [CLI, 'convert', `${dir}/decks/${id}.opf.json`, `${dir}/pptx/${id}.pptx`, '--force'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { report = error.stdout || String(error); }
  const r = JSON.parse(report);
  meta[`${id}-1`] = { ...(meta[`${id}-1`] ?? {}), findings: [...new Set((r.findings ?? []).filter(f => !/typeface-not-office-safe/.test(f.ruleId)).map(f => `${f.ruleId}: ${f.message}`))] };
}
writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 2));
console.log(ids.length, 'refilled');
