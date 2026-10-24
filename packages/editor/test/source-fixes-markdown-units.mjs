// Phase 4 units: the remaining Markdown quick fixes (artifacts/source-editor/VALIDATOR-HINTS.md, sections 10 and 12): each fix, applied to its text, gives the golden
// text, keeps the author's comments and removes the finding it came from when the text is read again with `fromMarkdown`. A rule with no mechanical, unambiguous
// repair (`image-source`, `chart-data`, `timeline-events`, `opf-slide-not-mapping`) offers nothing.
import assert from 'node:assert/strict';
import { fromMarkdown } from '@openpresentation/opf/markdown';
import { applySourceEdits } from '../dist/source-fixes.js';
import { syntaxFixesFor, withSyntaxFixes } from '../dist/source-fixes-syntax.js';

const findingsOf = (text, rule) => fromMarkdown(text).findings.filter((entry) => entry.ruleId === rule);
const titlesOf = (text, rule, nth = 0) => {
  const found = findingsOf(text, rule)[nth];
  assert.ok(found, `a ${rule} finding for ${JSON.stringify(text)}`);
  return syntaxFixesFor('md', text, found)?.fixes.map((fix) => fix.title) ?? [];
};
/** Apply the fix `title` of the `nth` finding of `rule`; one finding with that message must be gone afterwards. */
const apply = (text, rule, title, expected, nth = 0) => {
  const found = findingsOf(text, rule)[nth];
  assert.ok(found, `a ${rule} finding for ${JSON.stringify(text)}`);
  const made = syntaxFixesFor('md', text, found);
  const fix = made?.fixes.find((entry) => entry.title === title);
  assert.ok(fix, `${title} is offered for ${JSON.stringify(text)} (has ${made?.fixes.map((entry) => entry.title).join(', ') ?? 'none'})`);
  const after = applySourceEdits(text, fix.edits);
  assert.equal(after, expected, title);
  const count = (source) => findingsOf(source, rule).filter((entry) => entry.message === found.message).length;
  assert.equal(count(after), count(text) - 1, `${title} removes one "${found.message}": ${JSON.stringify(after)}`);
  return after;
};

// markdown/slide-property-conflict: the key goes from the opf-slide fence, with its nested lines; comments stay.
apply('<!-- slide: layout=cover -->\n# A\n\n```opf-slide\nlayout: agenda # mine\nnotes: n\n```\n', 'markdown/slide-property-conflict', 'Remove layout from the fence', '<!-- slide: layout=cover -->\n# A\n\n```opf-slide\nnotes: n\n```\n');
apply('<!-- slide: id=x -->\n# A\n\n```opf-slide\n# the id\nid: y\ndesign:\n  theme: minimal\n```\n', 'markdown/slide-property-conflict', 'Remove id from the fence', '<!-- slide: id=x -->\n# A\n\n```opf-slide\n# the id\ndesign:\n  theme: minimal\n```\n');
apply('<!-- slide: layout=cover -->\n# A\n\n```opf-slide\ndesign:\n  theme: minimal\nlayout: agenda\n```\n', 'markdown/slide-property-conflict', 'Remove layout from the fence', '<!-- slide: layout=cover -->\n# A\n\n```opf-slide\ndesign:\n  theme: minimal\n```\n');
apply('# A\n\n```opf-slide\ntitle: B\n```\n', 'markdown/slide-property-conflict', 'Remove title from the fence', '# A\n');
apply('# A\n\ntext\n\n```opf-slide\ntitle: B\n```\n\nmore\n', 'markdown/slide-property-conflict', 'Remove title from the fence', '# A\n\ntext\n\nmore\n');
// Two conflicts: each finding removes its own key.
{
  const text = '<!-- slide: id=x layout=cover -->\n# A\n\n```opf-slide\nid: y\nlayout: agenda\nnotes: n\n```\n';
  assert.deepEqual(findingsOf(text, 'markdown/slide-property-conflict').map((_entry, index) => titlesOf(text, 'markdown/slide-property-conflict', index)[0]), ['Remove id from the fence', 'Remove layout from the fence']);
  apply(text, 'markdown/slide-property-conflict', 'Remove layout from the fence', '<!-- slide: id=x layout=cover -->\n# A\n\n```opf-slide\nid: y\nnotes: n\n```\n', 1);
}
// The second slide's fence, not the first's.
apply('<!-- slide: id=a -->\n# A\n\n```opf-slide\nid: b\n```\n\n---\n\n<!-- slide: id=c -->\n# B\n\n```opf-slide\nid: d\nnotes: n\n```\n', 'markdown/slide-property-conflict', 'Remove id from the fence', '<!-- slide: id=a -->\n# A\n\n```opf-slide\nid: b\n```\n\n---\n\n<!-- slide: id=c -->\n# B\n\n```opf-slide\nnotes: n\n```\n', 1);

// markdown/empty-quote
apply('# A\n\n>\n\ntext\n', 'markdown/empty-quote', 'Remove the empty quote', '# A\n\ntext\n');
apply('# A\n\n> \n>\n', 'markdown/empty-quote', 'Remove the empty quote', '# A\n\n');
apply('# A\n\ntext\n>\nmore\n', 'markdown/empty-quote', 'Remove the empty quote', '# A\n\ntext\nmore\n');

// markdown/options-orphan
apply('# A\n\n<!-- block: id=a -->\n', 'markdown/options-orphan', 'Remove the options comment', '# A\n\n');
apply('# A\n\n- x\n\n<!-- block: id=a\n  region=left -->\n', 'markdown/options-orphan', 'Remove the options comment', '# A\n\n- x\n\n');

// markdown/options-trailing
apply('# A\n\n<!-- block: id=a --> text after\n- x\n', 'markdown/options-trailing', 'Move the text to its own line', '# A\n\n<!-- block: id=a -->\ntext after\n- x\n');
apply('<!-- slide: id=a -->   # A\n', 'markdown/options-trailing', 'Move the text to its own line', '<!-- slide: id=a -->\n# A\n');
apply('<!-- slide: id=a -->\r\n# A\r\n\r\n<!-- block: id=b --> after\r\n- x\r\n', 'markdown/options-trailing', 'Move the text to its own line', '<!-- slide: id=a -->\r\n# A\r\n\r\n<!-- block: id=b -->\r\nafter\r\n- x\r\n');

// markdown/options-syntax
apply('# A\n<!-- slide: layout="x -->\n', 'markdown/options-syntax', 'Insert closing quote', '# A\n<!-- slide: layout="x" -->\n');
apply('# A\n<!-- slide: id=a section="Part one   -->\n', 'markdown/options-syntax', 'Insert closing quote', '# A\n<!-- slide: id=a section="Part one"   -->\n');
apply('# A\n<!-- slide: layout= -->\n', 'markdown/options-syntax', 'Remove layout=', '# A\n<!-- slide: -->\n');
apply('# A\n<!-- slide: id=a layout= section=b -->\n', 'markdown/options-syntax', 'Remove layout=', '# A\n<!-- slide: id=a section=b -->\n');
assert.deepEqual(titlesOf('# A\n<!-- slide: =x -->\n', 'markdown/options-syntax'), [], 'a stray = has no safe repair');
assert.deepEqual(titlesOf('# A\n<!-- slide: id="a\\qb" -->\n', 'markdown/options-syntax'), [], 'a bad escape has no safe repair');

// markdown/options-value: a flag without a value, a bad `as`
apply('# A\n<!-- slide: id=a layout -->\n', 'markdown/options-value', 'Remove layout', '# A\n<!-- slide: id=a -->\n');
apply('# A\n\n<!-- block: as=foo -->\n- x\n', 'markdown/options-value', 'Use as=bullets', '# A\n\n<!-- block: as=bullets -->\n- x\n');
apply('# A\n\n<!-- block: id=a as="foo" -->\n- x\n', 'markdown/options-value', 'Use as=video', '# A\n\n<!-- block: id=a as=video -->\n- x\n');
assert.deepEqual(titlesOf('# A\n\n<!-- block: as=video -->\n- x\n', 'markdown/options-value'), [], 'as=video on a list is about the block, not the comment: no repair');

// markdown/chart-attributes and timeline-attributes: an attribute the fence does not take is dropped
apply('# A\n\n```chart column foo="x"\na,b\nc,1\n```\n', 'markdown/chart-attributes', 'Remove foo', '# A\n\n```chart column\na,b\nc,1\n```\n');
apply('# A\n\n```chart column alt="Sales" size=3\na,b\nc,1\n```\n', 'markdown/chart-attributes', 'Remove size', '# A\n\n```chart column alt="Sales"\na,b\nc,1\n```\n');
apply('# A\n\n```timeline foo="x" name="N"\n2024 — x\n```\n', 'markdown/timeline-attributes', 'Remove foo', '# A\n\n```timeline name="N"\n2024 — x\n```\n');
assert.deepEqual(titlesOf('# A\n\n```chart column alt\na,b\nc,1\n```\n', 'markdown/chart-attributes'), [], 'alt without a value is the author\'s to fill');

// markdown/metric-block: a key given twice, a key with no value
apply('# A\n\n```metric\nvalue: 1\nvalue: 2\n```\n', 'markdown/metric-block', 'Remove the second value', '# A\n\n```metric\nvalue: 1\n```\n');
apply('# A\n\n```metric\nvalue: 1\nlabel:\n```\n', 'markdown/metric-block', 'Remove label:', '# A\n\n```metric\nvalue: 1\n```\n');
assert.deepEqual(titlesOf('# A\n\n```metric\nvalue:\n```\n', 'markdown/metric-block'), [], 'a value is never invented');

// Rules with no mechanical, unambiguous repair offer nothing (and never throw)
for (const [text, rule] of [
  ['# A\n\n![alt]()\n', 'markdown/image-source'],
  ['# A\n\n```chart column\n```\n', 'markdown/chart-data'],
  ['# A\n\n```timeline\n```\n', 'markdown/timeline-events'],
  ['# A\n\n```opf-slide\n- a\n```\n', 'markdown/opf-slide-not-mapping'],
]) {
  assert.deepEqual(titlesOf(text, rule), [], `${rule} has no fix`);
  const [with0] = withSyntaxFixes('md', text, findingsOf(text, rule));
  assert.equal(with0.editFixes, undefined, `${rule}: no editFixes`);
}

// A fix leaves the rest of the deck alone: the comments and the other slides stay as they were.
{
  const text = '---\nname: x # the deck\n---\n\n<!-- keep me -->\n# A\n\n<!-- block: id=a -->\n\n---\n\n# B\n';
  const after = apply(text, 'markdown/options-orphan', 'Remove the options comment', '---\nname: x # the deck\n---\n\n<!-- keep me -->\n# A\n\n\n---\n\n# B\n');
  assert.equal(fromMarkdown(after).presentation.slides.length, 2);
}
console.log('Source fixes (Markdown phase 4): conflict, empty quote, orphan, trailing, syntax, value, attribute and metric fixes give the golden text and remove their findings.');
