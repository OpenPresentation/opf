import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import * as core from '@openpresentation/opf';
import * as composition from '@openpresentation/opf/composition';

// RR-55: every core name this package uses must exist on the entry it imports it from. A name that moved (the engine names
// left the root for /composition in core 0.14) or was renamed fails the import loudly, and this test names it: the package
// never feature-detects a core function, so a missing one cannot switch a feature off silently.
const entries = {'@openpresentation/opf': core, '@openpresentation/opf/composition': composition};
const source = new URL('../src/', import.meta.url);
const used = new Map();
for (const file of readdirSync(source).filter(name => name.endsWith('.js'))) {
  const text = readFileSync(new URL(file, source), 'utf8');
  for (const [, list, specifier] of text.matchAll(/\b(?:import|export)\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"](@openpresentation\/opf(?:\/[\w-]+)?)['"]/g)) {
    if (!Object.hasOwn(entries, specifier)) continue;
    for (const item of list.split(',').map(part => part.trim()).filter(Boolean)) {
      const name = item.split(/\s+as\s+/)[0].trim();
      used.set(`${specifier}#${name}`, {specifier, name, file});
    }
  }
  // A namespace import would hide the names it reads; the package uses named imports only.
  assert.ok(!/import\s+\*\s+as\s+\w+\s+from\s+['"]@openpresentation\/opf(?:\/composition)?['"]/.test(text), `${file}: use named imports from core so this test sees every name`);
}
assert.ok(used.size >= 30, `found ${used.size} core imports in src`);

const missing = [...used.values()].filter(({specifier, name}) => entries[specifier][name] === undefined);
assert.deepEqual(missing.map(({specifier, name, file}) => `${name} from ${specifier} (${file})`), [], 'core exports every name src imports');

// The names whose absence used to switch a feature off silently, by the entry that exports them in core 0.14.
const required = {
  '@openpresentation/opf': ['validate', 'resolveVariables', 'isTemplate', 'hasContentVariables', 'resolveSlideContext', 'toExcelNumberFormat', 'fromExcelNumberFormat',
    'chartNumber', 'resolveChartData', 'resolveTableData', 'inlineChartData', 'inlineTableData', 'isDatasetRef', 'tableCellDisplayValue', 'validateCatalogRecord', 'schemas'],
  '@openpresentation/opf/composition': ['composeSlide', 'resolveScriptFonts', 'paragraphDirection', 'physicalAlignment', 'resolveSocialProfile', 'resolveColorRef', 'tokenizeCode',
    'codeSyntaxPaletteForScheme', 'codeLineRuns', 'metricTrendMark', 'resolveChartOptions', 'chartOptionSupport', 'chartOptionTarget', 'textColorForFill', 'chartPaletteForFill',
    // FA (0.14): colour roles, text watermark, code highlight, timeline status and chart highlight.
    'resolveColorRoles', 'defaultSlideBackground', 'layoutWatermark', 'codeHighlightLines', 'codeHighlightBands', 'codeHighlightColors', 'codeLineNumbers', 'timelineMarkerShapes',
    'timelineTextColor', 'chartHighlightMarks', 'chartHighlightColors',
    // FA-23 (0.15): reference resolution against registered catalogs, and the engine default font scheme.
    'resolveReference', 'catalogRecords', 'parseReference', 'ENGINE_DEFAULT_FONT_SCHEME'],
};
for (const [specifier, names] of Object.entries(required)) {
  for (const name of names) {
    assert.notEqual(entries[specifier][name], undefined, `${specifier} exports ${name}`);
    assert.ok(used.has(`${specifier}#${name}`) || name === 'schemas', `src imports ${name} from ${specifier}`);
  }
}

// OPF 0.15: core's root carries no catalog data (test/fa-23-catalogs.mjs checks src never imports the opt-in snapshot).
assert.equal(core.catalogs, undefined, 'core 0.15 has no root `catalogs` export');

// The engine names are on /composition only: a root import of one would be the silent switch-off this test exists to catch.
for (const name of ['composeSlide', 'resolveScriptFonts', 'paragraphDirection', 'tokenizeCode', 'metricTrendMark', 'resolveChartOptions', 'resolveSocialProfile', 'resolveColorRef', 'resolveColorRoles', 'layoutWatermark', 'codeHighlightLines', 'timelineMarkerShapes', 'chartHighlightMarks']) {
  assert.equal(core[name], undefined, `${name} is not a root export of core 0.14`);
  assert.equal(typeof composition[name], 'function', `${name} is exported by /composition`);
}

console.log(JSON.stringify({test: 'core-features', passed: true, coreImports: used.size}));
