// Dependency integration: the pinned production parser must preserve DTD boundaries,
// and the PPTX boundary continues refusing DTDs rather than interpreting them.
import assert from 'node:assert/strict';
import {parseXml} from '@rgrove/parse-xml';
import {zipSync, strToU8} from 'fflate';
import {readInputZip} from '../src/input-safety.js';
import {toPptx, fromPptx} from '../dist/index.js';

const subsets = [
  '<!ENTITY safe "before ]> after">',
  '<!-- ]><injected/> -->',
  '<?sample ]><injected/> ?>',
];
for (const subset of subsets) {
  const xml = `<!DOCTYPE root [${subset}]><root><value>Current authored text</value></root>`;
  const parsed = parseXml(xml);
  assert.equal(parsed.root.name, 'root');
  assert.equal(parsed.root.text, 'Current authored text');
  assert.deepEqual(parsed.children.filter(node => node.type === 'element').map(node => node.name), ['root']);
  assert.throws(() => readInputZip(zipSync({'a.xml': strToU8(xml)})), error => error.code === 'invalid-pptx', 'PPTX input never interprets a DTD');
}
for (const invalid of ['<root>&#65a;</root>', '<root>&#x41g;</root>', '<root><child></root></child>'])
  assert.throws(() => parseXml(invalid), 'malformed XML stays a strict error');
const document = {slides: [{title: 'Markup & Unicode', text: 'Literal <value> & “quoted” text ]> stays authored.'}]};
const imported = await fromPptx(await toPptx(document));
assert.equal(imported.slides[0].title, document.slides[0].title);
assert.equal(imported.slides[0].text, document.slides[0].text);
console.log('Production XML parser: quoted/comment/PI internal DTD boundaries, PPTX DTD refusals, malformed references and exact literal text round trip PASS.');
