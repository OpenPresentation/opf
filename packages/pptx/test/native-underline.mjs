import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {validate} from '@openpresentation/opf';
import {toPptx} from '../dist/index.js';

// Public exporter controls. No private converter calls or native Office claim.
const parser = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', parseTagValue:false, trimValues:false});
const output = path.resolve(process.env.OPF_NATIVE_UNDERLINE_ARTIFACTS ?? 'artifacts/native-underline/source');
// The historical registry lane predates linked social furniture. All rich
// underline assertions remain mandatory there; source/current candidates run all.
const registryLane = process.env.OPF_NATIVE_UNDERLINE_REGISTRY === '1';
const fixed = {seed: 32, timestamp:'2026-09-29T00:00:00Z', zipDate:'2026-09-29T00:00:00Z'};
const all = (node, key) => !node || typeof node !== 'object' ? [] : Object.entries(node).flatMap(([name, value]) => [
  ...(name === key ? [value].flat() : []), ...all(value, key)
]);
const cases = [
  ['trueHex', {underline:true, color:'#247A78'}, 'sng', 'srgbClr', '247A78'],
  ['trueSlot', {underline:true, color:'accent2'}, 'sng', 'schemeClr', 'accent2'],
  ['falseHex', {underline:false, color:'#247A78'}, undefined, 'srgbClr', '247A78'],
  ['falseSlot', {underline:false, color:'accent2'}, undefined, 'schemeClr', 'accent2'],
  ['absentHex', {color:'#247A78'}, undefined, 'srgbClr', '247A78'],
  ['absentSlot', {color:'accent2'}, undefined, 'schemeClr', 'accent2'],
  ['linkTrue', {underline:true, color:'#247A78', link:'https://example.com/true'}, 'sng', 'srgbClr', '247A78'],
  ['linkFalse', {underline:false, link:'https://example.com/false'}, 'sng'],
  ['linkAbsent', {link:'https://example.com/absent'}, 'sng']
];
const rich = cases.flatMap(([name, style], index) => [...(index ? [' '] : []), {text:name, ...style}]);
const shapes = [
  ['body-root', {text:rich}],
  ['body-block', {blocks:[{text:rich}]}],
  ['body-region', {center:{text:rich}}],
  ['list-body', {items:[{text:rich}]}],
  ['list-description', {items:[{text:'List body', description:rich}]}],
  ['table-header', {table:{columns:[rich], rows:[['Table body']]}}],
  ['table-cell', {table:{columns:['Header'], rows:[[rich]]}}]
];
const deck = slide => ({design:{fontScheme:'roboto', colorScheme:'forest-green'}, slides:[slide]});
async function exportAndRetain(name, source) {
  assert.equal(validate(source, {only: ['format']}).valid, true, name + ': schema-valid source');
  const before = JSON.stringify(source), diagnostics = [];
  const bytes = await toPptx(source, {...fixed, onDiagnostic:value => diagnostics.push(value)});
  const entries = unzipSync(bytes), xml = new TextDecoder().decode(entries['ppt/slides/slide1.xml']);
  if (output) {
    await mkdir(output, {recursive:true});
    await writeFile(path.join(output, name + '.opf.json'), JSON.stringify(source, null, 2) + '\n');
    await writeFile(path.join(output, name + '.pptx'), bytes);
    await writeFile(path.join(output, name + '.xml.txt'), xml);
    await writeFile(path.join(output, name + '.json'), JSON.stringify({node:process.version, entrypoint:import.meta.resolve('../dist/index.js'), sha256:createHash('sha256').update(bytes).digest('hex'), diagnostics}, null, 2) + '\n');
  }
  assert.equal(JSON.stringify(source), before, name + ': source is unchanged');
  assert.equal(XMLValidator.validate(xml), true, name + ': valid native XML');
  assert.deepEqual(await toPptx(source, fixed), bytes, name + ': deterministic public export');
  return {native:parser.parse(xml), xml, entries};
}
for (const [name, slide] of shapes) {
  test(name + ': true/false/absent, literal/scheme color, hyperlink defaults', async () => {
    const {native} = await exportAndRetain(name, deck(slide));
    const runs = all(native, 'a:r');
    for (const [text, style, underline, colorType, color] of cases) {
      const matches = runs.filter(run => run['a:t'] === text);
      assert.equal(matches.length, 1, name + ': exact current run ' + text);
      const properties = matches[0]['a:rPr'];
      assert.equal(properties.u, underline, name + ': native underline for ' + text);
      if (colorType) assert.equal(properties['a:solidFill']?.['a:' + colorType]?.val, color, name + ': text color ' + text);
      if (style.underline) assert.equal(properties['a:uFill']?.['a:solidFill']?.['a:' + colorType]?.val, color, name + ': underline color ' + text);
      else assert.equal(properties['a:uFill'], undefined, name + ': no explicit underline fill ' + text);
      assert.equal(Boolean(properties['a:hlinkClick']), Boolean(style.link), name + ': hyperlink ' + text);
    }
  });
}
test('linked furniture retains explicit native underline none', {skip:registryLane ? 'Published core 0.11 does not emit linked social furniture; current candidate/source lane is mandatory.' : false}, async () => {
  const source = {organization:{id:'acme', name:'Acme', socials:{x:'@acme'}}, design:{footer:{left:{text:'{{organization.name}}'}, right:{socials:true}}}, slides:[{text:'Body'}]};
  const {native} = await exportAndRetain('furniture-links', source);
  const links = all(native, 'a:r').filter(run => run['a:rPr']?.['a:hlinkClick']);
  assert.ok(links.length > 0, 'Reach the linked furniture converter');
  for (const run of links) assert.equal(run['a:rPr'].u, 'none', 'Furniture explicitly suppresses hyperlink underline');
});
test('ordinary false/absent underline and hyperlink export control', async () => {
  const ordinary = rich.filter(value => typeof value === 'string' || !value.underline);
  const source = deck({blocks:[{text:ordinary}, {items:[{text:ordinary}]}, {table:{columns:['Plain header'], rows:[[ordinary]]}}]});
  const {native} = await exportAndRetain('ordinary', source);
  const runs = all(native, 'a:r');
  assert.ok(runs.length > 0);
  for (const run of runs) assert.equal(run['a:rPr']?.u, run['a:rPr']?.['a:hlinkClick'] ? 'sng' : undefined);
});
