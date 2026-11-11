import assert from 'node:assert/strict';
import { createValidator, validate, resolveVariables } from '@openpresentation/opf';
import { gallery } from '@openpresentation/gallery';
import { toSvg } from '../dist/index.js';

const options = { catalogs: [gallery] };
const titleOf = svg => svg.match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1];
const visibleText = svg => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(match => match[1].replace(/<[^>]+>/g, '')).join('\n');
const check = (checker, source) => assert.deepEqual(checker.validate(source, options), validate(source, options), 'complete fresh report equals cold');

for (const language of ['en-US', 'ar-SA']) {
  const source = { name: 'Original accessible name', language, slides: [{ layout: 'cover', subtitle: 'Authored subtitle' }] };
  const checker = createValidator(); check(checker, source);
  const before = toSvg(source, 1, options);
  assert.equal(titleOf(before), source.name);
  assert.ok(!visibleText(before).includes(source.name), 'root name is not an implicit visible cover heading');
  source.name = 'Changed accessible name'; check(checker, source);
  const after = toSvg(source, 1, options);
  assert.equal(titleOf(after), source.name, 'the accessible fallback is fresh despite reusable validation geometry');
  assert.ok(!visibleText(after).includes(source.name));
  assert.notEqual(after, before, 'do not claim whole SVG equality when its accessible name changed');
}
for (const kind of ['header', 'footer']) {
  const source = { name: 'Before visible name', design: { [kind]: { start: { text: '{{deck.name}}' } } }, slides: [{ title: 'Authored heading', text: 'A stable body.' }] };
  const checker = createValidator(); check(checker, source);
  const resolvedChecker = createValidator(); check(resolvedChecker, resolveVariables(source).presentation);
  assert.ok(visibleText(toSvg(source, 1, options)).includes('Before visible name'));
  source.name = 'After visible name'; check(checker, source);
  check(resolvedChecker, resolveVariables(source).presentation);
  const svg = toSvg(source, 1, options);
  assert.equal(titleOf(svg), 'Authored heading');
  assert.ok(visibleText(svg).includes('After visible name'), 'renderer resolves the actual new furniture name');
  assert.ok(!visibleText(svg).includes('Before visible name'));
}
const unrelated = {
  name: 'Unused root name', organization: { name: 'Organization', tagline: 'Tagline' }, speaker: { name: 'Speaker' },
  design: { footer: { start: { text: '{{organization.name}} · {{organization.tagline}}' }, end: { text: '{{slide.number}} / {{deck.slideCount}}' } } },
  slides: [{ title: 'Authored heading', text: 'By {{speaker.name}} · {{organization.tagline}}' }],
};
const unrelatedChecker = createValidator(); check(unrelatedChecker, unrelated);
const beforeUnrelated = toSvg(unrelated, 1, options);
assert.ok(visibleText(beforeUnrelated).includes('Organization · Tagline'));
assert.ok(visibleText(beforeUnrelated).includes('By Speaker · Tagline'));
unrelated.name = 'A different unused root name'; check(unrelatedChecker, unrelated);
assert.equal(toSvg(unrelated, 1, options), beforeUnrelated, 'actual unrelated builtins keep identical public output on this explicitly titled slide');
console.log('Root-name cache boundary: fresh LTR/RTL accessible names, no implicit visible title, actual header/footer variable expansion and complete cold-report equality passed.');
