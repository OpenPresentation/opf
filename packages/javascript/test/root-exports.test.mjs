import assert from "node:assert/strict";
import { describe, test } from "node:test";

import * as root from "../dist/index.js";
import * as composition from "../dist/composition.js";
import * as symbolFonts from "../dist/symbol-font-encodings.js";
import * as data from "../dist/data.js";
import * as fontPolicy from "../dist/font-policy.js";

// RR-55: the package root holds app-level names. The layout engine's names (composition, numbering, annotations,
// colour, code syntax, metric trend, patterns, chart options, script fonts, direction) live on /composition, and
// the symbol-font tables on /symbol-font-encodings. Each moved name must exist at its new home and not at the root.
const compositionNames = [
  "composeSlide", "resolveCanvasDimensions", "fitText", "fitList", "fitRichText", "wrapText", "measureText", "measureTextOutline", "placeTextLines",
  "snapFontSizeDown", "snapFontSizeUp", "FONT_SIZE_GRID_PER_PX", "MAX_COMPOSITION_DEPTH", "OPFCompositionError",
  "resolveFontFamilies", "resolveFontSchemeReference", "DEFAULT_FONT_SCHEME", "resolveTextStyle", "textWidthMeasurer",
  "layoutQuote", "layoutCode", "layoutMetric", "layoutTimeline", "layoutFurniture", "layoutCaption", "layoutFootnotes",
  "resolveSocialProfile", "resolveLogo", "PICTURE_BULLET_SCALE", "formatFurnitureDate", "formatSlideNumber", "DEFAULT_FURNITURE_DATE_FORMAT", "DEFAULT_SLIDE_NUMBER_FORMAT",
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
  "chartNumber", "formatDataNumber", "numberFormatError", "excelNumberFormat", "numberFormatFromExcel", "inlineDatasets", "inlineTableData", "inlineChartData", "isDatasetRef", "isXYChartType",
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
    for (const name of ["stats", "resolveSlideContext", "paginatePresentation", "paginateSlide", "bundlePresentation", "createDataContent", "parseTabularData", "resolveVariables", "listVariables", "catalogs", "schemas"]) assert.equal(typeof root[name] === "function" || typeof root[name] === "object", true, name);
    for (const name of dataNames) { assert.equal(typeof root[name], "function", name); assert.equal(root[name], data[name], name); }
    for (const name of ["FONT_POLICY", "fontPolicyFor", "applyFontPolicyDecisions", "fontAvailabilityDiagnostics"]) { assert.notEqual(root[name], undefined, name); assert.equal(root[name], fontPolicy[name], name); }
  });

  test("a name exported from two entries is the same binding", () => {
    for (const name of ["paragraphDirection", "physicalAlignment", "formatListNumber", "resolveChartData", "chartNumber"]) {
      const home = composition[name];
      if (home !== undefined && root[name] !== undefined) assert.equal(root[name], home, name);
    }
    assert.equal(composition.resolveChartData, data.resolveChartData);
  });
});
