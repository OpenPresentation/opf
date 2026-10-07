// FF-16 (font-fidelity-everywhere): editor switches for every pptx.gallery dimension.
// Each dimension produces the expected patch, one undoable transaction, and a preview that
// recomposes to the new fonts and content. Exports after a switch: switches-export.mjs.
import assert from "node:assert/strict";
import { resolveSlideContext, validate } from "@openpresentation/opf";
import { renderSlideSvg } from "@openpresentation/opf-render/svg";
import { OPFEditorError, createEditorSession } from "../dist/index.js";
const fontFamiliesOf = (presentation, index) => resolveSlideContext(presentation, index).options.fontFamilies;
import { prepareBlockReplace } from "../dist/layout.js";
import { currentSwitchValue, prepareDimensionSwitch, switchDimension, SWITCH_DIMENSIONS } from "../dist/switches.js";
import { EXTRA_DIMENSIONS, GALLERY_DIMENSIONS, SLIDE_SIZES, baseDeck, cases } from "./switch-fixture.mjs";

// Coverage: every gallery dimension, then slide-sizes and purposes (RR-41), has a switch and a case, and nothing else does.
const ALL_DIMENSIONS = [...GALLERY_DIMENSIONS, ...EXTRA_DIMENSIONS];
assert.deepEqual([...SWITCH_DIMENSIONS], ALL_DIMENSIONS);
assert.deepEqual(cases.map((entry) => entry.dimension), ALL_DIMENSIONS);

const session = (presentation = baseDeck()) => createEditorSession(presentation, { rejectInvalid: true });
const svg = (presentation, slideIndex) => renderSlideSvg(presentation, slideIndex);
function measuredFamilies(presentation, slideIndex) {
  const families = new Set();
  createEditorSession(presentation).composeSlide(slideIndex, {
    fonts: { textMeasurement: { measure: (text, size, style) => (families.add(style.fontFamily), text.length * size * 0.5) } },
  });
  return [...families].sort();
}
const summary = [];
let languagePreview = "unchanged by these switches";
for (const entry of cases) {
  const { dimension, value, options, slide } = entry;
  const editor = session();
  const original = editor.presentation;
  const beforeSvg = svg(original, slide);
  const events = [];
  editor.subscribe((event) => events.push(event));

  const change = switchDimension(editor, dimension, value, options);

  // Expected patch, one transaction, valid document.
  assert.equal(change.changed, true, dimension);
  assert.equal(change.dimension, dimension);
  if (entry.patches) assert.deepEqual(change.patches, entry.patches, `${dimension} patch`);
  if (entry.patchPaths) assert.deepEqual(change.patches.map((patch) => patch.path), entry.patchPaths, `${dimension} patch paths`);
  entry.check?.(change.presentation);
  assert.equal(editor.validation.valid, true, `${dimension} valid`);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  assert.equal(editor.snapshot().undoDepth, 1, `${dimension} is one undo step`);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "patch");
  assert.equal(events[0].meta.source, "dimension-switch");
  assert.equal(events[0].meta.dimension, dimension);
  assert.deepEqual(events[0].snapshot.presentation, editor.presentation, "the event carries the switched document");
  // prepareDimensionSwitch is the same patch without a session, and does not mutate its input.
  const prepared = prepareDimensionSwitch(original, dimension, value, options);
  assert.deepEqual(prepared.patches, change.patches);
  assert.deepEqual(prepared.presentation, editor.presentation);
  assert.deepEqual(original, baseDeck());

  // Preview refresh: the shared composition and SVG render follow the switched document.
  const switched = editor.presentation;
  const afterSvg = svg(switched, slide);
  if (entry.preview === "svg") assert.notEqual(afterSvg, beforeSvg, `${dimension}: preview changes`);
  else if (entry.preview === "metadata") assert.equal(afterSvg, beforeSvg, `${dimension}: authoring metadata leaves the preview as is`);
  else if (entry.preview === "language") {
    if (afterSvg !== beforeSvg) {
      languagePreview = "checked";
      assert.match(afterSvg, /xml:lang="ja"/, "the preview marks the new language");
    }
  } else assert.notEqual(afterSvg, beforeSvg, `${dimension}: preview changes`);
  if (entry.fonts) {
    assert.deepEqual(fontFamiliesOf(switched, slide), { ...fontFamiliesOf(original, slide), ...entry.fonts }, `${dimension}: resolved fonts`);
    assert.deepEqual(measuredFamilies(switched, slide), [...new Set(Object.values(entry.fonts))].sort(), `${dimension}: composition measures the new fonts`);
    assert.ok(afterSvg.includes(entry.fonts.body), `${dimension}: SVG names ${entry.fonts.body}`);
    assert.ok(!beforeSvg.includes(entry.fonts.body));
  }

  // Undo and redo restore exact documents and previews.
  assert.deepEqual(editor.undo().presentation, original, `${dimension} undo`);
  assert.equal(editor.canUndo, false);
  assert.equal(svg(editor.presentation, slide), beforeSvg, `${dimension}: undo restores the preview`);
  assert.deepEqual(editor.redo().presentation, switched, `${dimension} redo`);
  assert.equal(svg(editor.presentation, slide), afterSvg, `${dimension}: redo restores the preview`);
  assert.deepEqual(events.map((event) => event.type), ["patch", "undo", "redo"]);
  assert.deepEqual(events[1].snapshot.presentation, original);
  assert.deepEqual(events[2].snapshot.presentation, switched);

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
assert.deepEqual(summary, ALL_DIMENSIONS);

// Design dimensions: a slide scope patches the slide, and a deck scope reports shadowing.
{
  const editor = session();
  const change = switchDimension(editor, "font-schemes", "georgia", { slideIndex: 1 });
  assert.deepEqual(change.patches, [{ op: "add", path: "/slides/1/design", value: { fontScheme: "georgia" } }]);
  assert.equal(change.scope, "slide");
  assert.deepEqual(measuredFamilies(editor.presentation, 1), ["Georgia"]);
  assert.deepEqual(measuredFamilies(editor.presentation, 0), ["Aptos", "Aptos Display"]);
  // A deck switch cannot reach a slide with its own font scheme: it says so instead of hiding it.
  const deck = switchDimension(editor, "font-schemes", "roboto");
  assert.deepEqual(deck.patches, [{ op: "replace", path: "/design/fontScheme", value: "roboto" }]);
  assert.deepEqual(deck.shadowed, [1]);
  assert.deepEqual(measuredFamilies(editor.presentation, 1), ["Georgia"]);
  // Clearing the overrides is opt-in and joins the same transaction.
  const depth = editor.snapshot().undoDepth;
  const cleared = switchDimension(editor, "font-schemes", "tahoma", { clearSlideOverrides: true });
  assert.deepEqual(cleared.patches, [
    { op: "replace", path: "/design/fontScheme", value: "tahoma" },
    { op: "remove", path: "/slides/1/design/fontScheme" },
  ]);
  assert.deepEqual(cleared.shadowed, []);
  assert.deepEqual(measuredFamilies(editor.presentation, 1), ["Tahoma"]);
  assert.equal(editor.snapshot().undoDepth, depth + 1);
  editor.undo();
  assert.deepEqual(measuredFamilies(editor.presentation, 1), ["Georgia"]);
  // An inline object value is replaced by the bare id: its overrides belong to the old scheme.
  const custom = session({ ...baseDeck(), design: { fontScheme: { id: "aptos", major: "Override Display", minor: "Override Text" } } });
  assert.deepEqual(measuredFamilies(custom.presentation, 0), ["Override Display", "Override Text"]);
  switchDimension(custom, "font-schemes", "georgia");
  assert.equal(custom.get("design.fontScheme"), "georgia");
  assert.deepEqual(measuredFamilies(custom.presentation, 0), ["Georgia"]);
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
  assert.deepEqual(measuredFamilies(editor.presentation, 0), ["Aptos", "Aptos Display"]);
  editor.undo();
  switchDimension(editor, "themes", "classic");
  assert.deepEqual(measuredFamilies(editor.presentation, 0), ["Tenorite", "Tenorite Display"]);
}

// Gallery records: an item's own record is added inline in the same undoable transaction.
{
  const editor = session();
  const record = { id: "team-mono", name: "Team Mono", major: "Inter", minor: "Inter", code: "JetBrains Mono" };
  assert.throws(() => switchDimension(editor, "font-schemes", "team-mono"), (error) => error.code === "unknown-catalog-id");
  const change = switchDimension(editor, "font-schemes", "team-mono", { record });
  assert.deepEqual(change.patches.map((patch) => [patch.op, patch.path]), [["add", "/catalogs"], ["replace", "/design/fontScheme"]]);
  assert.equal(editor.get("catalogs.fontSchemes.records.0.id"), "team-mono");
  assert.deepEqual(fontFamiliesOf(editor.presentation, 0), { heading: "Inter", body: "Inter", code: "JetBrains Mono" });
  assert.deepEqual(measuredFamilies(editor.presentation, 0), ["Inter"]);
  // With another inline catalog present, bundled ids stay available and records append.
  switchDimension(editor, "font-schemes", "georgia");
  const second = switchDimension(editor, "font-schemes", "team-serif", { record: { id: "team-serif", name: "Team Serif", major: "Lora", minor: "Lora" } });
  assert.deepEqual(second.patches.map((patch) => patch.path), ["/catalogs/fontSchemes/records/-", "/design/fontScheme"]);
  assert.deepEqual(measuredFamilies(editor.presentation, 0), ["Lora"]);
  assert.throws(() => switchDimension(editor, "font-schemes", "other", { record }), (error) => error.code === "record-id-mismatch");
  while (editor.canUndo) editor.undo();
  assert.deepEqual(editor.presentation, baseDeck());
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
  const presentation = baseDeck();
  presentation.slides[1] = { id: "chart", title: "Revenue", blocks: [{ text: "Note" }, { chart: presentation.slides[1].chart }] };
  const editor = session(presentation);
  const change = switchDimension(editor, "charts", "area", { slideIndex: 1 });
  assert.deepEqual(change.patches, [{ op: "replace", path: "/slides/1/blocks/1/chart/type", value: "area" }]);
  assert.deepEqual(editor.get("slides.1.blocks.1.chart.data"), presentation.slides[1].blocks[1].chart.data);
  assert.throws(() => switchDimension(editor, "charts", "area", { slideIndex: 0 }), (error) => error.code === "chart-not-found");
}

// FA-07: the root audience may be one inline Audience object; the document stays valid and a switch replaces it with catalog ids.
{
  const document = baseDeck();
  document.audience = { id: "executive", attentionBudgetMinutes: 20 };
  assert.equal(validate(document, { only: ["format"] }).valid, true);
  assert.deepEqual(currentSwitchValue(document, "audiences"), { value: { id: "executive", attentionBudgetMinutes: 20 }, scope: "deck" });
  const editor = session(document);
  const change = switchDimension(editor, "audiences", ["investor"]);
  assert.deepEqual(change.patches, [{ op: "replace", path: "/audience", value: ["investor"] }]);
  assert.deepEqual(editor.get("audience"), ["investor"]);
}

// Backgrounds accept the schema's shorthand strings as well as objects.
{
  const editor = session();
  for (const shorthand of ["dark1", "light2", "#ffff00"]) {
    const change = switchDimension(editor, "backgrounds", shorthand);
    assert.deepEqual(change.patches, [{ op: change.patches[0].op, path: "/design/background", value: shorthand }]);
    assert.equal(editor.get("design.background"), shorthand);
    assert.equal(editor.validation.valid, true);
    assert.notEqual(svg(editor.presentation, 0), svg(baseDeck(), 0));
  }
  const scoped = switchDimension(editor, "backgrounds", "#00ff00", { slideIndex: 1 });
  assert.deepEqual(scoped.patches, [{ op: "add", path: "/slides/1/design", value: { background: "#00ff00" } }]);
  editor.undo();
  editor.undo();
  assert.equal(editor.get("design.background"), "light2");
}

// Socials: the organization, arrays of speakers and replacing a handle.
{
  const presentation = baseDeck();
  presentation.speaker = [{ id: "alice", name: "Alice" }, { id: "bo", name: "Bo", socials: { x: "@bo" } }];
  const editor = session(presentation);
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
  const presentation = baseDeck();
  presentation.slides[2].blocks[0] = { id: "intro", text: [{ text: "Rich ", bold: true }, { text: "text" }], extensions: { review: "kept" } };
  presentation.slides[3] = { id: "single", title: "Single", text: "Only text" };
  const editor = session(presentation);
  const change = switchDimension(editor, "blocks", "list", { path: "slides.2.blocks.0" });
  assert.deepEqual(editor.get("slides.2.blocks.0"), { id: "intro", extensions: { review: "kept" }, items: ["First point", "Second point"] });
  assert.equal(JSON.stringify(editor.presentation).includes("Rich"), false, "the old text is discarded, not converted into list items");
  assert.deepEqual(change.patches[0], { op: "test", path: "/slides/2/blocks/0", value: presentation.slides[2].blocks[0] });
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
  assert.throws(() => prepareBlockReplace(presentation, "slides.2", { text: "x" }), /one content field|complete block/);
  assert.throws(() => prepareBlockReplace(presentation, "slides.2.blocks.0.text", { text: "x" }), /complete block/);
  assert.throws(() => switchDimension(editor, "blocks", "text", {}), (error) => error.code === "missing-path");
  // The guard rejects a stale prepared patch and leaves state and history untouched.
  const fresh = session(presentation);
  const prepared = prepareDimensionSwitch(fresh.presentation, "blocks", "table", { path: "slides.2.blocks.1" });
  fresh.set("slides.2.blocks.1.items.0", "Changed since preview");
  const depth = fresh.snapshot().undoDepth;
  assert.throws(() => fresh.applyPatch(prepared.patches), /changed/);
  assert.equal(fresh.snapshot().undoDepth, depth);
  assert.equal(fresh.get("slides.2.blocks.1.items.0"), "Changed since preview");
}

// Slide sizes (RR-41): each of the ten presets is one patch and one undo step, the shared composition
// and the SVG preview recompose at the new canvas, and undo restores the exact size.
{
  const canvas = (presentation) => {
    const composed = createEditorSession(presentation).composeSlide(0);
    return { width: composed.width, height: composed.height };
  };
  const viewBox = (presentation) => svg(presentation, 0).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
  assert.deepEqual(canvas(baseDeck()), { width: 1280, height: 720 }, "the fixture starts at widescreen");
  for (const [preset, size] of Object.entries(SLIDE_SIZES)) {
    const editor = session();
    const original = editor.presentation;
    const beforeBoxes = JSON.stringify(editor.composeSlide(0).items);
    const change = switchDimension(editor, "slide-sizes", preset);
    assert.deepEqual(change.patches, [{ op: "add", path: "/design/dimensions", value: preset }], preset);
    assert.equal(change.scope, "deck");
    assert.equal(editor.snapshot().undoDepth, 1, `${preset} is one undo step`);
    assert.deepEqual(canvas(editor.presentation), { width: size.width, height: size.height }, `${preset}: composition canvas`);
    assert.deepEqual(viewBox(editor.presentation), [size.width, size.height], `${preset}: preview viewBox`);
    // The slide's content is laid out again at the new canvas, not just cropped or scaled.
    if (size.width !== 1280) assert.notEqual(JSON.stringify(editor.composeSlide(0).items), beforeBoxes, `${preset}: boxes recomposed`);
    assert.equal(editor.validation.valid, true);
    assert.deepEqual(editor.undo().presentation, original, `${preset} undo`);
    assert.deepEqual(canvas(editor.presentation), { width: 1280, height: 720 });
    assert.deepEqual(viewBox(editor.presentation), [1280, 720]);
    editor.redo();
    assert.deepEqual(viewBox(editor.presentation), [size.width, size.height], `${preset}: redo restores the preview`);
    assert.equal(switchDimension(editor, "slide-sizes", preset).changed, false, `${preset}: repeat switch`);
  }
  // Switching from one size to another replaces the value in place.
  const editor = session();
  switchDimension(editor, "slide-sizes", "4:3");
  assert.deepEqual(switchDimension(editor, "slide-sizes", "letter").patches, [{ op: "replace", path: "/design/dimensions", value: "letter" }]);
  assert.deepEqual(viewBox(editor.presentation), [1056, 816]);
  // The aliases are separate values: the document keeps what was chosen.
  assert.equal(switchDimension(editor, "slide-sizes", "standard").changed, true);
  assert.equal(editor.get("design.dimensions"), "standard");
  // {preset} alone is the same size as the bare string; a custom size is replaced by the preset.
  const object = session({ ...baseDeck(), design: { ...baseDeck().design, dimensions: { preset: "a4" } } });
  assert.equal(switchDimension(object, "slide-sizes", "a4").changed, false);
  const custom = session({ ...baseDeck(), design: { ...baseDeck().design, dimensions: { preset: "a4", widthInches: 12 } } });
  assert.deepEqual(viewBox(custom.presentation), [1152, 793.92]);
  assert.deepEqual(switchDimension(custom, "slide-sizes", "a4").patches, [{ op: "replace", path: "/design/dimensions", value: "a4" }]);
  assert.deepEqual(viewBox(custom.presentation), [1122.24, 793.92]);
  custom.undo();
  assert.deepEqual(custom.get("design.dimensions"), { preset: "a4", widthInches: 12 });
  // A theme's own size is what a document without design.dimensions has; the switch makes the choice explicit.
  const themed = session({ ...baseDeck(), design: { theme: "minimal" } });
  assert.deepEqual(currentSwitchValue(themed.presentation, "slide-sizes"), { value: "widescreen", scope: "deck" });
  // A slide's design cannot set dimensions (FA-07): the deck switch is never shadowed, and a slide scope is refused.
  const deck = session();
  assert.deepEqual(switchDimension(deck, "slide-sizes", "4:3").shadowed, []);
  assert.throws(() => switchDimension(deck, "slide-sizes", "16:10", { slideIndex: 1 }), (error) => error.code === "deck-scope-only");
  // A slide-scope theme switch writes no dimensions into the slide's design (the deck's size stays the one size).
  const slideTheme = switchDimension(session(), "themes", "classic", { slideIndex: 1 });
  assert.equal(slideTheme.patches.some((patch) => /dimensions/.test(patch.path) || (patch.value && typeof patch.value === "object" && "dimensions" in patch.value)), false);
  // A theme switch still carries its own size and is a separate step from a slide-size switch.
  const bundle = session();
  switchDimension(bundle, "slide-sizes", "4:3");
  switchDimension(bundle, "themes", "classic");
  assert.equal(bundle.get("design.dimensions"), "widescreen");
  assert.equal(bundle.snapshot().undoDepth, 2);
  assert.equal(bundle.undo().presentation.design.dimensions, "4:3");
}

// Purposes (RR-41): a catalog id, free-form goal text or a Purpose object, one patch, exact undo.
{
  const editor = session();
  const original = editor.presentation;
  assert.deepEqual(switchDimension(editor, "purposes", "decide").patches, [{ op: "add", path: "/purpose", value: "decide" }]);
  assert.deepEqual(switchDimension(editor, "purposes", "pitch").patches, [{ op: "replace", path: "/purpose", value: "pitch" }]);
  // Any goal text is valid, in or out of the catalog.
  const goal = "Raise a Series B round of $30M";
  switchDimension(editor, "purposes", goal);
  assert.equal(editor.get("purpose"), goal);
  assert.equal(editor.validation.valid, true);
  // An inline Purpose object, and a catalog-backed one.
  switchDimension(editor, "purposes", { id: "decide", outcome: "Approve the Q4 hiring plan" });
  assert.deepEqual(editor.get("purpose"), { id: "decide", outcome: "Approve the Q4 hiring plan" });
  assert.equal(switchDimension(editor, "purposes", { id: "decide", outcome: "Approve the Q4 hiring plan" }).changed, false);
  assert.equal(editor.snapshot().undoDepth, 4);
  while (editor.canUndo) editor.undo();
  assert.deepEqual(editor.presentation, original);
  assert.equal("purpose" in editor.presentation, false);
  // The preview does not change: purpose is authoring metadata.
  switchDimension(editor, "purposes", "sell");
  assert.equal(svg(editor.presentation, 0), svg(original, 0));
  // A gallery item's record is added inline in the same transaction, then the purpose names it.
  const record = { id: "fundraise", name: "Fundraise", summary: "Raise a round.", outcome: "A term sheet." };
  const withRecord = switchDimension(session(), "purposes", "fundraise", { record });
  assert.deepEqual(withRecord.patches.map((patch) => [patch.op, patch.path]), [["add", "/catalogs"], ["add", "/purpose"]]);
  assert.equal(withRecord.presentation.catalogs.purposes.records[0].id, "fundraise");
  assert.throws(() => switchDimension(session(), "purposes", "other", { record }), (error) => error.code === "record-id-mismatch");
}

// Rejections leave the document and history unchanged.
{
  const editor = session();
  const before = editor.presentation;
  const reject = (dimension, value, options, code) => {
    assert.throws(
      () => switchDimension(editor, dimension, value, options),
      (error) => error instanceof OPFEditorError && error.code === code,
      `${dimension} ${JSON.stringify(value)}`,
    );
    assert.deepEqual(editor.presentation, before);
    assert.equal(editor.canUndo, false);
  };
  reject("not-a-dimension", "x", {}, "unknown-dimension");
  reject("color-schemes", "no-such-scheme", {}, "unknown-catalog-id");
  reject("font-schemes", "", {}, "invalid-catalog-id");
  reject("themes", "no-such-theme", {}, "unknown-catalog-id");
  reject("narratives", "no-such-narrative", {}, "unknown-catalog-id");
  reject("audiences", ["executive", "nobody"], {}, "unknown-catalog-id");
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
  reject("slide-sizes", "a5", {}, "invalid-switch-value");
  reject("slide-sizes", "", {}, "invalid-switch-value");
  reject("slide-sizes", { preset: "a4" }, {}, "invalid-switch-value");
  reject("slide-sizes", null, {}, "invalid-switch-value");
  reject("slide-sizes", "4:3", { slideIndex: 0 }, "deck-scope-only");
  reject("slide-sizes", "4:3", { record: { id: "4:3" } }, "record-id-mismatch");
  reject("purposes", "", {}, "invalid-switch-value");
  reject("purposes", 5, {}, "invalid-switch-value");
  reject("purposes", ["decide"], {}, "invalid-switch-value");
  reject("purposes", null, {}, "invalid-switch-value");
  reject("purposes", { outcome: 5 }, {}, "invalid-opf-edit");
}

console.log(`Dimension switches passed: ${summary.length} dimensions (patch, one undo step, undo/redo, preview refresh; slide image preview checked; language preview ${languagePreview}).`);
