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
    parseOpfTransfer(serializeOpfTransfer(source, { format })).document,
    source,
  );
assert.equal(parseOpfTransfer('{"title":"One slide"}').kind, "slides");
assert.equal(
  parseOpfTransfer('[{"title":"One"},{"title":"Two"}]').document.slides.length,
  2,
);
assert.equal(parseOpfTransfer('"Text fragment"').kind, "selection");
assert.throws(() => parseOpfTransfer('{"slides":[]}'));
assert.throws(() => parseOpfTransfer("{broken"));
assert.throws(() => parseOpfTransfer("```json\n{}\n```\n```json\n{}\n```"));
assert.throws(() => parseOpfTransfer('{"__proto__":{}}'));
const copy = parseOpfTransfer(
  serializeOpfTransfer(source, { scope: "slide" }),
).document;
assert.deepEqual(copy.assets, source.assets);
assert.deepEqual(copy.design, source.design);
assert.equal(
  serializeOpfTransfer(source, { scope: "selection", path: "slides.0.title" }),
  '"Current"',
);
const imported = {
  design: { theme: "minimal", fontScheme: "custom-font" },
  catalogs: {
    fontSchemes: {
      records: [
        {
          $schema: "https://openpresentation.org/schema/opf-font-scheme/v1",
          id: "custom-font",
          name: "Custom",
          major: "Roboto",
          minor: "Roboto",
        },
      ],
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
assert.equal(result.document.slides.length, 2);
assert.equal(result.document.slides[1].id, "same-2");
assert.equal(result.document.slides[1].image, "asset:logo-2");
assert.equal(result.document.assets.alias, "asset:logo-2");
assert.equal(result.document.assets.logo, source.assets.logo);
assert.equal(result.document.slides[1].text, "asset:logo is literal text");
assert.equal(result.document.slides[1].design.fontScheme, "import-custom-font");
assert.equal(
  result.document.catalogs.fontSchemes.records[0].id,
  "import-custom-font",
);
const twice = prepareOpfImport(
  result.document,
  parseOpfTransfer(JSON.stringify(imported)),
).document;
assert.ok(
  twice.catalogs.fontSchemes.records.some(
    (record) => record.id === "import-custom-font-2",
  ),
);
const editor = createEditorSession(source, { rejectInvalid: true });
editor.applyPatch([{ op: "replace", path: "", value: result.document }]);
editor.undo();
assert.deepEqual(editor.document, source);
const selected = prepareOpfImport(source, parseOpfTransfer('"Revised"'), {
  mode: "selection",
  path: "slides.0.title",
});
assert.equal(selected.document.slides[0].title, "Revised");
assert.throws(() =>
  prepareOpfImport(source, parseOpfTransfer("42"), {
    mode: "selection",
    path: "slides.0.title",
  }),
);
assert.deepEqual(
  prepareOpfImport(source, parseOpfTransfer(JSON.stringify(imported)), {
    mode: "replace",
  }).document,
  imported,
);
assert.throws(() =>
  prepareOpfImport(
    source,
    parseOpfTransfer(
      '{"catalogs":{"layouts":{"source":"https://example.com/layouts.json"}},"slides":[{"title":"External"}]}',
    ),
  ),
);
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
console.log(
  "Transfer: clipboard formats, code fences, fragments, collision-safe insertion, design/assets, undo and explicit gallery fetches passed.",
);
