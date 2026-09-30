import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {catalogs} from '@openpresentation/opf';
import {toPptx, fromPptx} from '../dist/index.js';

// FF-59: the slide tag is the eyebrow label. The export writes its run in the deck primary colour, the colour
// opf-render draws it in (colors.primary: scheme.primary, else accent1). Where the deck theme holds that colour in
// accent1 the run is a:schemeClr accent1 (FF-24 convention: engine chrome follows the deck theme); otherwise it is the
// literal. The title, subtitle and body keep the text colour.

const parts = bytes => unzipSync(new Uint8Array(bytes));
const slideXml = entries => {
  const xml = strFromU8(entries['ppt/slides/slide1.xml']);
  assert.equal(XMLValidator.validate(xml), true, 'slide XML');
  return xml;
};
const themeAccent1 = entries => strFromU8(entries['ppt/theme/theme1.xml']).match(/<a:accent1><a:srgbClr val="([0-9A-F]{6})"\/><\/a:accent1>/)[1];
const runs = (xml, text) => [...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map(m => m[1]).filter(body => body.includes(`<a:t>${text}</a:t>`));
const fillOf = run => run.match(/<a:solidFill>(<a:(?:srgbClr|schemeClr) val="[^"]+"\s*\/>)/)?.[1];
const hex = value => value.replace(/^#/, '').toUpperCase();
const slide = {id: 'intro', layout: 'title-slide', tag: 'Pitch Intro', title: 'New category, clear wedge', subtitle: 'Why now', items: ['Problem worth solving']};
const tagRuns = xml => { const found = runs(xml, 'Pitch Intro'); assert.equal(found.length, 1, 'one tag run'); return found; };

// 1. Every catalog color scheme: the tag is a:schemeClr accent1 and resolves to the theme accent1 (the renderer's
// primary). No scheme in the catalog names a separate primary.
assert.ok(catalogs.colorSchemes.length > 10);
for (const record of catalogs.colorSchemes) {
  const entries = parts(await toPptx({design: {colorScheme: record.id}, slides: [slide]}));
  const xml = slideXml(entries);
  const expected = hex(record.primary ?? record.accent1);
  const [run] = tagRuns(xml);
  assert.equal(fillOf(run), '<a:schemeClr val="accent1"/>', `${record.id}: tag is scheme accent1`);
  assert.equal(themeAccent1(entries), expected, `${record.id}: theme accent1 is the preview primary`);
  // Only the tag is retinted: the title keeps the text colour.
  assert.notEqual(fillOf(runs(xml, 'New category, clear wedge')[0]), '<a:schemeClr val="accent1"/>', `${record.id}: title is not the tag colour`);
}

// 2. A scheme that names a primary other than accent1: the theme does not hold it, so the tag stays the literal primary.
{
  const scheme = {light1: '#FFFFFF', dark1: '#111111', accent1: '#AA0000', primary: '#0055AA'};
  const [run] = tagRuns(slideXml(parts(await toPptx({design: {colorScheme: scheme}, slides: [slide]}))));
  assert.equal(fillOf(run), '<a:srgbClr val="0055AA"/>');
}

// 3. A slide with its own scheme is pinned to literals, even when the deck theme holds the same colour.
{
  const entries = parts(await toPptx({design: {colorScheme: 'cool-horizon'}, slides: [{...slide, design: {colorScheme: 'boost'}}]}));
  const boost = catalogs.colorSchemes.find(record => record.id === 'boost');
  assert.notEqual(hex(boost.accent1), themeAccent1(entries));
  const [run] = tagRuns(slideXml(entries));
  assert.equal(fillOf(run), `<a:srgbClr val="${hex(boost.primary ?? boost.accent1)}"/>`);
}

// 4. A tag that wraps writes every line in the tag colour.
{
  const long = {...slide, tag: 'A long eyebrow label that needs more than one line to fit in the heading width, '.repeat(6)};
  const xml = slideXml(parts(await toPptx({design: {colorScheme: 'cool-horizon'}, slides: [long]})));
  const tagShapes = [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF heading slides\.0\.tag line \d+"[\s\S]*?<\/p:sp>/g)].map(m => m[0]);
  assert.ok(tagShapes.length >= 1);
  for (const shape of tagShapes) for (const run of shape.match(/<a:r>[\s\S]*?<\/a:r>/g) ?? []) assert.equal(fillOf(run), '<a:schemeClr val="accent1"/>');
}

// 5. Byte-identical output and lossless re-import of the tag text.
{
  const deck = {design: {colorScheme: 'cool-horizon'}, slides: [slide]};
  const first = await toPptx(deck), second = await toPptx(deck);
  assert.deepEqual(Buffer.from(first), Buffer.from(second), 'deterministic');
  const imported = await fromPptx(first);
  assert.equal(imported.slides[0].tag, 'Pitch Intro');
  assert.equal(imported.design.colorScheme, 'cool-horizon');
}
console.log('tag colour ok');
