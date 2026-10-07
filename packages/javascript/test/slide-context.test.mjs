import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { paginate, paginateSlide, resolveSlideContext, validate } from "../dist/index.js";
import { DEFAULT_FONT_SCHEME, composeSlide, resolveFontFamilies } from "../dist/composition.js";
import { fontSchemes } from "../dist/catalogs.js";

const families = (scheme) => resolveFontFamilies(fontSchemes.find((record) => record.id === scheme));
const recorder = () => {
  const used = new Set();
  return { used, textMeasurement: { measure: (text, size, style) => { used.add(style.fontFamily); return text.length * size * 0.5; } } };
};

describe("resolveSlideContext", () => {
  test("resolves canvas, theme, colour scheme, font families and layout in one call", () => {
    const deck = { design: { theme: "minimal", fontScheme: "roboto", dimensions: "4:3", contentAlignment: "center", titleAlignment: "right", contentBox: true }, slides: [{ layout: "title", title: "Hi" }, { title: "Second" }] };
    const { options, diagnostics, resolved } = resolveSlideContext(deck, 0);
    assert.deepEqual(diagnostics, []);
    assert.equal(options.width, 960);
    assert.equal(options.height, 720);
    assert.equal(options.fontFamilies.body, "Roboto");
    assert.deepEqual(options.fontFamilies, families("roboto"));
    assert.equal(options.layout.id, "title");
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
    assert.ok(options.socialPlatforms.length > 0);
    assert.equal("textMeasurement" in options, false);
    assert.equal(resolved.fontScheme.id, "roboto");
    assert.equal(resolved.fontSchemePath, "design.fontScheme");
    assert.equal(resolved.theme.id, "minimal");
    assert.ok(resolved.colorScheme.id);
    assert.equal("layout" in resolveSlideContext(deck, 1).options, false);
  });

  test("a slide's design wins over the deck's, per field, and the theme supplies the font scheme last", () => {
    const deck = {
      design: { theme: "minimal", fontScheme: "roboto" },
      slides: [{ title: "deck scheme" }, { title: "slide scheme", design: { fontScheme: "consolas" } }, { title: "slide theme only", design: { theme: "classic" } }],
    };
    assert.equal(resolveSlideContext(deck, 0).options.fontFamilies.body, "Roboto");
    assert.equal(resolveSlideContext(deck, 1).options.fontFamilies.body, families("consolas").body);
    assert.equal(resolveSlideContext(deck, 1).resolved.fontSchemePath, "slides.1.design.fontScheme");
    // The deck names a scheme, so a slide's own theme does not replace it (per-field override).
    assert.equal(resolveSlideContext(deck, 2).options.fontFamilies.body, "Roboto");
    const themed = { design: { theme: "classic" }, slides: [{ title: "x" }] };
    const theme = resolveSlideContext(themed, 0);
    assert.equal(theme.resolved.fontScheme.id, theme.resolved.theme.fontScheme);
    assert.equal(theme.resolved.fontSchemePath, "design.theme");
    // No theme and no scheme anywhere: the shared default.
    assert.equal(resolveSlideContext({ slides: [{ title: "x" }] }, 0).options.fontFamilies.body, families(DEFAULT_FONT_SCHEME).body);
  });

  test("an unresolved font scheme reports unresolved-font-scheme once, with its path, and falls back to the default", () => {
    const deck = { design: { fontScheme: "no-such-scheme" }, slides: [{ title: "x" }, { title: "y", design: { fontScheme: "also-missing" } }] };
    const first = resolveSlideContext(deck, 0);
    assert.deepEqual(first.diagnostics, [{ code: "unresolved-font-scheme", path: "design.fontScheme", id: "no-such-scheme", fallback: DEFAULT_FONT_SCHEME, message: `Font scheme 'no-such-scheme' is not in the inline or bundled catalogs; using the default font scheme '${DEFAULT_FONT_SCHEME}'.` }]);
    assert.deepEqual(first.options.fontFamilies, families(DEFAULT_FONT_SCHEME));
    assert.equal(resolveSlideContext(deck, 1).diagnostics[0].path, "slides.1.design.fontScheme");
  });

  test("an unknown theme uses minimal, an unknown colour scheme cool-horizon, an unknown layout no record; each is a diagnostic", () => {
    const deck = { design: { theme: "no-such-theme", colorScheme: "no-such-scheme" }, slides: [{ layout: "no-such-layout", title: "x" }, { design: { colorScheme: "other-missing" }, title: "y" }] };
    const { options, diagnostics, resolved } = resolveSlideContext(deck, 0);
    assert.deepEqual(diagnostics.map((item) => [item.code, item.path, item.id, item.fallback]), [
      ["unresolved-theme", "design.theme", "no-such-theme", "minimal"],
      ["unresolved-color-scheme", "design.colorScheme", "no-such-scheme", "cool-horizon"],
      ["unresolved-layout", "slides.0.layout", "no-such-layout", undefined],
    ]);
    assert.equal("layout" in options, false);
    assert.equal(resolved.theme.id, "minimal");
    assert.equal(resolved.colorScheme.id, "cool-horizon");
    assert.equal(resolveSlideContext(deck, 1).diagnostics.find((item) => item.code === "unresolved-color-scheme").path, "slides.1.design.colorScheme");
    // The theme's own colour scheme is the reference when the deck and slide name none, and the path is the theme's.
    const themed = { catalogs: { themes: { records: [{ id: "mine", colorScheme: "missing-scheme" }] } }, design: { theme: "mine" }, slides: [{}] };
    assert.deepEqual(resolveSlideContext(themed, 0).diagnostics.map((item) => [item.code, item.path]), [["unresolved-color-scheme", "design.theme"]]);
    // An inline theme or scheme with fields of its own is a resolved reference even when its id matches nothing.
    assert.deepEqual(resolveSlideContext({ design: { theme: { id: "mine", dimensions: "letter" } }, slides: [{}] }, 0).diagnostics, []);
  });

  test("an inline colour scheme or theme without an id is overlaid on the default record, like the preview", () => {
    const base = resolveSlideContext({ slides: [{}] }, 0).resolved;
    const scheme = resolveSlideContext({ design: { colorScheme: { accent1: "#123456", primary: "#654321" } }, slides: [{}] }, 0);
    assert.equal(scheme.resolved.colorScheme.accent1, "#123456");
    assert.equal(scheme.resolved.colorScheme.light2, base.colorScheme.light2);
    assert.equal(scheme.resolved.colorScheme.dark2, base.colorScheme.dark2);
    assert.equal(scheme.resolved.colorScheme.light1, base.colorScheme.light1);
    assert.equal(scheme.resolved.colorScheme.id, "cool-horizon");
    const theme = resolveSlideContext({ design: { theme: { dimensions: "letter" } }, slides: [{}] }, 0);
    assert.equal(theme.options.width, 1056);
    assert.deepEqual(theme.resolved.theme.background, base.theme.background);
    assert.equal(theme.resolved.theme.id, "minimal");
    // The slide's own object is overlaid too, and nothing is reported for any of them.
    assert.deepEqual(resolveSlideContext({ slides: [{ design: { colorScheme: { accent1: "#111111" }, theme: {} } }] }, 0).diagnostics, []);
    assert.deepEqual(scheme.diagnostics, []);
    // An object with an id keeps the record of that id as its base.
    const named = resolveSlideContext({ design: { colorScheme: { id: "cool-horizon", accent1: "#123456" } }, slides: [{}] }, 0);
    assert.equal(named.resolved.colorScheme.light2, base.colorScheme.light2);
  });

  test("an unknown theme paints the minimal background; darkBackground follows the resolved background", () => {
    const unknown = resolveSlideContext({ design: { theme: "no-such-theme" }, slides: [{}] }, 0);
    const minimal = resolveSlideContext({ design: { theme: "minimal" }, slides: [{}] }, 0);
    assert.equal(unknown.options.darkBackground, minimal.options.darkBackground);
    assert.deepEqual(unknown.resolved.theme, minimal.resolved.theme);
    const background = (color) => ({ design: { background: { type: "solid", color } }, slides: [{}] });
    assert.equal(resolveSlideContext(background("#101010"), 0).options.darkBackground, true);
    assert.equal(resolveSlideContext(background("#FAFAFA"), 0).options.darkBackground, false);
    // A slide's own background wins over the deck's.
    assert.equal(resolveSlideContext({ ...background("#101010"), slides: [{ design: { background: { type: "solid", color: "#FFFFFF" } } }] }, 0).options.darkBackground, false);
  });

  test("a background written as a ColorRef is resolved like the preview: var:, scheme slots and roles", () => {
    const dark = (background, variables = { brand: "#101010", pale: { type: "color", value: "#FAFAFA" } }, extra = {}) =>
      resolveSlideContext({ variables, design: { background, ...extra }, slides: [{}] }, 0).options.darkBackground;
    assert.equal(dark({ type: "solid", color: "var:brand" }), true);
    assert.equal(dark({ type: "solid", color: "var:pale" }), false);
    // An unknown variable falls back to white, like a colour that does not parse.
    assert.equal(dark({ type: "solid", color: "var:missing" }), false);
    assert.equal(dark({ type: "pattern", pattern: { preset: "pct5", backgroundColor: "var:brand", foregroundColor: "#FFFFFF" } }), true);
    // A scheme slot name and a role resolve through the colour scheme.
    const scheme = { colorScheme: { id: "t", light1: "#FFFFFF", dark1: "#000000", primary: "#0A0A0A" } };
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
    const contrast = (text) => validate(deck(text), { only: ["opf/text-contrast"] }).findings.map((finding) => finding.measured?.ratio !== undefined);
    assert.deepEqual(contrast("#161616"), [true], "dark text on the dark variable background is reported");
    assert.deepEqual(contrast("#FFFFFF"), [], "light text is fine");
  });

  test("a slide with no layout, or an unknown one, is a vertically centred cover and nothing is substituted", () => {
    const cover = (slide) => {
      const { options } = resolveSlideContext({ slides: [slide] }, 0);
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
    const { options } = resolveSlideContext({ slides: [{ title: "T", text: "Body" }] }, 0);
    assert.ok(composeSlide({ title: "T", text: "Body" }, options).items.find((item) => item.field === "title").box.y < options.height * 0.2);
  });

  test("inline catalog records resolve before host and bundled ones", () => {
    const deck = {
      catalogs: { fontSchemes: { records: [{ id: "roboto", name: "Mine", heading: "Inline Head", body: "Inline Body" }] }, layouts: { records: [{ id: "custom", name: "Custom" }] } },
      design: { fontScheme: "roboto" },
      slides: [{ layout: "custom", title: "x" }],
    };
    const { options, diagnostics } = resolveSlideContext(deck, 0);
    assert.deepEqual(diagnostics, []);
    assert.equal(options.fontFamilies.body, "Inline Body");
    assert.equal(options.layout.id, "custom");
    const host = resolveSlideContext({ design: { fontScheme: "host-scheme" }, slides: [{}] }, 0, { catalogs: { fontSchemes: [{ id: "host-scheme", body: "Host Body", heading: "Host Head" }] } });
    assert.equal(host.options.fontFamilies.body, "Host Body");
    assert.deepEqual(host.diagnostics, []);
  });

  test("passes the fonts handle's measurement, the date and the numbering through", () => {
    const measurement = recorder().textMeasurement;
    const { options } = resolveSlideContext({ slides: [{}, {}] }, 1, { fonts: { textMeasurement: measurement }, slideNumber: 7, slideCount: 12, date: "2026-10-06" });
    assert.equal(options.textMeasurement, measurement);
    assert.equal(options.slideNumber, 7);
    assert.equal(options.slideCount, 12);
    assert.equal(options.date, "2026-10-06");
  });

  test("rejects an index outside the deck", () => {
    assert.throws(() => resolveSlideContext({ slides: [{}] }, 1), RangeError);
    assert.throws(() => resolveSlideContext({ slides: [{}] }, -1), RangeError);
    assert.throws(() => resolveSlideContext({}, 0), RangeError);
    assert.throws(() => resolveSlideContext({ slides: [{}] }, 0.5), RangeError);
  });

  test("composeSlide(slide, context.options) draws with the families the context resolved", () => {
    const deck = { design: { fontScheme: "roboto" }, slides: [{ title: "Title", text: "Body text that is measured" }] };
    const { used, textMeasurement } = recorder();
    composeSlide(deck.slides[0], resolveSlideContext(deck, 0, { fonts: { textMeasurement } }).options);
    assert.ok(used.has("Roboto"), [...used].join());
  });

  test("pagination resolves the same context: same families, same unresolved-font-scheme diagnostic", () => {
    const deck = { design: { fontScheme: "roboto" }, slides: [{ title: "Title", text: "Body" }] };
    const direct = recorder(), viaContext = recorder();
    paginate(structuredClone(deck), { fonts: { textMeasurement: direct.textMeasurement } });
    composeSlide(deck.slides[0], resolveSlideContext(deck, 0, { fonts: { textMeasurement: viaContext.textMeasurement } }).options);
    assert.deepEqual([...direct.used].sort(), [...viaContext.used].sort());
    const seen = [];
    paginate({ design: { fontScheme: "nope" }, slides: [{ title: "x" }, { title: "y" }] }, { onDiagnostic: (diagnostic) => seen.push(diagnostic) });
    assert.deepEqual(seen.map((diagnostic) => [diagnostic.code, diagnostic.path]), [["unresolved-font-scheme", "design.fontScheme"]]);
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
    composeSlide(deck.slides[0], resolveSlideContext(deck, 0, { fonts: { textMeasurement: direct.textMeasurement } }).options);
    validate(deck, { only: ["layout"], fonts: { textMeasurement: viaValidate.textMeasurement } });
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
    const { presentation } = paginate(deck, { onDiagnostic: (diagnostic) => seen.push([diagnostic.code, diagnostic.path]) });
    assert.equal(presentation.slides.length, 2);
    assert.deepEqual(seen, [["unresolved-theme", "design.theme"], ["unresolved-color-scheme", "design.colorScheme"], ["unresolved-layout", "slides.0.layout"]]);
    assert.doesNotThrow(() => paginateSlide({ layout: "no-such-layout", title: "x", text: "y" }));
  });
});
