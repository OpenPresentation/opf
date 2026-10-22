// MR-31: the baseline the renderer compares the repository's examples with. The contract is read off the workspace core
// (metric default, table and chart text size, scheme neutrals, color variants), so core and renderer in one checkout always
// agree on it, and `test/golden.mjs` (the gate) and `scripts/golden-promote.mjs` (the promoter) select the same directory.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {layoutMetric} from '@openpresentation/opf/composition';
import {exampleBaseline} from './example-baseline.mjs';
import {chartTextSizeDefault, schemeNeutralsDerived, colorVariantsDerived, tableTextSize} from './template-baseline.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** The default example baseline of this checkout, relative to the package (`test/golden/<name>.sha256.json`, the directory form selects `<name>/`). */
export function defaultExampleBaseline() {
  return exampleBaseline(layoutMetric(1, {x: 0, y: 0, width: 400, height: 300}).alignment, tableTextSize(), chartTextSizeDefault(), schemeNeutralsDerived(), colorVariantsDerived());
}
/** Absolute path of the default example baseline. */
export function defaultExampleBaselinePath() { return path.join(root, defaultExampleBaseline()); }
