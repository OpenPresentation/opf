// FF-16 (font-fidelity-everywhere): editor switches for every pptx.gallery dimension.
// Each dimension produces the expected patch, one undoable transaction, and a preview that
// recomposes to the new fonts and content. Exports after a switch: switches-export.mjs.
import assert from "node:assert/strict";
import { validatePresentation } from "@openpresentation/opf";
import { renderSvg } from "@openpresentation/opf-render/svg";
import { OPFEditorError, createEditorSession, resolveSlideFonts } from "../dist/index.js";
import { prepareBlockReplace } from "../dist/layout.js";
import { prepareDimensionSwitch, switchDimension, SWITCH_DIMENSIONS } from "../dist/switches.js";
import { GALLERY_DIMENSIONS, baseDeck, cases } from "./switch-fixture.mjs";

// Coverage: every gallery dimension has a switch and a case, and nothing else does.
assert.deepEqual([...SWITCH_DIMENSIONS], GALLERY_DIMENSIONS);
assert.deepEqual(cases.map((entry) => entry.dimension), GALLERY_DIMENSIONS);

const session = (document = baseDeck()) => createEditorSession(document, { rejectInvalid: true });
const svg = (document, slideIndex) => renderSvg(document, { slideIndex });
function measuredFamilies(document, slideIndex) {
  const families = new Set();
  createEditorSession(document).composeSlide(slideIndex, {
    textMeasurement: { measure: (text, size, style) => (families.add(style.fontFamily), text.length * size * 0.5) },
  });
  return [...families].sort();
}
// Whether the installed renderer draws design.slideImage (unpublished FF-26 in renderer main).
const slideImageSupported = (() => {
  const document = baseDeck();
  const plain = svg(document, 0);
  document.slides[0].design = { slideImage: { src: "asset:cover", position: "right" } };
  return svg(document, 0) !== plain;
})();

const summary = [];
let languagePreview = "skipped: installed renderer does not mark the language in the SVG";
for (const entry of cases) {
  const { dimension, value, options, slide } = entry;
  const editor = session();
  const original = editor.document;
  const beforeSvg = svg(original, slide);
  const events = [];
  editor.subscribe((event) => events.push(event));

  const change = switchDimension(editor, dimension, value, options);

  // Expected patch, one transaction, valid document.
  assert.equal(change.changed, true, dimension);
  assert.equal(change.dimension, dimension);
  if (entry.patches) assert.deepEqual(change.patches, entry.patches, `${dimension} patch`);
  if (entry.patchPaths) assert.deepEqual(change.patches.map((patch) => patch.path), entry.patchPaths, `${dimension} patch paths`);
  entry.check?.(change.document);
  assert.equal(editor.validation.valid, true, `${dimension} valid`);
  assert.equal(validatePresentation(editor.document).valid, true);
  assert.equal(editor.snapshot().undoDepth, 1, `${dimension} is one undo step`);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "patch");
  assert.equal(events[0].meta.source, "dimension-switch");
  assert.equal(events[0].meta.dimension, dimension);
  assert.deepEqual(events[0].snapshot.document, editor.document, "the event carries the switched document");
  // prepareDimensionSwitch is the same patch without a session, and does not mutate its input.
  const prepared = prepareDimensionSwitch(original, dimension, value, options);
  assert.deepEqual(prepared.patches, change.patches);
  assert.deepEqual(prepared.document, editor.document);
  assert.deepEqual(original, baseDeck());

  // Preview refresh: the shared composition and SVG render follow the switched document.
  const switched = editor.document;
  const afterSvg = svg(switched, slide);
  if (entry.preview === "svg") assert.notEqual(afterSvg, beforeSvg, `${dimension}: preview changes`);
  else if (entry.preview === "metadata") assert.equal(afterSvg, beforeSvg, `${dimension}: authoring metadata leaves the preview as is`);
  else if (entry.preview === "language") {
    if (afterSvg !== beforeSvg) {
      languagePreview = "checked";
      assert.match(afterSvg, /xml:lang="ja"/, "the preview marks the new language");
    }
  } else if (slideImageSupported) assert.notEqual(afterSvg, beforeSvg, `${dimension}: preview changes`);
  if (entry.fonts) {
    assert.deepEqual(resolveSlideFonts(switched, slide), { ...resolveSlideFonts(original, slide), ...entry.fonts }, `${dimension}: resolved fonts`);
    assert.deepEqual(measuredFamilies(switched, slide), [...new Set(Object.values(entry.fonts))].sort(), `${dimension}: composition measures the new fonts`);
    assert.ok(afterSvg.includes(entry.fonts.body), `${dimension}: SVG names ${entry.fonts.body}`);
    assert.ok(!beforeSvg.includes(entry.fonts.body));
  }

  // Undo and redo restore exact documents and previews.
  assert.deepEqual(editor.undo().document, original, `${dimension} undo`);
  assert.equal(editor.canUndo, false);
  assert.equal(svg(editor.document, slide), beforeSvg, `${dimension}: undo restores the preview`);
  assert.deepEqual(editor.redo().document, switched, `${dimension} redo`);
  assert.equal(svg(editor.document, slide), afterSvg, `${dimension}: redo restores the preview`);
  assert.deepEqual(events.map((event) => event.type), ["patch", "undo", "redo"]);
  assert.deepEqual(events[1].snapshot.document, original);
  assert.deepEqual(events[2].snapshot.document, switched);

  // Switching to the value the document already has is a no-op with no history entry.
  editor.undo();
  const again = switchDimension(editor, dimension, value, options);
  assert.equal(again.changed, true);
  const repeat = switchDimension(editor, dimension, value, options);
  assert.equal(repeat.changed, false, `${dimension}: repeat switch`);
  assert.deepEqual(repeat.patches, []);
  assert.equal(editor.snapshot().undoDepth, 1);
  summary.push(dimension);
}
assert.deepEqual(summary, GALLERY_DIMENSIONS);

// Design dimensions: a slide scope patches the slide, and a deck scope reports shadowing.
{
  const editor = session();
  const change = switchDimension(editor, "font-schemes", "georgia", { slideIndex: 1 });
  assert.deepEqual(change.patches, [{ op: "add", path: "/slides/1/design", value: { fontScheme: "georgia" } }]);
  assert.equal(change.scope, "slide");
  assert.deepEqual(measuredFamilies(editor.document, 1), ["Georgia"]);
  assert.deepEqual(measuredFamilies(editor.document, 0), ["Aptos", "Aptos Display"]);
  // A deck switch cannot reach a slide with its own font scheme: it says so instead of hiding it.
  const deck = switchDimension(editor, "font-schemes", "roboto");
  assert.deepEqual(deck.patches, [{ op: "replace", path: "/design/fontScheme", value: "roboto" }]);
  assert.deepEqual(deck.shadowed, [1]);
  assert.deepEqual(measuredFamilies(editor.document, 1), ["Georgia"]);
  // Clearing the overrides is opt-in and joins the same transaction.
  const depth = editor.snapshot().undoDepth;
  const cleared = switchDimension(editor, "font-schemes", "tahoma", { clearSlideOverrides: true });
  assert.deepEqual(cleared.patches, [
    { op: "replace", path: "/design/fontScheme", value: "tahoma" },
    { op: "remove", path: "/slides/1/design/fontScheme" },
  ]);
  assert.deepEqual(cleared.shadowed, []);
  assert.deepEqual(measuredFamilies(editor.document, 1), ["Tahoma"]);
  assert.equal(editor.snapshot().undoDepth, depth + 1);
  editor.undo();
  assert.deepEqual(measuredFamilies(editor.document, 1), ["Georgia"]);
  // An inline object value is replaced by the bare id: its overrides belong to the old scheme.
  const custom = session({ ...baseDeck(), design: { fontScheme: { id: "aptos", major: "Override Display", minor: "Override Text" } } });
  assert.deepEqual(measuredFamilies(custom.document, 0), ["Override Display", "Override Text"]);
  switchDimension(custom, "font-schemes", "georgia");
  assert.equal(custom.get("design.fontScheme"), "georgia");
  assert.deepEqual(measuredFamilies(custom.document, 0), ["Georgia"]);
}

// Image treatments at deck scope write the gallery's snippet: slideImage and imageFill.
{
  const editor = session();
  const change = switchDimension(editor, "image-treatments", { slideImage: { src: "asset:cover", position: "right" }, imageFill: "crop" });
  assert.deepEqual(change.patches, [
    { op: "add", path: "/design/slideImage", value: { src: "asset:cover", position: "right" } },
    { op: "add", path: "/design/imageFill", value: "crop" },
  ]);
  const removed = switchDimension(editor, "image-treatments", { slideImage: null });
  assert.deepEqual(removed.patches, [{ op: "remove", path: "/design/slideImage" }]);
  assert.equal(editor.get("design.imageFill"), "crop");
}

// Themes: the default writes the whole bundle so fonts follow; bundle:false changes only the id.
{
  const editor = session();
  const plain = switchDimension(editor, "themes", "classic", { bundle: false });
  assert.deepEqual(plain.patches, [{ op: "replace", path: "/design/theme", value: "classic" }]);
  // The deck's explicit font scheme still wins, so the fonts did not change.
  assert.deepEqual(measuredFamilies(editor.document, 0), ["Aptos", "Aptos Display"]);
  editor.undo();
  switchDimension(editor, "themes", "classic");
  assert.deepEqual(measuredFamilies(editor.document, 0), ["Tenorite", "Tenorite Display"]);
}

// Gallery records: an item's own record is added inline in the same undoable transaction.
{
  const editor = session();
  const record = { id: "team-mono", name: "Team Mono", major: "Inter", minor: "Inter", code: { family: "JetBrains Mono" } };
  assert.throws(() => switchDimension(editor, "font-schemes", "team-mono"), (error) => error.code === "unknown-catalog-id");
  const change = switchDimension(editor, "font-schemes", "team-mono", { record });
  assert.deepEqual(change.patches.map((patch) => [patch.op, patch.path]), [["add", "/catalogs"], ["replace", "/design/fontScheme"]]);
  assert.equal(editor.get("catalogs.fontSchemes.records.0.id"), "team-mono");
  assert.deepEqual(resolveSlideFonts(editor.document, 0), { heading: "Inter", body: "Inter", code: "JetBrains Mono" });
  assert.deepEqual(measuredFamilies(editor.document, 0), ["Inter"]);
  // With another inline catalog present, bundled ids stay available and records append.
  switchDimension(editor, "font-schemes", "georgia");
  const second = switchDimension(editor, "font-schemes", "team-serif", { record: { id: "team-serif", name: "Team Serif", major: "Lora", minor: "Lora" } });
  assert.deepEqual(second.patches.map((patch) => patch.path), ["/catalogs/fontSchemes/records/-", "/design/fontScheme"]);
  assert.deepEqual(measuredFamilies(editor.document, 0), ["Lora"]);
  assert.throws(() => switchDimension(editor, "font-schemes", "other", { record }), (error) => error.code === "record-id-mismatch");
  while (editor.canUndo) editor.undo();
  assert.deepEqual(editor.document, baseDeck());
  // A gallery-only layout arrives with its own record.
  const layout = { id: "gallery-hero", name: "Gallery hero", placeholders: [{ type: "title" }, { type: "text" }] };
  const hero = switchDimension(editor, "layouts", "gallery-hero", { slideIndex: 0, record: layout });
  assert.equal(hero.patches[0].path, "/catalogs");
  assert.equal(editor.get("slides.0.layout"), "gallery-hero");
  editor.undo();
  assert.equal(editor.get("catalogs"), undefined);
}

// Layouts keep existing content and add the blank payloads the new layout declares.
{
  const editor = session();
  switchDimension(editor, "layouts", "number-2x", { slideIndex: 0 });
  const slide = editor.get("slides.0");
  assert.equal(slide.layout, "number-2x");
  assert.equal(slide.title, "Quarterly review");
  assert.equal(slide.subtitle, "Switch fixture");
  assert.equal(JSON.stringify(slide).split('"metric"').length - 1, 2);
}

// Charts: type switch keeps the data; the chart may sit inside a block.
{
  const document = baseDeck();
  document.slides[1] = { id: "chart", title: "Revenue", blocks: [{ text: "Note" }, { chart: document.slides[1].chart }] };
  const editor = session(document);
  const change = switchDimension(editor, "charts", "area", { slideIndex: 1 });
  assert.deepEqual(change.patches, [{ op: "replace", path: "/slides/1/blocks/1/chart/type", value: "area" }]);
  assert.deepEqual(editor.get("slides.1.blocks.1.chart.data"), document.slides[1].blocks[1].chart.data);
  assert.throws(() => switchDimension(editor, "charts", "area", { slideIndex: 0 }), (error) => error.code === "chart-not-found");
}

// Backgrounds accept the schema's shorthand strings as well as objects.
{
  const editor = session();
  for (const shorthand of ["dark1", "light2", "#ffff00"]) {
    const change = switchDimension(editor, "backgrounds", shorthand);
    assert.deepEqual(change.patches, [{ op: change.patches[0].op, path: "/design/background", value: shorthand }]);
    assert.equal(editor.get("design.background"), shorthand);
    assert.equal(editor.validation.valid, true);
    assert.notEqual(svg(editor.document, 0), svg(baseDeck(), 0));
  }
  const scoped = switchDimension(editor, "backgrounds", "#00ff00", { slideIndex: 1 });
  assert.deepEqual(scoped.patches, [{ op: "add", path: "/slides/1/design", value: { background: "#00ff00" } }]);
  editor.undo();
  editor.undo();
  assert.equal(editor.get("design.background"), "light2");
}

// Socials: the organization, arrays of speakers and replacing a handle.
{
  const document = baseDeck();
  document.speaker = [{ id: "alice", name: "Alice" }, { id: "bo", name: "Bo", socials: { x: "@bo" } }];
  const editor = session(document);
  const change = switchDimension(editor, "socials", { platform: "github", handle: "bo-dev" }, { index: 1 });
  assert.deepEqual(change.patches, [{ op: "add", path: "/speaker/1/socials/github", value: "bo-dev" }]);
  const replaced = switchDimension(editor, "socials", { platform: "x", handle: "@bo2" }, { index: 1 });
  assert.deepEqual(replaced.patches, [{ op: "replace", path: "/speaker/1/socials/x", value: "@bo2" }]);
  const org = switchDimension(editor, "socials", { platform: "linkedin", handle: "acme" }, { owner: "organization" });
  assert.deepEqual(org.patches, [{ op: "add", path: "/organization/socials", value: { linkedin: "acme" } }]);
  assert.throws(() => switchDimension(session({ ...baseDeck(), speaker: undefined }), "socials", { platform: "x", handle: "@a" }), (error) => error.code === "missing-owner");
}

// Headers and footers: absent fields stay, null removes.
{
  const editor = session();
  switchDimension(editor, "headers-footers", { header: { left: { text: "Brand" } }, footer: { center: { text: "Confidential" } } });
  const onlyFooter = switchDimension(editor, "headers-footers", { footer: { center: { text: "Internal" } } });
  assert.deepEqual(onlyFooter.patches, [{ op: "replace", path: "/design/footer", value: { center: { text: "Internal" } } }]);
  assert.deepEqual(editor.get("design.header"), { left: { text: "Brand" } });
  const removed = switchDimension(editor, "headers-footers", { header: null });
  assert.deepEqual(removed.patches, [{ op: "remove", path: "/design/header" }]);
  assert.equal(editor.get("design.header"), undefined);
}

// Blocks: replacement only. The old payload is discarded, never converted, and stable ids stay.
{
  const document = baseDeck();
  document.slides[2].blocks[0] = { id: "intro", text: [{ text: "Rich ", bold: true }, { text: "text" }], extensions: { review: "kept" } };
  document.slides[3] = { id: "single", title: "Single", text: "Only text" };
  const editor = session(document);
  const change = switchDimension(editor, "blocks", "list", { path: "slides.2.blocks.0" });
  assert.deepEqual(editor.get("slides.2.blocks.0"), { id: "intro", extensions: { review: "kept" }, items: ["First point", "Second point"] });
  assert.equal(JSON.stringify(editor.document).includes("Rich"), false, "the old text is discarded, not converted into list items");
  assert.deepEqual(change.patches[0], { op: "test", path: "/slides/2/blocks/0", value: document.slides[2].blocks[0] });
  // An explicit block object is used as given.
  switchDimension(editor, "blocks", { metric: { value: 7, label: "Wins" } }, { path: "slides.2.blocks.1" });
  assert.deepEqual(editor.get("slides.2.blocks.1"), { metric: { value: 7, label: "Wins" } });
  // A slide holding one implicit payload is replaced in place, keeping its other fields.
  switchDimension(editor, "blocks", "quote", { path: "slides.3" });
  assert.deepEqual(editor.get("slides.3"), { id: "single", title: "Single", quote: { text: "Add a quotation", attribution: "Source" } });
  // A caller-supplied id or extensions never overwrite the slide's own when the payload is implicit.
  switchDimension(editor, "blocks", { id: "other", extensions: { x: 1 }, table: { columns: ["A"], rows: [["1"]] } }, { path: "slides.3" });
  assert.equal(editor.get("slides.3.id"), "single");
  assert.equal(editor.get("slides.3.extensions"), undefined);
  assert.deepEqual(editor.get("slides.3.table"), { columns: ["A"], rows: [["1"]] });
  // An explicit block keeps its own id unless the new block names one.
  switchDimension(editor, "blocks", { id: "renamed", text: "x" }, { path: "slides.2.blocks.0" });
  assert.equal(editor.get("slides.2.blocks.0.id"), "renamed");
  // Media kinds need a source; ambiguous or partial targets are rejected.
  assert.throws(() => switchDimension(editor, "blocks", "image", { path: "slides.2.blocks.0" }), /media file/);
  switchDimension(editor, "blocks", "image", { path: "slides.2.blocks.0", source: "asset:cover" });
  assert.equal(editor.get("slides.2.blocks.0.image"), "asset:cover");
  assert.throws(() => prepareBlockReplace(document, "slides.2", { text: "x" }), /one content field|complete block/);
  assert.throws(() => prepareBlockReplace(document, "slides.2.blocks.0.text", { text: "x" }), /complete block/);
  assert.throws(() => switchDimension(editor, "blocks", "text", {}), (error) => error.code === "missing-path");
  // The guard rejects a stale prepared patch and leaves state and history untouched.
  const fresh = session(document);
  const prepared = prepareDimensionSwitch(fresh.document, "blocks", "table", { path: "slides.2.blocks.1" });
  fresh.set("slides.2.blocks.1.items.0", "Changed since preview");
  const depth = fresh.snapshot().undoDepth;
  assert.throws(() => fresh.applyPatch(prepared.patches), /changed/);
  assert.equal(fresh.snapshot().undoDepth, depth);
  assert.equal(fresh.get("slides.2.blocks.1.items.0"), "Changed since preview");
}

// Rejections leave the document and history unchanged.
{
  const editor = session();
  const before = editor.document;
  const reject = (dimension, value, options, code) => {
    assert.throws(
      () => switchDimension(editor, dimension, value, options),
      (error) => error instanceof OPFEditorError && error.code === code,
      `${dimension} ${JSON.stringify(value)}`,
    );
    assert.deepEqual(editor.document, before);
    assert.equal(editor.canUndo, false);
  };
  reject("not-a-dimension", "x", {}, "unknown-dimension");
  reject("color-schemes", "no-such-scheme", {}, "unknown-catalog-id");
  reject("font-schemes", "", {}, "invalid-catalog-id");
  reject("themes", "no-such-theme", {}, "unknown-catalog-id");
  reject("narratives", "no-such-narrative", {}, "unknown-catalog-id");
  reject("audiences", ["executives", "nobody"], {}, "unknown-catalog-id");
  reject("audiences", [], {}, "invalid-catalog-id");
  reject("languages", "klingon-ish", {}, "unknown-catalog-id");
  reject("tones", "sarcastic", {}, "unknown-catalog-id");
  reject("charts", "no-such-chart", { slideIndex: 1 }, "unknown-catalog-id");
  reject("layouts", "text-2x", {}, "slide-index-out-of-range");
  reject("layouts", "text-2x", { slideIndex: 9 }, "slide-index-out-of-range");
  reject("layouts", "no-such-layout", { slideIndex: 0 }, "unknown-catalog-id");
  reject("backgrounds", { type: "nonsense" }, {}, "invalid-opf-edit");
  reject("backgrounds", "solid", {}, "invalid-opf-edit");
  reject("backgrounds", "#12", {}, "invalid-opf-edit");
  reject("backgrounds", 5, {}, "invalid-switch-value");
  reject("backgrounds", ["#ffffff"], {}, "invalid-switch-value");
  reject("charts", "line", { slideIndex: 0, path: "slides.1" }, "path-slide-mismatch");
  reject("charts", "line", { slideIndex: 1, path: "slides.0" }, "path-slide-mismatch");
  reject("charts", "line", { slideIndex: 1, path: "extensions" }, "path-slide-mismatch");
  reject("headers-footers", { header: 5 }, {}, "invalid-opf-edit");
  reject("headers-footers", { sidebar: {} }, {}, "invalid-switch-value");
  reject("image-treatments", { imageFill: "stretch" }, {}, "invalid-opf-edit");
  reject("socials", { platform: "no-such-platform", handle: "x" }, {}, "unknown-catalog-id");
  reject("socials", { platform: "x", handle: "" }, {}, "invalid-switch-value");
  reject("blocks", "diagram", { path: "slides.2.blocks.0" }, "invalid-switch-value");
  reject("font-schemes", "georgia", { slideIndex: 9 }, "slide-index-out-of-range");
}

console.log(`Dimension switches passed: ${summary.length} dimensions (patch, one undo step, undo/redo, preview refresh; slide image preview ${slideImageSupported ? "checked" : "skipped: installed renderer lacks design.slideImage"}; language preview ${languagePreview}).`);
