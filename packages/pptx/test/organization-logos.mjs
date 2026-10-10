import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, unzipSync, zipSync} from 'fflate';
import {crc32, deflateSync} from 'node:zlib';
import {FURNITURE_GAP, FURNITURE_IMAGE_SHARE, composeSlide} from '@openpresentation/opf/composition';
import {resolveSlideContext} from '@openpresentation/opf';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

// RR-71 (OPF 0.18): logos live on the organization; a header or footer zone image can be a logo reference
// (`var:organization.logo.icon`) whose onLight/onDark asset follows each slide's background.
// - export: furniture image parts draw at core's row layout boxes with the asset for that slide; the cover draws the full logo
// - import: an unchanged logo picture returns as its reference, the organization (with every shape and tone) from the document
//   record, `design.logo` (a reference or false) from the design record; a changed or foreign picture is an ordinary image

const image = async name => new Uint8Array(await readFile(new URL(`./fixtures/images/${name}`, import.meta.url)));
const uri = (bytes, type = 'image/png') => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const bytes = {wide: await image('wide.png'), tall: await image('tall.png'), square: await image('square.png'), jpg: await image('wide.jpg')};
const wide = uri(bytes.wide), tall = uri(bytes.tall), square = uri(bytes.square), jpg = uri(bytes.jpg, 'image/jpeg');
// A valid flat RGB PNG of the given pixel size.
const flatPng = (width, height) => {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0); out.write(type, 4, 'latin1'); data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x33)]);
  return uri(Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(Array.from({length: height}, () => row)))), chunk('IEND', Buffer.alloc(0))]));
};
const light = {type: 'solid', color: '#FFFFFF'}, dark = {type: 'solid', color: '#0B1220'};
const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z'};

const decoder = new TextDecoder(), encoder = new TextEncoder();
const exportDeck = async (deck, options = {}) => {
  const diagnostics = [];
  const output = await toPptx(deck, {...FIXED, onDiagnostic: item => diagnostics.push(item), ...options});
  return {bytes: output, entries: unzipSync(output), diagnostics};
};
const slideXml = (entries, index) => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]);
const slideRels = (entries, index) => decoder.decode(entries[`ppt/slides/_rels/slide${index + 1}.xml.rels`]);
const pictures = xml => [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(([picture]) => ({
  xml: picture,
  name: picture.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1],
  embed: picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1],
  x: Number(picture.match(/<a:off x="(-?\d+)"/)?.[1]) / 9525, y: Number(picture.match(/<a:off x="-?\d+" y="(-?\d+)"/)?.[1]) / 9525,
  w: Number(picture.match(/<a:ext cx="(\d+)"/)?.[1]) / 9525, h: Number(picture.match(/<a:ext cx="\d+" cy="(\d+)"/)?.[1]) / 9525,
}));
const mediaFor = (entries, index, embed) => {
  const target = slideRels(entries, index).match(new RegExp(`<Relationship Id="${embed}"[^>]*Target="([^"]+)"`))?.[1];
  assert.ok(target, `relationship ${embed} on slide ${index}`);
  return entries[`ppt/${target.replace(/^\.\.\//, '')}`];
};
const same = (a, b) => a && b && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const near = (actual, expected, label, tolerance = .75) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
// The pictures of a slide that carry bytes of `expected`.
const drawnWith = (entries, index, expected) => pictures(slideXml(entries, index)).filter(picture => same(mediaFor(entries, index, picture.embed), expected));
const geometry = (deck, index) => { const context = resolveSlideContext(deck, index); return composeSlide(context.slide, context.options); };
const noContentPictures = (imported, label) => imported.slides.forEach((slide, index) => assert.ok(!slide.image && !slide.blocks, `${label}: slide ${index} has no content picture`));
const codes = (reports, ...wanted) => reports.filter(item => wanted.includes(item.code)).map(item => `${item.code} ${item.path}`);
const PROBLEMS = ['invalid-furniture-provenance', 'invalid-logo-provenance', 'invalid-document-provenance', 'unresolved-asset-reference', 'content-structure-changed'];
let checked = 0;

// ---- A deck-level footer logo: the onLight/onDark asset is chosen per slide, and re-import gives back the reference.
const organization = {id: 'acme', name: 'Acme', role: 'primary', logo: {full: {onLight: wide, onDark: tall}, icon: {onLight: square, onDark: jpg}}};
{
  const deck = {organization, design: {background: light, footer: {left: {image: 'var:organization.logo.icon'}, right: {text: '{{slide.number}}'}}}, slides: [
    {title: 'On light', text: 'Body copy.'},
    {title: 'On dark', text: 'Body copy.', design: {background: dark}},
    {title: 'On light again', text: 'Body copy.'},
  ]};
  const {entries, bytes: output, diagnostics} = await exportDeck(deck);
  assert.deepEqual(codes(diagnostics, 'unresolved-asset', 'unresolved-content'), []);
  for (const [index, [expected, other]] of [[bytes.square, bytes.jpg], [bytes.jpg, bytes.square], [bytes.square, bytes.jpg]].entries()) {
    const part = geometry(deck, index).furniture.parts.find(item => item.type === 'image');
    assert.equal(part.reference, 'var:organization.logo.icon');
    assert.equal(part.sourcePath, `organization.logo.icon.${index === 1 ? 'onDark' : 'onLight'}`);
    const [logo] = drawnWith(entries, index, expected);
    assert.ok(logo && logo.name.startsWith('OPF image'), `slide ${index} draws the ${index === 1 ? 'onDark' : 'onLight'} icon`);
    assert.equal(drawnWith(entries, index, other).length, 0, `slide ${index} does not draw the other tone`);
    // Contained in core's part box, centered.
    const scale = Math.min(part.box.width / 120, part.box.height / 60), size = index === 1 ? [120, 60] : [80, 80];
    const fit = Math.min(part.box.width / size[0], part.box.height / size[1]);
    near(logo.w, size[0] * fit, `slide ${index} logo width`); near(logo.h, size[1] * fit, `slide ${index} logo height`);
    near(logo.x, part.box.x + (part.box.width - size[0] * fit) / 2, `slide ${index} logo left`);
    assert.ok(scale > 0);
  }
  const reports = [];
  const imported = await fromPptx(output, {onDiagnostic: item => reports.push(item)});
  assert.deepEqual(imported.design.footer, {left: {image: 'var:organization.logo.icon'}, right: {text: '{{slide.number}}'}}, 'the deck footer returns with the reference');
  assert.ok(imported.slides.every(slide => slide.design?.footer === undefined), 'no slide overrides the footer');
  assert.deepEqual(imported.organization, organization, 'every shape and tone of the organization logo returns');
  assert.ok(!JSON.stringify(imported.design).includes('data:'), 'no resolved asset is written into the design');
  noContentPictures(imported, 'footer logo');
  assert.deepEqual(codes(reports, ...PROBLEMS), []);
  // Re-export is the same package.
  const again = await toPptx(imported, FIXED);
  assert.ok(same(again, output), 'a re-export of the import is byte-identical');
  // The tone is chosen again from the reimported background: a dark deck switches every slide.
  const flipped = await exportDeck({...imported, design: {...imported.design, background: dark}});
  assert.equal(drawnWith(flipped.entries, 0, bytes.jpg).length, 1, 'a dark deck draws the onDark icon on slide 0');
  checked++;
}

// ---- A partner logo: another organization's logo in a zone, and as the cover logo through design.logo.
{
  const partner = {id: 'beta', name: 'Beta', role: 'partner', logo: {full: tall, wordmark: jpg}};
  const deck = {organization: [organization, partner], design: {background: light, footer: {left: {image: 'var:organization.logo.icon'}, right: {image: 'var:organization.beta.logo.wordmark'}}}, slides: [
    {title: 'Cover', layout: 'title'},
    {title: 'Cover for the partner', layout: 'title', design: {logo: 'var:organization.beta.logo'}},
    {title: 'Body', text: 'Copy.'},
  ]};
  const {entries, bytes: output, diagnostics} = await exportDeck(deck);
  assert.deepEqual(codes(diagnostics, 'unresolved-asset', 'unresolved-content'), []);
  const covers = [0, 1].map(index => pictures(slideXml(entries, index)).find(picture => picture.name === 'OPF logo'));
  assert.ok(same(mediaFor(entries, 0, covers[0].embed), bytes.wide), "the primary organization's full logo is the cover logo");
  assert.ok(same(mediaFor(entries, 1, covers[1].embed), bytes.tall), "design.logo names the partner's full logo");
  assert.equal(drawnWith(entries, 2, bytes.jpg).length, 1, "the partner's wordmark is the footer logo on the body slide");
  assert.equal(drawnWith(entries, 2, bytes.square).length, 1, "and the primary organization's icon");
  const reports = [];
  const imported = await fromPptx(output, {onDiagnostic: item => reports.push(item)});
  assert.deepEqual(imported.organization, [organization, partner], 'both organizations return');
  assert.deepEqual(imported.design.footer, deck.design.footer, 'the partner reference returns');
  assert.equal(imported.slides[1].design.logo, 'var:organization.beta.logo', "the slide's design.logo returns");
  assert.equal(imported.slides[0].design?.logo, undefined);
  noContentPictures(imported, 'partner logo');
  assert.deepEqual(codes(reports, ...PROBLEMS), []);
  assert.ok(same(await toPptx(imported, FIXED), output), 'a re-export of the import is byte-identical');
  checked++;
}

// ---- design.logo: false draws no cover or section logo and round-trips, as a deck default and as a slide override.
{
  const deck = {organization, design: {background: light, logo: false}, slides: [
    {title: 'Cover', layout: 'title'},
    {title: 'Section', layout: 'section-divider', design: {logo: 'var:organization.logo'}},
  ]};
  const {entries, bytes: output} = await exportDeck(deck);
  assert.equal(pictures(slideXml(entries, 0)).filter(picture => picture.name === 'OPF logo').length, 0, 'the deck default draws no cover logo');
  assert.equal(pictures(slideXml(entries, 1)).filter(picture => picture.name === 'OPF logo').length, 1, 'a slide can name the logo again');
  const reports = [];
  const imported = await fromPptx(output, {onDiagnostic: item => reports.push(item)});
  assert.equal(imported.design.logo, false, 'design.logo: false returns');
  assert.equal(imported.slides[1].design.logo, 'var:organization.logo', 'the slide reference returns');
  assert.deepEqual(imported.organization, organization);
  noContentPictures(imported, 'design.logo false');
  assert.deepEqual(codes(reports, ...PROBLEMS), []);
  const slideFalse = await exportDeck({organization, design: {background: light}, slides: [{title: 'Cover', layout: 'title', design: {logo: false}}, {title: 'Cover', layout: 'title'}]});
  assert.equal(pictures(slideXml(slideFalse.entries, 0)).filter(picture => picture.name === 'OPF logo').length, 0, 'a slide can turn the logo off');
  assert.equal((await fromPptx(slideFalse.bytes)).slides[0].design.logo, false);
  checked++;
}

// ---- The cover's full logo: the onLight/onDark tone follows the slide, a shape reference picks another shape.
{
  const deck = {organization, design: {background: light}, slides: [
    {title: 'Cover on light', layout: 'title'},
    {title: 'Section on dark', layout: 'section-divider', design: {background: dark}},
    {title: 'Wordmark cover', layout: 'title', design: {logo: 'var:organization.logo.icon'}},
    {title: 'Body', text: 'No cover logo here.'},
  ]};
  const {entries, bytes: output} = await exportDeck(deck);
  const logoOf = index => pictures(slideXml(entries, index)).filter(picture => picture.name === 'OPF logo');
  assert.ok(same(mediaFor(entries, 0, logoOf(0)[0].embed), bytes.wide), 'onLight full logo on a light cover');
  assert.ok(same(mediaFor(entries, 1, logoOf(1)[0].embed), bytes.tall), 'onDark full logo on a dark section');
  assert.ok(same(mediaFor(entries, 2, logoOf(2)[0].embed), bytes.square), 'design.logo can name the icon');
  assert.equal(logoOf(3).length, 0, 'content slides draw none');
  for (const index of [0, 1, 2]) {
    const { box, shape } = geometry(deck, index).logo;
    const [logo] = logoOf(index);
    assert.equal(shape, index === 2 ? 'icon' : 'full');
    assert.ok(logo.x >= box.x - .75 && logo.x + logo.w <= box.x + box.width + .75 && logo.y >= box.y - .75 && logo.y + logo.h <= box.y + box.height + .75, `slide ${index} logo sits in core's box`);
  }
  const reports = [];
  const imported = await fromPptx(output, {onDiagnostic: item => reports.push(item)});
  assert.deepEqual(imported.organization, organization);
  assert.equal(imported.slides[2].design.logo, 'var:organization.logo.icon');
  noContentPictures(imported, 'cover logo');
  assert.deepEqual(codes(reports, ...PROBLEMS), []);
  assert.ok(same(await toPptx(imported, FIXED), output), 'a re-export of the import is byte-identical');
  checked++;
}

// ---- The row layout and the native footer placeholders: a text part beside the logo has a natural-width box; the slide's
// footer placeholder keeps that box, and the master's spans the zone.
{
  const deck = {organization, design: {background: light, footer: {left: {image: 'var:organization.logo.icon', text: 'Confidential'}, right: {text: '{{slide.number}}'}}}, slides: [{title: 'One', text: 'Body.'}, {title: 'Two', text: 'Body.'}]};
  const {entries, bytes: output} = await exportDeck(deck);
  const parts = geometry(deck, 0).furniture.parts;
  const text = parts.find(part => part.field === 'text' && part.zone === 'left'), icon = parts.find(part => part.type === 'image');
  assert.ok(text.box.x >= icon.box.x + icon.box.width, 'the text follows the logo in the row');
  const xml = slideXml(entries, 0);
  const placeholder = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]).find(shape => /<p:ph type="ftr"/.test(shape));
  assert.ok(placeholder, 'the footer text is a native footer placeholder');
  const box = placeholder.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/).slice(1).map(Number);
  near(box[0] / 9525, text.box.x, 'placeholder x'); near(box[2] / 9525, text.box.width, 'placeholder width');
  const master = decoder.decode(entries['ppt/slideMasters/slideMaster1.xml']);
  const masterFooter = master.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph type="ftr"[\s\S]*?<\/p:sp>/)[0];
  const masterBox = masterFooter.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/).slice(1).map(Number);
  const zone = resolveSlideContext(deck, 0).options.width * .26;
  near(masterBox[2] / 9525, zone, 'the master footer placeholder spans its zone', 1);
  assert.ok(box[2] < masterBox[2], "the slide's placeholder is narrower than the master's");
  const reports = [];
  const imported = await fromPptx(output, {onDiagnostic: item => reports.push(item)});
  assert.deepEqual(imported.design.footer, deck.design.footer, 'logo, text and slide number return');
  assert.deepEqual(codes(reports, ...PROBLEMS), []);
  checked++;
}

// ---- A wide logo beside text is capped at FURNITURE_IMAGE_SHARE of the zone (core); the picture is fitted inside that box
// with its proportions, and the slide's footer placeholder starts after it at the text's natural width.
{
  const wordmark = flatPng(400, 50);
  const deck = {organization: {id: 'acme', name: 'Acme', logo: {full: wide, wordmark}}, design: {background: light, footer: {left: {image: 'var:organization.logo.wordmark', text: 'Confidential'}, right: {text: '{{slide.number}}'}}}, slides: [{title: 'One', text: 'Body.'}]};
  const {entries, bytes: output, diagnostics} = await exportDeck(deck);
  assert.deepEqual(codes(diagnostics, 'text-overflow', 'unresolved-content', ...PROBLEMS), []);
  const parts = geometry(deck, 0).furniture.parts, zone = resolveSlideContext(deck, 0).options.width * .26;
  const logo = parts.find(part => part.type === 'image'), text = parts.find(part => part.field === 'text' && part.zone === 'left');
  near(logo.box.width, zone * FURNITURE_IMAGE_SHARE, 'the 8:1 logo is capped at its share of the zone', .01);
  near(text.box.x, logo.box.x + logo.box.width + FURNITURE_GAP, 'the text follows the capped logo', .01);
  const [picture] = pictures(slideXml(entries, 0)).filter(entry => entry.name.startsWith('OPF image'));
  assert.ok(picture, 'the logo is drawn');
  assert.ok(picture.x >= logo.box.x - .75 && picture.x + picture.w <= logo.box.x + logo.box.width + .75, `the picture stays inside the capped box: ${picture.x}+${picture.w}`);
  assert.ok(picture.y >= logo.box.y - .75 && picture.y + picture.h <= logo.box.y + logo.box.height + .75, 'and inside its height');
  near(picture.w / picture.h, 8, 'with its proportions (fitted, not stretched)', .05);
  const placeholder = [...slideXml(entries, 0).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]).find(shape => /<p:ph type="ftr"/.test(shape));
  const box = placeholder.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/).slice(1).map(Number);
  near(box[0] / 9525, text.box.x, 'placeholder x after the capped logo'); near(box[2] / 9525, text.box.width, 'placeholder width');
  assert.ok(box[0] / 9525 >= picture.x + picture.w, 'the placeholder does not overlap the picture');
  const reports = [];
  const imported = await fromPptx(output, {onDiagnostic: item => reports.push(item)});
  assert.deepEqual(imported.design.footer, deck.design.footer, 'the wordmark reference, text and slide number return');
  assert.deepEqual(codes(reports, ...PROBLEMS), []);
  checked++;
}

// ---- A changed or foreign picture is an ordinary image; so is every logo when the organization is not stored.
{
  const deck = {organization, design: {background: light, footer: {left: {image: 'var:organization.logo.icon'}}}, slides: [{title: 'One', text: 'Body.'}, {title: 'Two', text: 'Body.'}]};
  const {bytes: output, entries} = await exportDeck(deck);
  // PowerPoint's Change Picture: the same shape and tags, other bytes.
  const media = pictures(slideXml(entries, 0)).find(picture => picture.name.startsWith('OPF image'));
  const target = `ppt/${slideRels(entries, 0).match(new RegExp(`<Relationship Id="${media.embed}"[^>]*Target="([^"]+)"`))[1].replace(/^\.\.\//, '')}`;
  const swapped = zipSync({...entries, [target]: bytes.wide});
  // Both slides draw the same icon, which the package embeds once, so the swap changes both pictures.
  const reports = [];
  const changed = await fromPptx(swapped, {onDiagnostic: item => reports.push(item)});
  assert.ok(changed.design.footer.left.image?.src?.startsWith('data:image/png'), 'a replaced picture imports as an ordinary image');
  assert.ok(!JSON.stringify(changed.design).includes('var:organization'), 'and not as the reference');
  assert.deepEqual(codes(reports, 'invalid-furniture-provenance'), []);
  // Provenance off: no manifest, no organization record; references-only: a manifest without the organization.
  for (const provenance of [false, 'references-only']) {
    const other = await exportDeck(deck, {provenance});
    const imported = await fromPptx(other.bytes);
    assert.ok(!JSON.stringify(imported).includes('var:organization'), `${provenance}: no reference without the stored organization`);
    assert.equal(imported.organization, undefined, `${provenance}: the organization is not stored`);
  }
  // A third-party picture in a footer (no OPF tags) is an ordinary picture.
  const untagged = zipSync(Object.fromEntries(Object.entries(entries).filter(([path]) => !/^ppt\/tags\//.test(path)).map(([path, data]) => [path,
    /^ppt\/slides\/slide\d+\.xml$/.test(path) ? encoder.encode(decoder.decode(data).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, '')) :
    /^ppt\/slides\/_rels\//.test(path) ? encoder.encode(decoder.decode(data).replace(/<Relationship [^>]*relationships\/tags"[^>]*\/>/g, '')) :
    path === '[Content_Types].xml' ? encoder.encode(decoder.decode(data).replace(/<Override PartName="\/ppt\/tags\/[^>]*\/>/g, '')) : data])));
  const plain = await fromPptx(untagged);
  assert.ok(!JSON.stringify(plain).includes('var:organization'), 'a plain PPTX never gains a logo reference');
  assert.ok(JSON.stringify(plain.slides[0]).includes('data:image/png'), 'a plain PPTX keeps the picture as an image');
  checked++;
}

// ---- A footer logo reference with no logo to draw: nothing is drawn, the reference still returns.
{
  const deck = {organization: {id: 'acme', name: 'Acme'}, design: {footer: {left: {image: 'var:organization.logo.icon', text: 'Hello'}}}, slides: [{title: 'One', text: 'Body.'}]};
  const {entries, bytes: output, diagnostics} = await exportDeck(deck);
  assert.deepEqual(codes(diagnostics, 'unresolved-content'), ['unresolved-content design.footer.left.image']);
  assert.equal(pictures(slideXml(entries, 0)).length, 0);
  const imported = await fromPptx(output);
  assert.deepEqual(imported.design.footer, deck.design.footer);
  checked++;
}

console.log(`Organization logos passed: ${checked} groups (onLight/onDark footer logo per slide, partner logo, design.logo false, the cover's full logo, row layout and native placeholders, a wide logo capped beside text, changed and foreign pictures, an undrawn logo).`);
