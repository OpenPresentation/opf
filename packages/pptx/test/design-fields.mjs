import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, unzipSync, zipSync} from 'fflate';
import { toSvg, resolvePresentation } from '@openpresentation/opf-render';
import {checkTypefaces, fromPptx, toPptx} from '../dist/index.js';

// Spec-gap closure A (P2): the design fields that used to change nothing export natively.
// - the deck logo on cover and section slides: one native picture `OPF logo` at core's geometry.logo box
// - header/footer `logo: true`: a generated image part, re-imported as the flag
// - design.listBullet: image: native picture bullets (a:buBlip), re-imported as a list
// - fontScheme.accent: the slide tag and the quote body carry the accent typeface

const image = async name => new Uint8Array(await readFile(new URL(`./fixtures/images/${name}`, import.meta.url)));
const uri = (bytes, type = 'image/png') => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const wideBytes = await image('wide.png'), tallBytes = await image('tall.png'), squareBytes = await image('square.png'), jpgBytes = await image('wide.jpg');
const wide = uri(wideBytes), tall = uri(tallBytes), square = uri(squareBytes), jpg = uri(jpgBytes, 'image/jpeg');
const light = {type: 'solid', color: '#FFFFFF'}, dark = {type: 'solid', color: '#0B1220'};

const decoder = new TextDecoder();
const open = async (deck, options = {}) => {
  const bytes = await toPptx(deck, {seed: 1, timestamp: '2026-01-01T00:00:00Z', ...options});
  return {bytes, entries: unzipSync(bytes)};
};
const slideXml = (entries, index) => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]);
const slideRels = (entries, index) => decoder.decode(entries[`ppt/slides/_rels/slide${index + 1}.xml.rels`]);
const pictures = xml => [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(([picture]) => ({
  xml: picture,
  name: picture.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1],
  descr: picture.match(/<p:cNvPr\b[^>]*\bdescr="([^"]*)"/)?.[1],
  embed: picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1],
  x: Number(picture.match(/<a:off x="(-?\d+)"/)?.[1]) / 9525, y: Number(picture.match(/<a:off x="-?\d+" y="(-?\d+)"/)?.[1]) / 9525,
  w: Number(picture.match(/<a:ext cx="(\d+)"/)?.[1]) / 9525, h: Number(picture.match(/<a:ext cx="\d+" cy="(\d+)"/)?.[1]) / 9525,
}));
const mediaFor = (entries, index, embed) => {
  const target = slideRels(entries, index).match(new RegExp(`<Relationship Id="${embed}"[^>]*Target="([^"]+)"`))?.[1];
  assert.ok(target, `relationship ${embed} on slide ${index}`);
  return entries[`ppt/${target.replace(/^\.\.\//, '')}`];
};
const sameBytes = (a, b) => a && b && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const near = (actual, expected, label, tolerance = .75) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const attr = (element, name) => element.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const imageTags = svg => [...svg.matchAll(/<image\b[^>]*>/g)].map(match => match[0]);
// The picture rectangle an SVG <image> draws: contained in its box, anchored by preserveAspectRatio.
const drawn = (element, intrinsic) => {
  const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(name => Number(attr(element, name)));
  const scale = Math.min(width / intrinsic.width, height / intrinsic.height);
  const w = intrinsic.width * scale, h = intrinsic.height * scale;
  return {x: attr(element, 'preserveAspectRatio').startsWith('xMin') ? x : x + (width - w) / 2, y: y + (height - h) / 2, w, h};
};
const sizes = new Map([[wide, {width: 120, height: 60}], [tall, {width: 60, height: 120}], [square, {width: 80, height: 80}], [jpg, {width: 120, height: 60}]]);
let checked = 0;

// ---- Cover and section logos: placement, order, parity with the preview, provenance, re-import.
{
  const deck = {design: {logo: wide, background: light, watermark: tall}, slides: [
    {title: 'Quarterly review', subtitle: 'Results', layout: 'title-subtitle'},
    {title: 'Part one', layout: 'section-divider'},
    {title: 'Content', text: 'Body copy stays logo free.'},
    {title: 'Items', items: ['One', 'Two']},
  ]};
  const {entries, bytes} = await open(deck);
  const geometry = resolvePresentation(deck).slides.map(slide => slide.geometry);
  assert.ok(geometry[0].logo && geometry[1].logo && !geometry[2].logo && !geometry[3].logo, 'core composes the logo on covers and sections only');
  for (const index of [0, 1]) {
    const xml = slideXml(entries, index), all = pictures(xml);
    const logos = all.filter(picture => picture.name === 'OPF logo');
    assert.equal(logos.length, 1, `slide ${index}: one native logo picture`);
    const [logo] = logos;
    assert.equal(logo.descr, 'Logo', 'alt text');
    // Left-anchored, vertically centered inside core's box, fitted without cropping.
    const {box} = geometry[index].logo, scale = Math.min(box.width / 120, box.height / 60);
    near(logo.w, 120 * scale, `slide ${index} logo width`); near(logo.h, 60 * scale, `slide ${index} logo height`);
    near(logo.x, box.x, `slide ${index} logo left edge`); near(logo.y, box.y + (box.height - 60 * scale) / 2, `slide ${index} logo top`);
    assert.ok(!/<a:srcRect/.test(logo.xml), 'fitted, not cropped');
    assert.ok(sameBytes(mediaFor(entries, index, logo.embed), wideBytes), 'the logo bytes are embedded');
    // Paint order: watermark, then the logo, then every heading.
    assert.ok(xml.indexOf('name="OPF watermark"') < xml.indexOf('name="OPF logo"') && xml.indexOf('name="OPF logo"') < xml.indexOf('name="OPF heading'), `slide ${index}: watermark, logo, content`);
    // The preview draws the same rectangle.
    const svg = toSvg(deck, index + 1, {trace: true});
    const generated = imageTags(svg).filter(element => attr(element, 'data-opf-generated') === 'true');
    assert.equal(generated.length, 1, 'one preview logo');
    const preview = drawn(generated[0], sizes.get(wide));
    for (const key of ['x', 'y', 'w', 'h']) near(logo[key], preview[key], `slide ${index} preview parity ${key}`, 1);
    checked++;
  }
  for (const index of [2, 3]) assert.ok(!/name="OPF logo"/.test(slideXml(entries, index)), `content slide ${index} has no logo`);
  // Native tag, then re-import: the logo returns as design.logo; the picture is not content.
  assert.match(slideXml(entries, 0), /<p:custDataLst><p:tags r:id="rIdOpfLogo1"\/>/);
  assert.ok(entries['ppt/tags/opfLogo1.xml'] && entries['ppt/tags/opfLogo2.xml'] && /OPF_LOGO_V1/.test(strFromU8(entries['ppt/tags/opfLogo1.xml'])));
  const diagnostics = [];
  const imported = await fromPptx(bytes, {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.equal(imported.design.logo, wide, 'design.logo round-trips');
  assert.equal(imported.design.watermark?.src, tall, 'the watermark is unaffected');
  for (const [index, slide] of imported.slides.entries()) assert.ok(!slide.image && !slide.blocks && !(slide.design && slide.design.logo), `slide ${index} carries no content picture`);
  assert.ok(!diagnostics.some(item => item.code === 'invalid-logo-provenance'), 'no provenance report on an unchanged export');
  const again = await toPptx(imported, {seed: 1, timestamp: '2026-01-01T00:00:00Z'});
  const second = unzipSync(again);
  assert.equal(pictures(slideXml(second, 0)).filter(picture => picture.name === 'OPF logo').length, 1, 're-export draws the logo once');
  // Deterministic.
  const rerun = await toPptx(deck, {seed: 1, timestamp: '2026-01-01T00:00:00Z'});
  assert.ok(sameBytes(rerun, bytes), 'two exports of the same deck are byte-identical');
  checked++;
}

// ---- Variant choice follows the slide background, as in the preview; the organization logo is the fallback.
{
  const set = {light: tall, dark: square, default: wide};
  const deck = {design: {logo: set, background: light}, slides: [
    {title: 'On light', layout: 'title'},
    {title: 'On dark', layout: 'title', design: {background: dark}},
    {title: 'Own logo', layout: 'title', design: {logo: jpg}},
  ]};
  const {entries} = await open(deck);
  const expected = [square, tall, jpg];
  for (const [index, source] of expected.entries()) {
    const [logo] = pictures(slideXml(entries, index)).filter(picture => picture.name === 'OPF logo');
    assert.ok(logo, `slide ${index} logo`);
    const bytes = mediaFor(entries, index, logo.embed);
    assert.ok(sameBytes(bytes, Buffer.from(source.split(',')[1], 'base64')), `slide ${index} draws the ${['dark', 'light', 'slide'][index]} variant`);
    // The same variant the preview chooses.
    const svg = toSvg(deck, index + 1, {trace: true});
    const generated = imageTags(svg).find(element => attr(element, 'data-opf-generated') === 'true');
    assert.equal(attr(generated, 'href'), source, `slide ${index} preview variant`);
  }
  const organization = {organization: {id: 'acme', name: 'Acme', logo: tall}, design: {background: light}, slides: [{title: 'Org', layout: 'title'}]};
  const org = await open(organization);
  const [logo] = pictures(slideXml(org.entries, 0)).filter(picture => picture.name === 'OPF logo');
  assert.ok(logo && sameBytes(mediaFor(org.entries, 0, logo.embed), tallBytes), 'organization.logo is drawn where the deck logo would be');
  const imported = await fromPptx(org.bytes);
  assert.equal(imported.organization.logo, tall, 'organization.logo returns from the document tag');
  assert.equal(imported.design?.logo, undefined, 'no design.logo is fabricated from the organization logo');
  checked++;
}

// ---- Unresolved and unsupported logos: the preview's placeholder panel and one unresolved-asset diagnostic.
{
  const missing = {design: {logo: 'asset:missing', background: light}, slides: [{title: 'Cover', layout: 'title'}]};
  const diagnostics = [];
  const {entries} = await open(missing, {onDiagnostic: item => diagnostics.push(item)});
  assert.ok(!/name="OPF logo"/.test(slideXml(entries, 0)));
  assert.match(slideXml(entries, 0), /name="OPF image placeholder 1"/, 'the panel stands where the logo would be');
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-asset').map(item => item.path), ['design.logo']);
  await assert.rejects(() => toPptx(missing, {strictAssets: true}));
  const svg = toSvg(missing, 1, {trace: true});
  assert.match(svg, /data-opf-asset-status="unresolved"/);
  checked++;
}

// ---- Header and footer `logo: true`: a generated image part with the icon variant, re-imported as the flag.
{
  const icon = jpg;
  const deck = {design: {logo: {default: wide, icon}, background: light, footer: {left: {logo: true}}, header: {right: {logo: true, text: 'Confidential'}}},
    slides: [{title: 'Content', text: 'Body copy.'}, {title: 'Cover', layout: 'title'}]};
  const {entries, bytes} = await open(deck);
  const geometry = resolvePresentation(deck).slides[0].geometry;
  const parts = geometry.furniture.parts.filter(part => part.field === 'logo');
  assert.equal(parts.length, 2);
  const natives = pictures(slideXml(entries, 0)).filter(picture => /^OPF image \d+$/.test(picture.name));
  assert.equal(natives.length, 2, 'header and footer logo pictures');
  const svg = toSvg(deck, 1, {trace: true});
  const groups = [...svg.matchAll(/<g\b[^>]*data-opf-furniture-field="logo"[^>]*>[\s\S]*?<\/g>/g)].map(match => match[0]);
  assert.equal(groups.length, 2);
  for (const part of parts) {
    const native = natives.find(picture => Math.abs(picture.x - (part.box.x + (part.box.width - Math.min(part.box.width, part.box.height * 2)) / 2)) < 2 && Math.abs(picture.y - part.box.y) < part.box.height);
    assert.ok(native, `${part.kind} logo native picture near its part box`);
    assert.ok(sameBytes(mediaFor(entries, 0, native.embed), jpgBytes), 'the icon variant is embedded');
  }
  // Pixel parity with the preview's image part: same fitted rectangle.
  const previewImages = groups.map(group => drawn(imageTags(group)[0], sizes.get(icon)));
  for (const native of natives) assert.ok(previewImages.some(rect => ['x', 'y', 'w', 'h'].every(key => Math.abs(rect[key] - native[key]) <= 1)), 'native logo matches a preview logo rectangle');
  const imported = await fromPptx(bytes);
  assert.deepEqual(imported.design.footer?.left, {logo: true}, 'the footer logo returns as the flag');
  assert.deepEqual(imported.design.header?.right, {logo: true, text: 'Confidential'}, 'the header logo and text return');
  assert.ok(!JSON.stringify(imported.design.footer).includes('data:'), 'no data URI image is fabricated');
  assert.deepEqual(imported.design.logo, {default: wide, icon}, 'design.logo itself is restored from the document tag');
  // Without any logo the part reports unresolved-content and nothing is drawn; the flag still round-trips.
  const bare = {design: {footer: {left: {logo: true}}}, slides: [{title: 'Content', text: 'Body copy.'}]};
  const diagnostics = [];
  const result = await open(bare, {onDiagnostic: item => diagnostics.push(item)});
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-content').map(item => item.path), ['design.footer.left.logo']);
  assert.equal(pictures(slideXml(result.entries, 0)).length, 0);
  const reimported = await fromPptx(result.bytes);
  assert.deepEqual(reimported.design.footer, {left: {logo: true}});
  checked++;
}

// ---- Picture bullets: a:buBlip per entry in place of a:buChar, the preview's marker size, still a list on import.
{
  const entries = ['Alpha', 'Beta', 'Gamma'];
  const deck = {design: {logo: {default: wide, icon: square}, listBullet: 'image', background: light}, slides: [{title: 'Items', items: entries}, {title: 'More', items: ['Delta']}]};
  const character = {...deck, design: {...deck.design, listBullet: undefined}};
  const picture = await open(deck), plain = await open(character);
  const xml = slideXml(picture.entries, 0);
  const geometry = resolvePresentation(deck).slides[0].geometry;
  const list = geometry.items.find(item => item.field === 'items');
  assert.ok(list.bulletImage, 'core attaches the picture bullet');
  assert.equal([...xml.matchAll(/<a:buBlip>/g)].length, entries.length, 'one picture bullet per entry');
  assert.ok(!/<a:buChar/.test(xml), 'no character bullets');
  assert.ok(!/name="OPF bullet image"/.test(xml) && pictures(xml).length === 0, 'the embedding picture is not drawn');
  const embeds = [...xml.matchAll(/<a:buBlip><a:blip r:embed="([^"]+)"\/><\/a:buBlip>/g)].map(match => match[1]);
  assert.equal(new Set(embeds).size, 1, 'one relationship serves every bullet');
  assert.ok(sameBytes(mediaFor(picture.entries, 0, embeds[0]), squareBytes), 'the icon variant is the bullet picture');
  // Same paragraph geometry as the character bullets: only the marker changes.
  const normalize = text => text.replace(/<a:buBlip>.*?<\/a:buBlip>/g, '<BU/>').replace(/<a:buChar [^>]*\/>/g, '<BU/>').replace(/<a:buClr>.*?<\/a:buClr>|<a:buSzPts [^>]*\/>|<a:buFont [^>]*\/>/g, '');
  // Shape ids stay unique but leave the removed embedding picture's id unused.
  const strip = text => normalize(text).replace(/<a:buSzPct val="100000"\/>/g, '').replace(/<p:cNvPr id="\d+"/g, '<p:cNvPr id=""').replace(/ name="OPF image \d+"/g, '');
  assert.equal(strip(xml), strip(slideXml(plain.entries, 0)), 'bullets are the only difference');
  const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'shape ids stay unique');
  assert.match(xml, /<a:buSzPct val="100000"\/><a:buBlip>/, 'the bullet is the text size');
  // The preview marker is a square of the text size.
  const svg = toSvg(deck, 1, {trace: true});
  const markers = imageTags(svg).filter(element => attr(element, 'aria-hidden') === 'true');
  assert.equal(markers.length, entries.length);
  const textSize = Number(xml.match(/name="OPF list [^"]*"[\s\S]*?<a:rPr lang="en-US" sz="(\d+)"/)?.[1]) / 100 / .75;
  // The picture bullet is PowerPoint's size: a square of 0.65 of the text size once core composes bulletBox, else the text size.
  const bulletSize = list.text.listEntries[0].bulletBox?.width ?? textSize;
  assert.ok(bulletSize === textSize || Math.abs(bulletSize - textSize * .65) < .01, 'core bullet box is 0.65 of the text size');
  for (const marker of markers) near(Number(attr(marker, 'width')), bulletSize, 'preview marker size', .01);
  // Second slide reuses its own relationship.
  assert.equal([...slideXml(picture.entries, 1).matchAll(/<a:buBlip>/g)].length, 1);
  // Re-import: still lists; design.listBullet returns; the media is not a content picture.
  const imported = await fromPptx(picture.bytes);
  assert.equal(imported.design.listBullet, 'image');
  assert.equal(imported.slides[0].items.length, entries.length);
  assert.ok(!imported.slides[0].image && !imported.slides[0].blocks);
  // Native bullets without our tags (a hand-built paragraph) are still list paragraphs on import.
  const hand = new Map(Object.entries(unzipSync(picture.bytes)));
  const stripped = Object.fromEntries([...hand].filter(([path]) => !/^ppt\/tags\//.test(path)).map(([path, data]) => [path, /^ppt\/slides\/slide\d+\.xml$/.test(path) ? new TextEncoder().encode(decoder.decode(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '')) : /^ppt\/slides\/_rels\//.test(path) ? new TextEncoder().encode(decoder.decode(data).replace(/<Relationship [^>]*relationships\/tags"[^>]*\/>/g, '')) : path === '[Content_Types].xml' ? new TextEncoder().encode(decoder.decode(data).replace(/<Override PartName="\/ppt\/tags\/[^>]*\/>/g, '')) : data]));
  const plainImport = await fromPptx(zipSync(stripped));
  const lists = [plainImport.slides[0], ...(plainImport.slides[0].blocks ?? [])].map(node => node.items ?? node.bullets).filter(Array.isArray);
  assert.deepEqual(lists.map(list => list.length), [entries.length], 'tagless picture-bullet paragraphs import as one list');
  assert.equal(plainImport.design?.listBullet, undefined, 'plain PPTX: no listBullet hint without provenance');
  // An icon that cannot be drawn keeps the character bullets with one diagnostic.
  const broken = {design: {logo: 'asset:missing', listBullet: 'image', background: light}, slides: [{title: 'Items', items: entries}]};
  const diagnostics = [];
  const fallback = await open(broken, {onDiagnostic: item => diagnostics.push(item)});
  assert.equal([...slideXml(fallback.entries, 0).matchAll(/<a:buChar/g)].length, entries.length);
  assert.ok(!/<a:buBlip>/.test(slideXml(fallback.entries, 0)));
  assert.equal(diagnostics.filter(item => item.code === 'unresolved-asset' && item.path === 'design.logo').length, 1, 'one unresolved-asset for the icon');
  // Without any logo the glyph bullets stay and core reports the missing logo.
  const noLogo = {design: {listBullet: 'image'}, slides: [{title: 'Items', items: entries}]};
  const reported = [];
  const none = await open(noLogo, {onDiagnostic: item => reported.push(item)});
  assert.equal([...slideXml(none.entries, 0).matchAll(/<a:buChar/g)].length, entries.length);
  assert.deepEqual(reported.filter(item => item.code === 'unresolved-content').map(item => item.path), ['design.listBullet']);
  checked++;
}

// ---- fontScheme.accent: the tag and the quote body carry the accent typeface; theme fonts and body stay.
{
  const accent = 'Georgia';
  const deck = {design: {fontScheme: {id: 'aptos', accent: accent}}, slides: [
    {tag: 'Eyebrow', title: 'Accent check', text: 'Body copy.'},
    {title: 'Quote', quote: {text: 'Design is how it works.', attribution: 'Someone'}},
  ]};
  const {entries, bytes} = await open(deck);
  const families = (xml, name) => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => shape.includes(name))
    .flatMap(shape => [...shape.matchAll(/<a:latin typeface="([^"]*)"/g)].map(match => match[1]));
  const first = slideXml(entries, 0), second = slideXml(entries, 1);
  assert.deepEqual([...new Set(families(first, 'OPF heading slides.0.tag'))], [accent], 'tag run');
  assert.deepEqual([...new Set(families(first, 'OPF heading slides.0.title'))], ['Aptos Display'], 'title run');
  assert.ok(!families(first, '"OPF text').includes(accent) && !/Georgia/.test(first.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*OPF heading slides\.0\.tag[\s\S]*?<\/p:sp>/, '')), 'only the tag carries the accent on slide 1');
  const quote = [...second.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape).filter(shape => /OPF quote 0 part \d line/.test(shape));
  const quoteFaces = quote.map(shape => shape.match(/<a:latin typeface="([^"]*)"/)?.[1]);
  assert.equal(quoteFaces[0], accent, 'quote body');
  assert.notEqual(quoteFaces[1], accent, 'attribution stays body');
  // The theme keeps the major/minor pair; "Fonts Used" lists the accent family; the typeface policy accepts it.
  const theme = strFromU8(entries['ppt/theme/theme1.xml']);
  assert.match(theme, /<a:majorFont><a:latin typeface="Aptos Display"/);
  assert.match(theme, /<a:minorFont><a:latin typeface="Aptos"/);
  assert.match(strFromU8(entries['docProps/app.xml']), /Georgia/);
  assert.ok(checkTypefaces(bytes, {families: ['Aptos', 'Aptos Display', accent, 'Roboto Mono'], monospace: ['Roboto Mono']}).ok, 'chosen fonts including the accent');
  assert.ok(!checkTypefaces(bytes, {families: ['Aptos', 'Aptos Display', 'Roboto Mono'], monospace: ['Roboto Mono']}).ok, 'the accent is a chosen font the author must list');
  // Round trip: the scheme returns from provenance.
  const imported = await fromPptx(bytes);
  assert.deepEqual(imported.design.fontScheme, {id: 'aptos', accent: accent});
  // Without an accent role nothing changes.
  const plain = await open({design: {fontScheme: 'aptos'}, slides: deck.slides});
  assert.ok(!/Georgia/.test(slideXml(plain.entries, 0)) && !/Georgia/.test(slideXml(plain.entries, 1)));
  // The preview draws the same families.
  const svg = toSvg(deck, 1, {trace: true});
  const tag = [...svg.matchAll(/<text\b([^>]*)>/g)].map(match => match[1]).filter(attrs => attrs.includes('data-opf-path="slides.0.tag"')).map(attrs => attr(` ${attrs}`, 'font-family'));
  assert.ok(tag.length && tag.every(family => family.startsWith(accent)), 'preview tag family');
  checked++;
}

// ---- Provenance: edited and damaged logo pictures, no provenance, and a plain PPTX.
{
  const deck = {design: {logo: wide, background: light}, slides: [{title: 'Cover', layout: 'title'}]};
  const {bytes, entries} = await open(deck);
  const repack = edit => zipSync(Object.fromEntries(Object.entries(unzipSync(bytes)).map(([path, data]) => [path, edit(path, data) ?? data])));
  const text = value => new TextEncoder().encode(value);
  // Moved picture: ordinary picture content again, with a diagnostic.
  const moved = repack((path, data) => path === 'ppt/slides/slide1.xml' ? text(decoder.decode(data).replace(/(<p:pic>(?:(?!<\/p:pic>)[\s\S])*name="OPF logo"(?:(?!<\/p:pic>)[\s\S])*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525}`)) : undefined);
  const diagnostics = [];
  const edited = await fromPptx(moved, {onDiagnostic: item => diagnostics.push(item)});
  assert.equal(diagnostics.filter(item => item.code === 'invalid-logo-provenance').length, 1, 'edited logo reported');
  assert.ok(edited.slides[0].image || edited.slides[0].blocks || edited.slides[0].pictures || JSON.stringify(edited.slides[0]).includes('data:image'), 'the edited picture is ordinary content');
  // Damaged tag part.
  const damaged = repack((path, data) => path === 'ppt/tags/opfLogo1.xml' ? text(decoder.decode(data).replace(/val="[^"]*"/, 'val="not-a-tag"')) : undefined);
  const reports = [];
  await fromPptx(damaged, {onDiagnostic: item => reports.push(item)});
  assert.equal(reports.filter(item => item.code === 'invalid-logo-provenance').length, 1, 'damaged tag reported');
  // Exported with provenance: false, the document tag is absent; the logo picture still restores design.logo.
  const noTag = await open(deck, {provenance: false});
  const fromPicture = await fromPptx(noTag.bytes);
  assert.equal(fromPicture.design?.logo?.src, wide, 'design.logo returns from the picture when nothing else restored it');
  assert.ok(!fromPicture.slides[0].image && !fromPicture.slides[0].blocks, 'never a content image');
  // A PPTX whose logo picture has no OPF tag (a deck from another tool) imports it as an ordinary picture.
  const untagged = zipSync(Object.fromEntries(Object.entries(unzipSync(noTag.bytes)).filter(([path]) => !/^ppt\/tags\/opfLogo/.test(path)).map(([path, data]) => [path,
    /^ppt\/slides\/slide1\.xml$/.test(path) ? text(decoder.decode(data).replace(/<p:custDataLst><p:tags r:id="rIdOpfLogo1"\/><\/p:custDataLst>/, '')) :
    /^ppt\/slides\/_rels\/slide1\.xml\.rels$/.test(path) ? text(decoder.decode(data).replace(/<Relationship Id="rIdOpfLogo1"[^>]*\/>/, '')) :
    path === '[Content_Types].xml' ? text(decoder.decode(data).replace(/<Override PartName="\/ppt\/tags\/opfLogo1.xml"[^>]*\/>/, '')) : data])));
  const plain = await fromPptx(untagged);
  assert.equal(plain.design?.logo, undefined, 'plain PPTX: no design.logo is invented');
  assert.ok(JSON.stringify(plain.slides[0]).includes('data:image/png'), 'plain PPTX: the logo imports as an ordinary picture');
  assert.equal(pictures(slideXml(entries, 0)).filter(picture => picture.name === 'OPF logo').length, 1);
  checked++;
}

// ---- A PowerPoint save renames media parts (here a rotation, so a stored part name holds another picture), renumbers
// relationships, renames tag parts and drops whitespace between elements, keeping the bytes. Every logo and the picture
// bullet still restore, matched by content, and an unchanged picture-bullet list round-trips with its structure.
const powerpointSave = bytes => {
  const original = unzipSync(bytes), enc = new TextEncoder(), names = Object.keys(original);
  const media = names.filter(path => /^ppt\/media\/[^/]+$/.test(path)).sort();
  const tags = names.filter(path => /^ppt\/tags\/[^/]+$/.test(path)).sort();
  const moved = new Map([...media.map((path, index) => [path, media[(index + 1) % media.length]]), ...tags.map((path, index) => [path, `ppt/tags/tag${tags.length - index}.xml`])]);
  const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
  const ids = new Map();
  for (const path of names.filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    const all = [...decoder.decode(original[relsOf(path)]).matchAll(/Id="([^"]+)"/g)].map(match => match[1]);
    ids.set(path, new Map(all.map((id, index) => [id, `rIdPP${all.length - index}`])));
  }
  const result = {};
  for (const [path, data] of Object.entries(original)) {
    let out = data;
    if (/\.rels$/.test(path)) {
      const owner = path.replace('_rels/', '').replace(/\.rels$/, ''), directory = owner.replace(/[^/]*$/, '');
      let xml = decoder.decode(data).replace(/Target="([^"]+)"/g, (match, value) => {
        if (/^[a-z]+:/i.test(value)) return match;
        const full = new URL(value, `http://x/${directory}`).pathname.slice(1), to = moved.get(full);
        return to ? `Target="${value.replace(/[^/]+$/, to.split('/').pop())}"` : match;
      });
      for (const [from, to] of ids.get(owner) ?? []) xml = xml.replace(`Id="${from}"`, `Id="${to}"`);
      out = enc.encode(xml);
    } else if (path === '[Content_Types].xml') {
      out = enc.encode(decoder.decode(data).replace(/PartName="\/([^"]+)"/g, (match, part) => `PartName="/${moved.get(part) ?? part}"`));
    } else if (ids.has(path)) {
      let xml = decoder.decode(data).replace(/>\s+</g, '><');
      for (const [from, to] of ids.get(path)) xml = xml.replaceAll(`"${from}"`, `"${to}"`);
      out = enc.encode(xml);
    }
    result[moved.get(path) ?? path] = out;
  }
  return zipSync(result);
};
{
  const deck = {design: {logo: {default: wide, light: tall, dark: square, icon: jpg}, listBullet: 'image', background: light, footer: {left: {logo: true}, right: {text: '{{slide.number}}'}}},
    organization: {id: 'acme', name: 'Acme', logo: tall},
    slides: [
      {title: 'Cover', subtitle: 'On light', layout: 'title-subtitle'},
      {title: 'Own', layout: 'title', design: {logo: jpg}},
      {title: 'Items', items: ['Alpha', {text: 'Beta wraps ' + 'word '.repeat(40)}, {text: 'Gamma', description: 'A description line'}, {text: 'Nested', level: 1}]},
    ]};
  const original = await open(deck);
  const saved = powerpointSave(original.bytes);
  const before = unzipSync(original.bytes), after = unzipSync(saved);
  assert.ok(Object.keys(before).some(path => /^ppt\/media\/image-1/.test(path)) && !Object.keys(after).some(path => /^ppt\/tags\/opf/.test(path)), 'the simulated save renamed parts');
  for (const [label, input] of [['original', original.bytes], ['saved by PowerPoint', saved]]) {
    const diagnostics = [];
    const imported = await fromPptx(input, {onDiagnostic: item => diagnostics.push(item)});
    assert.deepEqual(imported.design.logo, deck.design.logo, `${label}: design.logo restores with every variant`);
    assert.equal(imported.organization.logo, tall, `${label}: organization.logo restores`);
    assert.equal(imported.slides[1].design.logo, jpg, `${label}: a slide's own logo restores`);
    assert.equal(imported.design.listBullet, 'image', `${label}: listBullet`);
    assert.deepEqual(imported.design.footer.left, {logo: true}, `${label}: footer logo flag`);
    for (const code of ['invalid-logo-provenance', 'unresolved-asset-reference', 'content-structure-changed', 'invalid-document-provenance', 'invalid-furniture-provenance']) {
      assert.deepEqual(diagnostics.filter(item => item.code === code).map(item => item.path), [], `${label}: no ${code}`);
    }
    assert.ok(!imported.slides[0].blocks && !imported.slides[0].image && !imported.slides[1].blocks, `${label}: logo pictures are not content`);
    // The picture-bullet list is the authored list again: entries, wrapped line, description and level.
    const [list] = imported.slides[2].items ? [imported.slides[2].items] : [imported.slides[2].blocks?.[0]?.items];
    const plain = value => Array.isArray(value) ? value.map(run => run.text).join('') : value;
    assert.deepEqual(list.map(entry => typeof entry === 'object' && !Array.isArray(entry) ? [plain(entry.text).trim(), plain(entry.description), entry.level] : [plain(entry).trim()]),
      [['Alpha'], [('Beta wraps ' + 'word '.repeat(40)).trim()], ['Gamma', 'A description line', undefined], ['Nested', undefined, 1]], `${label}: list entries`);
  }
  checked++;
}

// ---- Logo fallbacks without document provenance: a slide's own tagged logo restores whatever the deck logo is, in any slide order.
{
  for (const provenance of [false, 'references-only']) {
    for (const order of [[{title: 'Deck', layout: 'title'}, {title: 'Own', layout: 'title', design: {logo: jpg}}], [{title: 'Own', layout: 'title', design: {logo: jpg}}, {title: 'Deck', layout: 'title'}]]) {
      const deck = {design: {logo: wide, background: light}, slides: order};
      const {bytes} = await open(deck, {provenance});
      const imported = await fromPptx(bytes);
      const own = order.findIndex(slide => slide.design?.logo), other = 1 - own;
      assert.equal(imported.slides[own].design?.logo?.src, jpg, `${provenance}: the slide's own logo restores (slide ${own})`);
      assert.equal(imported.design?.logo?.src, wide, `${provenance}: the deck logo restores`);
      assert.equal(imported.slides[other].design?.logo, undefined, `${provenance}: the other slide inherits the deck logo`);
      assert.ok(!imported.slides[0].blocks && !imported.slides[1].blocks, `${provenance}: logos are not content`);
    }
  }
  checked++;
}

// ---- An unresolvable logo (a malformed SVG: no xmlns) draws the "Image unavailable" panel; the tagged panel is not content on import.
{
  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg width="10" height="10"/>').toString('base64')}`;
  const deck = {design: {logo: svg, background: light}, slides: [{title: 'Cover', layout: 'title'}, {title: 'Body', text: 'Copy.'}]};
  for (const provenance of ['full', false]) {
    const diagnostics = [];
    const {bytes, entries} = await open(deck, {provenance, onDiagnostic: item => diagnostics.push(item)});
    assert.match(slideXml(entries, 0), /name="OPF image placeholder 1"/, 'the panel is drawn');
    assert.match(slideXml(entries, 0), /name="OPF image placeholder 1 text line 0"/, 'with named text lines');
    assert.ok(/OPF_LOGO_V1/.test(Object.entries(entries).filter(([path]) => /^ppt\/tags\/opfLogoPlaceholder/.test(path)).map(([, data]) => strFromU8(data)).join('')), 'the panel carries a logo tag');
    assert.ok(diagnostics.some(item => item.code === 'unresolved-asset' && item.path === 'design.logo'));
    const reports = [];
    const imported = await fromPptx(bytes, {onDiagnostic: item => reports.push(item)});
    assert.ok(!imported.slides[0].blocks && !imported.slides[0].text && !imported.slides[0].image, `${provenance}: the panel is not content`);
    assert.deepEqual(reports.filter(item => /structure|invalid-/.test(item.code)).map(item => item.code), [], `${provenance}: a clean round trip`);
    if (provenance === 'full') assert.equal(imported.design.logo, svg, 'the stored logo returns');
    // An edited panel (its tag removed) is ordinary content again.
    const untagged = zipSync(Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([path]) => !/^ppt\/tags\/opfLogoPlaceholder/.test(path)).map(([path, data]) => [path,
      path === 'ppt/slides/slide1.xml' ? new TextEncoder().encode(decoder.decode(data).replace(/<p:custDataLst><p:tags r:id="rIdOpfLogoPlaceholder1"\/><\/p:custDataLst>/, '')) :
      path === 'ppt/slides/_rels/slide1.xml.rels' ? new TextEncoder().encode(decoder.decode(data).replace(/<Relationship Id="rIdOpfLogoPlaceholder1"[^>]*\/>/, '')) :
      path === '[Content_Types].xml' ? new TextEncoder().encode(decoder.decode(data).replace(/<Override PartName="\/ppt\/tags\/opfLogoPlaceholder1.xml"[^>]*\/>/, '')) : data])));
    const loose = await fromPptx(untagged);
    assert.ok(JSON.stringify(loose.slides[0]).includes('Image unavailable'), 'an untagged panel imports as ordinary text');
  }
  checked++;
}

console.log(`Design fields passed: ${checked} groups (cover and section logo, variants and organization fallback, unresolved logo, footer logo, picture bullets, accent font, provenance).`);
