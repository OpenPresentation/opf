// RR-06: design-level options without opening All properties. Every option is one validated
// patch, one undo step, the right scope (deck or slide), and the preview and the PPTX export
// follow the document.
import assert from "node:assert/strict";
import { schemas, validatePresentation } from "@openpresentation/opf";
import { renderSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { createEditorSession, resolveSlideFonts } from "../dist/index.js";
import { switchDimension } from "../dist/switches.js";
import {
  DESIGN_OPTIONS,
  HEADER_FOOTER_ZONES,
  LOGO_VARIANTS,
  designWarnings,
  getDesignOption,
  headerFooterState,
  prepareDesignOption,
  readHeaderFooterZone,
  readLogoVariants,
  setDesignOption,
  setHeaderFooterZone,
  setLogoVariant,
} from "../dist/design-options.js";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0cAAAAASUVORK5CYII=";
const deck = () => ({
  name: "Design options fixture",
  design: { theme: "minimal", fontScheme: "aptos", colorScheme: "cool-horizon" },
  organization: { id: "acme", name: "Acme" },
  assets: { logo: PIXEL, mark: PIXEL, photo: PIXEL },
  slides: [
    { id: "cover", layout: "title-subtitle", title: "Quarterly review", subtitle: "Design options" },
    { id: "list", title: "List", items: ["First point", "Second point", "Third point"] },
    { id: "data", title: "Data", blocks: [{ chart: { type: "column", data: { columns: ["Q", "V"], rows: [["Q1", 12], ["Q2", 18]] } } }, { text: "Supporting text" }] },
  ],
});
const session = (document = deck()) => createEditorSession(document, { rejectInvalid: true });
const svg = (document, slideIndex = 0) => renderSvg(document, { slideIndex });

// The descriptor list is the documented set, and every enum matches the installed schema.
{
  assert.deepEqual(
    DESIGN_OPTIONS.map((option) => option.id),
    ["titleAlignment", "contentAlignment", "contentDirection", "chartPrimary", "listBullet", "contentBox", "accentFont", "logo", "organizationLogo", "watermark", "slideImage"],
  );
  const design = schemas.presentation.$defs.Design.properties;
  for (const option of DESIGN_OPTIONS.filter((entry) => entry.type === "enum")) assert.deepEqual([...option.values], design[option.id].enum, `${option.id} values follow the schema`);
  assert.deepEqual([...LOGO_VARIANTS], Object.keys(schemas.presentation.$defs.LogoSet.properties), "logo variants follow the schema");
  assert.deepEqual([...HEADER_FOOTER_ZONES], ["left", "center", "right"]);
}

// Each option: patch, scope, one undo step, preview, and export.
const cases = [
  { option: "titleAlignment", value: "right", slide: 0, patch: { op: "add", path: "/design/titleAlignment", value: "right" }, preview: true },
  { option: "contentAlignment", value: "center", slide: 1, patch: { op: "add", path: "/design/contentAlignment", value: "center" } },
  { option: "contentDirection", value: "vertical", slide: 2, patch: { op: "add", path: "/design/contentDirection", value: "vertical" } },
  { option: "chartPrimary", value: "left", slide: 2, patch: { op: "add", path: "/design/chartPrimary", value: "left" } },
  { option: "contentBox", value: true, slide: 1, patch: { op: "add", path: "/design/contentBox", value: true }, preview: true },
  { option: "accentFont", value: "Georgia", slide: 0, patch: { op: "replace", path: "/design/fontScheme", value: { id: "aptos", accent: { family: "Georgia" } } } },
  { option: "logo", value: "asset:logo", slide: 0, patch: { op: "add", path: "/design/logo", value: "asset:logo" } },
  { option: "organizationLogo", value: "asset:logo", slide: 0, patch: { op: "add", path: "/organization/logo", value: "asset:logo" } },
  { option: "watermark", value: { src: "asset:mark", opacity: 0.1 }, slide: 1, patch: { op: "add", path: "/design/watermark", value: { src: "asset:mark", opacity: 0.1 } }, preview: true },
  { option: "slideImage", value: { src: "asset:photo", position: "right" }, slide: 0, patch: { op: "add", path: "/design/slideImage", value: { src: "asset:photo", position: "right" } } },
  // listBullet "image" needs a logo to draw; the fixture sets one first.
  { option: "listBullet", value: "image", slide: 1, setup: (editor) => setDesignOption(editor, "logo", "asset:logo"), patch: { op: "add", path: "/design/listBullet", value: "image" }, preview: true },
];
const slideImageDrawn = (() => {
  const document = deck();
  const plain = svg(document);
  document.slides[0].design = { slideImage: { src: "asset:photo", position: "right" } };
  return svg(document) !== plain;
})();
for (const entry of cases) {
  const editor = session();
  entry.setup?.(editor);
  const baseline = editor.snapshot().undoDepth;
  const original = editor.document;
  const before = svg(original, entry.slide);
  const events = [];
  editor.subscribe((event) => events.push(event));

  const change = setDesignOption(editor, entry.option, entry.value);
  assert.equal(change.changed, true, entry.option);
  assert.deepEqual(change.patches, [entry.patch], `${entry.option} patch`);
  assert.equal(change.scope, "deck");
  assert.equal(editor.validation.valid, true, `${entry.option} valid`);
  assert.equal(validatePresentation(editor.document).valid, true);
  assert.equal(editor.snapshot().undoDepth, baseline + 1, `${entry.option} is one undo step`);
  assert.equal(events.length, 1);
  assert.equal(events[0].meta.source, "design-option");
  assert.equal(events[0].meta.option, entry.option);
  // prepareDesignOption is the same patch without a session and does not touch its input.
  const prepared = prepareDesignOption(original, entry.option, entry.value);
  assert.deepEqual(prepared.patches, change.patches);
  assert.deepEqual(prepared.document, editor.document);
  assert.deepEqual(original, entry.setup ? original : deck());
  // Preview and export follow the document.
  const switched = editor.document;
  if (entry.preview) assert.notEqual(svg(switched, entry.slide), before, `${entry.option}: the preview changes`);
  const bytes = await pptx.toPptx(structuredClone(switched), { strictAssets: true });
  assert.ok(bytes.byteLength > 0, `${entry.option}: exports after the change`);
  // Undo and redo.
  assert.deepEqual(editor.undo().document, original, `${entry.option} undo`);
  assert.equal(svg(editor.document, entry.slide), before, `${entry.option}: undo restores the preview`);
  assert.deepEqual(editor.redo().document, switched, `${entry.option} redo`);
  // The same value again commits nothing.
  const repeat = setDesignOption(editor, entry.option, entry.value);
  assert.equal(repeat.changed, false, `${entry.option} repeat`);
  assert.equal(editor.snapshot().undoDepth, baseline + 1);
  // getDesignOption reads it back.
  const read = getDesignOption(editor.document, entry.option);
  assert.notEqual(read.value, undefined, `${entry.option} reads back`);
  assert.equal(read.scope, "deck");
}

// A slide image on a slide is drawn where the installed renderer supports design.slideImage.
{
  const editor = session();
  const before = svg(editor.document, 0);
  setDesignOption(editor, "slideImage", { src: "asset:photo", position: "right", size: 0.4 }, { slideIndex: 0 });
  if (slideImageDrawn) assert.notEqual(svg(editor.document, 0), before, "slideImage: the preview changes");
  assert.deepEqual(editor.get("slides.0.design.slideImage"), { src: "asset:photo", position: "right", size: 0.4 });
}

// Slide scope writes the slide, never the deck; null removes it so the deck value shows again.
{
  const editor = session();
  setDesignOption(editor, "titleAlignment", "center");
  const change = setDesignOption(editor, "titleAlignment", "left", { slideIndex: 1 });
  assert.deepEqual(change.patches, [{ op: "add", path: "/slides/1/design", value: { titleAlignment: "left" } }]);
  assert.equal(change.scope, "slide");
  assert.deepEqual(getDesignOption(editor.document, "titleAlignment", { slideIndex: 1 }), { value: "left", scope: "slide", inherited: false });
  assert.deepEqual(getDesignOption(editor.document, "titleAlignment", { slideIndex: 0 }), { value: "center", scope: "deck", inherited: true });
  setDesignOption(editor, "titleAlignment", "right", { slideIndex: 0 });
  assert.notEqual(svg(editor.document, 0), svg(session(deck()).document, 0), "a slide alignment changes that slide");
  assert.equal(svg(editor.document, 2), svg(session(Object.assign(deck(), { design: { ...deck().design, titleAlignment: "center" } })).document, 2));
  editor.undo();
  setDesignOption(editor, "titleAlignment", null, { slideIndex: 1 });
  assert.equal(editor.get("slides.1.design.titleAlignment"), undefined);
  // A deck change reports the slides that hide it, and can clear them in the same transaction.
  setDesignOption(editor, "titleAlignment", "right", { slideIndex: 2 });
  const shadowed = setDesignOption(editor, "titleAlignment", "left");
  assert.deepEqual(shadowed.shadowed, [2]);
  const depth = editor.snapshot().undoDepth;
  const cleared = setDesignOption(editor, "titleAlignment", "right", { clearSlideOverrides: true });
  assert.deepEqual(cleared.patches.map((patch) => patch.op), ["replace", "remove"]);
  assert.deepEqual(cleared.shadowed, []);
  assert.equal(editor.snapshot().undoDepth, depth + 1);
  assert.throws(() => setDesignOption(editor, "organizationLogo", "asset:logo", { slideIndex: 0 }), (error) => error.code === "invalid-scope");
  assert.throws(() => setDesignOption(editor, "titleAlignment", "left", { slideIndex: 9 }), (error) => error.code === "slide-index-out-of-range");
}

// Validation: bad values never reach the document.
{
  const editor = session();
  const bad = [
    ["chartPrimary", "middle", "invalid-design-value"],
    ["contentBox", "yes", "invalid-design-value"],
    ["accentFont", "  ", "invalid-design-value"],
    ["watermark", { src: "asset:mark", opacity: 2 }, "invalid-design-value"],
    ["watermark", { src: "asset:mark", opacity: -1 }, "invalid-design-value"],
    ["slideImage", { position: "diagonal" }, "invalid-design-value"],
    ["logo", 4, "invalid-design-value"],
    ["nope", "x", "unknown-design-option"],
  ];
  for (const [option, value, code] of bad) assert.throws(() => setDesignOption(editor, option, value), (error) => error.code === code, `${option} ${JSON.stringify(value)}`);
  assert.throws(() => setDesignOption(editor, "titleAlignment"), (error) => error.code === "invalid-design-value");
  assert.equal(editor.snapshot().undoDepth, 0);
  assert.deepEqual(editor.document, deck());
  assert.throws(() => setDesignOption({}, "titleAlignment", "left"), (error) => error.code === "invalid-editor");
  // The organization logo needs an organization.
  const none = createEditorSession({ slides: [{ title: "x", text: "y" }] });
  assert.throws(() => setDesignOption(none, "organizationLogo", "asset:logo"), (error) => error.code === "missing-owner");
}

// Accent font: object-form font scheme overrides, collapsing back to the bare id.
{
  // The accent font reaches the resolved fonts and the export names it (FF-08 typeface check when the installed opf-pptx has it).
  {
    // The accent font draws the cover tag.
    const editor = session({ ...deck(), slides: [{ id: "cover", title: "Quarterly review", tag: "New", subtitle: "Design options" }] });
    setDesignOption(editor, "accentFont", "Georgia");
    const fonts = resolveSlideFonts(editor.document, 0);
    assert.equal(fonts.accent, "Georgia");
    const bytes = await pptx.toPptx(structuredClone(editor.document), { strictAssets: true });
    if (typeof pptx.checkPptxTypefaces === "function") {
      const result = pptx.checkPptxTypefaces(bytes, { fonts: Object.values(fonts), monospace: [fonts.code] });
      assert.deepEqual(result.violations, [], "the export names only the chosen fonts");
      assert.ok(result.fontsUsed.includes("Georgia"), "the export uses the accent font");
    } else assert.notEqual(process.env.OPF_REQUIRE_FF08, "1", "OPF_REQUIRE_FF08=1 but opf-pptx has no checkPptxTypefaces");
  }
  const editor = session();
  setDesignOption(editor, "accentFont", "Georgia");
  assert.deepEqual(editor.get("design.fontScheme"), { id: "aptos", accent: { family: "Georgia" } });
  assert.deepEqual(getDesignOption(editor.document, "accentFont"), { value: "Georgia", scope: "deck", inherited: false });
  setDesignOption(editor, "accentFont", "Lora");
  assert.equal(editor.get("design.fontScheme.accent.family"), "Lora");
  setDesignOption(editor, "accentFont", null);
  assert.equal(editor.get("design.fontScheme"), "aptos", "a lone id collapses to the string form");
  // A slide inherits the deck's scheme and adds its own accent.
  const slide = setDesignOption(editor, "accentFont", "Georgia", { slideIndex: 1 });
  assert.deepEqual(slide.patches, [{ op: "add", path: "/slides/1/design", value: { fontScheme: { id: "aptos", accent: { family: "Georgia" } } } }]);
  assert.deepEqual(getDesignOption(editor.document, "accentFont", { slideIndex: 1 }), { value: "Georgia", scope: "slide", inherited: false });
}

// Watermark and slide image merge into the existing object; null fields remove; false suppresses.
{
  const editor = session();
  setDesignOption(editor, "watermark", "asset:mark");
  assert.equal(editor.get("design.watermark"), "asset:mark", "a source alone stays a bare source");
  setDesignOption(editor, "watermark", { opacity: 0.25 });
  assert.deepEqual(editor.get("design.watermark"), { src: "asset:mark", opacity: 0.25 });
  setDesignOption(editor, "watermark", { src: "asset:logo" });
  assert.deepEqual(editor.get("design.watermark"), { src: "asset:logo", opacity: 0.25 });
  setDesignOption(editor, "watermark", false, { slideIndex: 1 });
  assert.equal(editor.get("slides.1.design.watermark"), false, "a slide can suppress the inherited watermark");
  setDesignOption(editor, "watermark", null);
  assert.equal(editor.get("design.watermark"), undefined);
  setDesignOption(editor, "slideImage", { src: "asset:photo" });
  assert.deepEqual(editor.get("design.slideImage"), { src: "asset:photo", position: "background" }, "position is required, so it defaults to background");
  setDesignOption(editor, "slideImage", { position: "left", size: 0.4, shape: "circle", inset: true });
  assert.deepEqual(editor.get("design.slideImage"), { src: "asset:photo", position: "left", size: 0.4, shape: "circle", inset: true });
  setDesignOption(editor, "slideImage", { size: null, shape: null });
  assert.deepEqual(editor.get("design.slideImage"), { src: "asset:photo", position: "left", inset: true });
  setDesignOption(editor, "slideImage", null);
  assert.equal(editor.get("design.slideImage"), undefined);
}

// Logo variants: a lone default is a bare source; more variants make a LogoSet; clearing collapses.
{
  const editor = session();
  setLogoVariant(editor, "default", "asset:logo");
  assert.equal(editor.get("design.logo"), "asset:logo");
  setLogoVariant(editor, "light", "asset:mark");
  assert.deepEqual(editor.get("design.logo"), { default: "asset:logo", light: "asset:mark" });
  assert.deepEqual(readLogoVariants(editor.document), { default: "asset:logo", light: "asset:mark" });
  setLogoVariant(editor, "icon", "asset:photo", { slideIndex: 0 });
  assert.deepEqual(readLogoVariants(editor.document, { slideIndex: 0 }), { icon: "asset:photo" }, "a slide logo starts from the slide's own value");
  setLogoVariant(editor, "light", null);
  assert.equal(editor.get("design.logo"), "asset:logo");
  setLogoVariant(editor, "default", null);
  assert.equal(editor.get("design.logo"), undefined);
  assert.throws(() => setLogoVariant(editor, "huge", "asset:logo"), (error) => error.code === "invalid-design-value");
  assert.throws(() => setLogoVariant(editor, "default", "  "), (error) => error.code === "invalid-design-value");
  // Variant switching resolves by background: a light variant is chosen for a dark background.
  setLogoVariant(editor, "default", "asset:logo");
  setLogoVariant(editor, "light", "asset:mark");
  const bytes = await pptx.toPptx(structuredClone(editor.document), { strictAssets: true });
  assert.ok(bytes.byteLength > 0);
}

// Header and footer zones: merge fields, drop empties, keep suppression, warn when a logo is missing.
{
  const editor = session();
  const text = setHeaderFooterZone(editor, "footer", "center", { text: "Confidential" });
  assert.deepEqual(text.patches, [{ op: "add", path: "/design/footer", value: { center: { text: "Confidential" } } }]);
  assert.ok(svg(editor.document, 1).includes("Confidential"), "the footer draws");
  setHeaderFooterZone(editor, "footer", "right", { slideNumber: true });
  assert.deepEqual(editor.get("design.footer"), { center: { text: "Confidential" }, right: { slideNumber: true } });
  const logo = setHeaderFooterZone(editor, "header", "left", { logo: true });
  assert.deepEqual(logo.warnings.map((warning) => warning.code), ["unresolved-logo"], "logo: true with no logo is reported");
  assert.equal(logo.warnings[0].path, "design.header.left.logo");
  assert.deepEqual(designWarnings(editor.document, 0).length, 1);
  setDesignOption(editor, "organizationLogo", "asset:logo");
  assert.deepEqual(designWarnings(editor.document, 0), [], "an organization logo resolves it");
  assert.deepEqual(readHeaderFooterZone(editor.document, "header", "left"), { logo: true });
  // Removing the last field removes the zone, then the header.
  setHeaderFooterZone(editor, "header", "left", { logo: false });
  assert.equal(editor.get("design.header"), undefined);
  // false, null and "" all remove; unknown fields are refused.
  setHeaderFooterZone(editor, "footer", "right", { slideNumber: null });
  assert.equal(editor.get("design.footer.right"), undefined);
  assert.throws(() => setHeaderFooterZone(editor, "footer", "right", { sparkle: true }), (error) => error.code === "invalid-design-value");
  assert.throws(() => setHeaderFooterZone(editor, "middle", "right", { text: "x" }), (error) => error.code === "invalid-design-value");
  assert.throws(() => setHeaderFooterZone(editor, "footer", "top", { text: "x" }), (error) => error.code === "invalid-design-value");
  // A slide scope writes the slide; a suppressed footer is replaced when a zone is set.
  setDesignOption(editor, "titleAlignment", "left");
  editor.set("slides.1.design", { footer: false });
  setHeaderFooterZone(editor, "footer", "left", { text: "Only here" }, { slideIndex: 1 });
  assert.deepEqual(editor.get("slides.1.design.footer"), { left: { text: "Only here" } });
  const export_ = await pptx.toPptx(structuredClone(editor.document), { strictAssets: true });
  assert.ok(export_.byteLength > 0);
  // Picture bullets without a logo are reported too.
  const bare = session();
  assert.deepEqual(setDesignOption(bare, "listBullet", "image").warnings.map((warning) => warning.path), ["design.listBullet"]);
}

// A slide's own header replaces the deck's whole one: the first slide edit copies the deck's zones, so nothing else disappears.
{
  const editor = session();
  setHeaderFooterZone(editor, "footer", "left", { text: "Acme" });
  setHeaderFooterZone(editor, "footer", "right", { slideNumber: true });
  assert.deepEqual(headerFooterState(editor.document, "footer", { slideIndex: 1 }), { own: false, inherited: true, hidden: false });
  assert.deepEqual(readHeaderFooterZone(editor.document, "footer", "left", { slideIndex: 1 }), { text: "Acme" }, "a slide reads the deck's zone it inherits");
  const edit = setHeaderFooterZone(editor, "footer", "center", { text: "Draft" }, { slideIndex: 1 });
  assert.deepEqual(edit.patches, [{ op: "add", path: "/slides/1/design", value: { footer: { left: { text: "Acme" }, right: { slideNumber: true }, center: { text: "Draft" } } } }]);
  assert.deepEqual(headerFooterState(editor.document, "footer", { slideIndex: 1 }), { own: true, inherited: false, hidden: false });
  assert.equal(editor.get("design.footer.center"), undefined, "the deck is untouched");
  // Clearing a zone the slide only inherited overrides it for this slide, and the other zones stay.
  setHeaderFooterZone(editor, "footer", "left", { text: null }, { slideIndex: 2 });
  assert.deepEqual(editor.get("slides.2.design.footer"), { right: { slideNumber: true } });
  // A slide emptied entirely hides the furniture instead of inheriting it again.
  setHeaderFooterZone(editor, "footer", "left", { text: null }, { slideIndex: 0 });
  setHeaderFooterZone(editor, "footer", "right", { slideNumber: null }, { slideIndex: 0 });
  assert.equal(editor.get("slides.0.design.footer"), false);
  assert.deepEqual(headerFooterState(editor.document, "footer", { slideIndex: 0 }), { own: true, inherited: false, hidden: true });
  // The deck without any header or footer stays simple: no copy, no false.
  const bare = session();
  setHeaderFooterZone(bare, "header", "left", { text: "Only" }, { slideIndex: 0 });
  assert.deepEqual(bare.get("slides.0.design.header"), { left: { text: "Only" } });
  setHeaderFooterZone(bare, "header", "left", { text: null }, { slideIndex: 0 });
  assert.equal(bare.get("slides.0.design.header"), undefined);
}

// A watermark opacity needs a watermark image first; the font scheme keeps an accent font when it changes.
{
  const editor = session();
  assert.throws(() => setDesignOption(editor, "watermark", { opacity: 0.2 }), (error) => error.code === "invalid-design-value" && /image before setting its opacity/.test(error.message));
  assert.equal(editor.snapshot().undoDepth, 0);
  setDesignOption(editor, "accentFont", "Georgia");
  const switched = switchDimension(editor, "font-schemes", "georgia");
  assert.deepEqual(editor.get("design.fontScheme"), { id: "georgia", accent: { family: "Georgia" } }, "the accent font survives a font scheme switch");
  assert.equal(switched.changed, true);
  setDesignOption(editor, "accentFont", null);
  assert.equal(editor.get("design.fontScheme"), "georgia");
  // A slide switch keeps the slide's own accent too.
  setDesignOption(editor, "accentFont", "Lora", { slideIndex: 1 });
  switchDimension(editor, "font-schemes", "tahoma", { slideIndex: 1 });
  assert.deepEqual(editor.get("slides.1.design.fontScheme"), { id: "tahoma", accent: { family: "Lora" } });
}

// Undo and redo through a sequence keep every step separate.
{
  const editor = session();
  setDesignOption(editor, "titleAlignment", "center");
  setDesignOption(editor, "contentBox", true);
  setHeaderFooterZone(editor, "footer", "center", { text: "Draft" });
  assert.equal(editor.snapshot().undoDepth, 3);
  editor.undo();
  assert.equal(editor.get("design.footer"), undefined);
  assert.equal(editor.get("design.contentBox"), true);
  editor.undo();
  editor.undo();
  assert.deepEqual(editor.document, deck());
  editor.redo();
  editor.redo();
  editor.redo();
  assert.equal(editor.get("design.footer.center.text"), "Draft");
}

console.log(`Design options: ${cases.length} options with patch, scope, undo/redo, preview and export; slide scope, shadowing, validation, accent font, watermark and slide image merging, logo variants, header/footer zones and logo warnings.`);
