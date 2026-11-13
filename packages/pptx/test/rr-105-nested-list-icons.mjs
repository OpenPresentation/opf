// RR-105 (coverage finding 05): the PPTX draws the chips of a nested list's first-level entries where the preview draws them (core's
// geometry), the nested entries keep their native bullets, and the import gives every entry, and every icon, back.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {composeSlide} from '@openpresentation/opf/composition';
import {resolveSlideContext} from '@openpresentation/opf';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const deck = () => ({
  language: 'en-US', design: {background: 'light1'}, icons: {mark: MARK},
  slides: [{title: 'Icons', items: [{text: 'Alpha', icon: 'mark'}, {text: 'Beta', level: 1, icon: 'mark'}, {text: 'Gamma', level: 1}, {text: 'Delta', icon: 'mark'}]}],
});
const EMU = 9525;

test('the chips of the first-level entries are native ellipses at core\'s geometry; nested entries keep bullets', async () => {
  const source = deck(), diagnostics = [];
  const bytes = await toPptx(source, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  const xml = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const chips = [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF icon ([^"]*) chip"[\s\S]*?<\/p:sp>/g)];
  assert.equal(chips.length, 2);
  const context = resolveSlideContext(source, 0), composed = composeSlide(context.slide, context.options);
  for (const [index, icon] of composed.icons.entries()) {
    const shape = chips.find(chip => chip[1].includes(icon.path))?.[0];
    assert.ok(shape, icon.path);
    const [, x, y, cx] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)"/.exec(shape).map(Number);
    assert.ok(Math.abs(x / EMU + cx / EMU / 2 - icon.chip.cx) < 0.5 && Math.abs(y / EMU + cx / EMU / 2 - icon.chip.cy) < 0.5, `chip ${index} at core's center`);
  }
  // Two nested paragraphs with the level-1 dash as their native bullet.
  assert.equal((xml.match(/<a:buChar char="&#x2013;"\/>/g) ?? []).length, 2);
  assert.deepEqual(diagnostics.filter(diagnostic => diagnostic.code === 'icon-dropped').map(diagnostic => diagnostic.path), ['slides.0.items.1.icon']);
});

test('the nested icon list comes back from the import with the icons it draws', async () => {
  const source = deck();
  const imported = await fromPptx(await toPptx(source));
  // The list, its levels and its drawn icons come back. An icon that is not drawn (icon-dropped: here the nested entry's) has no native
  // shape to come back from, as before this change (known gap, every dropped icon).
  const expected = structuredClone(source.slides[0].items);
  delete expected[1].icon;
  assert.deepEqual(imported.slides[0].items, expected);
  assert.deepEqual(imported.icons, source.icons);
});

test('a bullet removed natively from a nested entry is still a changed list, as for any list', async () => {
  const entries = unzipSync(await toPptx(deck()));
  const part = 'ppt/slides/slide1.xml', xml = strFromU8(entries[part]);
  const edited = xml.replace(/<a:buChar char="&#x2013;"\/>/, '<a:buNone/>');
  assert.notEqual(edited, xml);
  entries[part] = strToU8(edited);
  const diagnostics = [];
  await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.ok(diagnostics.some(diagnostic => diagnostic.code === 'list-line-role-changed'), JSON.stringify(diagnostics.map(diagnostic => diagnostic.code)));
});
