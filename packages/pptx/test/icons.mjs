// LH-14 in the PPTX export and import: a monochrome icon is a chip ellipse and native custom geometries in the theme accent (accent1,
// the chip with its lumMod and lumOff), so the icon recolors with the theme; a multicolor SVG icon is an SVG picture with its PNG
// fallback; every icon shape carries an OPF_ICON_V1 tag, and import consumes the shapes and gives each `icon` back to its entry,
// metric or group, with the deck's own `icons` map.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {galleryIconSets} from '@openpresentation/gallery/icon-sets';
import {fromPptx, toPptx} from '../dist/index.js';

const MULTI = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="10" fill="#f00"/><rect x="5" width="5" height="10" fill="#00f"/></svg>';
const deck = {
  name: 'Icons', language: 'en', design: {background: 'light1'},
  icons: {multi: MULTI},
  slides: [
    {title: 'What is new', items: [{text: 'Offline mode', description: 'Keep working without a connection.', icon: 'lucide:wifi-off'}, {text: 'Faster search', description: 'Results in 200 ms.', icon: 'tabler:search'}]},
    {title: 'Numbers', blocks: [{metric: {value: '98%', label: 'Uptime', icon: 'lucide:activity'}}, {metric: {value: '12k', label: 'Users', icon: 'lucide:users'}}]},
    {title: 'Partners', blocks: [{icon: 'multi', blocks: [{text: 'Gold'}, {text: 'Co-selling and joint roadmaps.'}]}, {icon: 'lucide:handshake', blocks: [{text: 'Referral'}, {text: 'A share of first-year revenue.'}]}]},
  ],
};
const bytes = await toPptx(deck, {catalogs: [gallery, galleryIconSets]});
const files = unzipSync(bytes);
const slide = index => strFromU8(files[`ppt/slides/slide${index}.xml`]);
const shapes = (xml, role) => [...xml.matchAll(/<p:(sp|pic)>(?:(?!<\/p:\1>)[\s\S])*?name="OPF icon [^"]*"[\s\S]*?<\/p:\1>/g)].map(([shape]) => shape).filter(shape => shape.includes(` ${role}`));
let checks = 0;

const first = slide(1);
const chips = shapes(first, 'chip"'), glyphs = shapes(first, 'glyph 0"');
assert.equal(chips.length, 2);
assert.equal(glyphs.length, 2);
for (const chip of chips) assert.match(chip, /<a:prstGeom prst="ellipse">[\s\S]*<a:solidFill><a:schemeClr val="accent1"><a:lumMod val="20000"\/><a:lumOff val="80000"\/><\/a:schemeClr><\/a:solidFill>/, 'the chip is a tint of accent1');
for (const glyph of glyphs) {
  assert.match(glyph, /<a:custGeom>[\s\S]*<a:moveTo>[\s\S]*<a:cubicBezTo>/, 'the glyph is a native custom geometry with curves');
  assert.match(glyph, /<a:noFill\/><a:ln w="\d+" cap="rnd"><a:solidFill><a:schemeClr val="accent1"\/><\/a:solidFill>[\s\S]*<a:round\/><\/a:ln>/, 'a stroke icon is a round-capped line in accent1, unfilled');
}
checks += 4 + glyphs.length;
assert.equal(shapes(slide(2), 'chip"').length, 2, 'each metric has a chip');
const third = slide(3);
assert.equal(shapes(third, 'picture"').length, 1, 'the multicolor icon is a picture');
assert.ok(Object.keys(files).some(path => /^ppt\/media\/svg-3-\d+\.svg$/.test(path)), 'with its SVG part');
assert.equal(shapes(third, 'chip"').length, 1, 'the other group keeps its chip');
checks += 4;
const tags = Object.keys(files).filter(path => /^ppt\/tags\/opfIcon\d+\.xml$/.test(path));
assert.ok(tags.length >= 9, `${tags.length} icon tags`);
checks += 1;

const imported = await fromPptx(bytes, {catalogs: [gallery]});
const presentation = imported.presentation ?? imported;
assert.deepEqual(presentation.slides[0].items?.map(item => item.icon) ?? presentation.slides[0].blocks?.[0]?.items?.map(item => item.icon), ['lucide:wifi-off', 'tabler:search']);
assert.deepEqual(presentation.slides[1].blocks.map(block => block.metric.icon), ['lucide:activity', 'lucide:users']);
assert.deepEqual(presentation.slides[2].blocks.map(block => block.icon), ['multi', 'lucide:handshake']);
assert.equal(presentation.icons?.multi, MULTI);
const text = JSON.stringify(presentation);
assert.doesNotMatch(text, /OPF icon/, 'no icon shape comes back as content');
checks += 5;
console.log(`icons passed: ${checks} checks (native theme-colored glyphs, an SVG picture for a multicolor icon, tags, and the round trip).`);
