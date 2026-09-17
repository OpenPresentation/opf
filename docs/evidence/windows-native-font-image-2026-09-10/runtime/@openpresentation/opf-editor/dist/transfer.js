import {
  applyJsonPatch,
  createValuePatch,
  getValueAtPath,
  validateOpfDocument,
} from "./index.js";
import { catalogs } from "@openpresentation/opf";
export const MAX_OPF_BYTES = 20 * 1024 * 1024;
const clone = (value) => structuredClone(value);
export function assertOpf(document) {
  bounded(document);
  const result = validateOpfDocument(document);
  if (!result.valid)
    throw new Error(result.errors[0]?.message ?? "Invalid OPF document.");
  return document;
}
function bounded(value, depth = 0, budget = { remaining: 250000 }) {
  if (depth > 64 || --budget.remaining < 0)
    throw new Error("OPF exceeds the supported nesting or item limit.");
  if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error(`Unsupported object key: ${key}`);
      bounded(child, depth + 1, budget);
    }
}
export function unwrapOpf(value, depth = 0) {
  if (depth > 64) throw new Error("OPF exceeds the supported nesting limit.");
  if (value?.slides) return value;
  if (value?.opfSnippet) return unwrapOpf(value.opfSnippet, depth + 1);
  if (Array.isArray(value?.opf)) {
    const snippet =
      value.opf.find((item) => item.name === "default") ?? value.opf[0];
    if (snippet) return unwrapOpf(snippet.value ?? JSON.parse(snippet.source), depth + 1);
  }
  if (value?.opf && typeof value.opf === "object") return unwrapOpf(value.opf, depth + 1);
  if (value?.document) return unwrapOpf(value.document, depth + 1);
  return value;
}
export function parseOpfTransfer(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_OPF_BYTES
  )
    throw new Error("Choose OPF smaller than 20 MB.");
  let source = text.replace(/^\uFEFF/, "").trim();
  if (source.includes("```")) {
    const fences = [...source.matchAll(/```(?:json|opf)?\s*\n([\s\S]*?)```/gi)];
    if (fences.length !== 1)
      throw new Error("Paste one JSON or OPF code block at a time.");
    source = fences[0][1].trim();
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Paste valid OPF JSON, a slide, or one JSON code block.");
  }
  bounded(value);
  value = unwrapOpf(value);
  bounded(value);
  if (value?.slides) {
    assertOpf(value);
    return { kind: "presentation", value, document: clone(value) };
  }
  const document = { slides: Array.isArray(value) ? value : [value] };
  if (validateOpfDocument(document).valid)
    return { kind: "slides", value, document };
  return { kind: "selection", value };
}
export function serializeOpfTransfer(
  document,
  { scope = "presentation", slideIndex = 0, path, format = "pretty" } = {},
) {
  let value = document;
  if (scope === "slide") {
    if (!document.slides?.[slideIndex])
      throw new Error("Select a slide first.");
    value = { ...document, slides: [document.slides[slideIndex]] };
  } else if (scope === "selection") {
    value = getValueAtPath(document, path);
    if (value === undefined) throw new Error("Select some content first.");
  }
  const json = JSON.stringify(value, null, format === "compact" ? 0 : 2);
  return format === "markdown" ? `\`\`\`json\n${json}\n\`\`\`` : json;
}
const catalogKeys = {
  layouts: "layout",
  themes: "theme",
  fontSchemes: "fontScheme",
  colorSchemes: "colorScheme",
  narratives: "narrative",
  languages: "language",
  tones: "tone",
  audiences: "audience",
  purposes: "purpose",
  socialPlatforms: "platform",
};
function themeFor(document, reference) {
  const id = typeof reference === "string" ? reference : reference?.id;
  const record =
    document.catalogs?.themes?.records?.find((item) => item.id === id) ??
    catalogs.themes.find((item) => item.id === id);
  return { ...record, ...(typeof reference === "object" ? reference : {}) };
}
export function prepareOpfImport(
  current,
  transfer,
  { mode = "insert", slideIndex = 0, path } = {},
) {
  if (mode === "selection") {
    const document = applyJsonPatch(
      current,
      createValuePatch(current, path, transfer.value),
    );
    assertOpf(document);
    return { document, slideIndex };
  }
  if (!transfer.document)
    throw new Error(
      "This is a content fragment. Choose Replace selected content.",
    );
  if (mode === "replace")
    return { document: assertOpf(clone(transfer.document)), slideIndex: 0 };
  if (mode !== "insert") throw new Error("Unknown import action.");
  const incoming = clone(transfer.document),
    document = clone(current);
  // Freeze the source deck defaults on inserted slides before changing their catalog ids.
  incoming.slides = incoming.slides.map((slide) => {
    const design = { ...incoming.design, ...slide.design };
    const theme = themeFor(incoming, design.theme ?? "minimal");
    return {
      ...slide,
      design: {
        ...design,
        theme: design.theme ?? "minimal",
        colorScheme: design.colorScheme ?? theme.colorScheme ?? "cool-horizon",
        fontScheme: design.fontScheme ?? theme.fontScheme ?? "roboto",
        dimensions: design.dimensions ?? theme.dimensions ?? "widescreen",
        background: design.background ?? theme.background ?? "#FFFFFF",
        header: design.header ?? false,
        footer: design.footer ?? false,
      },
    };
  });
  const mappings = {},
    assetMap = new Map();
  let chartTypes = new Map();
  for (const [kind, catalog] of Object.entries(incoming.catalogs ?? {})) {
    const existing = document.catalogs?.[kind];
    if (
      catalog.source &&
      existing?.source &&
      JSON.stringify(catalog.source) !== JSON.stringify(existing.source)
    )
      throw new Error(
        `The ${kind} gallery sources conflict. Open this as a separate presentation instead.`,
      );
    if (catalog.source && !existing?.source)
      throw new Error(
        `Resolve ${kind} records into this OPF before inserting, or open it as a presentation.`,
      );
    const used = new Set(
      [...(existing?.records ?? []), ...(catalogs[kind] ?? [])].map(
        (record) => record.id,
      ),
    );
    const names = new Map();
    for (const record of catalog.records ?? []) {
      let id = `import-${record.id}`,
        n = 2;
      while (used.has(id)) id = `import-${record.id}-${n++}`;
      used.add(id);
      names.set(record.id, id);
      record.id = id;
    }
    if (catalogKeys[kind]) mappings[catalogKeys[kind]] = names;
    if (kind === "chartTypes") chartTypes = names;
  }
  const assetIds = new Set(Object.keys(document.assets ?? {}));
  for (const id of Object.keys(incoming.assets ?? {})) {
    let next = id,
      n = 2;
    while (assetIds.has(next)) next = `${id}-${n++}`;
    assetIds.add(next);
    assetMap.set(id, next);
  }
  const rewrite = (value, key = "") => {
    if (Array.isArray(value)) return value.map((child) => rewrite(child, key));
    if (value && typeof value === "object") {
      const result = Object.fromEntries(
        Object.entries(value).map(([childKey, child]) => [
          childKey,
          rewrite(child, childKey),
        ]),
      );
      if (key === "socials" && mappings.platform) {
        for (const [id, child] of Object.entries(result)) {
          if (mappings.platform.has(id)) {
            delete result[id];
            result[mappings.platform.get(id)] = child;
          }
        }
      }
      if (mappings[key]?.has(value.id)) result.id = mappings[key].get(value.id);
      if (value.data && chartTypes.has(value.type))
        result.type = chartTypes.get(value.type);
      return result;
    }
    if (typeof value === "string") {
      if (mappings[key]?.has(value)) return mappings[key].get(value);
      if (
        ["src", "image", "video", "poster"].includes(key) &&
        value.startsWith("asset:") &&
        assetMap.has(value.slice(6))
      )
        return `asset:${assetMap.get(value.slice(6))}`;
    }
    return value;
  };
  const rewritten = rewrite(incoming);
  if (incoming.catalogs) {
    document.catalogs ??= {};
    for (const [kind, catalog] of Object.entries(rewritten.catalogs))
      document.catalogs[kind] = {
        ...document.catalogs[kind],
        ...catalog,
        records: [
          ...(document.catalogs[kind]?.records ?? []),
          ...(catalog.records ?? []),
        ],
      };
  }
  if (incoming.assets) {
    document.assets ??= {};
    for (const [id, asset] of Object.entries(rewritten.assets))
      document.assets[assetMap.get(id)] =
        typeof asset === "string" &&
        asset.startsWith("asset:") &&
        assetMap.has(asset.slice(6))
          ? `asset:${assetMap.get(asset.slice(6))}`
          : asset;
  }
  const ids = new Set(document.slides.map((slide) => slide.id).filter(Boolean));
  for (const slide of rewritten.slides)
    if (slide.id) {
      const base = slide.id;
      let n = 2;
      while (ids.has(slide.id)) slide.id = `${base}-${n++}`;
      ids.add(slide.id);
    }
  const index = Math.max(0, Math.min(document.slides.length, slideIndex + 1));
  document.slides.splice(index, 0, ...rewritten.slides);
  assertOpf(document);
  return { document, slideIndex: index };
}
