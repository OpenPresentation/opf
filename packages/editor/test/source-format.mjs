import assert from 'node:assert/strict';
import { fromMarkdown } from '@openpresentation/opf/markdown';
import { fromYaml } from '@openpresentation/opf/yaml';
import { detectIndent, formatJsonSource, whitespaceEdits } from '../src/json-format.js';
import { formatMarkdownSource, formatSource, formatYamlSource } from '../src/source-format.js';

// Phase 0 of the source editor keyboard overhaul (artifacts/source-editor/SPEC.md section 10): Format document in every format, whitespace only,
// and nothing the author wrote is dropped. These are the pure functions; the keys and the button are covered by the browser suites.

// ---- JSON -----------------------------------------------------------------------------------------------------------------------
assert.equal(formatJsonSource('{"a":1,"b":[1,2]}'), '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}', 'two spaces by default');
assert.equal(formatJsonSource('{"a":1}', '    '), '{\n    "a": 1\n}', 'the unit given');
assert.equal(formatJsonSource('{"a":1}', '\t'), '{\n\t"a": 1\n}', 'a tab unit indents with tabs');
assert.equal(formatJsonSource('{"a":1}\n'), '{\n  "a": 1\n}\n', 'a final newline stays');
assert.equal(formatJsonSource('{"a":1}'), '{\n  "a": 1\n}', 'and none is added');
assert.equal(formatJsonSource('{\r\n"a":1}\r\n'), '{\r\n  "a": 1\r\n}\r\n', 'the first line ending is used throughout');
assert.equal(formatJsonSource('{"n":1.2300,"e":1E+3,"s":"a  b"}'), '{\n  "n": 1.2300,\n  "e": 1E+3,\n  "s": "a  b"\n}', 'numeric lexemes and spaces inside strings are kept');
assert.equal(formatJsonSource('{"slides":['), '{\n  "slides": [', 'a draft that does not parse is laid out too');
assert.equal(formatJsonSource(formatJsonSource('{"a":[{"b":1},{"c":[]}]}')), formatJsonSource('{"a":[{"b":1},{"c":[]}]}'), 'idempotent');
assert.deepEqual(JSON.parse(formatJsonSource('{"a":1,"b":{"c":[true,null,"x"]}}')), { a: 1, b: { c: [true, null, 'x'] } });

// The indentation unit of a text: a tab, else the smallest indentation; null when nothing is indented.
assert.equal(detectIndent('{}'), null);
assert.equal(detectIndent('{\n  "a": 1\n}'), '  ');
assert.equal(detectIndent('{\n    "a": [\n        1\n    ]\n}'), '    ');
assert.equal(detectIndent('{\n\t"a": 1\n}'), '\t');
assert.equal(detectIndent('{\n      "a": 1\n}'), '      ', 'the smallest indentation, even when it is odd');
assert.equal(detectIndent('{\n  "a": 1,\n      "b": 2\n}'), '  ', 'a deeper line does not change it');
assert.equal(detectIndent('{\n'.padEnd(40, ' ') + '\n{\n' + ' '.repeat(12) + 'x'), ' '.repeat(8), 'at most 8 spaces');

// The edits that turn a text into its formatted form: one per run of whitespace that changed, so a cursor between two tokens stays between them.
const edits = whitespaceEdits('{"a":1,"b":2}', '{\n  "a": 1,\n  "b": 2\n}');
assert.deepEqual(edits, [{ from: 1, to: 1, insert: '\n  ' }, { from: 5, to: 5, insert: ' ' }, { from: 7, to: 7, insert: '\n  ' }, { from: 11, to: 11, insert: ' ' }, { from: 12, to: 12, insert: '\n' }]);
const applied = (text, list) => list.toReversed().reduce((out, edit) => out.slice(0, edit.from) + edit.insert + out.slice(edit.to), text);
assert.equal(applied('{"a":1,"b":2}', edits), '{\n  "a": 1,\n  "b": 2\n}');
assert.deepEqual(whitespaceEdits('{\n  "a": 1\n}', '{\n  "a": 1\n}'), [], 'nothing to change');
assert.equal(whitespaceEdits('{"a":1}', '{"a":2}'), null, 'a change that is not whitespace is not a whitespace edit');
assert.equal(whitespaceEdits('{"a":1}', '{"a":1,}'), null);
assert.deepEqual(whitespaceEdits('"a  b"', '"a  b"'), [], 'whitespace inside a string is the same on both sides');
const tangled = '{"x" :  [ 1 ,2 ] , "s": "p  q"}';
assert.equal(applied(tangled, whitespaceEdits(tangled, formatJsonSource(tangled))), formatJsonSource(tangled), 'whitespace edits reproduce a format');

// ---- YAML -----------------------------------------------------------------------------------------------------------------------
const yamlDeck = '# deck\nname:   Q3   # inline\nslides:\n    - title: a\n      items: [x,   y]\n\n\n    - title: "b"\n';
const yamlOut = formatYamlSource(yamlDeck).text;
assert.equal(yamlOut, '# deck\nname: Q3 # inline\nslides:\n  - title: a\n    items: [x, y]\n\n  - title: "b"\n', 'two-space indent, comments, one blank line and quote styles kept');
assert.deepEqual(fromYaml(yamlOut).presentation, fromYaml(yamlDeck).presentation, 'the formatted YAML reads as the same document');
assert.equal(formatYamlSource(yamlOut).text, yamlOut, 'idempotent');
assert.equal(formatYamlSource('name: x\r\nslides: []').text, 'name: x\r\nslides: []', 'line endings and a missing final newline stay');
assert.equal(formatYamlSource('a: 1.0\nb: 1.50\nc: 1e3\nd:    0x1F\ne: .5\nf: +1\ng: [1E3,  .5]\n').text, 'a: 1.0\nb: 1.50\nc: 1e3\nd: 0x1F\ne: .5\nf: +1\ng: [1E3, .5]\n', 'number spellings stay');
assert.equal(formatYamlSource("a: 'it''s'\nb: |\n  one\n   two\n").text, "a: 'it''s'\nb: |\n  one\n   two\n", 'quotes and block scalars stay');
assert.equal(formatYamlSource('').text, '', 'an empty text stays empty');
assert.equal(formatYamlSource('# only a comment\n').text, '# only a comment\n');
assert.ok(formatYamlSource('a: [').error, 'YAML with errors is not formatted');
assert.ok(formatYamlSource('a: 1\n---\nb: 2\n').error, 'neither is a stream of documents');
assert.ok(!formatYamlSource('﻿name: x\n').error && formatYamlSource('﻿name:   x\n').text === '﻿name: x\n', 'a byte order mark stays');

// ---- Markdown -------------------------------------------------------------------------------------------------------------------
assert.equal(formatMarkdownSource('# A\n\n\n\n<!-- keep -->\n- x\n').text, '# A\n\n<!-- keep -->\n- x\n', 'blank runs become one blank line; comments stay');
assert.equal(formatMarkdownSource('---\nname:    x\n---\n# A\n').text, '---\nname: x\n---\n# A\n', 'front matter is formatted as YAML');
assert.equal(formatMarkdownSource('---\nname: [\n---\n# A\n').text, '---\nname: [\n---\n# A\n', 'front matter with errors is left as written');
assert.equal(formatMarkdownSource('# A\n\n```\none\n\n\n\ntwo\n```\n\n\n\nend').text, '# A\n\n```\none\n\n\n\ntwo\n```\n\nend\n', 'code fences keep their blank lines');
assert.equal(formatMarkdownSource('# A\n\n~~~yaml\na: 1\n\n\nb: 2\n~~~\n').text, '# A\n\n~~~yaml\na: 1\n\n\nb: 2\n~~~\n', 'tilde fences too');
assert.equal(formatMarkdownSource('````\n```\n\n\n````\n').text, '````\n```\n\n\n````\n', 'a shorter fence inside a longer one does not close it');
assert.equal(formatMarkdownSource('text\r\n\r\n\r\nmore\r\n').text, 'text\r\n\r\nmore\r\n', 'the first line ending is used');
assert.equal(formatMarkdownSource('a  \nb  \n').text, 'a  \nb  \n', 'trailing spaces (a hard break) stay');
assert.equal(formatMarkdownSource('para\n\n    code\n\n\n    more\n').text, 'para\n\n    code\n\n\n    more\n', 'blank lines inside an indented code block stay');
assert.equal(formatMarkdownSource('# A\n\ntext\n\n\n').text, '# A\n\ntext\n', 'the text ends with one newline');
assert.equal(formatMarkdownSource('').text, '');
assert.equal(formatMarkdownSource('# A\n\n```\nunclosed\n\n\n').text, '# A\n\n```\nunclosed\n\n\n', 'a fence that is never closed keeps the rest as written');
const mdDeck = '---\nname: Q3 Review\n---\n\n\n# Q3 Review\n\n\n---\n\n# Highlights\n\n\n- Revenue up 12%\n- Churn down\n';
const mdOut = formatMarkdownSource(mdDeck).text;
assert.deepEqual(fromMarkdown(mdOut).presentation, fromMarkdown(mdDeck).presentation, 'the formatted Markdown reads as the same document');
assert.equal(formatMarkdownSource(mdOut).text, mdOut, 'idempotent');

// ---- the dispatcher -------------------------------------------------------------------------------------------------------------
assert.equal(formatSource('json', '{"a":1}', { unit: '\t' }).text, '{\n\t"a": 1\n}');
assert.equal(formatSource('yaml', 'a:   1\n').text, 'a: 1\n');
assert.equal(formatSource('md', 'a\n\n\nb\n').text, 'a\n\nb\n');
assert.ok(formatSource('yaml', 'a: [').error);
console.log('Source format: JSON, YAML (comments kept) and Markdown (fences kept) lay out as whitespace only, and are idempotent.');
