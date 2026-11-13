// RR-105 (#1290, ribbon audit gap 11): Home > Layout lists user-facing layout names: the layout record's own name, "Title Only" for
// OPF's automatic layout ("Title and Text" for its native-body variant), "Blank" for the base layout, and a plain number for a second
// layout of the same name under one master. No internal name ("DEFAULT", "OPF auto", "(native body)", "(furniture 2)",
// "(no furniture)", "(group:id)") reaches PowerPoint. Identity is the layout tag (OPF_LAYOUT_V1), so import does not depend on names:
// the same package with every layout renamed imports to the same document.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {examples} from '@openpresentation/opf/examples';
import {gallery} from '@openpresentation/gallery';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {layoutDisplayName} from '../dist/layout-names.js';

const INTERNAL = /DEFAULT|^OPF |\((?:native body|automatic grid|furniture \d+|no furniture|[^():]+:[^():]+)\)/;
const image = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
// Every layout's name, per master in its layout-list order.
function layoutNames(bytes) {
  const parts = unzipSync(bytes), text = path => strFromU8(parts[path]);
  const masters = Object.keys(parts).filter(path => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path)).sort();
  return masters.map(master => {
    const rels = text(master.replace(/([^/]+)$/, '_rels/$1.rels'));
    const target = id => /Target="(?:\.\.\/)?(?:slideLayouts\/)?([^"]+)"/.exec(new RegExp(`<Relationship\\b[^>]*\\bId="${id}"[^>]*>`).exec(rels)[0])[1];
    return [...text(master).matchAll(/<p:sldLayoutId\b[^>]*\br:id="([^"]+)"/g)].map(([, id]) => {
      const path = `ppt/slideLayouts/${target(id).replace(/^.*\//, '')}`;
      return /<p:cSld\b[^>]*\bname="([^"]*)"/.exec(text(path))[1];
    });
  });
}
let checks = 0;

// 1. The naming rule.
assert.equal(layoutDisplayName('DEFAULT'), 'Blank');
assert.equal(layoutDisplayName('OPF auto', 'titleOnly'), 'Title Only');
assert.equal(layoutDisplayName('OPF auto (native body)', 'tx'), 'Title and Text');
assert.equal(layoutDisplayName('OPF auto (furniture 2)', 'titleOnly'), 'Title Only');
assert.equal(layoutDisplayName('Cover (no furniture)', 'title'), 'Cover');
assert.equal(layoutDisplayName('Text (native body) (furniture 1)', 'obj'), 'Text');
assert.equal(layoutDisplayName('Quote (custom:quote)', 'cust'), 'Quote');
assert.equal(layoutDisplayName('OPF furniture 3'), 'Blank');
assert.equal(layoutDisplayName('Two columns', 'twoObj'), 'Two columns');
checks++;

// 2. Every bundled example (furniture variants, native bodies, several masters for script fonts): no internal name, and the names
// under each master are unique.
for (const {file, deck} of examples) {
  for (const bodyText of [undefined, 'native']) {
    const bytes = await toPptx(structuredClone(deck), {catalogs: [gallery], imageResolver: async () => image, ...(bodyText ? {bodyText} : {})});
    for (const names of layoutNames(bytes)) {
      assert.deepEqual(names.filter(name => INTERNAL.test(name)), [], `${file}: no internal layout name`);
      assert.equal(new Set(names).size, names.length, `${file}: layout names are unique under a master (${names})`);
    }
  }
  checks++;
}

// 3. A multi-layout deck: the names, and the same import whatever the layouts are called.
{
  const deck = {name: 'Layouts', organization: {id: 'acme', name: 'Acme'}, design: {footer: {start: {text: '{{organization.name}}'}, end: {text: '{{slide.number}}'}}}, slides: [
    {layout: 'cover', title: 'Annual review', subtitle: '2026'}, {layout: 'section', title: 'Results'},
    {title: 'Highlights', items: ['Revenue grew', 'Costs fell']}, {layout: 'quote', quote: {text: 'Keep going.', attribution: 'A. Person'}},
    {layout: 'closing', title: 'Thank you'}]};
  const bytes = await toPptx(structuredClone(deck), {catalogs: [gallery]});
  const [names] = layoutNames(bytes);
  for (const name of ['Blank', 'Cover', 'Section', 'Quote', 'Closing', 'Title Only']) assert.ok(names.includes(name), `${name} is listed (${names})`);
  const imported = await fromPptx(bytes, {catalogs: [gallery]});
  const parts = unzipSync(bytes);
  let index = 0;
  for (const path of Object.keys(parts).filter(path => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)))
    parts[path] = strToU8(strFromU8(parts[path]).replace(/(<p:cSld\b[^>]*\bname=")[^"]*(")/, `$1Renamed ${index++}$2`));
  assert.deepEqual(await fromPptx(zipSync(parts), {catalogs: [gallery]}), imported, 'import identifies layouts by their tags, not their names');
  assert.deepEqual(imported.slides.map(slide => slide.layout), ['cover', 'section', undefined, 'quote', 'closing']);
  checks++;
}
console.log(`layout-names: ${checks} checks (${examples.length} examples, measured and native body)`);
