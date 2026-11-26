// FR-07, part 3 (supervisor's addition 1): a metric without a gauge draws and exports byte for byte as before the gauge. The digests below are
// the PowerPoint export (with the default catalog and without one) and the SVG preview of helpers/metrics-deck.mjs as 572449431 (the base of
// the gauge, before it) wrote them; the gauge's change was measured to leave every one equal. A later change that moves these bytes on
// purpose re-pins them in that change and says why.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gallery} from '@openpresentation/gallery';
import {toSvg} from '@openpresentation/opf-render';
import {toPptx} from '../dist/index.js';
import {metricsDeck} from './helpers/metrics-deck.mjs';

const BEFORE = {
  'metrics.pptx': '5e6e71c4c149d2a5869a10aa5ea5c7ebcde8bef234d73be34b3382a5a8068812',
  'metrics.pptx-default': 'ab4cc25a072d16d005b497e13ab3485ae3c4d6e85a45bc52a5e1cd77c72604ea',
  'metrics.svg': 'b2b42cdb10862b6518de8a3be5d964c9b6285d871d857419d6f15a9da2025697',
  'rtl.pptx': '4e3187066de54e6728788cfd234c2d7293af853f1d9e1c6ca868b01af2d55ab1',
  'rtl.pptx-default': 'd4dfb308a1ae682ed7b4858c095ad8c10267273c6a326bb224300ac760268330',
  'rtl.svg': 'a860f70e82de5812d16c9eabd8ae2fa8e390558578c6763d0315161b3b35375f',
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const now = {};
for (const [name, deck] of Object.entries(metricsDeck)) {
  now[`${name}.pptx`] = sha(await toPptx(structuredClone(deck), {catalogs: [gallery]}));
  now[`${name}.pptx-default`] = sha(await toPptx(structuredClone(deck)));
  now[`${name}.svg`] = sha(toSvg(structuredClone(deck), {catalogs: [gallery]}).join('\n'));
}
assert.deepEqual(now, BEFORE, 'a deck of metrics without a gauge exports and draws the bytes it did before the gauge');
console.log('fr-07 gauge unchanged: ok');
