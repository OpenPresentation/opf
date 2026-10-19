// Exact template baselines for the known core contracts: the metric default (left, then center) and, since RR-90/91/93,
// the first-use layout (table cell text at the body size, footer zones on the content inset) and, since RR-89/90/92, the chart
// contract (series from the colour scheme, 20 px chart text) and, since RR-96, scheme-derived neutrals (borders, gridlines and axis lines
// are the text color mixed into the background). Unknown defaults fail closed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {chartTextSize, layoutTable, resolveColorRoles} from '@openpresentation/opf/composition';

export const LEGACY_TEMPLATE_BASELINE = 'test/golden/layout-templates-rr20-array-areas.json';
export const CENTERED_TEMPLATE_BASELINE = 'test/golden/layout-templates-rr85-metric-centering.json';
export const FIRST_USE_TEMPLATE_BASELINE = 'test/golden/layout-templates-rr90-first-use-layout.json';
export const CHART_TEMPLATE_BASELINE = 'test/golden/layout-templates-rr89-chart-palette-text.json';
export const SCHEME_NEUTRALS_TEMPLATE_BASELINE = 'test/golden/layout-templates-rr96-scheme-neutrals.json';
export const VARIANTS_TEMPLATE_BASELINE = 'test/golden/layout-templates-rr96-color-variants.json';
/** The chart text size (px) of core before RR-90: 14 px floored to the 16 px minimum. */
const LEGACY_CHART_TEXT_SIZE = 16;
/** The table cell size (px) of core before RR-90, which asked for 15 px and was floored to 16 px. */
const LEGACY_TABLE_TEXT_SIZE = 16;
/** The size core draws a short table cell at: the discriminator between the centered and the first-use contracts. */
export function tableTextSize() {
  return layoutTable({rows: [['x']]}, {x: 0, y: 0, width: 400, height: 300}).rows[0].cells[0].fit.fontSize;
}
/** The size core draws the text of a roomy chart at: the discriminator between the first-use and the chart contracts. */
export function chartTextSizeDefault() {
  return chartTextSize({width: 1200, height: 500, scale: 1});
}
/** True when core resolves the slide's roles through a variant (`roles.variant`, RR-96): the discriminator between the scheme-neutral and the variant contracts. */
export function colorVariantsDerived() {
  return typeof resolveColorRoles({}).variant === 'object';
}
/** True when core derives the neutrals from the colour scheme (`roles.neutrals`, RR-96): the discriminator between the chart and the scheme-neutral contracts. */
export function schemeNeutralsDerived() {
  return typeof resolveColorRoles({}).neutrals === 'object';
}
// The baseline each one is compared with while it does not exist yet (candidate generation only).
const PREVIOUS = new Map([[VARIANTS_TEMPLATE_BASELINE, SCHEME_NEUTRALS_TEMPLATE_BASELINE], [SCHEME_NEUTRALS_TEMPLATE_BASELINE, CHART_TEMPLATE_BASELINE], [CHART_TEMPLATE_BASELINE, FIRST_USE_TEMPLATE_BASELINE], [FIRST_USE_TEMPLATE_BASELINE, CENTERED_TEMPLATE_BASELINE], [CENTERED_TEMPLATE_BASELINE, LEGACY_TEMPLATE_BASELINE]]);
export function templateBaseline(alignment, tableSize = LEGACY_TABLE_TEXT_SIZE, chartSize = LEGACY_CHART_TEXT_SIZE, neutrals = false, variants = false) {
  assert.ok(alignment === 'left' || alignment === 'center', `Unknown metric default alignment: ${alignment}`);
  assert.ok(Number.isFinite(tableSize) && tableSize > 0, `Unknown table text size: ${tableSize}`);
  assert.ok(Number.isFinite(chartSize) && chartSize > 0, `Unknown chart text size: ${chartSize}`);
  if (alignment === 'left') return LEGACY_TEMPLATE_BASELINE;
  if (tableSize > LEGACY_TABLE_TEXT_SIZE) return chartSize > LEGACY_CHART_TEXT_SIZE ? (neutrals ? (variants ? VARIANTS_TEMPLATE_BASELINE : SCHEME_NEUTRALS_TEMPLATE_BASELINE) : CHART_TEMPLATE_BASELINE) : FIRST_USE_TEMPLATE_BASELINE;
  return CENTERED_TEMPLATE_BASELINE;
}
export function readTemplateBaseline(root, alignment, {update = false, tableSize = LEGACY_TABLE_TEXT_SIZE, chartSize = LEGACY_CHART_TEXT_SIZE, neutrals = false, variants = false} = {}) {
  const selected = templateBaseline(alignment, tableSize, chartSize, neutrals, variants);
  let comparison = selected, bytes;
  try { bytes = readFileSync(path.join(root, selected), 'utf8'); }
  catch (error) {
    // Candidate generation can show the complete delta from the previous approved baseline.
    // Normal verification must require the baseline for the actual composition contract.
    if (error.code !== 'ENOENT' || !update || !PREVIOUS.has(selected)) throw error;
    comparison = PREVIOUS.get(selected);
    bytes = readFileSync(path.join(root, comparison), 'utf8');
  }
  return {selected, comparison, previous: JSON.parse(bytes)};
}
