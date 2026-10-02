// RR-41: build the gallery tracker, one record per item pptx.gallery shows or the OPF catalogs define, with its
// lifecycle columns, a status and whether its gaps are addressed.
//
//   node scripts/build-gallery-tracker.mjs            write gallery-tracker.json and gallery-tracker.md
//   node scripts/build-gallery-tracker.mjs --check    fail when either file differs from a fresh build (stale tracker)
//   node scripts/build-gallery-tracker.mjs --snapshot-gallery <pptx-gallery checkout> --commit <sha>
//                                                     refresh the pinned pptx.gallery snapshot, then rebuild
//   node scripts/build-gallery-tracker.mjs --snapshot-editor <opf-editor checkout> --commit <sha>
//                                                     refresh the pinned opf-editor switch snapshot, then rebuild
//
// Derived data (never hand edited): spec/catalogs, the opf schema, the gallery support audits A and B, the latest
// committed parity run, the font tracker, the committed native evidence under docs/evidence, the RR burndown and the
// two pinned snapshots (pptx.gallery data and pages, opf-editor switch dimensions). Authored data:
// docs/programs/release-readiness/gallery-tracker.overrides.json (the rules that give each gap its next action and its
// link: an RR item, a pull request, or an issue for a descoped gap). Internal tracking only; never shown on a site.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBurndown } from "../docs/programs/release-readiness/report.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = "docs/programs/release-readiness";
export const FILES = {
  json: `${DIR}/gallery-tracker.json`,
  markdown: `${DIR}/gallery-tracker.md`,
  overrides: `${DIR}/gallery-tracker.overrides.json`,
  snapshots: `${DIR}/gallery-tracker.snapshots.json`,
};
export const SCHEMA = "opf-gallery-tracker/v1";

/** Statuses, most severe last. A record's status is its most severe gap that is not descoped. */
export const STATUS_DEFINITIONS = {
  done: { severity: 0, meaning: "Every column passes: in the spec or catalog, composes, previews, exports and re-imports, parity perfect, switchable in the editor, shown on pptx.gallery, its fonts accepted, and a committed native PowerPoint evidence run names it." },
  deprecated: { severity: 0, meaning: "A catalog record deprecated in favour of another id (its `deprecation.replacedBy`); kept so documents resolve, not shown on pptx.gallery and not measured by decision." },
  descoped: { severity: 0, meaning: "Every remaining gap is descoped by a decision, with an issue that states the current behaviour, what full support needs and the evidence." },
  "works-unverified": { severity: 1, meaning: "Every automated column passes, but no committed native PowerPoint evidence run names this value." },
  unknown: { severity: 1.5, meaning: "A column has no data source for this record (no audit, parity or probe measured it), so it is not known to work." },
  "parity-near": { severity: 2, meaning: "The preview and the PPTX agree only within the near tolerance on at least one parity check (latest parity run)." },
  "font-gap": { severity: 2, meaning: "A font the value draws is not accepted in the font tracker (accepted means status qualified or documented-visual)." },
  "missing-gallery": { severity: 2, meaning: "Not shown on pptx.gallery: served only as catalog JSON, announced as coming, or without its card preview." },
  "missing-spec": { severity: 2, meaning: "Not in the bundled core catalog: published only by the pptx.gallery catalog, or not published in any catalog." },
  "missing-editor": { severity: 3, meaning: "The editor has no switch operation for this kind of value (FF-16, RR-06)." },
  "parity-mismatch": { severity: 4, meaning: "The preview and the PPTX disagree beyond the near tolerance on at least one parity check." },
  "missing-export": { severity: 4, meaning: "The PPTX export fails, is not native, or does not re-import to the same value." },
  "missing-preview": { severity: 4, meaning: "The preview fails or does not change for this value." },
  broken: { severity: 5, meaning: "The value does not validate or compose in core." },
};
export const STATUSES = Object.keys(STATUS_DEFINITIONS);
const TERMINAL = new Set(["done", "deprecated", "descoped"]);
export const GAP_CODES = STATUSES.filter((s) => !TERMINAL.has(s));
const severity = (code) => STATUS_DEFINITIONS[code].severity;
const OPEN_RR = new Set(["todo", "in-progress", "review"]);
const ACCEPTED_FONT = new Set(["qualified", "documented-visual"]);

const DEFAULT_NEXT = {
  "works-unverified": "Include the value in a native PowerPoint sample (supervisor-run) and commit the evidence under docs/evidence.",
  unknown: "Measure the missing columns (audit or probe) and commit the result.",
  "parity-near": "Find the cause of the near check and fix the engine or the harness, then re-run parity.",
  "font-gap": "Finish the font tracker's next action for the family.",
  "missing-gallery": "Give the value a gallery page and card, or record that it stays catalog-only.",
  "missing-spec": "Publish the value in the core catalog, or record that it stays gallery-only.",
  "missing-editor": "Add an editor switch for the value, or record that the editor does not switch it.",
  "parity-mismatch": "Fix the preview or the export so parity reaches near or perfect.",
  "missing-export": "Fix the export or the re-import.",
  "missing-preview": "Fix the preview.",
  broken: "Fix the value so it validates and composes.",
};

// Catalog kind names that differ from the gallery dimension names (support-status.json, opf-editor switches).
const KIND_ALIASES = { "chart-types": "charts", "social-platforms": "socials" };
const readJson = (root, file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const uniq = (values) => [...new Set(values)];
const typeOfKind = (kind) => KIND_ALIASES[kind] ?? kind;
const normDimension = (dimension) => (dimension === "font-schemes-legacy" ? "font-schemes" : dimension);
const clip = (text, n = 160) => (text.length > n ? `${text.slice(0, n - 3)}...` : text);

// ---- snapshots -------------------------------------------------------------------------------------------------

/** pptx.gallery: which kinds have pages, the ids each page lists, missing card previews, the published catalog ids and the "Coming" teasers. */
export function snapshotGallery(dir, { commit, capturedAt }) {
  const kinds = {};
  for (const file of readdirSync(path.join(dir, "data")).filter((f) => f.endsWith(".json")).sort()) {
    const data = JSON.parse(readFileSync(path.join(dir, "data", file), "utf8"));
    if (!Array.isArray(data.items)) continue;
    const kind = file.replace(/\.json$/, "");
    const ids = data.items.map((item) => item.id ?? item.slug);
    const legacy = Array.isArray(data.legacyItems) ? data.legacyItems.map((item) => item.id ?? item.slug) : [];
    const previewDir = path.join(dir, "public", `${kind.replace(/s$/, "")}-previews`);
    const previews = existsSync(previewDir) ? new Set(readdirSync(previewDir).map((f) => f.replace(/\.[^.]+$/, ""))) : null;
    kinds[kind] = {
      page: existsSync(path.join(dir, "app", kind, "[slug]", "page.tsx")),
      items: ids,
      legacyItems: legacy,
      deprecated: data.items.filter((item) => item.deprecation).map((item) => item.id ?? item.slug),
      previewAssets: previews ? `public/${kind.replace(/s$/, "")}-previews` : null,
      previewAssetsMissing: previews ? ids.filter((id) => !previews.has(id)) : [],
    };
  }
  const publishedCatalog = {};
  for (const entry of readdirSync(path.join(dir, "public"), { withFileTypes: true })) {
    const index = path.join(dir, "public", entry.name, "index.json");
    if (!entry.isDirectory() || !existsSync(index)) continue;
    const records = JSON.parse(readFileSync(index, "utf8")).records;
    if (Array.isArray(records)) publishedCatalog[entry.name] = records.map((r) => r.id).sort();
  }
  const section = readFileSync(path.join(dir, "components", "home", "catalog-section.tsx"), "utf8");
  const comingBlock = section.match(/const coming = \[([\s\S]*?)\];/)?.[1] ?? "";
  const coming = [...comingBlock.matchAll(/title:\s*"([^"]+)",\s*desc:\s*"([^"]+)"/g)].map((m) => ({ title: m[1], description: m[2] }));
  return {
    source: { repository: "Data-Advantage/pptx-gallery", commit, capturedAt },
    kinds,
    publishedCatalog,
    coming,
  };
}

/** opf-editor: the dimensions the switch operation covers (src/switches.js SWITCH_DIMENSIONS) and the package version. */
export function snapshotEditor(dir, { commit, capturedAt }) {
  const source = readFileSync(path.join(dir, "src", "switches.js"), "utf8");
  const block = source.match(/export const SWITCH_DIMENSIONS = Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1];
  if (!block) throw new Error("SWITCH_DIMENSIONS not found in src/switches.js");
  const version = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version;
  return {
    source: { repository: "OpenPresentation/opf-editor", commit, capturedAt, version, switches: "src/switches.js", test: "test/switches.mjs" },
    switchDimensions: [...block.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]),
  };
}

// ---- inputs ----------------------------------------------------------------------------------------------------

function readCatalogs(root, dir) {
  const manifest = readJson(root, `${dir}/manifest.json`);
  const kinds = {};
  for (const kind of Object.keys(manifest.kinds).sort()) {
    const index = readJson(root, `${dir}/${kind}/index.json`);
    kinds[kind] = Object.fromEntries(
      index.records.map((entry) => {
        const record = readJson(root, `${dir}/${kind}/${entry.file ?? `${entry.id}.json`}`);
        return [entry.id, { name: record.name ?? entry.name ?? entry.id, deprecated: Boolean(entry.deprecated || record.deprecation), replacedBy: entry.replacedBy ?? record.deprecation?.replacedBy ?? null, record }];
      }),
    );
  }
  return { manifest, kinds };
}

/** Native PowerPoint evidence: every json/md file under a path segment naming native or PowerPoint, indexed by the value ids it names. */
export function nativeEvidenceIndex(root, evidenceDir) {
  const patterns = {
    layouts: /"layout"\s*:\s*"([a-z0-9][a-z0-9-]*)"/g,
    "color-schemes": /"colorScheme"\s*:\s*(?:\{\s*"id"\s*:\s*)?"([a-z0-9][a-z0-9-]*)"/g,
    "font-schemes": /"fontScheme"\s*:\s*(?:\{\s*"id"\s*:\s*)?"([a-z0-9][a-z0-9-]*)"/g,
    languages: /"language"\s*:\s*"([a-z0-9][a-z0-9-]*)"/g,
    themes: /"theme"\s*:\s*(?:\{\s*"id"\s*:\s*)?"([a-z0-9][a-z0-9-]*)"/g,
    narratives: /"narrative"\s*:\s*"([a-z0-9][a-z0-9-]*)"/g,
    tones: /"tone"\s*:\s*"([a-z0-9][a-z0-9-]*)"/g,
    audiences: /"audience"\s*:\s*\[?\s*"([a-z0-9][a-z0-9-]*)"/g,
    purposes: /"purpose"\s*:\s*"([a-z0-9][a-z0-9-]*)"/g,
    socials: /"socials"\s*:\s*\[[^\]]{0,400}?"platform"\s*:\s*"([a-z0-9][a-z0-9-]*)"/g,
    charts: /"chart"\s*:\s*\{[^{}]{0,200}?"type"\s*:\s*"([a-z0-9][a-z0-9-]*)"/g,
    "slide-sizes": /"dimensions"\s*:\s*(?:\{\s*"preset"\s*:\s*)?"([a-z0-9:]+)"/g,
    blocks: /gallery:blocks\/([a-z0-9][a-z0-9-]*)/g,
    backgrounds: /gallery:backgrounds\/([a-z0-9][a-z0-9-]*)/g,
    "headers-footers": /gallery:headers-footers\/([a-z0-9][a-z0-9-]*)/g,
    "image-treatments": /gallery:image-treatments\/([a-z0-9][a-z0-9-]*)/g,
  };
  const index = {};
  const add = (type, id, dir) => {
    index[type] = index[type] ?? {};
    index[type][id] = index[type][id] ?? new Set();
    index[type][id].add(dir);
  };
  const walk = (rel) => {
    for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (/\.(json|md)$/.test(entry.name)) {
        const inside = child.slice(evidenceDir.length + 1);
        if (!inside.split("/").some((segment) => /native|powerpoint/i.test(segment))) continue;
        if (statSync(path.join(root, child)).size > 4e6) continue;
        const top = `${evidenceDir}/${inside.split("/")[0]}`;
        const text = readFileSync(path.join(root, child), "utf8");
        for (const [type, re] of Object.entries(patterns)) for (const m of text.matchAll(re)) add(type, m[1], top);
        // The native chart runs keep one PowerPoint report per chart deck, named after the chart id ("07-line.json").
        if (/chart/i.test(inside)) add("charts", entry.name.replace(/\.(json|md)$/, "").replace(/^\d+-/, ""), top);
      }
    }
  };
  walk(evidenceDir);
  return Object.fromEntries(Object.entries(index).map(([type, ids]) => [type, Object.fromEntries(Object.entries(ids).map(([id, dirs]) => [id, [...dirs].sort()]))]));
}

// ---- columns ---------------------------------------------------------------------------------------------------

function auditColumns(auditA, auditB) {
  const out = new Map();
  for (const r of auditA.results) {
    const c = r.checks;
    const native = c.export?.native;
    out.set(`${r.dimension}/${r.id}`, {
      compose: c.schema?.pass ? "pass" : "fail",
      preview: c.render?.pass && c.render?.effect !== false ? "pass" : "fail",
      export: c.export?.pass && native !== false ? "pass" : "fail",
      roundTrip: c.reimport?.pass && c.reimport?.retained !== false ? "pass" : "fail",
      pipeline: r.class,
      reasons: r.reasons ?? [],
      audit: "a",
    });
  }
  for (const r of auditB.results) {
    const reasons = r.reasons ?? [];
    const chart = r.chart;
    out.set(`${normDimension(r.dimension)}/${r.id}`, {
      compose: r.schemaValid && r.catalogResolves ? "pass" : "fail",
      preview: r.preview?.hostFonts === true && r.hostPreview?.render?.ok !== false ? "pass" : "fail",
      export: r.export?.default === true && (!chart || chart.export?.nativeConstruct === true) ? "pass" : "fail",
      roundTrip: !reasons.some((x) => /re-?import/i.test(x)) && (!chart || chart.reimport?.type === r.id) ? "pass" : "fail",
      pipeline: r.classification,
      reasons,
      audit: "b",
    });
  }
  return out;
}

function parityColumns(parity) {
  const rank = { perfect: 0, near: 1, mismatch: 2 };
  const out = new Map();
  for (const r of parity.results) {
    const key = `${normDimension(r.dimension)}/${r.id}`;
    const entry = out.get(key) ?? { class: "perfect", checks: new Set(), reasons: new Set(), families: [] };
    if (rank[r.class] === undefined) throw new Error(`parity: unknown class ${r.class} for ${key}`);
    if (rank[r.class] > rank[entry.class]) entry.class = r.class;
    for (const [check, verdict] of Object.entries(r.checks)) if (verdict !== "pass") entry.checks.add(`${check} ${verdict}`);
    for (const diff of r.diffs ?? []) if (diff.status !== "pass") entry.reasons.add(`${diff.check}: ${diff.reason}`);
    if (r.variant === "published") entry.families = Object.keys(r.fontResolution ?? {}).sort();
    out.set(key, entry);
  }
  return out;
}

function fontColumn(families, fontStatus) {
  if (!families.length) return { value: "n/a", families: [] };
  const statuses = families.map((family) => ({ family, status: fontStatus.get(family) ?? "not-in-tracker" }));
  const open = statuses.filter((s) => !ACCEPTED_FONT.has(s.status));
  return { value: open.length ? "gap" : "accepted", families: statuses, open };
}

// ---- rules -----------------------------------------------------------------------------------------------------

export function matchRule(rules, type, id, gap) {
  return rules.find(
    (rule) =>
      rule.gap === gap.code &&
      (!rule.types || rule.types.includes(type)) &&
      (!rule.ids || rule.ids.includes(id)) &&
      (!rule.detail || new RegExp(rule.detail).test(gap.detail)),
  );
}

export function linkState(link, burndown) {
  if (!link) return { kind: "none", addressed: false };
  if (/^RR-\d{2}$/.test(link)) {
    const item = burndown.get(link);
    if (!item) throw new Error(`gallery tracker: rule links unknown burndown item ${link}`);
    return { kind: "rr", status: item.status, addressed: OPEN_RR.has(item.status) };
  }
  if (/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(link)) return { kind: "pr", addressed: true };
  if (/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/.test(link)) return { kind: "issue", addressed: false };
  throw new Error(`gallery tracker: link must be an RR id, a pull request or an issue URL: ${link}`);
}

// ---- build -----------------------------------------------------------------------------------------------------

export function buildTracker({ root = ROOT } = {}) {
  const overrides = readJson(root, FILES.overrides);
  const inputs = overrides.inputs;
  const snapshots = readJson(root, FILES.snapshots);
  const gallery = snapshots.gallery;
  const editor = snapshots.editor;
  const catalogs = readCatalogs(root, inputs.catalogs);
  const support = readJson(root, inputs.supportStatus);
  const auditA = readJson(root, inputs.auditA);
  const auditB = readJson(root, inputs.auditB);
  const parity = readJson(root, inputs.parity);
  const fontTracker = readJson(root, inputs.fontTracker);
  const schema = readJson(root, inputs.schema);
  const burndownItems = parseBurndown(readFileSync(path.join(root, inputs.burndown), "utf8"));
  const burndown = new Map(burndownItems.map((item) => [item.id, item]));
  const native = nativeEvidenceIndex(root, inputs.evidence);
  // RR-43: later runs on records the main runs do not cover (the catalog-only records and the slide-size presets).
  const auditBExtra = (inputs.auditBExtra ?? []).map((file) => ({ file, ...readJson(root, file) }));
  const parityExtra = (inputs.parityExtra ?? []).map((file) => ({ file, ...readJson(root, file) }));
  const audits = auditColumns(auditA, { results: [...auditB.results, ...auditBExtra.flatMap((x) => x.results)] });
  const parityBy = parityColumns({ results: [...parity.results, ...parityExtra.flatMap((x) => x.results)] });
  const fontStatus = new Map(fontTracker.records.map((r) => [r.family, r.status]));
  const supportBy = new Map(support.items.map((item) => [`${item.dimension}/${item.galleryId}`, item]));
  const switchable = new Set(editor.switchDimensions);
  const rules = overrides.rules;
  const ruleUse = Object.fromEntries(rules.map((rule) => [rule.id, 0]));

  // Item types: every catalog kind and every gallery item kind (with the gallery's dimension names), in the gallery's
  // section order, then the fonts (font tracker), slide sizes (schema presets) and the gallery's "Coming" teasers.
  const order = Object.keys(support.sectionAnchors);
  const catalogTypes = Object.keys(catalogs.kinds).map(typeOfKind);
  const galleryTypes = Object.keys(gallery.kinds);
  const kindTypes = uniq([...catalogTypes, ...galleryTypes]).sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const catalogKindOf = Object.fromEntries(Object.keys(catalogs.kinds).map((kind) => [typeOfKind(kind), kind]));
  const publishedKindOf = (type) => Object.keys(gallery.publishedCatalog).find((kind) => typeOfKind(kind) === type) ?? null;
  const themeDimensions = new Set(Object.values(catalogs.kinds.themes ?? {}).map((t) => t.record.dimensions).filter((d) => typeof d === "string"));
  const fontSchemeFamilies = (id) => {
    const scheme = catalogs.kinds["font-schemes"]?.[id]?.record;
    return scheme ? uniq([scheme.major, scheme.minor].filter(Boolean)).sort() : [];
  };

  const records = [];
  const push = (record) => {
    // Rules give each gap its next action and link; a record is addressed when every gap is linked to an open RR item or
    // a pull request, or is descoped with an issue.
    for (const gap of record.gaps) {
      const rule = matchRule(rules, record.type, record.id, gap);
      if (rule) ruleUse[rule.id] += 1;
      if (rule) Object.assign(gap, { rule: rule.id, ...(rule.link ? { link: rule.link } : {}) });
      if (rule?.descoped) {
        if (!rule.link || !/\/issues\/\d+$/.test(rule.link)) throw new Error(`rule ${rule.id}: a descoped gap needs an issue link`);
        gap.descoped = true;
      }
      const state = linkState(gap.link, burndown);
      gap.addressed = gap.descoped ? true : state.addressed;
      if (state.kind === "rr") gap.linkStatus = state.status;
    }
    const live = record.gaps.filter((gap) => !gap.descoped);
    const worst = live.reduce((best, gap) => (!best || severity(gap.code) > severity(best.code) ? gap : best), null);
    if (record.status !== "deprecated") record.status = worst ? worst.code : record.gaps.length ? "descoped" : "done";
    record.addressed = record.gaps.every((gap) => gap.addressed);
    records.push(record);
  };

  for (const type of kindTypes) {
    const catalogKind = catalogKindOf[type];
    const catalogRecords = catalogKind ? catalogs.kinds[catalogKind] : {};
    const g = gallery.kinds[type];
    const publishedKind = publishedKindOf(type);
    const published = new Set(publishedKind ? gallery.publishedCatalog[publishedKind] : []);
    const shown = new Set(g?.page ? [...g.items, ...g.legacyItems] : []);
    const legacy = new Set(g?.legacyItems ?? []);
    const ids = uniq([...Object.keys(catalogRecords), ...(g?.items ?? []), ...(g?.legacyItems ?? [])]).sort();
    for (const id of ids) {
      const cat = catalogRecords[id];
      const audit = audits.get(`${type}/${id}`);
      const par = parityBy.get(`${type}/${id}`);
      const supportItem = supportBy.get(`${type}/${id}`);
      const gaps = [];
      const record = { type, id, name: cat?.name ?? id };

      // spec
      let spec;
      if (cat) spec = cat.deprecated ? "catalog-deprecated" : "catalog";
      else if (!catalogKind) spec = "schema";
      else if (published.has(id)) spec = "gallery-catalog";
      else spec = "none";
      if (spec === "gallery-catalog") gaps.push({ code: "missing-spec", detail: `published by the pptx.gallery ${publishedKind} catalog but not bundled in core spec/catalogs (portable through an inline record)` });
      if (spec === "none") gaps.push({ code: "missing-spec", detail: `${legacy.has(id) ? "legacy gallery item" : "gallery item"} not published in any OPF catalog` });

      // gallery
      let galleryColumn;
      if (shown.has(id)) galleryColumn = g.previewAssetsMissing.includes(id) ? "shown-no-preview" : "shown";
      else if (spec === "catalog-deprecated") galleryColumn = "not-shown-deprecated";
      else if (published.has(id)) galleryColumn = "json-only";
      else galleryColumn = "not-shown";
      if (galleryColumn === "shown-no-preview") gaps.push({ code: "missing-gallery", detail: `gallery page has no card preview in ${g.previewAssets}` });
      if (galleryColumn === "json-only") gaps.push({ code: "missing-gallery", detail: g?.page ? "served as catalog JSON only; the gallery has no page for this id" : `served as catalog JSON only; the gallery has no ${type} pages` });
      if (galleryColumn === "not-shown") gaps.push({ code: "missing-gallery", detail: "not shown on pptx.gallery" });

      if (spec === "catalog-deprecated" && galleryColumn !== "shown" && !audit) {
        record.columns = { spec, compose: "n/a", preview: "n/a", export: "n/a", roundTrip: "n/a", parity: "n/a", editor: "n/a", gallery: galleryColumn, native: "n/a", fonts: "n/a" };
        record.replacedBy = cat.replacedBy;
        record.status = "deprecated";
        record.gaps = [];
        push(record);
        continue;
      }

      // pipeline (audits A and B on the gallery configs)
      const pipe = audit ?? { compose: "unknown", preview: "unknown", export: "unknown", roundTrip: "unknown", pipeline: supportItem?.status ?? "unmeasured", reasons: [] };
      if (pipe.compose === "fail") gaps.push({ code: "broken", detail: clip(pipe.reasons.join("; ") || "schema or catalog check failed") });
      if (pipe.preview === "fail") gaps.push({ code: "missing-preview", detail: clip(pipe.reasons.join("; ") || "preview check failed") });
      if (pipe.export === "fail" || pipe.roundTrip === "fail") gaps.push({ code: "missing-export", detail: clip(pipe.reasons.join("; ") || "export or re-import check failed") });

      // parity
      const parityValue = par ? par.class : "unmeasured";
      const parityDetail = par ? clip([...par.checks].join(", ") + (par.reasons.size ? ` (${[...par.reasons].slice(0, 2).join("; ")})` : "")) : "";
      if (parityValue === "mismatch") gaps.push({ code: "parity-mismatch", detail: parityDetail });

      // editor
      const editorValue = switchable.has(type) ? "switch" : "none";
      if (editorValue === "none") gaps.push({ code: "missing-editor", detail: `opf-editor ${editor.source.version} has no ${type} switch (SWITCH_DIMENSIONS)` });

      // fonts: the families the value's parity preview drew, else the catalog's font scheme
      let families = par?.families ?? [];
      if (!families.length && type === "font-schemes") families = fontSchemeFamilies(id);
      if (!families.length && (type === "languages" || type === "themes") && cat?.record.fontScheme) families = fontSchemeFamilies(cat.record.fontScheme);
      const fonts = fontColumn(families, fontStatus);
      if (fonts.value === "gap") gaps.push({ code: "font-gap", detail: clip(fonts.open.map((f) => `${f.family} ${f.status}`).join(", ")) });

      if (parityValue === "near") gaps.push({ code: "parity-near", detail: parityDetail });

      // native evidence
      const nativeDirs = native[type]?.[id] ?? [];
      const nativeValue = nativeDirs.length ? "exercised" : "unverified";

      const unknownColumns = ["compose", "preview", "export", "roundTrip"].filter((c) => pipe[c] === "unknown");
      if (parityValue === "unmeasured") unknownColumns.push("parity");
      if (unknownColumns.length) gaps.push({ code: "unknown", detail: `not measured: ${unknownColumns.join(", ")} (no gallery config in the audits or the parity run)` });
      else if (nativeValue === "unverified") gaps.push({ code: "works-unverified", detail: "no committed native PowerPoint evidence names this value" });

      record.columns = { spec, compose: pipe.compose, preview: pipe.preview, export: pipe.export, roundTrip: pipe.roundTrip, parity: parityValue, editor: editorValue, gallery: galleryColumn, native: nativeValue, fonts: fonts.value };
      record.pipeline = pipe.pipeline;
      if (fonts.families.length) record.fonts = fonts.families.map((f) => `${f.family}: ${f.status}`);
      if (nativeDirs.length) record.nativeEvidence = nativeDirs;
      if (cat?.deprecated) record.replacedBy = cat.replacedBy;
      record.gaps = gaps;
      push(record);
    }
  }

  // fonts: one record per font tracker family
  for (const r of [...fontTracker.records].sort((a, b) => a.family.localeCompare(b.family, "en"))) {
    const gaps = [];
    if (!ACCEPTED_FONT.has(r.status)) gaps.push({ code: "font-gap", detail: `font tracker status ${r.status}`, next: clip(r.nextAction, 240) });
    const nativeValue = r.nativeVerification?.status === "verified" ? "exercised" : "unverified";
    if (nativeValue === "unverified") gaps.push({ code: "works-unverified", detail: `font tracker native verification ${r.nativeVerification?.status ?? "unverified"} (FF-46)`, next: clip(r.nextAction, 240) });
    push({
      type: "fonts",
      id: r.family,
      name: r.family,
      columns: { spec: r.inPolicy ? "policy" : "none", compose: "n/a", preview: r.bundled?.yes ? "pass" : "fail", export: r.selectedNamePreservedInPptx ? "pass" : "fail", roundTrip: "n/a", parity: "n/a", editor: "n/a", gallery: "n/a", native: nativeValue, fonts: r.status },
      gaps,
    });
  }

  // slide sizes: the schema's dimension presets
  const presets = schema.$defs.DimensionPreset.enum;
  const slideSizeParity = parity.results.every((r) => r.checks.slideSize === "pass") ? "perfect" : "near";
  const themesWork = auditB.results.filter((r) => r.dimension === "themes").every((r) => r.classification === "works");
  for (const id of presets) {
    const probe = audits.get(`slide-sizes/${id}`);
    const measured = Boolean(probe) || themeDimensions.has(id);
    const gaps = [];
    if (!switchable.has("slide-sizes")) gaps.push({ code: "missing-editor", detail: `opf-editor ${editor.source.version} has no slide-size switch (SWITCH_DIMENSIONS); a theme switch carries its dimensions` });
    gaps.push({ code: "missing-gallery", detail: "pptx.gallery has no slide-size pages" });
    const nativeDirs = native["slide-sizes"]?.[id] ?? [];
    if (!measured) gaps.push({ code: "unknown", detail: "not measured: compose, preview, export, roundTrip, parity (no gallery config uses this preset)" });
    else if (!nativeDirs.length) gaps.push({ code: "works-unverified", detail: "no committed native PowerPoint evidence names this preset" });
    const pass = measured && themesWork ? "pass" : "unknown";
    const col = (c) => probe?.[c] ?? pass;
    for (const [c, code] of [["compose", "broken"], ["preview", "missing-preview"], ["export", "missing-export"]]) if (col(c) === "fail") gaps.push({ code, detail: clip(probe.reasons.join("; ") || `${c} check failed`) });
    if (col("roundTrip") === "fail" && col("export") !== "fail") gaps.push({ code: "missing-export", detail: clip(probe.reasons.join("; ") || "re-import check failed") });
    const presetParity = parityBy.get(`slide-sizes/${id}`)?.class ?? (measured ? slideSizeParity : "unmeasured");
    if (presetParity === "near") gaps.push({ code: "parity-near", detail: clip([...parityBy.get(`slide-sizes/${id}`).checks].join(", ")) });
    if (presetParity === "mismatch") gaps.push({ code: "parity-mismatch", detail: clip([...parityBy.get(`slide-sizes/${id}`).checks].join(", ")) });
    push({
      type: "slide-sizes",
      id,
      name: id,
      ...(probe ? { pipeline: probe.pipeline } : {}),
      columns: { spec: "schema-enum", compose: col("compose"), preview: col("preview"), export: col("export"), roundTrip: col("roundTrip"), parity: presetParity, editor: switchable.has("slide-sizes") ? "switch" : "none", gallery: "not-shown", native: nativeDirs.length ? "exercised" : "unverified", fonts: "n/a" },
      ...(nativeDirs.length ? { nativeEvidence: nativeDirs } : {}),
      gaps,
    });
  }

  // the gallery's "Coming" teasers
  for (const teaser of gallery.coming) {
    const id = teaser.title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    push({
      type: "gallery-teasers",
      id,
      name: teaser.title,
      columns: { spec: "n/a", compose: "n/a", preview: "n/a", export: "n/a", roundTrip: "n/a", parity: "n/a", editor: "n/a", gallery: "coming", native: "n/a", fonts: "n/a" },
      gaps: [{ code: "missing-gallery", detail: `pptx.gallery home lists "${teaser.title}" as coming: ${teaser.description}` }],
    });
  }

  const unused = Object.entries(ruleUse).filter(([, n]) => n === 0).map(([id]) => id);
  if (unused.length) throw new Error(`gallery tracker: rules match no gap: ${unused.join(", ")}`);

  // summary
  const types = uniq(records.map((r) => r.type));
  const byType = {};
  for (const type of types) {
    const rs = records.filter((r) => r.type === type);
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, rs.filter((r) => r.status === s).length]).filter(([, n]) => n));
    const unaddressed = rs.filter((r) => !r.addressed);
    byType[type] = { records: rs.length, byStatus, addressed: rs.length - unaddressed.length, unaddressed: unaddressed.length };
  }
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, records.filter((r) => r.status === s).length]));
  const unaddressedGaps = {};
  for (const r of records) for (const gap of r.gaps) if (!gap.addressed) unaddressedGaps[`${r.type} ${gap.code}`] = (unaddressedGaps[`${r.type} ${gap.code}`] ?? 0) + 1;
  const addressed = records.filter((r) => r.addressed).length;

  const tracker = {
    schema: SCHEMA,
    asOf: overrides.asOf,
    generatedBy: "scripts/build-gallery-tracker.mjs",
    description:
      "One record per item pptx.gallery shows or the OPF catalogs define (every catalog record, every gallery page item, every font tracker family, every slide-size preset and the gallery's coming teasers), with lifecycle columns from the committed measurements, a status and whether its gaps are addressed. Internal tracking only; never shown on a site.",
    inputs: {
      catalogs: { dir: inputs.catalogs, gallery: catalogs.manifest.source.commit.slice(0, 7), kinds: Object.keys(catalogs.kinds).length },
      gallery: { file: FILES.snapshots, ...gallery.source },
      editor: { file: FILES.snapshots, ...editor.source, switchDimensions: editor.switchDimensions.length },
      audits: { supportStatus: inputs.supportStatus, auditA: { file: inputs.auditA, heads: support.audits.a.heads }, auditB: { file: inputs.auditB, heads: support.audits.b.heads }, auditBExtra: auditBExtra.map((x) => ({ file: x.file, heads: x.heads, values: x.results.length })) },
      parity: { file: inputs.parity, generatedAt: parity.meta.generatedAt, heads: Object.fromEntries(Object.entries(parity.meta.heads).map(([k, v]) => [k, v.slice(0, 7)])), values: parity.results.length, note: overrides.parityNote },
      parityExtra: parityExtra.map((x) => ({ file: x.file, generatedAt: x.meta.generatedAt, heads: Object.fromEntries(Object.entries(x.meta.heads).map(([k, v]) => [k, String(v).slice(0, 7)])), values: x.results.length })),
      fontTracker: { file: inputs.fontTracker, asOf: fontTracker.asOf, records: fontTracker.records.length },
      nativeEvidence: { dir: inputs.evidence, rule: "json and md files under a path segment naming native or PowerPoint; a value counts as exercised when such a file names it" },
      burndown: { file: inputs.burndown, items: burndownItems.length },
      overrides: { file: FILES.overrides, rules: rules.length },
    },
    statusDefinitions: STATUS_DEFINITIONS,
    nextActionDefinition: "A gap's next action is its own `next` (derived, for example the font tracker's next action for the family), else the `next` of the rule it names in `rules`, else `defaultNext` for its code.",
    rules: Object.fromEntries(rules.map(({ id, ...rule }) => [id, rule])),
    defaultNext: DEFAULT_NEXT,
    columns: overrides.columns,
    addressedDefinition: "A record is addressed when it is done or deprecated, or when every gap is linked to an open RR item (todo, in-progress or review) or a pull request, or is descoped with an issue. A gap linked to a closed RR item is not addressed: the item claims a fix the measurement does not show yet (re-audit or reopen).",
    summary: { records: records.length, addressed, unaddressed: records.length - addressed, byStatus, byType, unaddressedGaps },
    records,
  };
  return { tracker };
}

// ---- markdown --------------------------------------------------------------------------------------------------

const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const linkMd = (link) => {
  if (!link) return "-";
  if (/^RR-/.test(link)) return `[${link}](burndown.md)`;
  const m = link.match(/github\.com\/[\w.-]+\/([\w.-]+)\/(pull|issues)\/(\d+)/);
  return m ? `[${m[1]}#${m[3]}](${link})` : link;
};

/** The next action of a gap: its own, else its rule's, else the default for its code. */
export function nextAction(tracker, gap) {
  return gap.next ?? (gap.rule ? tracker.rules[gap.rule]?.next : undefined) ?? tracker.defaultNext[gap.code];
}

export function renderMarkdown(tracker) {
  const lines = [];
  const push = (...xs) => lines.push(...xs);
  const s = tracker.summary;
  push(
    "# Gallery tracker (RR-41)",
    "",
    "<!-- Generated by scripts/build-gallery-tracker.mjs from gallery-tracker.json. Do not edit; edit gallery-tracker.overrides.json and rebuild. -->",
    "",
    `As of ${tracker.asOf}. Machine-readable source: [gallery-tracker.json](gallery-tracker.json). Authored rules: [gallery-tracker.overrides.json](gallery-tracker.overrides.json). Program: [burndown.md](burndown.md). Rebuild with \`pnpm build:gallery-tracker\`; \`pnpm check:gallery-tracker\` fails when this file is stale. Internal tracking only: nothing here is shown on a site.`,
    "",
    "One record per item type and value: every catalog record in `spec/catalogs`, every item pptx.gallery has a page for, every font tracker family, every slide-size preset of the schema and the gallery's coming teasers. Each record carries its lifecycle columns, its gaps and, per gap, the next action and the link that addresses it.",
    "",
    "## Summary",
    "",
    `${s.records} records; ${s.addressed} addressed, ${s.unaddressed} unaddressed. ${tracker.addressedDefinition}`,
    "",
    "| Type | Records | Statuses | Addressed | Unaddressed |",
    "| --- | ---: | --- | ---: | ---: |",
  );
  for (const [type, t] of Object.entries(s.byType)) push(`| ${type} | ${t.records} | ${Object.entries(t.byStatus).map(([k, v]) => `${k} ${v}`).join(", ")} | ${t.addressed} | ${t.unaddressed} |`);
  push("", "| Status | Records | Severity | Meaning |", "| --- | ---: | ---: | --- |");
  for (const status of STATUSES) push(`| \`${status}\` | ${s.byStatus[status]} | ${STATUS_DEFINITIONS[status].severity} | ${cell(STATUS_DEFINITIONS[status].meaning)} |`);
  push("", "## Columns", "", "| Column | Values and source |", "| --- | --- |");
  for (const [column, text] of Object.entries(tracker.columns)) push(`| ${column} | ${cell(text)} |`);

  // gaps grouped by type, gap code, rule and link
  const groups = new Map();
  for (const r of tracker.records)
    for (const gap of r.gaps) {
      const key = [r.type, gap.code, gap.rule ?? "", gap.link ?? "", gap.descoped ? "d" : ""].join("\u0000");
      const g = groups.get(key) ?? { type: r.type, code: gap.code, gap, ids: [], details: new Set(), nexts: new Set() };
      g.ids.push(r.id);
      g.details.add(gap.detail);
      g.nexts.add(nextAction(tracker, gap));
      groups.set(key, g);
    }
  const sorted = [...groups.values()].sort((a, b) => Number(a.gap.addressed) - Number(b.gap.addressed) || severity(b.code) - severity(a.code) || a.type.localeCompare(b.type) || b.ids.length - a.ids.length);
  const idList = (ids) => (ids.length > 12 ? `${ids.slice(0, 12).map((id) => `\`${id}\``).join(", ")} and ${ids.length - 12} more` : ids.map((id) => `\`${id}\``).join(", "));
  const detailOf = (g) => {
    const details = [...g.details];
    return details.length === 1 ? details[0] : `${details[0]} (and ${details.length - 1} other detail${details.length > 2 ? "s" : ""})`;
  };
  const table = (list) => {
    push("| Type | Gap | Records | Ids | Detail | Next action | Link |", "| --- | --- | ---: | --- | --- | --- | --- |");
    for (const g of list) push(`| ${g.type} | \`${g.code}\`${g.gap.descoped ? " (descoped)" : ""} | ${g.ids.length} | ${idList(g.ids)} | ${cell(clip(detailOf(g), 220))} | ${cell(g.nexts.size === 1 ? [...g.nexts][0] : `${nextAction(tracker, { ...g.gap, next: undefined })} Each record names its own next action in the JSON (${g.nexts.size} distinct).`)} | ${linkMd(g.gap.link)}${g.gap.linkStatus ? ` (${g.gap.linkStatus})` : ""} |`);
  };
  const open = sorted.filter((g) => !g.gap.addressed);
  push("", "## Unaddressed gaps", "");
  if (open.length) table(open);
  else push("None: every gap is linked to an open RR item or a pull request, or is descoped with an issue.");
  push("", "## Addressed gaps", "");
  table(sorted.filter((g) => g.gap.addressed));
  push("", "## Inputs", "", "| Input | Source |", "| --- | --- |");
  const inp = tracker.inputs;
  push(
    `| Catalogs | \`${inp.catalogs.dir}\` (${inp.catalogs.kinds} kinds, pinned to pptx-gallery \`${inp.catalogs.gallery}\`) |`,
    `| pptx.gallery pages | \`${inp.gallery.file}\` (${inp.gallery.repository} \`${inp.gallery.commit.slice(0, 7)}\`, captured ${inp.gallery.capturedAt}) |`,
    `| Editor switches | \`${inp.editor.file}\` (${inp.editor.repository} ${inp.editor.version} \`${inp.editor.commit.slice(0, 7)}\`, \`${inp.editor.switches}\` SWITCH_DIMENSIONS, tested by \`${inp.editor.test}\`) |`,
    `| Audits A and B | \`${inp.audits.auditA.file}\`, \`${inp.audits.auditB.file}\` (opf \`${inp.audits.auditA.heads.opf}\`, opf-render \`${inp.audits.auditA.heads["opf-render"]}\`, opf-pptx \`${inp.audits.auditA.heads["opf-pptx"]}\`, opf-editor \`${inp.audits.auditB.heads["opf-editor"]}\`, pptx-gallery \`${inp.audits.auditA.heads["pptx-gallery"]}\`) |`,
    `| Parity | \`${inp.parity.file}\` (${inp.parity.values} values, ${inp.parity.generatedAt}; opf \`${inp.parity.heads.opf}\`, opf-render \`${inp.parity.heads["opf-render"]}\`, opf-pptx \`${inp.parity.heads["opf-pptx"]}\`, pptx-gallery \`${inp.parity.heads["pptx-gallery"]}\`). ${cell(inp.parity.note)} |`,
    ...inp.audits.auditBExtra.map((x) => `| Audit B, later run | \`${x.file}\` (${x.values} values; ${Object.entries(x.heads ?? {}).map(([k, v]) => `${k} \`${v}\``).join(", ")}) |`),
    ...inp.parityExtra.map((x) => `| Parity, later run | \`${x.file}\` (${x.values} values, ${x.generatedAt}; ${Object.entries(x.heads).map(([k, v]) => `${k} \`${v}\``).join(", ")}) |`),
    `| Fonts | \`${inp.fontTracker.file}\` (${inp.fontTracker.records} families, as of ${inp.fontTracker.asOf}) |`,
    `| Native evidence | \`${inp.nativeEvidence.dir}\`: ${inp.nativeEvidence.rule} |`,
    `| Links | \`${inp.burndown.file}\` (${inp.burndown.items} items) and ${inp.overrides.rules} rules in \`${inp.overrides.file}\` |`,
  );
  push("");
  return `${lines.join("\n")}\n`;
}

/** Pretty JSON with one line per record, so a change to a record is a one-line diff. */
export function serialize(tracker) {
  const { records, ...head } = tracker;
  const top = JSON.stringify({ ...head, records: [] }, null, 2);
  const body = records.map((record) => `    ${JSON.stringify(record)}`).join(",\n");
  return `${top.replace(/"records": \[\]\n\}$/, `"records": [\n${body}\n  ]\n}`)}\n`;
}

/** Build both outputs in memory and report which committed files differ. */
export function checkTracker({ root = ROOT } = {}) {
  const { tracker } = buildTracker({ root });
  const expected = { [FILES.json]: serialize(tracker), [FILES.markdown]: renderMarkdown(tracker) };
  const drift = [];
  for (const [file, text] of Object.entries(expected)) {
    let actual = null;
    try {
      actual = readFileSync(path.join(root, file), "utf8");
    } catch {
      // A missing file is drift.
    }
    if (actual !== text) drift.push(file);
  }
  return { drift, expected, tracker };
}

function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
  };
  const capturedAt = option("--date") ?? new Date().toISOString().slice(0, 10);
  for (const [flag, key, fn] of [["--snapshot-gallery", "gallery", snapshotGallery], ["--snapshot-editor", "editor", snapshotEditor]]) {
    if (!args.includes(flag)) continue;
    const commit = option("--commit");
    if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error("--commit must be the full 40-character commit the checkout is at");
    const file = path.join(ROOT, FILES.snapshots);
    const snapshots = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { description: "" };
    snapshots.description =
      "Pinned snapshots the gallery tracker reads, so core never needs the sibling checkouts: the pptx.gallery data kinds, pages, card previews, published catalog ids and coming teasers, and the opf-editor switch dimensions. Refresh with node scripts/build-gallery-tracker.mjs --snapshot-gallery <pptx-gallery> --commit <sha> or --snapshot-editor <opf-editor> --commit <sha>.";
    snapshots[key] = fn(path.resolve(option(flag)), { commit, capturedAt });
    writeFileSync(file, `${JSON.stringify(snapshots, null, 2)}\n`);
    console.log(`Wrote the ${key} snapshot (${commit.slice(0, 7)}) to ${FILES.snapshots}.`);
  }
  const { drift, expected, tracker } = checkTracker();
  if (args.includes("--check")) {
    if (drift.length) {
      console.error(`Gallery tracker is stale: ${drift.join(", ")}. Run pnpm build:gallery-tracker and commit the result.`);
      process.exit(1);
    }
    console.log(`Gallery tracker is up to date (${tracker.summary.records} records, ${tracker.summary.unaddressed} unaddressed).`);
    return;
  }
  for (const [file, text] of Object.entries(expected)) writeFileSync(path.join(ROOT, file), text);
  console.log(`Wrote ${Object.keys(expected).join(" and ")}: ${tracker.summary.records} records, ${tracker.summary.addressed} addressed, ${tracker.summary.unaddressed} unaddressed.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
