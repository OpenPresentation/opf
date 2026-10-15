// Exact template baselines for the two known metric-default contracts. Unknown defaults fail closed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

export const LEGACY_TEMPLATE_BASELINE = 'test/golden/layout-templates-rr20-array-areas.json';
export const CENTERED_TEMPLATE_BASELINE = 'test/golden/layout-templates-rr85-metric-centering.json';
export function templateBaseline(alignment) {
  assert.ok(alignment === 'left' || alignment === 'center', `Unknown metric default alignment: ${alignment}`);
  return alignment === 'center' ? CENTERED_TEMPLATE_BASELINE : LEGACY_TEMPLATE_BASELINE;
}
export function readTemplateBaseline(root, alignment, {update = false} = {}) {
  const selected = templateBaseline(alignment);
  let comparison = selected, bytes;
  try { bytes = readFileSync(path.join(root, selected), 'utf8'); }
  catch (error) {
    // Candidate generation can show the complete delta from the old approved baseline.
    // Normal verification must require the baseline for the actual composition contract.
    if (error.code !== 'ENOENT' || !update || selected === LEGACY_TEMPLATE_BASELINE) throw error;
    comparison = LEGACY_TEMPLATE_BASELINE;
    bytes = readFileSync(path.join(root, comparison), 'utf8');
  }
  return {selected, comparison, previous: JSON.parse(bytes)};
}
