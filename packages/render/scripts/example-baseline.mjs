// Ordinary examples retain exact baselines for both known core metric-default contracts.
import assert from 'node:assert/strict';

export const LEGACY_EXAMPLE_BASELINE = 'test/golden/opf-examples-png.rr20-array-areas.sha256.json';
export const CENTERED_EXAMPLE_BASELINE = 'test/golden/opf-examples-png.rr85-metric-centering.sha256.json';

export function exampleBaseline(alignment) {
  assert.ok(alignment === 'left' || alignment === 'center', `Unknown metric default alignment: ${alignment}`);
  return alignment === 'center' ? CENTERED_EXAMPLE_BASELINE : LEGACY_EXAMPLE_BASELINE;
}
