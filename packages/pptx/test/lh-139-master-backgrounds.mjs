// LH-139, LH-140 and LH-146 in the PPTX export.
// LH-139: a deck with a fixed hex, gradient, pattern or picture background writes it on the slide master, and its layouts inherit it, so a
// slide added in PowerPoint draws on it instead of white; a layout variant (LH-01, LH-96) keeps its own bg1 background per layout.
// LH-140: the subtitle placeholders of the template layouts, and the body or content placeholders whose region does not lead with a list,
// say no bullet (and no hanging indent) in their list style, so a slide added in PowerPoint shows no stray master bullet; a region that
// leads with a list keeps the bullets.
// LH-146: the step-badge numeral of a right-to-left deck is an en-US run, so PowerPoint draws it in the bold body face, not the
// complex-script face of the deck language.
import assert from 'node:assert/strict';
import {crc32, deflateSync} from 'node:zlib';
import {strFromU8, unzipSync} from 'fflate';
import {gallery} from '@openpresentation/gallery';
import {toPptx} from '../dist/index.js';

const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
  return out;
};
const png = hex => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const pixel = Buffer.from([0, ...hex.slice(1).match(/\w\w/g).map(value => Number.parseInt(value, 16))]);
  return `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixel)), chunk('IEND', Buffer.alloc(0))]).toString('base64')}`;
};
const slides = [
  {layout: 'cover', title: 'Quarterly review', subtitle: 'Operations'},
  {layout: 'section', title: 'Part two', subtitle: 'The evidence'},
  {layout: 'text', title: 'Content', text: 'A plain slide.'},
  {layout: 'list', title: 'Points', blocks: [{items: ['One', 'Two', 'Three']}]},
  {layout: 'agenda', title: 'Agenda', blocks: [{items: ['Welcome', 'Results', 'Plan']}]},
];
const open = async (document, options = {}) => {
  const files = unzipSync(await toPptx({name: 'LH-139', language: 'en-US', slides, ...document}, {catalogs: [gallery], ...options}));
  const text = name => strFromU8(files[name]);
  const layouts = Object.keys(files).filter(name => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).map(name => ({name, xml: text(name)}));
  const named = title => layouts.find(({xml}) => xml.includes(`<p:cSld name="${title}"`))?.xml;
  return {files, text, layouts, named, master: text('ppt/slideMasters/slideMaster1.xml'), masterRels: text('ppt/slideMasters/_rels/slideMaster1.xml.rels')};
};
const bgOf = xml => xml.match(/<p:bg>[\s\S]*?<\/p:bg>/)?.[0];
let checks = 0;

// 1. A fixed hex, gradient or pattern background is on the master; the layouts inherit it (none draws its own); the slides keep theirs.
for (const [name, background, expected] of [
  ['hex', '#7A1F3D', /<a:solidFill><a:srgbClr val="7A1F3D"/],
  ['gradient', {type: 'gradient', gradient: {angle: 90, stops: [{position: 0, color: '#10243E'}, {position: 1, color: '#3E6B8F'}]}}, /<a:gradFill\b[\s\S]*<a:srgbClr val="10243E"[\s\S]*<a:srgbClr val="3E6B8F"/],
  ['pattern', {type: 'pattern', pattern: {preset: 'pct20', foregroundColor: '#2A4B7C', backgroundColor: '#F4EFE6'}}, /<a:pattFill prst="pct20">/],
]) {
  const {master, layouts, text} = await open({design: {theme: 'classic', background}});
  assert.match(bgOf(master) ?? '', expected, `${name}: the master draws the deck background`);
  assert.equal(layouts.filter(({xml}) => bgOf(xml)).length, 0, `${name}: no layout draws its own background, so each inherits the master's`);
  for (const index of [1, 2, 3, 4, 5]) assert.match(bgOf(text(`ppt/slides/slide${index}.xml`)) ?? '', expected, `${name}: slide ${index} keeps its own background`);
  checks += 8;
}

// 2. A picture background is a picture fill of the master, related to the media the slide embeds (a native fill, or the picture of one with alt text).
for (const alt of [undefined, 'Night sky']) {
  const {files, master, masterRels, layouts, text} = await open({design: {theme: 'classic', background: {type: 'image', src: png('#14202E'), tone: 'dark', ...(alt ? {alt} : {})}}});
  const fill = bgOf(master) ?? '';
  const id = fill.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
  assert.match(fill, /<a:blipFill\b/, `picture${alt ? ' with alt' : ''}: the master draws a picture fill`);
  const target = new RegExp(`<Relationship\\b[^>]*\\bId="${id}"[^>]*\\bTarget="\\.\\./media/([^"]+)"`).exec(masterRels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*\\bTarget="\\.\\./media/([^"]+)"[^>]*\\bId="${id}"`).exec(masterRels)?.[1];
  assert.ok(id && target && files[`ppt/media/${target}`], 'the picture fill names media that the package holds');
  assert.match(masterRels, /relationships\/image"/);
  assert.equal(layouts.filter(({xml}) => bgOf(xml)).length, 0, 'the layouts inherit the master picture');
  assert.match(text('ppt/slides/slide3.xml'), alt ? /<p:pic>/ : /<p:bg>[\s\S]*<a:blipFill/, 'the slide still draws the picture');
  checks += 6;
}

// 3. No fixed background: the master and layouts are as before (the vendored bg1 style), and a layout variant keeps its own bg1 per layout.
{
  const {master, named, layouts} = await open({design: {theme: 'classic'}});
  assert.equal(bgOf(master), undefined, 'a deck with no fixed background leaves the master background alone');
  assert.match(bgOf(named('Section')) ?? '', /<a:schemeClr val="bg1"\/>/, 'the section layout keeps its variant background');
  assert.match(named('Text'), /<p:bgRef idx="1001">/, 'a plain layout keeps the style background');
  assert.ok(layouts.length > 4);
  checks += 4;
}

// 4. LH-140: no bullet on subtitle placeholders and on text bodies; the list regions keep the master's bullets.
{
  const {named} = await open({design: {theme: 'classic'}});
  const shapes = xml => [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g)].map(([shape]) => shape);
  const find = (title, ph) => shapes(named(title)).find(shape => shape.includes(`<p:ph ${ph}/>`));
  const levels = shape => ({none: shape.match(/<a:buNone\/>/g)?.length ?? 0, flat: shape.match(/<a:lvl\dpPr marL="0" indent="0"/g)?.length ?? 0});
  for (const title of ['Cover', 'Section']) assert.deepEqual(levels(find(title, 'type="subTitle" idx="1"')), {none: 9, flat: 9}, `${title}: the subtitle says no bullet at any level`);
  assert.deepEqual(levels(find('Text', 'idx="100"')), {none: 9, flat: 9}, 'Text: a text region says no bullet');
  assert.deepEqual(levels(find('List', 'idx="100"')), {none: 0, flat: 0}, 'List: the list region keeps the master bullets');
  assert.deepEqual(levels(find('Agenda', 'type="body" idx="300"')), {none: 0, flat: 0}, 'Agenda: the items region keeps the master bullets');
  assert.deepEqual(levels(find('Cover', 'type="ctrTitle"')), {none: 0, flat: 0}, 'a title is untouched');
  checks += 6;
}

// 5. LH-146: the badge numeral of a right-to-left deck is an en-US run; a left-to-right deck keeps its bytes.
{
  const steps = language => ({language, slides: [{title: language === 'ar' ? 'من الطلب إلى التشغيل' : 'From request to run', layout: 'process', blocks: ['1', '2', '3'].map((n, index) => ({region: 'steps', items: [{text: language === 'ar' ? ['تحديد', 'إعداد', 'تدريب'][index] : ['Scope', 'Set up', 'Train'][index]}], numbering: {style: 'arabic', start: index + 1}}))}]});
  const badges = async language => {
    const {text} = await open(steps(language), {});
    const xml = text('ppt/slides/slide1.xml');
    return [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF steps [^"]*badge[^"]*"[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
  };
  const arabic = await badges('ar'), english = await badges('en-US');
  assert.ok(arabic.length >= 3 && english.length >= 3, 'both decks draw step badges');
  for (const shape of arabic) assert.match(shape, /<a:rPr lang="en-US" altLang="en-US"[^>]*b="1"[\s\S]*?<a:t>\d<\/a:t>/, 'an Arabic deck writes the numeral as an en-US run');
  for (const shape of english) assert.doesNotMatch(shape, /altLang/, 'an English deck writes no run language of its own');
  checks += 2 + arabic.length + english.length;
}

console.log(`LH-139/140/146 passed: ${checks} checks (fixed backgrounds on the master, no stray bullets on subtitle and text placeholders, en-US badge numerals).`);
