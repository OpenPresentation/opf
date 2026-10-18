// Ordinary examples retain exact baselines for both known core metric-default contracts.
import assert from 'node:assert/strict';

export const LEGACY_EXAMPLE_BASELINE = 'test/golden/opf-examples-png.rr20-array-areas.sha256.json';
export const CENTERED_EXAMPLE_BASELINE = 'test/golden/opf-examples-png.rr85-metric-centering.sha256.json';
// RR-90/91/93 (core 0.22): the first-use layout (table text at the body size, footer zones on the content inset). The reviewed
// rr85 fixture keeps its exact bytes (test/example-baseline.mjs); this one is regenerated for core 0.22 by `regenerate-goldens`.
export const FIRST_USE_EXAMPLE_BASELINE = 'test/golden/opf-examples-png.rr90-first-use-layout.sha256.json';
/** The table cell size (px) of core before RR-90, which asked for 15 px and was floored to 16 px. */
export const LEGACY_TABLE_TEXT_SIZE = 16;

export function exampleBaseline(alignment, tableSize = LEGACY_TABLE_TEXT_SIZE) {
  assert.ok(alignment === 'left' || alignment === 'center', `Unknown metric default alignment: ${alignment}`);
  assert.ok(Number.isFinite(tableSize) && tableSize > 0, `Unknown table text size: ${tableSize}`);
  if (alignment === 'left') return LEGACY_EXAMPLE_BASELINE;
  return tableSize > LEGACY_TABLE_TEXT_SIZE ? FIRST_USE_EXAMPLE_BASELINE : CENTERED_EXAMPLE_BASELINE;
}
