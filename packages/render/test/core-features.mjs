// RR-55: every core export the renderer uses is present, so a feature cannot switch itself off without a failing test.
// The renderer imports core by name (`import { resolveScriptFonts } from "@openpresentation/opf/composition"`), so a missing export
// already stops the module from loading; this test lists them anyway, and also checks that no source file feature-detects a core
// export (`typeof core.x === "function"`, `"x" in core`), which is how right-to-left text, script fonts, pattern fills, code colours,
// chart options, citations and numbered lists used to disappear silently when a name moved between core entries.
// OPF 0.15 (FA-21/23): the renderer registers no catalog of its own (hosts pass core `Catalog[]`), so it needs no catalog export
// and no source file imports `@openpresentation/opf/catalog`; what it falls back to is core's engine defaults.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '@openpresentation/opf';
import * as composition from '@openpresentation/opf/composition';
import * as fontPolicy from '@openpresentation/opf/font-policy';
import * as pagination from '@openpresentation/opf/pagination';
import * as symbols from '@openpresentation/opf/symbol-font-encodings';
import * as fonts from '../dist/fonts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// What the renderer feature-detected before 0.14, by the feature that disappears when the name is missing.
const REQUIRED = {
  '@openpresentation/opf': {
    'template variables': ['resolveVariables', 'isTemplate', 'hasContentVariables'],
    'the slide context (fonts, canvas, theme, colour scheme)': ['resolveSlideContext'],
    'the boundary check': ['validate'],
  },
  '@openpresentation/opf/composition': {
    'engine defaults (FA-21)': ['ENGINE_DEFAULT_THEME', 'ENGINE_DEFAULT_COLOR_SCHEME', 'ENGINE_DEFAULT_FONT_SCHEME', 'ENGINE_DEFAULT_CHART_TYPES'],
    'layout': ['composeSlide', 'layoutTable', 'fitText', 'fitList', 'fitRichText', 'resolveTextStyle', 'textWidthMeasurer', 'resolveCanvasDimensions', 'resolveFontFamilies'],
    'script fonts and the language model': ['resolveScriptFonts', 'scriptFontRole'],
    'right-to-left text': ['paragraphDirection', 'physicalAlignment'],
    'pattern fills': ['patternRuns', 'patternBitmap', 'PATTERN_PRESETS'],
    'metric trend arrows': ['metricTrendMark', 'metricTrendColor'],
    'code colouring': ['tokenizeCode', 'codeLineRuns', 'codeSyntaxPaletteForScheme', 'resolveCodeLanguage'],
    'colour references and contrast': ['resolveColorRef', 'colorContrast', 'textColorForFill', 'chartColorForFill', 'chartPaletteForFill'],
    'colour roles (FA-05)': ['resolveColorRoles', 'defaultSlideBackground'],
    'timeline status colours (FA-11)': ['timelineMarkerShapes', 'timelineTextColor'],
    'text watermark (FA-13)': ['layoutWatermark'],
    'code line highlight (FA-13)': ['codeHighlightLines', 'codeHighlightBands', 'codeHighlightColors', 'codeLineNumbers'],
    'chart highlight (FA-14)': ['chartHighlightMarks', 'chartHighlightColors'],
    'chart options': ['resolveChartOptions', 'chartOptionSupport', 'chartOptionTarget', 'formatChartLabelNumber', 'formatChartLabelPercent', 'chartLabelText'],
    'chart data and number formats': ['resolveChartData', 'chartNumber', 'formatDataNumber', 'numberFormatError'],
    'citations, footnotes and captions': ['collectCitations', 'layoutCaption', 'layoutFootnotes', 'referencesSlide', 'walkCitationRuns', 'captionSettings'],
    'numbered lists': ['listNumbers', 'formatListNumber', 'resolveNumbering'],
    'logos and furniture': ['resolveLogo', 'layoutFurniture'],
  },
  '@openpresentation/opf/font-policy': { 'the font policy': ['FONT_POLICY', 'fontPolicyFor'] },
  '@openpresentation/opf/pagination': { 'pagination': ['paginate', 'paginateSlide'] },
  '@openpresentation/opf/symbol-font-encodings': { 'symbol-encoded families': ['isSymbolEncodedFamily', 'symbolCodeOf', 'mapSymbolText', 'symbolFontEncodingFor', 'SYMBOL_FONT_ENCODINGS'] },
};
const namespaces = {
  '@openpresentation/opf': core,
  '@openpresentation/opf/composition': composition,
  '@openpresentation/opf/font-policy': fontPolicy,
  '@openpresentation/opf/pagination': pagination,
  '@openpresentation/opf/symbol-font-encodings': symbols,
};
for (const [specifier, features] of Object.entries(REQUIRED)) {
  for (const [feature, names] of Object.entries(features)) {
    for (const name of names) assert.notEqual(namespaces[specifier][name], undefined, `${specifier} must export ${name} (${feature})`);
  }
}
for (const name of ['resolveScriptFonts', 'paragraphDirection', 'patternRuns', 'metricTrendMark', 'tokenizeCode', 'resolveChartOptions', 'collectCitations', 'listNumbers']) {
  assert.equal(typeof composition[name], 'function', `${name} is a function on /composition`);
  assert.equal(core[name], undefined, `${name} left the root: the renderer must read /composition`);
}
for (const name of ['resolveVariables', 'resolveSlideContext', 'validate']) assert.equal(typeof core[name], 'function', `${name} is a function on the root`);

// Every named import of a core entry in src/ resolves, whatever the list above says.
const sourceFiles = readdirSync(path.join(root, 'src')).filter((name) => name.endsWith('.js'));
let checked = 0;
for (const file of sourceFiles) {
  const text = readFileSync(path.join(root, 'src', file), 'utf8');
  for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](@openpresentation\/opf(?:\/[a-z-]+)?)["']/g)) {
    const namespace = namespaces[match[2]] ?? (await import(match[2]));
    for (const item of match[1].split(',').map((part) => part.trim()).filter(Boolean)) {
      const name = item.split(/\s+as\s+/)[0];
      assert.notEqual(namespace[name], undefined, `src/${file} imports ${name} from ${match[2]}, which does not export it`);
      checked++;
    }
  }
  // No feature detection of a core export: it would switch the feature off silently.
  assert.doesNotMatch(text, /typeof\s+(?:core|opfCore|opfComposition|composition)\.\w+\s*[!=]==?\s*["']function["']/, `src/${file} feature-detects a core export`);
  assert.doesNotMatch(text, /["']\w+["']\s+in\s+(?:core|opfCore|opfComposition)\b/, `src/${file} feature-detects a core export with "in"`);
  assert.doesNotMatch(text, /import\s+\*\s+as\s+(?:core|opfCore|opfComposition)\s+from\s+["']@openpresentation\/opf/, `src/${file} reads core through a namespace; import the names it uses`);
  // The renderer is a library: the host registers catalogs, so no source file imports the gallery snapshot.
  assert.doesNotMatch(text, /(?:from|import\()\s*["']@openpresentation\/opf\/catalog["']/, `src/${file} imports a catalog; hosts register catalogs`);
}
assert.ok(checked > 40, `the source imports ${checked} core names`);

// `/fonts` re-exports core's own font-policy, symbol-code and script-slot helpers: the same objects, not copies.
assert.equal(fonts.FONT_POLICY, fontPolicy.FONT_POLICY);
assert.equal(fonts.fontPolicyFor, fontPolicy.fontPolicyFor);
assert.equal(fonts.isSymbolEncodedFamily, symbols.isSymbolEncodedFamily);
assert.equal(fonts.symbolCodeOf, symbols.symbolCodeOf);
assert.equal(fonts.mapSymbolText, symbols.mapSymbolText);
assert.equal(fonts.scriptFontRole, composition.scriptFontRole);

console.log(`Core features: ${Object.values(REQUIRED).reduce((total, features) => total + Object.values(features).flat().length, 0)} required exports, ${checked} imported names resolve, no feature detection, /fonts re-exports core's helpers.`);
