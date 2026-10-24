// Phase 3 units (artifacts/source-editor/TEST-PLAN.md, section 8.5, "quick-fix edits"): each quick fix of a YAML or Markdown syntax problem, applied to its
// text, gives the golden text and removes its finding; the text fixes for schema findings that are new in phase 3 (Move into extensions, Convert to string,
// Wrap in a list, Add a slide) keep comments and layout.
import assert from 'node:assert/strict';
import { fromMarkdown } from '@openpresentation/opf/markdown';
import { fromYaml } from '@openpresentation/opf/yaml';
import { validate } from '@openpresentation/opf';
import { applySourceEdits, fixesForFinding } from '../dist/source-fixes.js';
import { textFixesForFinding } from '../dist/source-fixes-text.js';
import { syntaxFixesFor, withSyntaxFixes } from '../dist/source-fixes-syntax.js';
import { normalizeFinding } from '../dist/source-findings.js';

const read = { yaml: fromYaml, md: fromMarkdown };
const syntax = (format, text, rule) => {
  const found = read[format](text).findings.find((entry) => !rule || entry.ruleId === rule);
  assert.ok(found, `${format} finding ${rule ?? ''} for ${JSON.stringify(text)}`);
  return found;
};
const apply = (format, text, title, rule) => {
  const found = syntax(format, text, rule);
  const made = syntaxFixesFor(format, text, found);
  const fix = made?.fixes.find((entry) => entry.title === title);
  assert.ok(fix, `${title} is offered for ${JSON.stringify(text)} (has ${made?.fixes.map((entry) => entry.title).join(', ') ?? 'none'})`);
  return applySourceEdits(text, fix.edits);
};
const gone = (format, text, rule) => !read[format](text).findings.some((entry) => entry.ruleId === rule);

// ---- YAML ------------------------------------------------------------------------------------------------------------------------------------------
assert.equal(apply('yaml', 'a:\n\tb: 1\n', 'Convert tabs to spaces'), 'a:\n  b: 1\n');
assert.equal(apply('yaml', 'name: "x\nslides: []\n', 'Insert closing quote'), 'name: "x"\nslides: []\n');
assert.equal(apply('yaml', 'tags: [a, b\nslides: []\n', 'Insert ]'), 'tags: [a, b]\nslides: []\n');
assert.equal(apply('yaml', 'name: x\ndes\nslides: []\n', 'Add a colon'), 'name: x\ndes: \nslides: []\n');
assert.equal(apply('yaml', 'title: Revenue: up\n', 'Quote the value'), 'title: "Revenue: up"\n');
assert.equal(apply('yaml', 'name: x\nname: y\nslides: []\n', 'Remove the second'), 'name: x\nslides: []\n');
assert.equal(apply('yaml', '', 'Insert minimal deck'), 'slides:\n  - title: Title\n');
assert.equal(apply('yaml', '- title: a\n', 'Wrap as `slides:`'), 'slides:\n  - title: a\n');
for (const [text, rule] of [['a:\n\tb: 1\n', 'yaml/syntax'], ['name: "x\nslides: []\n', 'yaml/syntax'], ['tags: [a, b\nslides: []\n', 'yaml/syntax'], ['name: x\nname: y\nslides: []\n', 'yaml/duplicate-key']]) {
  const found = syntax('yaml', text, rule);
  const fix = syntaxFixesFor('yaml', text, found).fixes[0];
  assert.ok(gone('yaml', applySourceEdits(text, fix.edits), rule), `${fix.title} removes ${rule}`);
}
// A finding gets its fixes and related places through withSyntaxFixes (the shape buildProblems reads).
{
  const text = 'name: x\nname: y\nslides: []\n';
  const [found] = withSyntaxFixes('yaml', text, fromYaml(text).findings);
  assert.deepEqual(found.editFixes.map((fix) => fix.title), ['Remove the first', 'Remove the second']);
  assert.deepEqual(found.related, [{ from: 0, to: 4 }], 'the first of two equal keys is marked too');
  assert.equal(syntaxFixesFor('json', text, found), null, 'JSON has its own analyzer');
}

// ---- Markdown ---------------------------------------------------------------------------------------------------------------------------------
assert.equal(apply('md', '---\nname: x\n\n# A\n', 'Insert ---'), '---\nname: x\n---\n\n# A\n');
assert.equal(apply('md', '---\nname: x\ndesign:\n  theme: minimal\n\n# A\n', 'Insert ---'), '---\nname: x\ndesign:\n  theme: minimal\n---\n\n# A\n');
assert.equal(apply('md', '# A\n\n<!-- note\n', 'Insert -->'), '# A\n\n<!-- note -->\n');
assert.equal(apply('md', '# A\n\n```js\nx\n', 'Insert closing fence'), '# A\n\n```js\nx\n```\n');
assert.equal(apply('md', '# A\n\n~~~js\nx', 'Insert closing fence'), '# A\n\n~~~js\nx\n~~~\n');
assert.equal(apply('md', '# A\n<!-- slide: layot=cover -->\n', 'Rename to layout'), '# A\n<!-- slide: layout=cover -->\n');
assert.equal(apply('md', '# A\n<!-- slide: hidden=maybe -->\n', 'Use hidden=true'), '# A\n<!-- slide: hidden=true -->\n');
assert.equal(apply('md', '# A\n<!-- slide: layout=a layout=b -->\n', 'Remove the second layout'), '# A\n<!-- slide: layout=a -->\n');
assert.equal(apply('md', '# A\n\n```chart\n```\n', 'Insert column'), '# A\n\n```chart column\n```\n');
assert.equal(apply('md', '---\nname: x\nslides: []\n---\n# A\n', 'Remove the slides key'), '---\nname: x\n---\n# A\n');
assert.equal(apply('md', '', 'Insert # Title'), '# Title\n');
assert.equal(apply('md', '# A\n\n1. one\n2. two\n', 'Add `numbering`'), '# A\n\n1. one\n2. two\n\n```opf-slide\nnumbering: arabic\n```\n');
assert.equal(apply('md', '# A\n\n---\n\n# B\n\n# C\n', 'Start a new slide here', 'markdown/duplicate-title'), '# A\n\n---\n\n# B\n\n---\n\n# C\n');
assert.equal(apply('md', '# A\n\n---\n\n# B\n\n# C\n', 'Remove the extra heading', 'markdown/duplicate-title'), '# A\n\n---\n\n# B\n\n');
assert.equal(apply('md', '---\nname: x\n\tbad: 1\n---\n# A\n', 'Convert tabs to spaces'), '---\nname: x\n  bad: 1\n---\n# A\n', 'the YAML of the front matter has the YAML fixes');
assert.equal(apply('md', '# A\n\n```opf-slide\nitems: [a, b\n```\n', 'Insert ]'), '# A\n\n```opf-slide\nitems: [a, b]\n```\n');
for (const [text, rule] of [
  ['---\nname: x\n\n# A\n', 'markdown/front-matter-unterminated'],
  ['# A\n\n<!-- note\n', 'markdown/comment-unterminated'],
  ['# A\n\n```js\nx\n', 'markdown/fence-unterminated'],
  ['# A\n<!-- slide: layot=cover -->\n', 'markdown/options-unknown-key'],
  ['# A\n\n```chart\n```\n', 'markdown/chart-type'],
  ['---\nname: x\nslides: []\n---\n# A\n', 'markdown/front-matter-slides'],
  ['', 'markdown/no-slides'],
]) {
  const found = syntax('md', text, rule);
  const fix = syntaxFixesFor('md', text, found).fixes[0];
  const after = applySourceEdits(text, fix.edits);
  assert.ok(gone('md', after, rule), `${fix.title} removes ${rule}: ${JSON.stringify(after)}`);
}
assert.equal(syntaxFixesFor('md', '# A\n\ntext\n', { ruleId: 'markdown/unknown', location: { offset: 0, length: 1, line: 1, column: 1 }, message: '' }), null);

// ---- text fixes for schema findings, new in phase 3 ---------------------------------------------------------------------------------------------
const schemaFinding = (text, format, keyword) => {
  const report = format === 'yaml' ? fromYaml(text) : format === 'md' ? fromMarkdown(text) : validate(text);
  return normalizeFinding(report.findings.find((entry) => entry.validation?.keyword === keyword), 'schema');
};
const valueAt = (draft) => (segments) => segments.reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), draft);
const context = (draft) => ({ valueAt: valueAt(draft), keysOf: () => ['slides', 'name', 'extensions', 'design'], starter: () => undefined });
const yamlFix = (text, keyword, title, draft) => {
  const found = schemaFinding(text, 'yaml', keyword);
  const fix = textFixesForFinding('yaml', found, text, context(draft ?? fromYaml(text).presentation)).find((entry) => entry.title === title);
  assert.ok(fix, `${title} for ${JSON.stringify(text)}`);
  return applySourceEdits(text, fix.edits);
};
assert.equal(yamlFix('slides:\n  - title: a\n    items: One # first\n', 'type', 'Wrap in a list', { slides: [{ title: 'a', items: 'One' }] }), 'slides:\n  - title: a\n    items: [One] # first\n');
assert.equal(yamlFix('slides:\n  - title: a\n    items: "One, two"\n', 'type', 'Wrap in a list', { slides: [{ title: 'a', items: 'One, two' }] }), 'slides:\n  - title: a\n    items: ["One, two"]\n');
assert.equal(yamlFix('slides:\n  - title: 42\n', 'oneOf', 'Convert to string', { slides: [{ title: 42 }] }), 'slides:\n  - title: "42"\n');
assert.equal(yamlFix('slides: []\nname: x\n', 'minItems', 'Add a slide', { slides: [] }), 'slides:\n  - title: Slide title\nname: x\n');
assert.equal(yamlFix('name: x\nslides: []', 'minItems', 'Add a slide', { slides: [] }), 'name: x\nslides:\n  - title: Slide title');
assert.equal(yamlFix('name: x\nfoo: 1\nslides:\n  - title: a\n', 'additionalProperties', 'Move into extensions', { slides: [{ title: 'a' }], foo: 1 }), 'name: x\nslides:\n  - title: a\nextensions:\n  foo: 1\n');
assert.equal(yamlFix('foo:\n  nested: 1 # keep\n  other: 2\nslides:\n  - title: a\nextensions:\n  bar: 2\n', 'additionalProperties', 'Move into extensions', { slides: [{ title: 'a' }], foo: {}, extensions: { bar: 2 } }), 'slides:\n  - title: a\nextensions:\n  bar: 2\n  foo:\n    nested: 1 # keep\n    other: 2\n');
assert.equal(yamlFix('slides:\n  - title: a\n    zz: 1\n    notes: n\n', 'additionalProperties', 'Move into extensions', { slides: [{ title: 'a', zz: 1, notes: 'n' }] }).includes('extensions:\n      zz: 1'), true, 'a slide gets its own extensions, indented under the slide keys');
{
  const text = '---\nname: x\nfoo: 1\n---\n# A\n';
  const found = schemaFinding(text, 'md', 'additionalProperties');
  const fix = textFixesForFinding('md', found, text, context({ name: 'x', foo: 1, slides: [{ title: 'A' }] })).find((entry) => entry.title === 'Move into extensions');
  assert.equal(applySourceEdits(text, fix.edits), '---\nname: x\nextensions:\n  foo: 1\n---\n# A\n', 'the front matter of Markdown too');
}
// JSON
{
  const text = '{\n  "slides": [{"title": "a"}],\n  "foo": 1\n}';
  const found = schemaFinding(text, 'json', 'additionalProperties');
  const fix = fixesForFinding(found, text, { ...context(JSON.parse(text)), unit: '  ' }).find((entry) => entry.title === 'Move into extensions');
  assert.deepEqual(JSON.parse(applySourceEdits(text, fix.edits)), { slides: [{ title: 'a' }], extensions: { foo: 1 } });
  const twice = '{\n  "slides": [{"title": "a"}],\n  "foo": 1,\n  "extensions": {"bar": 2}\n}';
  const other = fixesForFinding(schemaFinding(twice, 'json', 'additionalProperties'), twice, { ...context(JSON.parse(twice)), unit: '  ' }).find((entry) => entry.title === 'Move into extensions');
  assert.deepEqual(JSON.parse(applySourceEdits(twice, other.edits)), { slides: [{ title: 'a' }], extensions: { bar: 2, foo: 1 } });
  const number = '{"slides":[{"title":42}]}';
  const convert = fixesForFinding(schemaFinding(number, 'json', 'oneOf'), number, { ...context(JSON.parse(number)), unit: '  ' }).find((entry) => entry.title === 'Convert to string');
  assert.equal(applySourceEdits(number, convert.edits), '{"slides":[{"title":"42"}]}');
}
console.log('Source fixes (syntax and phase 3 text fixes): YAML and Markdown syntax fixes and the text fixes for schema findings give the golden text and remove their findings.');
