// Builds support-status.json, the per-item machine-readable view of the
// FF-23 presence audits (audit-a/results.json, audit-b/results.json) and the
// FF-38 parity scoreboard (parity/parity-results.json).
// Run from any directory: node build-support-status.mjs
// The output is deterministic for fixed inputs. Schema: README.md in this folder.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = async (p) => JSON.parse(await readFile(path.join(here, p), 'utf8'));
const a = await read('audit-a/results.json');
const b = await read('audit-b/results.json');
const p = await read('parity/parity-results.json');

const short = (sha) => (typeof sha === 'string' ? sha.slice(0, 7) : null);
const shortHeads = (heads, node) => {
  const out = Object.fromEntries(Object.entries(heads).map(([k, v]) => [k, short(v)]));
  if (node) out.node = node.replace(/^v/, '');
  return out;
};
const headsA = shortHeads(a.meta.commits, a.meta.node);
const headsB = { ...b.heads };
const headsP = shortHeads(p.meta.heads, p.meta.node);

const STATUSES = ['works', 'partial', 'schema-only', 'authoring-metadata', 'broken', 'gallery-only'];
const PARITY_STATUSES = ['perfect', 'near', 'mismatch'];
const PARITY_CHECKS = Object.keys(p.results[0].checks);

// Section anchors in gallery-support.md, for consumers that link per dimension.
const SECTION_ANCHORS = {
  layouts: 'layouts',
  'color-schemes': 'color-schemes',
  'font-schemes': 'font-schemes',
  languages: 'languages',
  backgrounds: 'backgrounds',
  narratives: 'narratives',
  charts: 'charts',
  themes: 'themes',
  audiences: 'audiences',
  tones: 'tones',
  socials: 'socials',
  'headers-footers': 'headers-and-footers',
  blocks: 'content-blocks',
  'image-treatments': 'image-treatments',
};

// Parity dimension names match the gallery dimensions, except the legacy font schemes.
const galleryDimension = (d) => (d === 'font-schemes-legacy' ? 'font-schemes' : d);
const keyOf = (dimension, id) => `${dimension}:${id}`;

function paritySummary(r) {
  if (!PARITY_STATUSES.includes(r.class)) throw new Error(`unknown parity class ${r.class} for ${r.dimension}:${r.id}`);
  const failedChecks = PARITY_CHECKS.filter((c) => r.checks[c] === 'fail');
  const nearChecks = PARITY_CHECKS.filter((c) => r.checks[c] === 'near');
  const topReasons = (r.diffs ?? [])
    .filter((d) => d.status === 'fail')
    .map((d, i) => ({ d, i }))
    .sort((x, y) => (y.d.count ?? 0) - (x.d.count ?? 0) || x.i - y.i)
    .slice(0, 5)
    .map(({ d }) => `${d.check} | ${d.reason}`);
  return { status: r.class, failedChecks, nearChecks, topReasons };
}

const parityByKey = new Map();
for (const r of p.results) {
  const k = keyOf(galleryDimension(r.dimension), r.id);
  const entry = parityByKey.get(k) ?? { dimension: galleryDimension(r.dimension), id: r.id, variants: {} };
  if (entry.variants[r.variant]) throw new Error(`duplicate parity record ${k} ${r.variant}`);
  entry.variants[r.variant] = paritySummary(r);
  parityByKey.set(k, entry);
}
const parityFor = (dimension, id) => {
  const entry = parityByKey.get(keyOf(dimension, id));
  if (!entry) return null;
  entry.used = true;
  const { published, ...rest } = entry.variants;
  if (!published) throw new Error(`no published parity record for ${dimension}:${id}`);
  return Object.keys(rest).length ? { ...published, variants: rest } : published;
};

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
    parity: parityFor(r.dimension, r.id),
  });
}

for (const r of b.results) {
  const legacy = r.dimension === 'font-schemes-legacy';
  const dimension = galleryDimension(r.dimension);
  items.push({
    dimension,
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
    parity: parityFor(dimension, r.id),
  });
}

for (const item of items) {
  if (!STATUSES.includes(item.status)) throw new Error(`unknown status ${item.status} for ${item.dimension}:${item.galleryId}`);
  if (!item.parity) throw new Error(`no parity record for ${item.dimension}:${item.galleryId}`);
}

// Ids recorded under the core slug because the gallery id is a misspelling that
// core's text-integrity check rejects (see README.md, "Normalized ids").
// The original slug is stored as parts (joined with `joiner`), as
// scripts/check-text-integrity.mjs spells it, because the joined literal is rejected.
const NORMALIZED_IDS = {
  'charts:united-kingdom': {
    fromParts: ['united', 'kindom'],
    joiner: '-',
    to: 'united-kingdom',
    reason: 'pptx-gallery uses a misspelled slug for this chart that core check-text-integrity rejects; recorded under the core chart-type id',
  },
};

// Values measured only by the parity audit (charts until FF-22 lands).
const parityOnly = [...parityByKey.values()]
  .filter((e) => !e.used)
  .map((e) => {
    const { published, ...rest } = e.variants;
    const note = NORMALIZED_IDS[keyOf(e.dimension, e.id)];
    return {
      dimension: e.dimension,
      galleryId: e.id,
      ...(note ? { galleryIdNormalized: note } : {}),
      parity: Object.keys(rest).length ? { ...published, variants: rest } : published,
    };
  });

const counts = {};
for (const item of items) {
  counts[item.dimension] ??= {};
  counts[item.dimension][item.status] = (counts[item.dimension][item.status] ?? 0) + 1;
}

const parityCounts = { total: p.results.length, perfect: 0, near: 0, mismatch: 0, checksPassed: {} };
for (const c of PARITY_CHECKS) parityCounts.checksPassed[c] = 0;
for (const r of p.results) {
  parityCounts[r.class] += 1;
  for (const c of PARITY_CHECKS) if (r.checks[c] === 'pass') parityCounts.checksPassed[c] += 1;
}
const withAssetsRecords = p.results.filter((r) => r.variant !== 'published').length;

const out = {
  schemaVersion: 1,
  program: 'font-fidelity-everywhere',
  item: 'FF-23',
  definitions: 'docs/programs/font-fidelity-everywhere/gallery-support.md#status-legend',
  parityDefinitions: 'docs/programs/font-fidelity-everywhere/gallery-support.md#parity-scoreboard',
  sectionAnchors: SECTION_ANCHORS,
  statuses: STATUSES,
  parityStatuses: PARITY_STATUSES,
  audits: {
    a: { dimensions: [...new Set(a.results.map((r) => r.dimension))], heads: headsA, results: 'audit-a/results.json' },
    b: { dimensions: [...new Set(b.results.map((r) => r.dimension))], heads: headsB, generated: b.generated, results: 'audit-b/results.json' },
    parity: {
      item: 'FF-38',
      heads: headsP,
      generated: p.meta.generatedAt,
      tolerances: p.meta.tolerances,
      checks: PARITY_CHECKS,
      results: 'parity/parity-results.json',
      records: p.results.length,
      withAssetsRecords,
      parityOnlyValues: parityOnly.length,
    },
  },
  notMeasured: [{ dimension: 'charts', reason: 'no presence status: reduction to Aspose.Slides-supported chart types in progress (FF-22); parity measured, see parityOnly' }],
  sharedExportGaps: b.sharedExportGaps,
  counts,
  parityCounts,
  items,
  parityOnly,
};

await writeFile(path.join(here, 'support-status.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${items.length} items, ${parityOnly.length} parity-only values, ${withAssetsRecords} withAssets parity records`);
console.log('parity', JSON.stringify(parityCounts));
for (const [d, c] of Object.entries(counts)) console.log(d, JSON.stringify(c));
