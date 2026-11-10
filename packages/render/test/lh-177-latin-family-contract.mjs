// LH-177: the independent Latin-host model follows the accepted named-light emphasis
// contract, without changing a directly authored parent family's bold selection.
import assert from 'node:assert/strict';
import {loadFonts} from '../dist/fonts-node.js';
import {toSvg} from '../dist/index.js';
import {expectedFace, familyDeck, latinFamilies, neededFaces, runFace} from './latin-family-fixture.mjs';

const {registry} = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const entries = latinFamilies();
for (const family of ['Segoe UI Light', 'Segoe UI Semilight']) {
  const entry = entries.find(row => row.family === family);
  assert.ok(entry, family);
  for (const italic of [false, true]) {
    for (const [requested, expected] of [[undefined, 300], [400, 300], [700, 400]]) {
      const face = expectedFace(entry, requested, italic).face;
      assert.deepEqual([face.family, face.weight, face.italic], ['Red Hat Display', expected, italic], `${family}: independent direct style ${requested}/${italic}`);
      const resolved = registry.resolveFont({fontFamily: family, ...(requested === undefined ? {} : {fontWeight: requested}), italic});
      assert.deepEqual([resolved.resolvedFamily, resolved.resolvedWeight, resolved.italic], ['Red Hat Display', expected, italic], `${family}: public registry ${requested}/${italic}`);
    }
    assert.equal(runFace(entry, {italic}).face.weight, 300, `${family}: regular rich run`);
    assert.equal(runFace(entry, {bold: true, italic}).face.weight, 400, `${family}: named-family rich emphasis`);
    assert.equal(runFace(entry, {heading: true, italic}).face.weight, 400, `${family}: named-family heading emphasis`);
  }
  assert.deepEqual(neededFaces(entry).map(found => [found.face.weight, found.face.italic]).sort(), [[300, false], [300, true], [400, false], [400, true]], `${family}: the host plans every drawn face without the parent bold`);

  const deck = familyDeck(family);
  deck.slides[0].text.push(' ', {text: 'Explicit parent', fontFamily: 'Red Hat Display', bold: true});
  const svg = toSvg(deck, 1, {fonts: {registry, textMeasurement: registry.textMeasurement}});
  const runs = new Map([...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, attributes, text]) => [text, {weight: Number(/\sfont-weight="([^"]*)"/.exec(attributes)?.[1] ?? 400), italic: /\sfont-style="italic"/.test(attributes)}]));
  for (const [text, weight, italic] of [['Quarterly review', 400, false], ['Regular', 300, false], ['Bold', 400, false], ['Italic', 300, true], ['BoldItalic', 400, true], ['Explicit parent', 700, false]]) {
    assert.deepEqual(runs.get(text), {weight, italic}, `${family}: actual SVG ${text}`);
  }
}
for (const italic of [false, true]) {
  const parent = entries.find(row => row.family === 'Red Hat Display');
  assert.equal(expectedFace(parent, 700, italic).face.weight, 700, 'explicit parent model remains bold');
  assert.equal(registry.resolveFont({fontFamily: 'Red Hat Display', fontWeight: 700, italic}).resolvedWeight, 700, 'explicit parent registry remains bold');
}
const semibold = entries.find(row => row.family === 'Segoe UI Semibold');
const black = entries.find(row => row.family === 'Arial Black');
assert.equal(expectedFace(semibold, 400, false).face.weight, 600);
assert.equal(expectedFace(semibold, 700, false).face.weight, 700);
assert.equal(expectedFace(black, 700, false).face.weight, 900);
assert.equal(runFace(black, {bold: true}).face.weight, 700, 'heavier normalized rich-run contract is retained');
console.log('LH-177 Latin fixture: named Light/Semilight defaults, styles, heading/rich runs and four planned faces; explicit parent 700 and heavier-family controls pass.');
