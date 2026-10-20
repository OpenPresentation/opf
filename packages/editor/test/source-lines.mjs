import assert from 'node:assert/strict';
import { toYaml } from '@openpresentation/opf/yaml';
import { toMarkdown } from '@openpresentation/opf/markdown';
import { lineForPath, lineOfOffset, offsetOfLine, pathSegments } from '../src/source-lines.js';

// RR-98: the source pane finds the line of a JSON Pointer in JSON (exactly) and in YAML and Markdown (best effort).
const deck = {
  name: 'D',
  design: { theme: 'minimal' },
  slides: [
    { title: 'A', text: 'hi' },
    { title: 'B', subtitle: 'sub', items: ['x', 'y'], design: { layout: 'title' } },
    { title: 'C', notes: 'n' },
  ],
};
const lineOf = (source, needle) => source.slice(0, source.indexOf(needle)).split('\n').length;

assert.deepEqual(pathSegments('/slides/0/a~1b~0c'), ['slides', '0', 'a/b~c']);
assert.deepEqual(pathSegments('slides.1.title'), ['slides', '1', 'title']);
assert.deepEqual(pathSegments(''), []);
assert.equal(lineOfOffset('a\r\nb\rc\nd', 6), 3);
assert.equal(offsetOfLine('a\r\nb\rc\nd', 3), 5);

const json = JSON.stringify(deck, null, 2);
assert.equal(lineForPath('json', json, '/name'), 2);
assert.equal(lineForPath('json', json, '/slides/0/title'), lineOf(json, '"title": "A"'));
assert.equal(lineForPath('json', json, '/slides/1/items/1'), lineOf(json, '"y"'));
assert.equal(lineForPath('json', json, '/slides/2'), lineOf(json, '"title": "C"') - 1, 'an array element is its opening brace');
assert.equal(lineForPath('json', json, '/slides/9/title'), lineOf(json, '"slides"'), 'the deepest place that exists');
assert.equal(lineForPath('json', '{"a":', '/a'), 1, 'incomplete JSON still places what it can');

const yaml = toYaml(deck).yaml;
assert.equal(lineForPath('yaml', yaml, '/name'), 1);
assert.equal(lineForPath('yaml', yaml, '/design/theme'), lineOf(yaml, 'theme:'));
assert.equal(lineForPath('yaml', yaml, '/slides/0/title'), lineOf(yaml, 'title: A'));
assert.equal(lineForPath('yaml', yaml, '/slides/1/subtitle'), lineOf(yaml, 'subtitle:'));
assert.equal(lineForPath('yaml', yaml, '/slides/1/items/1'), lineOf(yaml, '- "y"'));
assert.equal(lineForPath('yaml', yaml, '/slides/1/design/layout'), lineOf(yaml, 'layout:'));
assert.equal(lineForPath('yaml', yaml, '/slides/2/notes'), lineOf(yaml, 'notes:'));
// Sequences at the key's own column, quoted keys, block scalars and flow collections.
const loose = 'name: D\nslides:\n- title: A\n  items:\n  - x\n  - y\n- title: "B"\n  text: |\n    title: not a key\n  items: [a, b]\n';
assert.equal(lineForPath('yaml', loose, '/slides/0/items/1'), 6);
assert.equal(lineForPath('yaml', loose, '/slides/1/title'), 7);
assert.equal(lineForPath('yaml', loose, '/slides/1/text'), 8);
assert.equal(lineForPath('yaml', loose, '/slides/1/items/1'), 10, 'a flow sequence gives the line of its key');

const markdown = toMarkdown(deck).markdown;
assert.equal(lineForPath('md', markdown, '/name'), 2);
assert.equal(lineForPath('md', markdown, '/design/theme'), lineOf(markdown, 'theme:'));
assert.equal(lineForPath('md', markdown, '/slides/0/title'), lineOf(markdown, '# A'));
assert.equal(lineForPath('md', markdown, '/slides/1/subtitle'), lineOf(markdown, '## sub'));
assert.equal(lineForPath('md', markdown, '/slides/1/items/1'), lineOf(markdown, '- y'));
assert.equal(lineForPath('md', markdown, '/slides/1/design'), lineOf(markdown, '```opf-slide'), 'an embedded part points at its fence');
assert.equal(lineForPath('md', markdown, '/slides/2/notes'), lineOf(markdown, 'Note: n'));
assert.equal(lineForPath('md', markdown, '/slides/9'), null);
console.log('Source pane line lookup: JSON, YAML and Markdown.');
