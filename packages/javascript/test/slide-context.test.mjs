import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { OPFPaginationError, paginatePresentation, paginateSlide, resolveSlideContext } from "../dist/index.js";
import { DEFAULT_FONT_SCHEME, composeSlide, layoutCode, layoutFurniture, layoutMetric, layoutQuote, layoutTimeline, resolveFontFamilies } from "../dist/composition.js";
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
    assert.equal(options.contentAlignment, "center");
    assert.equal(options.titleAlignment, "right");
    assert.equal(options.contentBox, true);
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

  test("an unresolved layout or theme reports a diagnostic and leaves the record empty", () => {
    const deck = { design: { theme: "no-such-theme" }, slides: [{ layout: "no-such-layout", title: "x" }] };
    const { options, diagnostics, resolved } = resolveSlideContext(deck, 0);
    assert.deepEqual(diagnostics.map((item) => [item.code, item.path, item.id]), [
      ["unresolved-theme", "design.theme", "no-such-theme"],
      ["unresolved-layout", "slides.0.layout", "no-such-layout"],
    ]);
    assert.equal("layout" in options, false);
    assert.deepEqual(resolved.theme, {});
    // An inline theme with fields of its own is a resolved reference even when its id matches nothing.
    assert.deepEqual(resolveSlideContext({ design: { theme: { id: "mine", dimensions: "letter" } }, slides: [{}] }, 0).diagnostics, []);
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
    paginatePresentation(structuredClone(deck), { fonts: { textMeasurement: direct.textMeasurement } });
    composeSlide(deck.slides[0], resolveSlideContext(deck, 0, { fonts: { textMeasurement: viaContext.textMeasurement } }).options);
    assert.deepEqual([...direct.used].sort(), [...viaContext.used].sort());
    const seen = [];
    paginatePresentation({ design: { fontScheme: "nope" }, slides: [{ title: "x" }, { title: "y" }] }, { onDiagnostic: (diagnostic) => seen.push(diagnostic) });
    assert.deepEqual(seen.map((diagnostic) => [diagnostic.code, diagnostic.path]), [["unresolved-font-scheme", "design.fontScheme"]]);
  });
});

describe("the fonts option on deck-level verbs", () => {
  const deck = () => ({ slides: [{ title: "Measured", text: "word ".repeat(30) }] });

  test("paginatePresentation and paginateSlide measure with fonts.textMeasurement", () => {
    const deckRecorder = recorder(), slideRecorder = recorder();
    paginatePresentation(deck(), { fonts: { textMeasurement: deckRecorder.textMeasurement } });
    assert.ok(deckRecorder.used.size > 0, "paginatePresentation measured nothing");
    paginateSlide(deck().slides[0], { fonts: { textMeasurement: slideRecorder.textMeasurement } });
    assert.ok(slideRecorder.used.size > 0, "paginateSlide measured nothing");
  });

  test("a wider measurement paginates more pages: the handle changes the result", () => {
    const text = "word ".repeat(220);
    const source = { slides: [{ title: "T", text }] };
    const narrow = paginatePresentation(source, { fonts: { textMeasurement: { measure: (value, size) => value.length * size * 0.2 } } });
    const wide = paginatePresentation(source, { fonts: { textMeasurement: { measure: (value, size) => value.length * size * 0.9 } } });
    assert.ok(wide.presentation.slides.length > narrow.presentation.slides.length, `${wide.presentation.slides.length} pages vs ${narrow.presentation.slides.length}`);
  });

  test("a richer handle works as-is: only textMeasurement is read", () => {
    const handle = { ...recorder(), embeddedFonts: [], fontFiles: [], useBundledFonts: false, registry: {}, manifest: {} };
    assert.doesNotThrow(() => paginatePresentation(deck(), { fonts: handle }));
  });

  test("a top-level textMeasurement is rejected instead of silently measuring with estimates", () => {
    const measurement = recorder().textMeasurement;
    assert.throws(() => paginatePresentation(deck(), { textMeasurement: measurement }), /pass the fonts handle as \{ fonts \}/);
    assert.throws(() => paginateSlide(deck().slides[0], { textMeasurement: measurement }), TypeError);
  });

  test("an unresolved layout, or an unresolved theme, stops pagination with a pagination error", () => {
    assert.throws(() => paginatePresentation({ slides: [{ layout: "not-local", text: "x" }] }), OPFPaginationError);
    assert.throws(() => paginatePresentation({ design: { theme: "no-such-theme" }, slides: [{ text: "x" }] }), OPFPaginationError);
  });

  test("engine functions take fontFamilies and reject a stale fonts option instead of drawing with default families", () => {
    const slide = { title: "T", text: "body" };
    assert.throws(() => composeSlide(slide, { fonts: { heading: "Roboto", body: "Roboto" } }), /fontFamilies/);
    assert.throws(() => composeSlide(slide, { fonts: { textMeasurement: recorder().textMeasurement } }), TypeError);
    for (const layout of [layoutQuote, layoutMetric, layoutCode, layoutTimeline]) assert.throws(() => layout("x", { x: 0, y: 0, width: 300, height: 200 }, { fonts: { body: "Roboto" } }), TypeError, layout.name);
    assert.throws(() => layoutFurniture(slide, { fonts: { body: "Roboto" } }), TypeError);
    assert.doesNotThrow(() => composeSlide(slide, { fontFamilies: { heading: "Roboto", body: "Roboto" } }));
  });
});
