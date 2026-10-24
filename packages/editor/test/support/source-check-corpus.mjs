// The texts the source checker is tested on (test/source-check-units.mjs and test/source-worker-browser.mjs): a valid deck in each format, the syntax
// errors of each, schema errors, and decks whose references resolve only when the gallery catalog is registered. `catalogs` is "gallery" or "none".
import { toMarkdown } from '@openpresentation/opf/markdown';
import { toYaml } from '@openpresentation/opf/yaml';

const valid = { name: 'Valid', slides: [{ title: 'One', items: ['a', 'b'] }, { title: 'Two', text: 'Body.', notes: 'Say it.' }] };
const withLayout = { name: 'Layouts', slides: [{ title: 'Start', layout: 'cover' }, { title: 'Middle', layout: 'no-such-layout', text: 'x' }], tone: 'formal' };
const schemaErrors = { name: 'Broken', slides: [{ title: 42 }, { title: 'Agenda', items: 'One string, not an array' }, { title: 'Extra', bogus: true }] };
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const row = (id, format, text, catalogs = 'gallery') => ({ id, format, text, catalogs });
const pairs = (name, value) => [
  row(`${name}-json`, 'json', json(value)),
  row(`${name}-yaml`, 'yaml', toYaml(value).yaml),
  row(`${name}-md`, 'md', toMarkdown(value).markdown),
];

export const corpus = [
  ...pairs('valid', valid),
  ...pairs('layouts', withLayout),
  row('layouts-json-nocatalog', 'json', json(withLayout), 'none'),
  row('layouts-yaml-nocatalog', 'yaml', toYaml(withLayout).yaml, 'none'),
  row('layouts-md-nocatalog', 'md', toMarkdown(withLayout).markdown, 'none'),
  row('schema-json', 'json', json(schemaErrors)),
  row('schema-yaml', 'yaml', 'name: Broken\nslides:\n  - title: 42\n  - title: Agenda\n    items: One string, not an array\n  - title: Extra\n    bogus: true\n'),
  row('schema-md', 'md', '---\nname: Broken\n---\n\n# Agenda\n\n<!-- layout: [1, 2] -->\n\n- one\n'),
  row('json-missing-comma', 'json', '{\n  "name": "x"\n  "slides": []\n}\n'),
  row('json-trailing-comma', 'json', '{\n  "name": "x",\n  "slides": [],\n}\n'),
  row('json-unclosed-brace', 'json', '{\n  "name": "x",\n  "slides": [{ "title": "a" }\n'),
  row('json-duplicate-key', 'json', '{\n  "name": "x",\n  "name": "y",\n  "slides": [{ "title": "a" }]\n}\n'),
  row('json-not-object', 'json', '[1, 2]\n'),
  row('json-empty', 'json', ''),
  row('yaml-tab-indentation', 'yaml', 'name: x\nslides:\n\t- title: a\n'),
  row('yaml-unclosed-quote', 'yaml', 'name: "x\nslides:\n  - title: a\n'),
  row('yaml-unknown-key', 'yaml', 'name: x\nbogus: 1\nslides:\n  - title: a\n    wrong: 2\n'),
  row('yaml-flow', 'yaml', 'name: x\nslides: [{ title: a }, { title: b, items: [c, d] }]\n'),
  row('md-unterminated-front-matter', 'md', '---\nname: x\n\n# A\n'),
  row('md-unterminated-fence', 'md', '# A\n\n```yaml\nkey: 1\n\n# B\n'),
  row('md-unknown-slide-option', 'md', '---\nname: x\n---\n\n# A\n<!-- slide: layot=cover -->\n\n- one\n\n---\n\n# B\n'),
  row('md-numbered-list', 'md', '---\nname: x\n---\n\n# A\n\n1. one\n2. two\n'),
];

export const GALLERY = 'gallery';
