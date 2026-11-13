import assert from 'node:assert/strict';
import {loadFonts} from '../dist/fonts-node.js';
import {toSvg} from '../dist/index.js';
import {gallery} from '@openpresentation/gallery';
const {registry} = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const text = 'STEM lab funding: build, test, discover';
for (const family of ['Segoe UI Light', 'Segoe UI Semilight']) {
  for (const [requestedWeight, expectedWeight] of [[400, 300], [700, 400]]) {
    const style = {fontFamily: family, fontWeight: requestedWeight};
    const resolved = registry.resolveFont(style);
    assert.equal(resolved.resolvedFamily, 'Red Hat Display');
    assert.equal(resolved.resolvedWeight, expectedWeight, family + ' ' + requestedWeight);
    assert.equal(resolved.compatibility, 'visual');
    assert.equal(registry.textMeasurement.measure(text, 42, style), registry.textMeasurement.measure(text, 42, {fontFamily: 'Red Hat Display', fontWeight: expectedWeight}));
  }
}
assert.equal(registry.resolveFont({fontFamily: 'Segoe UI Semibold', fontWeight: 400}).resolvedWeight, 600);
assert.equal(registry.resolveFont({fontFamily: 'Segoe UI Semibold', fontWeight: 700}).resolvedWeight, 700);
assert.equal(registry.resolveFont({fontFamily: 'Arial Black', fontWeight: 700}).resolvedWeight, 900);
console.log('LH-177: Light/Semilight stay light in regular and bold; heavier named families keep their weights.');

// LH-188: a title of more than four words keeps the slide a content slide (no one-message growth onto more lines).
const svg=toSvg({design:{fontScheme:'segoe-ui-light'},slides:[{title:'Light title over a mixed paragraph',text:[{text:'Regular '},{text:'emphasis',bold:true},{text:' explicit',fontFamily:'Red Hat Display',bold:true}]}]},{fonts:{registry,textMeasurement:registry.textMeasurement},catalogs:[gallery]})[0];
assert.match(svg, /font-weight="400"[^>]*>emphasis<\/text>/);
assert.match(svg, /font-weight="700"[^>]*> explicit<\/text>/);
