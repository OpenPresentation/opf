import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as root from "../dist/index.js";
import * as composition from "../dist/composition.js";
import * as symbolFonts from "../dist/symbol-font-encodings.js";
import * as data from "../dist/data.js";
import * as fontPolicy from "../dist/font-policy.js";
import * as pagination from "../dist/pagination.js";
import * as validator from "../dist/validator.js";
import * as patch from "../dist/patch.js";
import * as diffModule from "../dist/diff.js";
import * as formatModule from "../dist/format.js";
import * as markdown from "../dist/markdown.js";

// RR-55: the package root holds app-level names. The layout engine's names (composition, numbering, annotations,
// colour, code syntax, metric trend, patterns, chart options, script fonts, direction) live on /composition, and
// the symbol-font tables on /symbol-font-encodings. Each moved name must exist at its new home and not at the root.
const compositionNames = [
  "composeSlide", "resolveCanvasDimensions", "fitText", "fitList", "fitRichText", "wrapText", "measureText", "measureTextOutline", "placeTextLines",
  "snapFontSizeDown", "snapFontSizeUp", "FONT_SIZE_GRID_PER_PX", "MAX_COMPOSITION_DEPTH", "OPFCompositionError",
  "resolveFontFamilies", "resolveTextStyle", "textWidthMeasurer",
  "layoutQuote", "layoutCode", "layoutMetric", "layoutTimeline", "layoutFurniture", "layoutCaption", "layoutFootnotes",
  "resolveSocialProfile", "resolveLogo", "PICTURE_BULLET_SCALE", "formatFurnitureDate", "DEFAULT_FURNITURE_DATE_FORMAT",
  "NUMBERING_STYLES", "NUMBERING_SUFFIXES", "MAX_NUMBERING_VALUE", "MAX_ROMAN_VALUE", "MAX_NUMBERING_LEVELS", "formatListNumber", "listNumbers", "resolveNumbering", "numberingAtLevel", "numberingStyleDraws", "sliceNumberedItems",
  "CAPTIONABLE_FIELDS", "CAPTION_FONT_RATIO", "CAPTION_MAX_RATIO", "CITATION_MARKER_RAISE", "CITATION_MARKER_SCALE", "FOOTNOTE_MAX_RATIO", "annotationText", "captionSettings", "citationMarkerText", "collectCitations", "referencesSlide", "slideCitations", "walkCitationRuns",
  "colorContrast", "textColorForFill", "chartColorForFill", "chartPaletteForFill", "normalizeHexColor", "resolveColorRef", "CHART_SERIES_MIN_DIFFERENCE", "CHART_SERIES_MIN_LIGHTNESS_STEP",
  "CODE_HIGHLIGHT_LANGUAGES", "CODE_HIGHLIGHT_MAX_LENGTH", "CODE_PANEL_BACKGROUND", "CODE_PANEL_FOREGROUND", "CODE_SYNTAX_MIN_CONTRAST", "codeLineRuns", "codeSyntaxPalette", "codeSyntaxPaletteForScheme", "resolveCodeLanguage", "tokenizeCode",
  "METRIC_TREND_MIN_CONTRAST", "METRIC_TREND_SHAPES", "metricTrendColor", "metricTrendMark", "metricTrendPoints",
  "PATTERN_PRESETS", "PATTERN_PRESET_ALIASES", "PATTERN_TILE_SIZE", "patternBitmap", "patternRuns", "resolvePatternPreset",
  "chartOptionSupport", "chartOptionTarget", "resolveChartOptions", "formatChartLabelNumber", "formatChartLabelPercent", "chartLabelText", "DEFAULT_CHART_LABEL_SEPARATOR",
  "resolveScriptFonts", "resolveSlideDirection", "scriptFontRole", "paragraphDirection", "paragraphDirectionAt", "physicalAlignment",
];
const symbolNames = ["SYMBOL_FONT_ENCODINGS", "SYMBOL_FONT_FAMILIES", "symbolFontEncodingFor", "isSymbolEncodedFamily", "symbolCodeOf", "symbolUnicodeFor", "symbolCodeForUnicode", "mapSymbolText"];
// App-level data helpers stay at the root (the editor and hosts call them) and on /data.
const dataNames = [
  "chartNumber", "formatDataNumber", "numberFormatError", "toExcelNumberFormat", "fromExcelNumberFormat", "inlineDatasets", "inlineTableData", "inlineChartData", "isDatasetRef", "isXYChartType",
  "resolveChartData", "resolveTableData", "tableCellDisplayValue", "datasetDiagnostics", "unusedDatasets", "suggestChartNumberFix",
];

describe("package root", () => {
  test("no layout-engine name is exported from the root", () => {
    const leaked = [...compositionNames, ...symbolNames].filter((name) => name in root);
    assert.deepEqual(leaked, []);
  });

  test("every moved engine name is on /composition (or /symbol-font-encodings)", () => {
    assert.deepEqual(compositionNames.filter((name) => composition[name] === undefined), []);
    assert.deepEqual(symbolNames.filter((name) => symbolFonts[name] === undefined), []);
  });

  test("the app-level verbs, data helpers and font policy stay at the root", () => {
    for (const name of ["stats", "resolveSlideContext", "paginate", "paginateSlide", "embed", "copySlides", "updateFromCatalog", "ingest", "parseTabularData", "resolveVariables", "resolveSlideVariables", "listVariables", "schemas"]) assert.equal(typeof root[name] === "function" || typeof root[name] === "object", true, name);
    for (const name of dataNames) { assert.equal(typeof root[name], "function", name); assert.equal(root[name], data[name], name); }
    for (const name of ["FONT_POLICY", "fontPolicyFor", "applyFontPolicyDecisions", "fontAvailabilityDiagnostics"]) { assert.notEqual(root[name], undefined, name); assert.equal(root[name], fontPolicy[name], name); }
  });

  test("a name exported from two entries is the same binding", () => {
    // The catalog references and the engine defaults and vocabularies are on both: hosts resolve at the root, engines on /composition.
    for (const name of ["resolveReference", "parseReference", "catalogRecords", "catalogKinds", "OPFUnresolvedReferenceError", "ENGINE_DEFAULT_THEME", "ENGINE_DEFAULT_COLOR_SCHEME", "ENGINE_DEFAULT_FONT_SCHEME", "CHART_TYPES", "SOCIAL_PLATFORMS", "LANGUAGES"]) {
      assert.notEqual(composition[name], undefined, `composition.${name}`);
      assert.equal(root[name], composition[name], name);
    }
    for (const name of ["paragraphDirection", "physicalAlignment", "formatListNumber", "resolveChartData", "chartNumber"]) {
      const home = composition[name];
      if (home !== undefined && root[name] !== undefined) assert.equal(root[name], home, name);
    }
    assert.equal(composition.resolveChartData, data.resolveChartData);
  });
});

// RR-55: the verbs of the CLI are exported from the root and keep their subpaths. Hosts (render, PPTX, editor, the CLI)
// feature-detect some of these names with typeof, so a rename that drops one must fail here, not silently turn a feature off.
const verbs = {
  validate: validator, assertValid: validator, paginate: pagination, paginateSlide: pagination, embed: root, copySlides: root, updateFromCatalog: root,
  diff: diffModule, merge: diffModule, format: formatModule, fromMarkdown: markdown, toMarkdown: markdown,
  applyPatch: patch, ingest: data, resolveVariables: root, toExcelNumberFormat: data, fromExcelNumberFormat: data,
};
const errorClasses = { OPFPatchError: patch, OPFPatchValidationError: patch, OPFFormatError: formatModule, OPFMarkdownError: markdown, OPFValidationError: validator, OPFPaginationError: pagination };
const removed = [
  "paginatePresentation", "bundlePresentation", "formatPresentation", "diffPresentations", "mergePresentations", "markdownToOpf", "opfToMarkdown",
  "createDataContent", "excelNumberFormat", "numberFormatFromExcel", "PatchError", "PatchValidationError", "FormatError",
  "validatePresentation", "assertValidPresentation", "lintSource", "lintPresentation", "auditSource", "auditPresentation",
  // OPF 0.15 (FA-20): embed replaces bundle; font schemes resolve like every content reference, with an engine default record.
  "bundle", "resolveFontSchemeReference", "DEFAULT_FONT_SCHEME",
];

describe("the short verbs", () => {
  test("every verb of the CLI is a function at the root and is the binding of its subpath", () => {
    for (const [name, home] of Object.entries(verbs)) {
      assert.equal(typeof root[name], "function", `root.${name}`);
      assert.equal(root[name], home[name], `${name} on its subpath`);
    }
    assert.equal(typeof root.stats, "function");
    assert.equal(typeof root.resolveSlideContext, "function");
  });

  test("the error classes keep the OPF prefix at the root and on their subpath", () => {
    for (const [name, home] of Object.entries(errorClasses)) {
      assert.equal(typeof root[name], "function", name);
      assert.equal(root[name], home[name], name);
    }
  });

  test("an old name is gone from the root and from every subpath", () => {
    for (const name of removed) for (const [label, entry] of Object.entries({ root, composition, data, pagination, validator, patch, diff: diffModule, format: formatModule, markdown }))
      assert.equal(entry[name], undefined, `${label}.${name}`);
  });

  test("the result fields that named the deck say presentation", () => {
    const converted = root.fromMarkdown("# One\n");
    assert.deepEqual(Object.keys(converted).sort(), ["checks", "counts", "findings", "presentation", "schemaValid", "valid"]);
    const patched = patch.applyPatchWithInverse({ slides: [{ title: "A" }] }, [{ op: "replace", path: "/slides/0/title", value: "B" }]);
    assert.equal(patched.presentation.slides[0].title, "B");
    assert.equal("document" in patched, false);
  });
});
