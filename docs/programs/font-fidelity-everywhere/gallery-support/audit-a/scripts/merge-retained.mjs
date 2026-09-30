// Merge a partial audit A run (ONLY=...) with rows retained from an earlier results.json, so that dimensions whose
// probe no longer applies to the current gallery snippets keep their last measured rows and their own heads.
// Usage (from audit-a/): node scripts/merge-retained.mjs <partial results.json> <earlier results.json> <dimension>[,<dimension>...] [out=results.json]
// The output records `meta.retained[dimension] = {commits, reason}`; build-support-status.mjs reads it so each retained
// item keeps the heads it was measured at, and summary.mjs prints it. Nothing else is changed.
import { readFile, writeFile } from 'node:fs/promises';

const [partialPath, earlierPath, dimArg, outPath = 'results.json'] = process.argv.slice(2);
if (!partialPath || !earlierPath || !dimArg) throw new Error('usage: merge-retained.mjs <partial.json> <earlier.json> <dimension,...> [out]');
const partial = JSON.parse(await readFile(partialPath, 'utf8'));
const earlier = JSON.parse(await readFile(earlierPath, 'utf8'));
const retained = dimArg.split(',');
const reason = 'image-treatments: the audit A probe measures design.slideImage; the gallery snippets (pptx-gallery#44) express the treatments with image backgrounds, image blocks and design.watermark instead, so the probe cannot classify them. Rows and heads are kept from the earlier run; the FF-38 parity audit measures the current snippets.';
const ORDER = ['backgrounds', 'image-treatments', 'headers-footers', 'blocks', 'layouts'];

const dims = [...new Set([...partial.results.map((r) => r.dimension), ...retained])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
const results = [];
const summary = {};
for (const d of dims) {
  const from = retained.includes(d) ? earlier : partial;
  const rows = from.results.filter((r) => r.dimension === d);
  if (!rows.length) throw new Error(`no ${d} rows in ${from === earlier ? earlierPath : partialPath}`);
  results.push(...rows);
  summary[d] = from.summary[d];
}
const meta = { ...partial.meta, retained: Object.fromEntries(retained.map((d) => [d, { commits: earlier.meta.commits, reason }])) };
await writeFile(outPath, JSON.stringify({ meta, summary, results }, null, 1));
console.log(`${results.length} results; retained ${retained.join(', ')} from ${Object.values(earlier.meta.commits).map((c) => c.slice(0, 7)).join('/')}`);
