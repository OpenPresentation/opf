import { assertOpf, unwrapOpf, MAX_OPF_BYTES } from "./transfer.js";
export function galleryUrl(input, base) {
  const url = new URL(input, base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use a public HTTP or HTTPS URL without credentials.");
  return url;
}
export function normalizeGalleryUrl(input, base) {
  const url = galleryUrl(input, base);
  if (url.hostname === "pptx.gallery") url.hostname = "www.pptx.gallery";
  if (url.pathname === "/" || url.pathname === "")
    url.pathname = "/registry.json";
  return url.href;
}
export function galleryItemUrl(input, base) {
  const url = galleryUrl(input, base);
  if (["pptx.gallery", "www.pptx.gallery"].includes(url.hostname)) {
    url.hostname = "www.pptx.gallery";
    const match = url.pathname.match(
      /^\/(layouts|color-schemes|colors|font-schemes|typography|themes|charts|backgrounds|narratives)\/([^/]+)\/?$/,
    );
    if (match)
      url.pathname = `/registry/${{ colors: "color-schemes", typography: "font-schemes" }[match[1]] ?? match[1]}/${match[2]}.json`;
    const content = url.pathname.match(
      /^\/(blocks|image-treatments)\/([^/]+)\/?$/,
    );
    if (content) {
      url.pathname = `/api/${content[1]}.json`;
      url.hash = `opf-item=${encodeURIComponent(content[2])}`;
    }
  }
  return url.href;
}
export async function fetchGalleryJson(
  input,
  { fetch: fetcher = globalThis.fetch, signal, base, origin } = {},
) {
  const url = galleryUrl(input, base);
  if (origin && url.origin !== origin)
    throw new Error(
      "This item points outside its configured gallery. Load its URL explicitly to use it.",
    );
  const response = await fetcher(url.href, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok)
    throw new Error(`Gallery returned HTTP ${response.status}.`);
  if (origin && response.url && new URL(response.url).origin !== origin)
    throw new Error(
      "The gallery redirected to another origin. Add its destination explicitly.",
    );
  if (Number(response.headers?.get("content-length")) > MAX_OPF_BYTES)
    throw new Error("Gallery response exceeds 20 MB.");
  let text = "";
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let count = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        count += value.byteLength;
        if (count > MAX_OPF_BYTES)
          throw new Error("Gallery response exceeds 20 MB.");
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      await reader.cancel();
      throw error;
    }
  } else {
    text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_OPF_BYTES)
      throw new Error("Gallery response exceeds 20 MB.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "This URL did not return JSON. Use a gallery registry, OPF URL, or supported gallery item link.",
    );
  }
}
export async function loadOpfGallery(input, options = {}) {
  const url = normalizeGalleryUrl(input, options.base);
  const data = await fetchGalleryJson(url, options);
  const entries = Array.isArray(data) ? data : (data.items ?? data.entries);
  if (!Array.isArray(entries))
    throw new Error(
      "A gallery needs an items array. Use Load URL for a single OPF document.",
    );
  if (entries.length > 5000)
    throw new Error("A gallery can contain at most 5,000 entries.");
  return {
    name: String(data.name ?? new URL(url).hostname),
    url,
    items: entries.map((item, index) => ({
      id: String(item.id ?? item.slug ?? index),
      name: String(
        item.name ?? item.title ?? item.id ?? `Example ${index + 1}`,
      ),
      description: String(item.description ?? ""),
      category: String(
        item.category ?? item.type?.replace("registry:", "") ?? "Examples",
      ),
      url: item.registry_url ?? item.opfUrl ?? item.url,
      raw: item,
    })),
  };
}
const FONT_SCHEME_ENUMS = {
  type: ["sans-serif", "serif", "monospace"],
  app: ["powerpoint", "google-slides"],
  languageFamily: ["latin", "ea", "cs", "eastAsian", "complexScript"],
};
// A font role is a family name (a non-empty string), or undefined.
function fontRole(value) {
  return typeof value === "string" && value ? value : undefined;
}
// Keep every font-scheme role that the catalog record schema defines: the OOXML
// pair and `code`. Gallery `heading`/`body` (family names) map onto
// major/minor only, never role objects, so a later inline design.fontScheme
// major/minor override still wins (resolveFontFamilies checks roles before the
// pair). `accent` is not part of the record schema and is dropped.
function fontSchemeRecord(source, id) {
  const record = {
    name: source.name ?? id,
    major:
      typeof source.major === "string"
        ? source.major
        : fontRole(source.heading),
    minor:
      typeof source.minor === "string"
        ? source.minor
        : fontRole(source.body),
  };
  for (const [field, values] of Object.entries(FONT_SCHEME_ENUMS))
    if (values.includes(source[field])) record[field] = source[field];
  const code = fontRole(source.code);
  if (code) record.code = code;
  return record;
}
const isPlain = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
// Embedded records carry no `$schema`, `id` or `x-*` display metadata (OPF 0.15): the key is the id.
function embeddedRecord(source) {
  return Object.fromEntries(
    Object.entries(structuredClone(source)).filter(
      ([key]) => key !== "$schema" && key !== "id" && key !== "slug" && !key.startsWith("x-"),
    ),
  );
}
/**
 * A gallery item that describes one catalog record (a layout, theme, colour or font scheme) is embedded in the
 * document it previews: under `default` with the gallery's origin as its `source` when the document has no default
 * group (or its default is that gallery), else under `custom` (an item with no gallery URL, or another default
 * catalog). Records the document already embeds are kept.
 */
function attachDefinition(presentation, descriptor, gallerySource) {
  const source = descriptor.metadata?.source,
    category = descriptor.category ?? descriptor.metadata?.category;
  if (!isPlain(source)) return;
  const kind = {
    layouts: "layouts",
    "font-schemes": "fontSchemes",
    "color-schemes": "colorSchemes",
    themes: "themes",
  }[category];
  if (!kind) return;
  const id = source.id ?? source.slug;
  if (typeof id !== "string" || !/^[a-z][a-z0-9-]*$/.test(id)) return;
  const groups = (presentation.catalogs ??= {});
  if (groups.custom?.[kind]?.[id] !== undefined || groups.default?.[kind]?.[id] !== undefined) return;
  const group = gallerySource && (groups.default === undefined || groups.default?.source === gallerySource) ? "default" : "custom";
  if (group === "default") groups.default ??= { source: gallerySource };
  else groups.custom ??= {};
  groups[group][kind] ??= {};
  let record;
  if (kind === "layouts") {
    // A gallery layout item is a layout record: its placeholders, design hints and composition are the
    // record's own. Only an item that declares no placeholders gets the default title and text.
    const placeholders = Array.isArray(source.placeholders)
      ? source.placeholders
          .filter((placeholder) => typeof placeholder?.type === "string")
          .map((placeholder) => structuredClone(placeholder))
      : [{ type: "title" }, { type: "text" }];
    record = {
      name: source.label ?? source.name ?? id,
      ...(isPlain(source.design) ? { design: structuredClone(source.design) } : {}),
      placeholders,
      ...(isPlain(source.composition) ? { composition: structuredClone(source.composition) } : {}),
    };
  } else if (kind === "fontSchemes") record = fontSchemeRecord(source, id);
  else record = embeddedRecord(source);
  groups[group][kind][id] = record;
}
export async function loadOpfGalleryItem(item, { gallery, ...options } = {}) {
  const base = gallery ?? options.base;
  const url = item.url ? galleryItemUrl(item.url, base) : base;
  const origin = gallery ? new URL(gallery).origin : undefined;
  let descriptor = item.url
    ? await fetchGalleryJson(url, { ...options, base, origin })
    : (item.raw ?? item);
  if (url && new URL(url).hash.startsWith("#opf-item=")) {
    const slug = decodeURIComponent(new URL(url).hash.slice(10));
    descriptor = descriptor.items?.find(
      (entry) => (entry.slug ?? entry.id) === slug,
    );
    if (!descriptor) throw new Error("This gallery item was not found.");
  }
  const presentation = structuredClone(unwrapOpf(descriptor));
  if (!presentation?.slides)
    throw new Error("This gallery item does not include a presentation.");
  // A gallery publishes self-contained OPF (every record a document uses is embedded, FA-23); the item's own record is
  // embedded too when the snippet omits it. Nothing else is fetched.
  attachDefinition(presentation, descriptor, url ? new URL(url).origin : undefined);
  assertOpf(presentation);
  return presentation;
}
