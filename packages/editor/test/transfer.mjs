import assert from "node:assert/strict";
import {
  parseOpfTransfer,
  serializeOpfTransfer,
  prepareOpfImport,
} from "../dist/transfer.js";
import {
  loadOpfGallery,
  loadOpfGalleryItem,
  fetchGalleryJson,
  galleryItemUrl,
} from "../dist/galleries.js";
import { createEditorSession } from "../dist/index.js";
const source = {
  design: { theme: "classic", fontScheme: "roboto" },
  assets: { logo: "data:image/png;base64,AA==" },
  slides: [{ id: "same", title: "Current", image: "asset:logo" }],
};
for (const format of ["pretty", "compact", "markdown"])
  assert.deepEqual(
    parseOpfTransfer(serializeOpfTransfer(source, { format })).presentation,
    source,
  );
assert.equal(parseOpfTransfer('{"title":"One slide"}').kind, "slides");
assert.equal(
  parseOpfTransfer('[{"title":"One"},{"title":"Two"}]').presentation.slides.length,
  2,
);
assert.equal(parseOpfTransfer('"Text fragment"').kind, "selection");
assert.throws(() => parseOpfTransfer('{"slides":[]}'));
assert.throws(() => parseOpfTransfer("{broken"));
assert.throws(() => parseOpfTransfer("```json\n{}\n```\n```json\n{}\n```"));
assert.throws(() => parseOpfTransfer('{"__proto__":{}}'));
const copy = parseOpfTransfer(
  serializeOpfTransfer(source, { scope: "slide" }),
).presentation;
assert.deepEqual(copy.assets, source.assets);
assert.deepEqual(copy.design, source.design);
assert.equal(
  serializeOpfTransfer(source, { scope: "selection", path: "slides.0.title" }),
  '"Current"',
);
const imported = {
  design: { theme: "minimal", fontScheme: "custom-font" },
  catalogs: {
    custom: {
      fontSchemes: {
        "custom-font": { name: "Custom", major: "Roboto", minor: "Roboto" },
      },
    },
  },
  assets: { logo: "data:image/png;base64,AQ==", alias: "asset:logo" },
  slides: [
    {
      id: "same",
      title: "Imported",
      image: "asset:logo",
      text: "asset:logo is literal text",
    },
  ],
};
const result = prepareOpfImport(
  source,
  parseOpfTransfer(JSON.stringify(imported)),
);
assert.equal(source.slides.length, 1);
assert.equal(result.presentation.slides.length, 2);
assert.equal(result.presentation.slides[1].id, "same-2");
assert.equal(result.presentation.slides[1].image, "asset:logo-2");
assert.equal(result.presentation.assets.alias, "asset:logo-2");
assert.equal(result.presentation.assets.logo, source.assets.logo);
assert.equal(result.presentation.slides[1].text, "asset:logo is literal text");
// FA-23: core's copySlides copies the record the slide uses under its own id when nothing conflicts (no import-<id> renaming).
assert.equal(result.presentation.slides[1].design.fontScheme, "custom-font");
assert.deepEqual(result.presentation.catalogs.custom.fontSchemes["custom-font"], imported.catalogs.custom.fontSchemes["custom-font"]);
assert.deepEqual(result.renamed, []);
// The same slides again reuse the identical record.
const twiceResult = prepareOpfImport(
  result.presentation,
  parseOpfTransfer(JSON.stringify(imported)),
);
const twice = twiceResult.presentation;
assert.deepEqual(Object.keys(twice.catalogs.custom.fontSchemes), ["custom-font"]);
assert.deepEqual(twiceResult.renamed, []);
// A different record under the same custom id is renamed <id>-2 and reported.
const differing = structuredClone(imported);
differing.catalogs.custom.fontSchemes["custom-font"].major = "Lora";
const renamed = prepareOpfImport(result.presentation, parseOpfTransfer(JSON.stringify(differing)));
assert.equal(renamed.presentation.slides[renamed.slideIndex].design.fontScheme, "custom-font-2");
assert.deepEqual(renamed.renamed.map((entry) => [entry.kind, entry.from, entry.to, entry.reason]), [["fontSchemes", "custom-font", "custom-font-2", "custom-conflict"]]);
const editor = createEditorSession(source, { rejectInvalid: true });
editor.applyPatch([{ op: "replace", path: "", value: result.presentation }]);
editor.undo();
assert.deepEqual(editor.presentation, source);
const selected = prepareOpfImport(source, parseOpfTransfer('"Revised"'), {
  mode: "selection",
  path: "slides.0.title",
});
assert.equal(selected.presentation.slides[0].title, "Revised");
assert.throws(() =>
  prepareOpfImport(source, parseOpfTransfer("42"), {
    mode: "selection",
    path: "slides.0.title",
  }),
);
assert.deepEqual(
  prepareOpfImport(source, parseOpfTransfer(JSON.stringify(imported)), {
    mode: "replace",
  }).presentation,
  imported,
);
// OPF 0.15 is a clean spec: the 0.14 catalog shape (`catalogs.<kind>.records`) is not OPF any more.
assert.throws(() =>
  parseOpfTransfer('{"catalogs":{"fontSchemes":{"records":[]}},"slides":[{"title":"Old shape"}]}'),
);
// A pasted deck that names a catalog group by source brings the group along (core copySlides matches groups by source).
{
  const named = { catalogs: { acme: { source: "pkg:@acme/opf-catalog", layouts: { hero: { name: "Hero", placeholders: [{ type: "title" }] } } } }, slides: [{ id: "acme", layout: "acme:hero", title: "Acme" }] };
  const target = { catalogs: { brand: { source: "pkg:@acme/opf-catalog" } }, slides: [{ id: "host", title: "Host" }] };
  const inserted = prepareOpfImport(target, parseOpfTransfer(JSON.stringify(named)), { mode: "insert", slideIndex: 0 });
  assert.equal(inserted.presentation.slides[1].layout, "brand:hero", "references are rewritten to the target's name for that source");
  assert.ok(inserted.presentation.catalogs.brand.layouts.hero);
}
const responses = new Map([
  [
    "https://gallery.example/registry.json",
    {
      name: "Custom Gallery",
      items: [
        { name: "Remote deck", registry_url: "./deck.json" },
        { name: "Inline deck", opf: { slides: [{ title: "Inline" }] } },
      ],
    },
  ],
  [
    "https://gallery.example/deck.json",
    { opf: [{ name: "default", value: { slides: [{ title: "Fetched" }] } }] },
  ],
]);
const requested = [];
const fetcher = async (url, options) => {
  requested.push({ url, options });
  return new Response(JSON.stringify(responses.get(url)), {
    status: responses.has(url) ? 200 : 404,
  });
};
const gallery = await loadOpfGallery("https://gallery.example", {
  fetch: fetcher,
});
assert.equal(gallery.items.length, 2);
const remote = await loadOpfGalleryItem(gallery.items[0], {
  gallery: gallery.url,
  fetch: fetcher,
});
assert.equal(remote.slides[0].title, "Fetched");
assert.equal(
  (await loadOpfGalleryItem(gallery.items[1], { gallery: gallery.url }))
    .slides[0].title,
  "Inline",
);
assert.equal(requested[0].options.credentials, "omit");
assert.equal(requested[0].options.referrerPolicy, "no-referrer");
await assert.rejects(
  loadOpfGalleryItem(
    { url: "https://elsewhere.example/a.json" },
    { gallery: gallery.url, fetch: fetcher },
  ),
);
await assert.rejects(
  fetchGalleryJson("javascript:alert(1)", { fetch: fetcher }),
);
await assert.rejects(
  fetchGalleryJson("https://u:p@example.com", { fetch: fetcher }),
);
await assert.rejects(
  fetchGalleryJson("https://gallery.example/missing", { fetch: fetcher }),
  /HTTP 404/,
);
await assert.rejects(
  fetchGalleryJson("https://gallery.example/huge", {
    fetch: async () =>
      new Response("{}", {
        headers: { "content-length": String(21 * 1024 * 1024) },
      }),
  }),
  /20 MB/,
);
await assert.rejects(
  loadOpfGallery("https://gallery.example", {
    fetch: async () => new Response('{"slides":[]}'),
  }),
  /items array/,
);
assert.equal(
  galleryItemUrl("https://pptx.gallery/layouts/two-column"),
  "https://www.pptx.gallery/registry/layouts/two-column.json",
);
assert.equal(
  galleryItemUrl("https://www.pptx.gallery/blocks/pitch-deck-intro"),
  "https://www.pptx.gallery/api/blocks.json#opf-item=pitch-deck-intro",
);
// FA-07: inserted slides freeze the source deck's design but never its size (a slide's design cannot set dimensions).
{
  const source = { name: "Source", design: { theme: "minimal", dimensions: "4:3" }, slides: [{ id: "wide", title: "Sized deck" }] };
  const target = { name: "Target", design: { theme: "minimal", dimensions: "letter" }, slides: [{ id: "host", title: "Host" }] };
  const inserted = prepareOpfImport(target, parseOpfTransfer(JSON.stringify(source)), { mode: "insert", slideIndex: 0 }).presentation;
  assert.equal(inserted.design.dimensions, "letter");
  for (const slide of inserted.slides) assert.equal(slide.design?.dimensions, undefined, "no slide carries dimensions");
}
console.log(
  "Transfer: clipboard formats, code fences, fragments, collision-safe insertion, design/assets, undo and explicit gallery fetches passed.",
);
