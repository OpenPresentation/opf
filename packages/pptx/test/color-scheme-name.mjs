// The inline ColorScheme's `name` is the theme's color scheme name in the export (a:clrScheme name), which PowerPoint
// lists under Design, Variants, Colors. Without it an object with `id` writes that id, and otherwise 'OpenPresentation'.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {validate} from '@openpresentation/opf';
import {toPptx} from '../dist/index.js';

const schemeName = async (colorScheme) => {
  const deck = {name: 'Palette', design: {colorScheme}, slides: [{title: 'Palette'}]};
  assert.deepEqual(validate(deck, {only: ['format']}).findings.filter(finding => finding.severity === 'error'), [], JSON.stringify(colorScheme));
  const out = await toPptx(deck);
  return strFromU8(unzipSync(out.bytes ?? out)['ppt/theme/theme1.xml']).match(/<a:clrScheme name="([^"]*)"/)?.[1];
};
assert.equal(await schemeName({id: 'boost', name: 'Harbour'}), 'Harbour');
assert.equal(await schemeName({name: 'Acme 2026', accent1: '#1F5AA6'}), 'Acme 2026');
assert.equal(await schemeName({id: 'boost'}), 'boost');
assert.equal(await schemeName({accent1: '#1F5AA6'}), 'OpenPresentation');
console.log('color scheme name: ok');
