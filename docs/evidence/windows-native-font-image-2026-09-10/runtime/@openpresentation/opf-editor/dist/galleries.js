import { assertOpf, unwrapOpf, MAX_OPF_BYTES } from "./transfer.js";
import { catalogs } from "@openpresentation/opf";
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
function attachDefinition(document, descriptor) {
  const source = descriptor.metadata?.source,
    category = descriptor.category ?? descriptor.metadata?.category;
  if (!source) return;
  const kind = {
    layouts: "layouts",
    "font-schemes": "fontSchemes",
    "color-schemes": "colorSchemes",
    themes: "themes",
  }[category];
  if (!kind) return;
  const id = source.id ?? source.slug;
  if (!id) return;
  if (
    catalogs[kind]?.some((record) => record.id === id) ||
    document.catalogs?.[kind]?.records?.some((record) => record.id === id)
  )
    return;
  let record;
  if (kind === "layouts") {
    const n = Math.min(
      12,
      Number(String(source.contentMultiple ?? "").replace("x", "")) || 1,
    );
    const type =
      { Image: "picture", Chart: "chart", List: "list" }[source.contentType] ??
      "text";
    record = {
      $schema: "https://openpresentation.org/schema/opf-layout/v1",
      id,
      name: source.label ?? source.name ?? id,
      placeholders: [
        { type: "title" },
        ...Array.from({ length: n }, () => ({ type })),
      ],
      ...(n > 1
        ? {
            composition: {
              mode: n <= 3 ? "row" : "grid",
              ...(n > 3 ? { columns: 2 } : {}),
            },
          }
        : {}),
    };
  } else if (kind === "fontSchemes")
    record = {
      $schema: "https://openpresentation.org/schema/opf-font-scheme/v1",
      id,
      name: source.name ?? id,
      major: source.major ?? source.heading,
      minor: source.minor ?? source.body,
    };
  else {
    record = {
      ...source,
      $schema: `https://openpresentation.org/schema/opf-${kind === "themes" ? "theme" : "color-scheme"}/v1`,
    };
  }
  document.catalogs ??= {};
  document.catalogs[kind] ??= { records: [] };
  document.catalogs[kind].records ??= [];
  document.catalogs[kind].records.push(record);
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
  const document = structuredClone(unwrapOpf(descriptor));
  if (!document?.slides)
    throw new Error("This gallery item does not include a presentation.");
  attachDefinition(document, descriptor);
  // PPTX.gallery's older descriptors omit inline layout records. Resolve only named
  // layout references from its known, same-origin registry; no arbitrary dependency crawl.
  if (
    url &&
    ["www.pptx.gallery", "pptx.gallery"].includes(new URL(url).hostname)
  ) {
    const missing = [
      ...new Set(
        document.slides
          .map((slide) => slide.layout)
          .filter(
            (id) =>
              typeof id === "string" &&
              !catalogs.layouts.some((record) => record.id === id) &&
              !document.catalogs?.layouts?.records?.some(
                (record) => record.id === id,
              ),
          ),
      ),
    ];
    if (missing.length > 12)
      throw new Error(
        "This item needs too many layout definitions. Supply self-contained OPF.",
      );
    for (const id of missing) {
      if (!/^[a-z][a-z0-9-]*$/.test(id))
        throw new Error("Unsupported layout reference.");
      const dependency = await fetchGalleryJson(
        `/registry/layouts/${id}.json`,
        { ...options, base: url, origin: new URL(url).origin },
      );
      attachDefinition(document, dependency);
    }
  }
  assertOpf(document);
  return document;
}
