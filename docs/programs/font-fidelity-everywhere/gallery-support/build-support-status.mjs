// Builds support-status.json, the per-item machine-readable view of the
// FF-23 dimension audits, from audit-a/results.json and audit-b/results.json.
// Run from any directory: node build-support-status.mjs
// The output is deterministic for fixed inputs. Schema: README.md in this folder.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = async (p) => JSON.parse(await readFile(path.join(here, p), 'utf8'));
const a = await read('audit-a/results.json');
const b = await read('audit-b/results.json');

const short = (sha) => (typeof sha === 'string' ? sha.slice(0, 7) : null);
const headsA = Object.fromEntries(Object.entries(a.meta.commits).map(([k, v]) => [k, short(v)]));
headsA.node = a.meta.node?.replace(/^v/, '') ?? null;
const headsB = { ...b.heads };

const STATUSES = ['works', 'partial', 'schema-only', 'authoring-metadata', 'broken', 'gallery-only'];
const items = [];

for (const r of a.results) {
  const layout = r.dimension === 'layouts';
  const legacy = layout && r.master === 'Gallery' && r.origin !== 'core-catalog';
  const checks = r.checks ?? r.variants?.published?.checks ?? {};
  items.push({
    dimension: r.dimension,
    galleryId: r.id,
    opfId: layout ? (legacy ? null : r.id) : null,
    inCoreCatalog: layout ? r.origin === 'core-catalog' : null,
    status: r.class,
    measuredStatus: r.variants?.published?.measuredClass ?? null,
    withAssetsStatus: r.withAssetsClass ?? null,
    previewOnly: checks.render?.effect === true && checks.export?.native === false,
    opfValue: layout ? null : (r.opfMapping ?? null),
    reasons: r.reasons ?? [],
    audit: 'a',
    measuredHeads: headsA,
  });
}

for (const r of b.results) {
  const legacy = r.dimension === 'font-schemes-legacy';
  items.push({
    dimension: legacy ? 'font-schemes' : r.dimension,
    ...(legacy ? { subset: 'legacy' } : {}),
    galleryId: r.id,
    opfId: r.id,
    // Legacy font schemes resolve only through records the gallery inlines.
    inCoreCatalog: legacy ? false : r.catalogResolves,
    status: r.classification,
    measuredStatus: null,
    withAssetsStatus: null,
    previewOnly: null,
    opfValue: null,
    reasons: r.reasons ?? [],
    audit: 'b',
    measuredHeads: headsB,
  });
}

for (const item of items) {
  if (!STATUSES.includes(item.status)) throw new Error(`unknown status ${item.status} for ${item.dimension}:${item.galleryId}`);
}

const counts = {};
for (const item of items) {
  counts[item.dimension] ??= {};
  counts[item.dimension][item.status] = (counts[item.dimension][item.status] ?? 0) + 1;
}

const out = {
  schemaVersion: 1,
  program: 'font-fidelity-everywhere',
  item: 'FF-23',
  definitions: 'docs/programs/font-fidelity-everywhere/gallery-support.md#status-legend',
  statuses: STATUSES,
  audits: {
    a: { dimensions: [...new Set(a.results.map((r) => r.dimension))], heads: headsA, results: 'audit-a/results.json' },
    b: { dimensions: [...new Set(b.results.map((r) => r.dimension))], heads: headsB, generated: b.generated, results: 'audit-b/results.json' },
  },
  notMeasured: [{ dimension: 'charts', reason: 'reduction to Aspose.Slides-supported chart types in progress (FF-22)' }],
  sharedExportGaps: b.sharedExportGaps,
  counts,
  items,
};

await writeFile(path.join(here, 'support-status.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${items.length} items`);
for (const [d, c] of Object.entries(counts)) console.log(d, JSON.stringify(c));
