// FF-35 (font-fidelity-everywhere): one shared last-resort font scheme, aptos, for
// every engine. A custom theme without a font scheme previews in the same fonts
// that core pagination, opf-editor and opf-pptx export use, and takes the same
// Aptos substitution path as a document with no design at all.
import assert from 'node:assert/strict';
import * as core from '@openpresentation/opf';
import { engineDefaults, renderSvg, svgToPng } from '../dist/index.js';
import { prepareNodeFonts } from '../dist/fonts-node.js';

assert.equal(engineDefaults.fontScheme.pptx.latin, 'aptos');
// Parity with core's exported constant once the installed core publishes it.
if ('DEFAULT_FONT_SCHEME' in core) assert.equal(engineDefaults.fontScheme.pptx.latin, core.DEFAULT_FONT_SCHEME);
// Kept only as the default for a future Google Slides target; no renderer path reads it.
assert.equal(engineDefaults.fontScheme.google.latin, 'roboto');

const slide = { id: 't', title: 'Quarterly operating review', text: 'Revenue grew in every region.' };
const bare = { $schema: 'https://openpresentation.org/schema/opf-theme/v1', id: 'bare', name: 'Bare' };
const custom = { name: 'Theme without font scheme', design: { theme: 'bare' }, catalogs: { themes: { records: [bare] } }, slides: [slide] };
const noDesign = { name: 'No design', slides: [slide] };
const families = svg => [...new Set([...svg.matchAll(/font-family="([^"]+)"/g)].map(match => match[1]))].sort();

// Estimated layout: the SVG names the Aptos families, as the default minimal theme does.
assert.deepEqual(families(renderSvg(custom)), ['Aptos Display, sans-serif', 'Aptos, sans-serif']);
assert.deepEqual(families(renderSvg(custom)), families(renderSvg(noDesign)));
// A deck font scheme still wins over the last resort.
assert.deepEqual(families(renderSvg({ ...custom, design: { theme: 'bare', fontScheme: 'roboto' } })), ['Roboto, sans-serif']);
// Aptos is not openly licensed and is not bundled. The default raster engine draws the
// unavailable family with its bundled sans-serif fallback.
assert.ok((await svgToPng(renderSvg(custom), { scale: 0.25 })).byteLength > 0);

// Measured layout takes the existing Aptos path: the office pack's visual substitute (Carlito).
const visual = await prepareNodeFonts({ pack: 'office', substitutionPolicy: 'visual' });
const measured = renderSvg(custom, visual.options);
assert.deepEqual(families(measured), ['Carlito, sans-serif']);
assert.deepEqual(
  visual.registry.substitutions.map(entry => `${entry.requestedFamily}->${entry.resolvedFamily}:${entry.compatibility}`).sort(),
  ['Aptos Display->Carlito:visual', 'Aptos->Carlito:visual'],
);
visual.registry.clearSubstitutions();
assert.deepEqual(families(renderSvg(noDesign, visual.options)), families(measured));
assert.deepEqual(visual.registry.substitutions.map(entry => entry.requestedFamily).sort(), ['Aptos', 'Aptos Display']);
// Without a visual substitution policy there is no metric Aptos substitute, so measured
// preview fails explicitly, exactly as it already does for a document with no design.
const metric = await prepareNodeFonts({ pack: 'office' });
for (const deck of [custom, noDesign]) assert.throws(() => renderSvg(deck, metric.options), { code: 'font-unavailable' });

console.log('shared default font scheme (aptos): estimated and measured previews match the default theme path');
