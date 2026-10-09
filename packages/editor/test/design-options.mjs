// RR-06: design-level options without opening All properties. Every option is one validated
// patch, one undo step, the right scope (deck or slide), and the preview and the PPTX export
// follow the document.
import assert from "node:assert/strict";
import { schemas, validate } from "@openpresentation/opf";
import { toSvg } from "@openpresentation/opf-render/svg";
import * as pptx from "@openpresentation/opf-pptx";
import { resolveSlideContext } from "@openpresentation/opf";
import { defaultCatalog } from "@openpresentation/opf/catalog";
import { createEditorSession } from "../dist/index.js";
import { switchDimension } from "../dist/switches.js";
import {
  DESIGN_OPTIONS,
  HEADER_FOOTER_ZONES,
  LOGO_VARIANTS,
  ZONE_FIELDS,
  ZONE_VALUES,
  designWarnings,
  getDesignOption,
  headerFooterState,
  insertZoneValue,
  prepareDesignOption,
  prepareZoneValue,
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
const catalogs = [defaultCatalog];
const session = (presentation = deck()) => createEditorSession(presentation, { rejectInvalid: true, catalogs });
const svg = (presentation, slideIndex = 0) => toSvg(presentation, slideIndex + 1, { catalogs });

// The descriptor list is the documented set, and every enum matches the installed schema.
{
  assert.deepEqual(
    DESIGN_OPTIONS.map((option) => option.id),
    ["titleAlignment", "contentAlignment", "contentDirection", "chartPrimary", "listBullet", "contentBox", "imageFit", "accentFont", "logo", "organizationLogo", "watermark"],
  );
  const design = schemas.presentation.$defs.Design.properties;
  for (const option of DESIGN_OPTIONS.filter((entry) => entry.type === "enum")) assert.deepEqual([...option.values], design[option.id].enum, `${option.id} values follow the schema`);
  assert.deepEqual([...LOGO_VARIANTS], Object.keys(schemas.presentation.$defs.LogoSet.properties), "logo variants follow the schema");
  assert.deepEqual([...HEADER_FOOTER_ZONES], ["left", "center", "right"]);
  // FA-31: the zone fields are the schema's (generated values are variables in `text`, not fields).
  assert.deepEqual([...ZONE_FIELDS].sort(), Object.keys(schemas.presentation.$defs.HeaderFooterItem.properties).sort(), "zone fields follow the schema");
  assert.deepEqual(ZONE_VALUES.map((value) => value.token), ["{{slide.number}}", "{{deck.slideCount}}", "{{slide.section}}", "{{organization.name}}", "{{speaker.name}}", "{{deck.name}}"]);
  assert.deepEqual(ZONE_VALUES.map((value) => value.label), ["Slide number", "Slide count", "Section", "Organization", "Speaker", "Deck name"]);
}

// Each option: patch, scope, one undo step, preview, and export.
const cases = [
  { option: "titleAlignment", value: "right", slide: 0, patch: { op: "add", path: "/design/titleAlignment", value: "right" }, preview: true },
  { option: "contentAlignment", value: "center", slide: 1, patch: { op: "add", path: "/design/contentAlignment", value: "center" } },
  { option: "contentDirection", value: "vertical", slide: 2, patch: { op: "add", path: "/design/contentDirection", value: "vertical" } },
  { option: "chartPrimary", value: "left", slide: 2, patch: { op: "add", path: "/design/chartPrimary", value: "left" } },
  { option: "contentBox", value: true, slide: 1, patch: { op: "add", path: "/design/contentBox", value: true }, preview: true },
  { option: "accentFont", value: "Georgia", slide: 0, patch: { op: "replace", path: "/design/fontScheme", value: { id: "aptos", accent: "Georgia" } } },
  { option: "logo", value: "asset:logo", slide: 0, patch: { op: "add", path: "/design/logo", value: "asset:logo" } },
  { option: "organizationLogo", value: "asset:logo", slide: 0, patch: { op: "add", path: "/organization/logo", value: "asset:logo" } },
  { option: "watermark", value: { src: "asset:mark", opacity: 0.1 }, slide: 1, patch: { op: "add", path: "/design/watermark", value: { src: "asset:mark", opacity: 0.1 } }, preview: true },
  { option: "imageFit", value: "contain", slide: 2, patch: { op: "add", path: "/design/imageFit", value: "contain" } },
  // listBullet "image" needs a logo to draw; the fixture sets one first.
  { option: "listBullet", value: "image", slide: 1, setup: (editor) => setDesignOption(editor, "logo", "asset:logo"), patch: { op: "add", path: "/design/listBullet", value: "image" }, preview: true },
];
for (const entry of cases) {
  const editor = session();
  entry.setup?.(editor);
  const baseline = editor.snapshot().undoDepth;
  const original = editor.presentation;
  const before = svg(original, entry.slide);
  const events = [];
  editor.subscribe((event) => events.push(event));

  const change = setDesignOption(editor, entry.option, entry.value);
  assert.equal(change.changed, true, entry.option);
  assert.deepEqual(change.patches, [entry.patch], `${entry.option} patch`);
  assert.equal(change.scope, "deck");
  assert.equal(editor.validation.valid, true, `${entry.option} valid`);
  assert.equal(validate(editor.presentation, { only: ["format"] }).valid, true);
  assert.equal(editor.snapshot().undoDepth, baseline + 1, `${entry.option} is one undo step`);
  assert.equal(events.length, 1);
  assert.equal(events[0].meta.source, "design-option");
  assert.equal(events[0].meta.option, entry.option);
  // prepareDesignOption is the same patch without a session and does not touch its input.
  const prepared = prepareDesignOption(original, entry.option, entry.value);
  assert.deepEqual(prepared.patches, change.patches);
  assert.deepEqual(prepared.presentation, editor.presentation);
  assert.deepEqual(original, entry.setup ? original : deck());
  // Preview and export follow the document.
  const switched = editor.presentation;
  if (entry.preview) assert.notEqual(svg(switched, entry.slide), before, `${entry.option}: the preview changes`);
  const bytes = await pptx.toPptx(structuredClone(switched), { strictAssets: true, catalogs });
  assert.ok(bytes.byteLength > 0, `${entry.option}: exports after the change`);
  // Undo and redo.
  assert.deepEqual(editor.undo().presentation, original, `${entry.option} undo`);
  assert.equal(svg(editor.presentation, entry.slide), before, `${entry.option}: undo restores the preview`);
  assert.deepEqual(editor.redo().presentation, switched, `${entry.option} redo`);
  // The same value again commits nothing.
  const repeat = setDesignOption(editor, entry.option, entry.value);
  assert.equal(repeat.changed, false, `${entry.option} repeat`);
  assert.equal(editor.snapshot().undoDepth, baseline + 1);
  // getDesignOption reads it back.
  const read = getDesignOption(editor.presentation, entry.option);
  assert.notEqual(read.value, undefined, `${entry.option} reads back`);
  assert.equal(read.scope, "deck");
}

// OPF 0.15: the default image fit of a slide is drawn by the renderer; the slide image and image fill are gone.
{
  const presentation = deck();
  presentation.slides[2].blocks[1] = { image: "asset:photo" };
  const editor = session(presentation);
  const before = svg(editor.presentation, 2);
  setDesignOption(editor, "imageFit", "contain", { slideIndex: 2 });
  assert.equal(editor.get("slides.2.design.imageFit"), "contain");
  assert.notEqual(svg(editor.presentation, 2), before, "imageFit: the preview changes");
}

// Slide scope writes the slide, never the deck; null removes it so the deck value shows again.
{
  const editor = session();
  setDesignOption(editor, "titleAlignment", "center");
  const change = setDesignOption(editor, "titleAlignment", "left", { slideIndex: 1 });
  assert.deepEqual(change.patches, [{ op: "add", path: "/slides/1/design", value: { titleAlignment: "left" } }]);
  assert.equal(change.scope, "slide");
  assert.deepEqual(getDesignOption(editor.presentation, "titleAlignment", { slideIndex: 1 }), { value: "left", scope: "slide", inherited: false });
  assert.deepEqual(getDesignOption(editor.presentation, "titleAlignment", { slideIndex: 0 }), { value: "center", scope: "deck", inherited: true });
  setDesignOption(editor, "titleAlignment", "right", { slideIndex: 0 });
  assert.notEqual(svg(editor.presentation, 0), svg(session(deck()).presentation, 0), "a slide alignment changes that slide");
  assert.equal(svg(editor.presentation, 2), svg(session(Object.assign(deck(), { design: { ...deck().design, titleAlignment: "center" } })).presentation, 2));
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
    ["imageFit", "crop", "invalid-design-value"],
    ["slideImage", "asset:photo", "unknown-design-option"],
    ["logo", 4, "invalid-design-value"],
    ["nope", "x", "unknown-design-option"],
  ];
  for (const [option, value, code] of bad) assert.throws(() => setDesignOption(editor, option, value), (error) => error.code === code, `${option} ${JSON.stringify(value)}`);
  assert.throws(() => setDesignOption(editor, "titleAlignment"), (error) => error.code === "invalid-design-value");
  assert.equal(editor.snapshot().undoDepth, 0);
  assert.deepEqual(editor.presentation, deck());
  assert.throws(() => setDesignOption({}, "titleAlignment", "left"), (error) => error.code === "invalid-editor");
  // The organization logo needs an organization.
  const none = createEditorSession({ slides: [{ title: "x", text: "y" }] });
  assert.throws(() => setDesignOption(none, "organizationLogo", "asset:logo"), (error) => error.code === "missing-owner");
}

// Accent font: object-form font scheme overrides, collapsing back to the bare id.
{
  // The accent font reaches the resolved fonts and the export names it (the FF-08 typeface check).
  {
    // The accent font draws the cover tag.
    const editor = session({ ...deck(), slides: [{ id: "cover", title: "Quarterly review", tag: "New", subtitle: "Design options" }] });
    setDesignOption(editor, "accentFont", "Georgia");
    const fonts = resolveSlideContext(editor.presentation, 0, { catalogs }).options.fontFamilies;
    assert.equal(fonts.accent, "Georgia");
    const bytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs });
    const result = pptx.checkTypefaces(bytes, { families: Object.values(fonts), monospace: [fonts.code] });
    assert.deepEqual(result.violations, [], "the export names only the chosen fonts");
    assert.ok(result.fontsUsed.includes("Georgia"), "the export uses the accent font");
  }
  const editor = session();
  setDesignOption(editor, "accentFont", "Georgia");
  assert.deepEqual(editor.get("design.fontScheme"), { id: "aptos", accent: "Georgia" });
  assert.deepEqual(getDesignOption(editor.presentation, "accentFont"), { value: "Georgia", scope: "deck", inherited: false });
  setDesignOption(editor, "accentFont", "Lora");
  assert.equal(editor.get("design.fontScheme.accent"), "Lora");
  setDesignOption(editor, "accentFont", null);
  assert.equal(editor.get("design.fontScheme"), "aptos", "a lone id collapses to the string form");
  // A slide inherits the deck's scheme and adds its own accent.
  const slide = setDesignOption(editor, "accentFont", "Georgia", { slideIndex: 1 });
  assert.deepEqual(slide.patches, [{ op: "add", path: "/slides/1/design", value: { fontScheme: { id: "aptos", accent: "Georgia" } } }]);
  assert.deepEqual(getDesignOption(editor.presentation, "accentFont", { slideIndex: 1 }), { value: "Georgia", scope: "slide", inherited: false });
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
}

// Logo variants: a lone default is a bare source; more variants make a LogoSet; clearing collapses.
{
  const editor = session();
  setLogoVariant(editor, "default", "asset:logo");
  assert.equal(editor.get("design.logo"), "asset:logo");
  setLogoVariant(editor, "light", "asset:mark");
  assert.deepEqual(editor.get("design.logo"), { default: "asset:logo", light: "asset:mark" });
  assert.deepEqual(readLogoVariants(editor.presentation), { default: "asset:logo", light: "asset:mark" });
  setLogoVariant(editor, "icon", "asset:photo", { slideIndex: 0 });
  assert.deepEqual(readLogoVariants(editor.presentation, { slideIndex: 0 }), { icon: "asset:photo" }, "a slide logo starts from the slide's own value");
  setLogoVariant(editor, "light", null);
  assert.equal(editor.get("design.logo"), "asset:logo");
  setLogoVariant(editor, "default", null);
  assert.equal(editor.get("design.logo"), undefined);
  assert.throws(() => setLogoVariant(editor, "huge", "asset:logo"), (error) => error.code === "invalid-design-value");
  assert.throws(() => setLogoVariant(editor, "default", "  "), (error) => error.code === "invalid-design-value");
  // Variant switching resolves by background: a light variant is chosen for a dark background.
  setLogoVariant(editor, "default", "asset:logo");
  setLogoVariant(editor, "light", "asset:mark");
  const bytes = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs });
  assert.ok(bytes.byteLength > 0);
}

// Header and footer zones: merge fields, drop empties, keep suppression, warn when a logo is missing.
{
  const editor = session();
  const text = setHeaderFooterZone(editor, "footer", "center", { text: "Confidential" });
  assert.deepEqual(text.patches, [{ op: "add", path: "/design/footer", value: { center: { text: "Confidential" } } }]);
  assert.ok(svg(editor.presentation, 1).includes("Confidential"), "the footer draws");
  setHeaderFooterZone(editor, "footer", "right", { text: "{{slide.number}}" });
  assert.deepEqual(editor.get("design.footer"), { center: { text: "Confidential" }, right: { text: "{{slide.number}}" } });
  assert.ok(/>2</.test(svg(editor.presentation, 1)), "the slide number token draws the slide's number");
  const logo = setHeaderFooterZone(editor, "header", "left", { logo: true });
  assert.deepEqual(logo.warnings.map((warning) => warning.code), ["unresolved-logo"], "logo: true with no logo is reported");
  assert.equal(logo.warnings[0].path, "design.header.left.logo");
  assert.deepEqual(designWarnings(editor.presentation, 0).length, 1);
  setDesignOption(editor, "organizationLogo", "asset:logo");
  assert.deepEqual(designWarnings(editor.presentation, 0), [], "an organization logo resolves it");
  assert.deepEqual(readHeaderFooterZone(editor.presentation, "header", "left"), { logo: true });
  // Removing the last field removes the zone, then the header.
  setHeaderFooterZone(editor, "header", "left", { logo: false });
  assert.equal(editor.get("design.header"), undefined);
  // false, null and "" all remove; unknown fields are refused.
  setHeaderFooterZone(editor, "footer", "right", { text: null });
  assert.equal(editor.get("design.footer.right"), undefined);
  assert.throws(() => setHeaderFooterZone(editor, "footer", "right", { sparkle: true }), (error) => error.code === "invalid-design-value");
  // The 0.16 flags are gone with no alias; the message says what to write instead.
  for (const [key, token] of [["organization", "{{organization.name}}"], ["speaker", "{{speaker.name}}"], ["section", "{{slide.section}}"], ["slideNumber", "{{slide.number}}"], ["slideNumberFormat", "{{deck.slideCount}}"]])
    assert.throws(() => setHeaderFooterZone(editor, "footer", "right", { [key]: key === "slideNumberFormat" ? "{current}" : true }), (error) => error.code === "invalid-design-value" && error.message.includes(`Unknown header/footer field: ${key}.`) && error.message.includes(token), key);
  assert.equal(editor.get("design.footer.right"), undefined, "a refused field changes nothing");
  assert.throws(() => setHeaderFooterZone(editor, "middle", "right", { text: "x" }), (error) => error.code === "invalid-design-value");
  assert.throws(() => setHeaderFooterZone(editor, "footer", "top", { text: "x" }), (error) => error.code === "invalid-design-value");
  // A slide scope writes the slide; a suppressed footer is replaced when a zone is set.
  setDesignOption(editor, "titleAlignment", "left");
  editor.set("slides.1.design", { footer: false });
  setHeaderFooterZone(editor, "footer", "left", { text: "Only here" }, { slideIndex: 1 });
  assert.deepEqual(editor.get("slides.1.design.footer"), { left: { text: "Only here" } });
  const export_ = await pptx.toPptx(structuredClone(editor.presentation), { strictAssets: true, catalogs });
  assert.ok(export_.byteLength > 0);
  // Picture bullets without a logo are reported too.
  const bare = session();
  assert.deepEqual(setDesignOption(bare, "listBullet", "image").warnings.map((warning) => warning.path), ["design.listBullet"]);
}

// A slide's own header replaces the deck's whole one: the first slide edit copies the deck's zones, so nothing else disappears.
{
  const editor = session();
  setHeaderFooterZone(editor, "footer", "left", { text: "Acme" });
  setHeaderFooterZone(editor, "footer", "right", { text: "{{slide.number}}" });
  assert.deepEqual(headerFooterState(editor.presentation, "footer", { slideIndex: 1 }), { own: false, inherited: true, hidden: false });
  assert.deepEqual(readHeaderFooterZone(editor.presentation, "footer", "left", { slideIndex: 1 }), { text: "Acme" }, "a slide reads the deck's zone it inherits");
  const edit = setHeaderFooterZone(editor, "footer", "center", { text: "Draft" }, { slideIndex: 1 });
  assert.deepEqual(edit.patches, [{ op: "add", path: "/slides/1/design", value: { footer: { left: { text: "Acme" }, right: { text: "{{slide.number}}" }, center: { text: "Draft" } } } }]);
  assert.deepEqual(headerFooterState(editor.presentation, "footer", { slideIndex: 1 }), { own: true, inherited: false, hidden: false });
  assert.equal(editor.get("design.footer.center"), undefined, "the deck is untouched");
  // Clearing a zone the slide only inherited overrides it for this slide, and the other zones stay.
  setHeaderFooterZone(editor, "footer", "left", { text: null }, { slideIndex: 2 });
  assert.deepEqual(editor.get("slides.2.design.footer"), { right: { text: "{{slide.number}}" } });
  // A slide emptied entirely hides the furniture instead of inheriting it again.
  setHeaderFooterZone(editor, "footer", "left", { text: null }, { slideIndex: 0 });
  setHeaderFooterZone(editor, "footer", "right", { text: null }, { slideIndex: 0 });
  assert.equal(editor.get("slides.0.design.footer"), false);
  assert.deepEqual(headerFooterState(editor.presentation, "footer", { slideIndex: 0 }), { own: true, inherited: false, hidden: true });
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
  assert.deepEqual(editor.get("design.fontScheme"), { id: "georgia", accent: "Georgia" }, "the accent font survives a font scheme switch");
  assert.equal(switched.changed, true);
  setDesignOption(editor, "accentFont", null);
  assert.equal(editor.get("design.fontScheme"), "georgia");
  // A slide switch keeps the slide's own accent too.
  setDesignOption(editor, "accentFont", "Lora", { slideIndex: 1 });
  switchDimension(editor, "font-schemes", "tahoma", { slideIndex: 1 });
  assert.deepEqual(editor.get("slides.1.design.fontScheme"), { id: "tahoma", accent: "Lora" });
}

// Every header/footer part the schema has, per zone: validation, flags, date and format, warnings, export.
{
  const editor = session();
  setHeaderFooterZone(editor, "footer", "left", { text: "Acme", logo: true, socials: true });
  setHeaderFooterZone(editor, "footer", "left", { image: "asset:photo" });
  setHeaderFooterZone(editor, "footer", "right", { text: "Page {{slide.number}} of {{deck.slideCount}}", date: true, dateFormat: "MMMM d, yyyy" });
  assert.deepEqual(editor.get("design.footer.left"), { text: "Acme", logo: true, socials: true, image: "asset:photo" });
  assert.deepEqual(editor.get("design.footer.right"), { text: "Page {{slide.number}} of {{deck.slideCount}}", date: true, dateFormat: "MMMM d, yyyy" });
  // A fixed date replaces the current date; false removes a flag or the date.
  setHeaderFooterZone(editor, "footer", "right", { date: "2026-10-01" });
  assert.equal(editor.get("design.footer.right.date"), "2026-10-01");
  setHeaderFooterZone(editor, "footer", "right", { date: false, dateFormat: null });
  assert.deepEqual(editor.get("design.footer.right"), { text: "Page {{slide.number}} of {{deck.slideCount}}" });
  setHeaderFooterZone(editor, "footer", "left", { socials: false, image: null });
  assert.deepEqual(editor.get("design.footer.left"), { text: "Acme", logo: true });
  // Friendly validation before the schema.
  const bad = (fields, pattern) => assert.throws(() => setHeaderFooterZone(editor, "footer", "center", fields), (error) => error.code === "invalid-design-value" && pattern.test(error.message), JSON.stringify(fields));
  bad({ logo: "yes" }, /logo is true or false/);
  bad({ text: 4 }, /Text is a string/);
  bad({ dateFormat: "  " }, /date format uses tokens/);
  bad({ date: "Autumn", dateFormat: "yyyy" }, /written YYYY-MM-DD/);
  assert.equal(editor.get("design.footer.center"), undefined);
  // A fixed date that is not ISO is fine as literal text when there is no format; with a format it must be ISO.
  setHeaderFooterZone(editor, "footer", "center", { date: "Autumn 2026" });
  assert.equal(editor.get("design.footer.center.date"), "Autumn 2026");
  assert.throws(() => setHeaderFooterZone(editor, "footer", "center", { dateFormat: "yyyy" }), (error) => /written YYYY-MM-DD/.test(error.message));
  setHeaderFooterZone(editor, "footer", "center", { date: null });
  // Warnings for parts with nothing to show.
  const warned = setHeaderFooterZone(editor, "header", "right", { text: "{{organization.name}}", socials: true });
  assert.deepEqual(warned.warnings.map((warning) => warning.path).filter((path) => path.startsWith("design.header")), ["design.header.right.socials"], "the organization exists; its socials do not");
  const none = createEditorSession({ slides: [{ title: "x", text: "y" }] });
  const both = setHeaderFooterZone(none, "footer", "left", { text: "{{organization.name}} {{speaker.name}}", socials: true });
  assert.deepEqual(both.warnings.map((warning) => warning.path), ["design.footer.left.socials", "design.footer.left.text", "design.footer.left.text"], "no organization, no speaker, no socials");
  assert.deepEqual(both.warnings.filter((warning) => warning.path.endsWith(".text")).map((warning) => warning.message), [
    "The footer left zone shows {{organization.name}}, but the presentation has no value for it.",
    "The footer left zone shows {{speaker.name}}, but the presentation has no value for it.",
  ]);
  // A section the slide does not have, an escaped token and a token repeated in a zone.
  const sectioned = createEditorSession({ slides: [{ title: "One", section: "Intro", text: "a" }, { title: "Two", text: "b" }] });
  setHeaderFooterZone(sectioned, "header", "right", { text: "{{slide.section}} {{ slide.section }} \\{{speaker.name}}" });
  assert.deepEqual(designWarnings(sectioned.presentation, 0), [], "slide 1 has a section; an escaped token is literal text");
  assert.deepEqual(designWarnings(sectioned.presentation, 1).map((warning) => [warning.path, warning.message]), [["design.header.right.text", "The header right zone shows {{slide.section}}, but this slide has no section."]]);
  // Preview and export carry the parts.
  const parts = createEditorSession({ ...deck(), organization: { id: "acme", name: "Acme Corp", socials: { linkedin: "acme" } } }, { rejectInvalid: true });
  setHeaderFooterZone(parts, "footer", "left", { text: "{{organization.name}}\nConfidential" });
  setHeaderFooterZone(parts, "footer", "right", { text: "Page {{slide.number}} of {{deck.slideCount}}" });
  const drawn = svg(parts.presentation, 1);
  assert.ok(drawn.includes("Acme Corp") && drawn.includes("Confidential") && /Page 2 of 3/.test(drawn), "the zone parts draw");
  assert.ok((await pptx.toPptx(structuredClone(parts.presentation), { strictAssets: true, catalogs })).byteLength > 0);
}

// FA-31: "Insert value" puts a variable token into a zone's text at the caret, as one undoable, validated edit.
{
  const editor = session();
  // An empty zone gets the token; the edit is a single patch and one undo step.
  const first = insertZoneValue(editor, "footer", "right", "slide.number");
  assert.deepEqual(first.patches, [{ op: "add", path: "/design/footer", value: { right: { text: "{{slide.number}}" } } }]);
  assert.equal(editor.snapshot().undoDepth, 1);
  // At the end by default, in the middle with offsets, over a selection when start and end differ.
  insertZoneValue(editor, "footer", "right", "deck.slideCount");
  assert.equal(editor.get("design.footer.right.text"), "{{slide.number}}{{deck.slideCount}}");
  setHeaderFooterZone(editor, "footer", "right", { text: "Page  of " });
  insertZoneValue(editor, "footer", "right", "slide.number", { start: 5, end: 5 });
  assert.equal(editor.get("design.footer.right.text"), "Page {{slide.number}} of ");
  insertZoneValue(editor, "footer", "right", "deck.slideCount");
  assert.equal(editor.get("design.footer.right.text"), "Page {{slide.number}} of {{deck.slideCount}}");
  const depth = editor.snapshot().undoDepth;
  insertZoneValue(editor, "footer", "right", "slide.section", { start: 0, end: 4 });
  assert.equal(editor.get("design.footer.right.text"), "{{slide.section}} {{slide.number}} of {{deck.slideCount}}", "a selection is replaced");
  // Undo restores the text before the insert; redo puts it back.
  editor.undo();
  assert.equal(editor.get("design.footer.right.text"), "Page {{slide.number}} of {{deck.slideCount}}");
  assert.equal(editor.snapshot().undoDepth, depth, "one insert is one undo step");
  editor.redo();
  assert.equal(editor.get("design.footer.right.text"), "{{slide.section}} {{slide.number}} of {{deck.slideCount}}");
  editor.undo();
  // Text typed in a box but not yet committed is the base: it commits together with the token.
  const typed = insertZoneValue(editor, "header", "left", "organization.name", { text: "From ", start: 5, end: 5 });
  assert.equal(editor.get("design.header.left.text"), "From {{organization.name}}");
  assert.equal(typed.changed, true);
  editor.undo();
  assert.equal(editor.get("design.header.left"), undefined, "undo removes the whole header edit, typed text included");
  // Every menu value inserts its token and the document stays valid; each draws in the preview.
  const all = createEditorSession({ ...deck(), speaker: [{ id: "ada", name: "Ada Lovelace" }], slides: [{ ...deck().slides[0], section: "Intro" }, ...deck().slides.slice(1)] }, { rejectInvalid: true, catalogs });
  const places = [["header", "left"], ["header", "center"], ["header", "right"], ["footer", "left"], ["footer", "center"], ["footer", "right"]];
  ZONE_VALUES.forEach((value, index) => {
    const [which, zone] = places[index];
    insertZoneValue(all, which, zone, value.name);
    assert.equal(all.get(`design.${which}.${zone}.text`), value.token, value.name);
  });
  const drawnAll = svg(all.presentation, 0);
  for (const shown of ["Intro", "Acme", "Ada Lovelace", "Design options fixture"]) assert.ok(drawnAll.includes(shown), `${shown} draws on slide 1`);
  assert.ok(/>1</.test(drawnAll) && /3</.test(drawnAll), "the slide number and the slide count draw on slide 1");
  // A slide scope inserts into the slide's own copy of the footer and leaves the deck alone.
  insertZoneValue(editor, "footer", "left", "slide.number", { slideIndex: 1 });
  assert.equal(editor.get("slides.1.design.footer.left.text"), "{{slide.number}}");
  assert.equal(editor.get("design.footer.left"), undefined);
  // Refusals change nothing.
  const before = JSON.stringify(editor.presentation);
  assert.throws(() => insertZoneValue(editor, "footer", "right", "slide.title"), (error) => error.code === "invalid-design-value");
  assert.throws(() => insertZoneValue(editor, "footer", "right", "slide.number", { start: 99 }), (error) => error.code === "invalid-selection");
  assert.throws(() => insertZoneValue(editor, "footer", "right", "slide.number", { start: 3, end: 1 }), (error) => error.code === "invalid-selection");
  assert.throws(() => insertZoneValue(editor, "middle", "right", "slide.number"), (error) => error.code === "invalid-design-value");
  assert.equal(JSON.stringify(editor.presentation), before);
  assert.equal(prepareZoneValue(deck(), "footer", "right", "slide.number").changed, true, "prepare computes the patch without a session");
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
  assert.deepEqual(editor.presentation, deck());
  editor.redo();
  editor.redo();
  editor.redo();
  assert.equal(editor.get("design.footer.center.text"), "Draft");
}

console.log(`Design options: ${cases.length} options with patch, scope, undo/redo, preview and export; slide scope, shadowing, validation, accent font, watermark and slide image merging, logo variants, header/footer zones and logo warnings.`);
