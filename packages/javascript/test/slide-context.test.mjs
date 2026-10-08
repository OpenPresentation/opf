import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ENGINE_DEFAULT_COLOR_SCHEME, ENGINE_DEFAULT_FONT_SCHEME, ENGINE_DEFAULT_THEME, paginate, paginateSlide, resolveSlideContext, validate } from "../dist/index.js";
import { composeSlide, resolveFontFamilies } from "../dist/composition.js";
import { defaultCatalog } from "../dist/catalog.js";

const catalogs = [defaultCatalog];
const families = (scheme) => resolveFontFamilies(scheme === undefined ? ENGINE_DEFAULT_FONT_SCHEME : defaultCatalog.fontSchemes[scheme]);
const context = (deck, index, options = {}) => resolveSlideContext(deck, index, { catalogs, ...options });
const brief = (diagnostic) => [diagnostic.code, diagnostic.kind, diagnostic.path, diagnostic.reference, diagnostic.fallback];
const recorder = () => {
  const used = new Set();
  return { used, textMeasurement: { measure: (text, size, style) => { used.add(style.fontFamily); return text.length * size * 0.5; } } };
};

describe("resolveSlideContext", () => {
  test("resolves canvas, theme, colour scheme, font families and layout in one call", () => {
    const deck = { design: { theme: "minimal", fontScheme: "roboto", dimensions: "4:3", contentAlignment: "center", titleAlignment: "right", contentBox: true }, slides: [{ layout: "title", title: "Hi" }, { title: "Second" }] };
    const { options, diagnostics, resolved } = context(deck, 0);
    assert.deepEqual(diagnostics, []);
    assert.equal(options.width, 960);
    assert.equal(options.height, 720);
    assert.equal(options.fontFamilies.body, "Roboto");
    assert.deepEqual(options.fontFamilies, families("roboto"));
    assert.equal(options.layout.name, "Title");
    assert.equal(options.presentation, deck);
    assert.equal(options.slideIndex, 0);
    assert.equal(options.slideNumber, 1);
    assert.equal(options.slideCount, 2);
    // The design hints (alignment, cards, ...) are not options: composeSlide resolves them from the slide, the deck design
    // in `presentation` and the layout record (FA-17), so every engine reads the same values from SlideComposition.design.
    for (const key of ["contentAlignment", "titleAlignment", "contentBox"]) assert.equal(key in options, false, key);
    const design = composeSlide(deck.slides[0], options).design;
    assert.deepEqual([design.contentAlignment, design.titleAlignment, design.contentBox], ["center", "right", true]);
    assert.deepEqual([design.sources.contentAlignment, design.sources.titleAlignment, design.sources.contentBox], ["deck", "deck", "deck"]);
    assert.equal("socialPlatforms" in options, false, "social platforms are an engine vocabulary");
    assert.equal("textMeasurement" in options, false);
    assert.deepEqual(resolved.fontScheme, defaultCatalog.fontSchemes.roboto);
    assert.equal(resolved.fontSchemePath, "design.fontScheme");
    assert.deepEqual(resolved.theme, defaultCatalog.themes.minimal);
    assert.deepEqual(resolved.colorScheme, defaultCatalog.colorSchemes[defaultCatalog.themes.minimal.colorScheme]);
    assert.equal("layout" in context(deck, 1).options, false);
  });

  test("a slide's design wins over the deck's, per field, and the theme supplies the font scheme last", () => {
    const deck = {
      design: { theme: "minimal", fontScheme: "roboto" },
      slides: [{ title: "deck scheme" }, { title: "slide scheme", design: { fontScheme: "consolas" } }, { title: "slide theme only", design: { theme: "classic" } }],
    };
    assert.equal(context(deck, 0).options.fontFamilies.body, "Roboto");
    assert.equal(context(deck, 1).options.fontFamilies.body, families("consolas").body);
    assert.equal(context(deck, 1).resolved.fontSchemePath, "slides.1.design.fontScheme");
    // The deck names a scheme, so a slide's own theme does not replace it (per-field override).
    assert.equal(context(deck, 2).options.fontFamilies.body, "Roboto");
    const themed = { design: { theme: "classic" }, slides: [{ title: "x" }] };
    const theme = context(themed, 0);
    assert.deepEqual(theme.resolved.fontScheme, defaultCatalog.fontSchemes[theme.resolved.theme.fontScheme]);
    assert.equal(theme.resolved.fontSchemePath, "design.theme");
    // No theme and no scheme anywhere: the shared engine default.
    assert.equal(context({ slides: [{ title: "x" }] }, 0).options.fontFamilies.body, families().body);
  });

  test("an unresolved font scheme reports unresolved-reference once, with its path and source, and falls back to the default", () => {
    const deck = { design: { fontScheme: "no-such-scheme" }, slides: [{ title: "x" }, { title: "y", design: { fontScheme: "also-missing" } }] };
    const first = context(deck, 0);
    assert.deepEqual(first.diagnostics, [{ code: "unresolved-reference", kind: "fontSchemes", reference: "no-such-scheme", path: "design.fontScheme", group: "default", source: "https://www.pptx.gallery", fallback: "engine-default", message: "Font scheme 'no-such-scheme' resolves nowhere: it is not embedded in catalogs.custom or catalogs.default and the catalog registered for https://www.pptx.gallery has no such record; the engine default is used." }]);
    assert.deepEqual(first.options.fontFamilies, families());
    assert.equal(context(deck, 1).diagnostics[0].path, "slides.1.design.fontScheme");
  });

  test("an unknown theme or colour scheme uses the engine default, an unknown layout no record; each is a diagnostic", () => {
    const deck = { design: { theme: "no-such-theme", colorScheme: "no-such-scheme" }, slides: [{ layout: "no-such-layout", title: "x" }, { design: { colorScheme: "other-missing" }, title: "y" }] };
    const { options, diagnostics, resolved } = context(deck, 0);
    assert.deepEqual(diagnostics.map(brief), [
      ["unresolved-reference", "themes", "design.theme", "no-such-theme", "engine-default"],
      ["unresolved-reference", "colorSchemes", "design.colorScheme", "no-such-scheme", "engine-default"],
      ["unresolved-reference", "layouts", "slides.0.layout", "no-such-layout", "automatic"],
    ]);
    assert.equal("layout" in options, false);
    assert.deepEqual(resolved.theme, ENGINE_DEFAULT_THEME);
    assert.deepEqual(resolved.colorScheme, ENGINE_DEFAULT_COLOR_SCHEME);
    assert.equal(context(deck, 1).diagnostics.find((item) => item.kind === "colorSchemes").path, "slides.1.design.colorScheme");
    // The theme's own colour scheme is the reference when the deck and slide name none, and the path is the record's.
    const themed = { catalogs: { custom: { themes: { mine: { name: "Mine", colorScheme: "missing-scheme" } } } }, design: { theme: "mine" }, slides: [{}] };
    assert.deepEqual(context(themed, 0).diagnostics.map((item) => [item.code, item.path]), [["unresolved-reference", "catalogs.custom.themes.mine.colorScheme"]]);
    // A colour scheme object with fields of its own still reports an id that resolves nowhere, at its id.
    assert.deepEqual(context({ design: { colorScheme: { id: "mine", accent1: "#123456" } }, slides: [{}] }, 0).diagnostics.map((item) => item.path), ["design.colorScheme.id"]);
  });

  test("an inline colour scheme without an id is overlaid on the engine default, like the preview", () => {
    const base = context({ slides: [{}] }, 0).resolved;
    const scheme = context({ design: { colorScheme: { accent1: "#123456", primary: "#654321" } }, slides: [{}] }, 0);
    assert.equal(scheme.resolved.colorScheme.accent1, "#123456");
    assert.equal(scheme.resolved.colorScheme.light2, base.colorScheme.light2);
    assert.equal(scheme.resolved.colorScheme.dark2, base.colorScheme.dark2);
    assert.equal(scheme.resolved.colorScheme.light1, base.colorScheme.light1);
    assert.equal(scheme.resolved.colorScheme.accent2, ENGINE_DEFAULT_COLOR_SCHEME.accent2);
    // The slide's own object is overlaid too, and nothing is reported for any of them.
    assert.deepEqual(context({ slides: [{ design: { colorScheme: { accent1: "#111111" } } }] }, 0).diagnostics, []);
    assert.deepEqual(scheme.diagnostics, []);
    // An object with an id keeps the record of that id as its base.
    const named = context({ design: { colorScheme: { id: "cool-horizon", accent1: "#123456" } }, slides: [{}] }, 0);
    assert.equal(named.resolved.colorScheme.light2, base.colorScheme.light2);
  });

  test("an unknown theme paints the engine default background (minimal's); darkBackground follows the resolved background", () => {
    const unknown = context({ design: { theme: "no-such-theme" }, slides: [{}] }, 0);
    const minimal = context({ design: { theme: "minimal" }, slides: [{}] }, 0);
    assert.equal(unknown.options.darkBackground, minimal.options.darkBackground);
    assert.deepEqual(unknown.resolved.theme.background, minimal.resolved.theme.background);
    assert.deepEqual(unknown.resolved.theme.dimensions, minimal.resolved.theme.dimensions);
    const background = (color) => ({ design: { background: { type: "solid", color } }, slides: [{}] });
    assert.equal(context(background("#101010"), 0).options.darkBackground, true);
    assert.equal(context(background("#FAFAFA"), 0).options.darkBackground, false);
    // A slide's own background wins over the deck's.
    assert.equal(context({ ...background("#101010"), slides: [{ design: { background: { type: "solid", color: "#FFFFFF" } } }] }, 0).options.darkBackground, false);
  });

  test("a background written as a ColorRef is resolved like the preview: var:, scheme slots and roles", () => {
    const dark = (background, variables = { brand: "#101010", pale: { type: "color", value: "#FAFAFA" } }, extra = {}) =>
      context({ variables, design: { background, ...extra }, slides: [{}] }, 0).options.darkBackground;
    assert.equal(dark({ type: "solid", color: "var:brand" }), true);
    assert.equal(dark({ type: "solid", color: "var:pale" }), false);
    // An unknown variable falls back to white, like a colour that does not parse.
    assert.equal(dark({ type: "solid", color: "var:missing" }), false);
    assert.equal(dark({ type: "pattern", pattern: { preset: "pct5", backgroundColor: "var:brand", foregroundColor: "#FFFFFF" } }), true);
    // A scheme slot name and a role resolve through the colour scheme.
    const scheme = { colorScheme: { light1: "#FFFFFF", dark1: "#000000", primary: "#0A0A0A" } };
    assert.equal(dark({ type: "solid", color: "dark1" }, {}, scheme), true);
    assert.equal(dark({ type: "solid", color: "primary" }, {}, scheme), true);
    assert.equal(dark({ type: "solid", color: "light1" }, {}, scheme), false);
    // A gradient has no single colour and counts as light; a picture reads light1.
    assert.equal(dark({ type: "gradient", gradient: { stops: [{ color: "#000000" }, { color: "#111111" }] } }), false);
    assert.equal(dark({ type: "image", image: { src: "asset:x" } }), false);
  });

  test("validate's contrast rules see a var: background", () => {
    const deck = (text) => ({
      variables: { brand: "#101010" },
      design: { background: { type: "solid", color: "var:brand" } },
      slides: [{ title: "Title", text: [{ text: "Body copy", color: text }] }],
    });
    const contrast = (text) => validate(deck(text), { only: ["opf/text-contrast"], catalogs }).findings.map((finding) => finding.measured?.ratio !== undefined);
    assert.deepEqual(contrast("#161616"), [true], "dark text on the dark variable background is reported");
    assert.deepEqual(contrast("#FFFFFF"), [], "light text is fine");
  });

  test("a slide with no layout, or an unknown one, is a vertically centred cover and nothing is substituted", () => {
    const cover = (slide) => {
      const { options } = context({ slides: [slide] }, 0);
      const geometry = composeSlide(slide, options);
      const title = geometry.items.find((item) => item.field === "title");
      return { title, height: options.height, items: geometry.items.length };
    };
    for (const slide of [{ title: "Cover" }, { title: "Cover", layout: "no-such-layout" }]) {
      const { title, height, items } = cover(slide);
      assert.equal(items, 1);
      assert.ok(Math.abs(title.box.y + title.box.height / 2 - height / 2) < height * 0.05, JSON.stringify(slide));
    }
    // With a body the title is not centred: it sits at the top.
    const { options } = context({ slides: [{ title: "T", text: "Body" }] }, 0);
    assert.ok(composeSlide({ title: "T", text: "Body" }, options).items.find((item) => item.field === "title").box.y < options.height * 0.2);
  });

  test("the document's own records resolve before the registered catalogs", () => {
    const deck = {
      catalogs: { custom: { fontSchemes: { roboto: { name: "Mine", heading: "Inline Head", body: "Inline Body" } }, layouts: { custom: { name: "Custom" } } } },
      design: { fontScheme: "roboto" },
      slides: [{ layout: "custom", title: "x" }],
    };
    const { options, diagnostics } = context(deck, 0);
    assert.deepEqual(diagnostics, []);
    assert.equal(options.fontFamilies.body, "Inline Body");
    assert.equal(options.layout.name, "Custom");
    const host = resolveSlideContext({ design: { fontScheme: "host-scheme" }, slides: [{}] }, 0, { catalogs: [{ source: "pkg:@host/catalog", fontSchemes: { "host-scheme": { body: "Host Body", heading: "Host Head" } } }] });
    assert.equal(host.options.fontFamilies.body, "Host Body");
    assert.deepEqual(host.diagnostics, []);
  });

  test("passes the fonts handle's measurement, the date and the numbering through", () => {
    const measurement = recorder().textMeasurement;
    const { options } = context({ slides: [{}, {}] }, 1, { fonts: { textMeasurement: measurement }, slideNumber: 7, slideCount: 12, date: "2026-10-06" });
    assert.equal(options.textMeasurement, measurement);
    assert.equal(options.slideNumber, 7);
    assert.equal(options.slideCount, 12);
    assert.equal(options.date, "2026-10-06");
  });

  test("rejects an index outside the deck", () => {
    assert.throws(() => context({ slides: [{}] }, 1), RangeError);
    assert.throws(() => context({ slides: [{}] }, -1), RangeError);
    assert.throws(() => context({}, 0), RangeError);
    assert.throws(() => context({ slides: [{}] }, 0.5), RangeError);
  });

  test("composeSlide(slide, context.options) draws with the families the context resolved", () => {
    const deck = { design: { fontScheme: "roboto" }, slides: [{ title: "Title", text: "Body text that is measured" }] };
    const { used, textMeasurement } = recorder();
    composeSlide(deck.slides[0], context(deck, 0, { fonts: { textMeasurement } }).options);
    assert.ok(used.has("Roboto"), [...used].join());
  });

  test("pagination resolves the same context: same families, same unresolved-reference diagnostic", () => {
    const deck = { design: { fontScheme: "roboto" }, slides: [{ title: "Title", text: "Body" }] };
    const direct = recorder(), viaContext = recorder();
    paginate(structuredClone(deck), { catalogs, fonts: { textMeasurement: direct.textMeasurement } });
    composeSlide(deck.slides[0], context(deck, 0, { fonts: { textMeasurement: viaContext.textMeasurement } }).options);
    assert.deepEqual([...direct.used].sort(), [...viaContext.used].sort());
    const seen = [];
    paginate({ design: { fontScheme: "nope" }, slides: [{ title: "x" }, { title: "y" }] }, { catalogs, onDiagnostic: (diagnostic) => seen.push(diagnostic) });
    assert.deepEqual(seen.map((diagnostic) => [diagnostic.code, diagnostic.path]), [["unresolved-reference", "design.fontScheme"]]);
  });
});

describe("the fonts option on deck-level verbs", () => {
  const deck = () => ({ slides: [{ title: "Measured", text: "word ".repeat(30) }] });

  test("paginate and paginateSlide measure with fonts.textMeasurement", () => {
    const deckRecorder = recorder(), slideRecorder = recorder();
    paginate(deck(), { fonts: { textMeasurement: deckRecorder.textMeasurement } });
    assert.ok(deckRecorder.used.size > 0, "paginate measured nothing");
    paginateSlide(deck().slides[0], { fonts: { textMeasurement: slideRecorder.textMeasurement } });
    assert.ok(slideRecorder.used.size > 0, "paginateSlide measured nothing");
  });

  test("a wider measurement paginates more pages: the handle changes the result", () => {
    const text = "word ".repeat(220);
    const source = { slides: [{ title: "T", text }] };
    const narrow = paginate(source, { fonts: { textMeasurement: { measure: (value, size) => value.length * size * 0.2 } } });
    const wide = paginate(source, { fonts: { textMeasurement: { measure: (value, size) => value.length * size * 0.9 } } });
    assert.ok(wide.presentation.slides.length > narrow.presentation.slides.length, `${wide.presentation.slides.length} pages vs ${narrow.presentation.slides.length}`);
  });

  test("a richer handle works as-is: only textMeasurement is read", () => {
    const handle = { ...recorder(), embeddedFonts: [], fontFiles: [], useBundledFonts: false, registry: {}, manifest: {} };
    assert.doesNotThrow(() => paginate(deck(), { fonts: handle }));
  });

  test("validate's layout rules resolve the same context: the families and measurement of resolveSlideContext", () => {
    const deck = { design: { fontScheme: "roboto" }, slides: [{ title: "Title", text: "Body text that is measured" }] };
    const direct = recorder(), viaValidate = recorder(), perSlide = recorder();
    composeSlide(deck.slides[0], context(deck, 0, { fonts: { textMeasurement: direct.textMeasurement } }).options);
    validate(deck, { only: ["layout"], catalogs, fonts: { textMeasurement: viaValidate.textMeasurement } });
    assert.deepEqual([...viaValidate.used].sort(), [...direct.used].sort());
    assert.ok(viaValidate.used.has("Roboto"), [...viaValidate.used].join());
    // The handle may give a measurement per slide; the format check alone builds no layout and measures nothing.
    validate(deck, { only: ["layout"], fonts: { textMeasurement: () => perSlide.textMeasurement } });
    assert.ok(perSlide.used.size > 0);
    const none = recorder();
    validate(deck, { only: ["format"], fonts: { textMeasurement: none.textMeasurement } });
    assert.equal(none.used.size, 0);
  });

  test("pagination of a deck with an unknown layout, theme or colour scheme does not throw: it falls back and reports", () => {
    const deck = { design: { theme: "no-such-theme", colorScheme: "no-such-scheme" }, slides: [{ layout: "no-such-layout", title: "x", text: "y" }, { title: "z" }] };
    const seen = [];
    const { presentation } = paginate(deck, { catalogs, onDiagnostic: (diagnostic) => seen.push([diagnostic.kind, diagnostic.path]) });
    assert.equal(presentation.slides.length, 2);
    assert.deepEqual(seen, [["themes", "design.theme"], ["colorSchemes", "design.colorScheme"], ["layouts", "slides.0.layout"]]);
    assert.doesNotThrow(() => paginateSlide({ layout: "no-such-layout", title: "x", text: "y" }));
  });
});
