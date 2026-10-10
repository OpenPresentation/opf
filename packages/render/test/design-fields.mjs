// Spec-gap closure A: the design fields that used to change nothing now draw. The organization logo on cover
// and section slides (RR-71: logos live on the organization, zones place them with var:organization.logo.<shape>), picture bullets (design.listBullet: image) and the
// fontScheme accent family on the tag and the quote body.
//
// The fields live in core composition (resolveLogo and the other layout engines). The decks name gallery records (the title
// and section-divider layouts, the aptos font scheme), so they render with the host catalog registered (./catalog-harness.mjs).
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as composition from '@openpresentation/opf/composition';
import {catalogs, resolvePresentation, toSvg} from './catalog-harness.mjs';
import { loadFonts } from '../dist/fonts-node.js';
import { presentationFamilies, presentationFaces } from '../dist/lazy-fonts.js';

const png = async (r, g, b, width = 160, height = 40) => `data:image/png;base64,${(await sharp({ create: { width, height, channels: 3, background: { r, g, b } } }).png().toBuffer()).toString('base64')}`;
const wide = await png(200, 30, 30, 160, 40), tall = await png(30, 30, 200, 40, 160);
const darkBackground = { type: 'solid', color: '#0B1220' }, lightBackground = { type: 'solid', color: '#FFFFFF' };
const attr = (element, name) => element.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const images = svg => [...svg.matchAll(/<image\b[^>]*>/g)].map(match => match[0]);
const logos = svg => images(svg).filter(image => attr(image, 'data-opf-generated') === 'true');
let checked = 0;

// RR-71: logos live on the organization. Organization.logo is an asset or { full, stacked, icon, wordmark }, each an asset or
// { onLight, onDark }. Covers and sections draw the full logo, zones place one with `image: 'var:organization.logo.icon'`.
const organization = (logo, extra = {}) => ({ id: 'acme', name: 'Acme Corp', logo, ...extra });
const furnitureSources = svg => [...svg.matchAll(/<g\b[^>]*data-opf-furniture-field="image"[^>]*>/g)].map(match => attr(match[0], 'data-opf-furniture-source'));

// Cover logo: one left-anchored image in the composed box, generated, named by its organization, traced to its source path.
{
  const deck = { organization: organization(wide), design: { background: lightBackground }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
  const geometry = resolvePresentation(deck).slides[0].geometry;
  assert.ok(geometry.logo, 'geometry.logo on a cover');
  assert.deepEqual([geometry.logo.shape, geometry.logo.variant, geometry.logo.reference, geometry.logo.path], ['full', 'default', 'var:organization.logo', 'organization.logo']);
  assert.equal('slot' in geometry.logo, false, 'the 0.17 slot is gone');
  const svg = toSvg(deck, 1, { trace: true });
  const [logo, ...rest] = logos(svg);
  assert.ok(logo && rest.length === 0, 'one generated logo image');
  assert.equal(attr(logo, 'preserveAspectRatio'), 'xMinYMid meet');
  assert.equal(attr(logo, 'role'), 'img');
  assert.equal(attr(logo, 'aria-label'), 'Acme Corp logo', 'named by the organization');
  assert.equal(attr(logo, 'data-opf-path'), 'organization.logo');
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(attr(logo, name))), ['x', 'y', 'width', 'height'].map(name => geometry.logo.box[name]));
  assert.equal(attr(logo, 'href'), wide);
  assert.ok(svg.indexOf(logo) < svg.indexOf('data-opf-path="slides.0.title"'), 'logo is drawn before the content');
  // Without tracing the picture carries no editor attributes.
  assert.ok(!/data-opf-/.test(logos(toSvg(deck, 1)).join('')) && images(toSvg(deck, 1)).length === 1);
  // Authored alt text names the picture; an organization list names the organization the logo belongs to.
  const named = toSvg({ ...deck, organization: organization({ src: wide, alt: 'Acme mark' }) }, 1);
  assert.equal(attr(images(named)[0], 'aria-label'), 'Acme mark');
  const listed = toSvg({ ...deck, organization: [organization(wide, { role: 'primary' }), { id: 'beta', name: 'Beta Inc', logo: tall }], design: { logo: 'var:organization.beta.logo' } }, 1, { trace: true });
  assert.equal(attr(logos(listed)[0], 'aria-label'), 'Beta Inc logo');
  assert.equal(attr(logos(listed)[0], 'data-opf-path'), 'organization.1.logo');
  checked++;
}

// The logo comes after the watermark and before every content item.
{
  const deck = { organization: organization(wide), design: { watermark: tall }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
  const svg = toSvg(deck, 1, { trace: true });
  const all = images(svg);
  assert.equal(all.length, 2);
  assert.equal(attr(all[0], 'data-opf-generated'), undefined, 'the watermark comes first');
  assert.equal(attr(all[1], 'data-opf-generated'), 'true');
  checked++;
}

// Section dividers draw it; content slides never do.
{
  const deck = { organization: organization(wide), slides: [
    { title: 'Part one', layout: 'section-divider' },
    { title: 'Content', text: 'Body copy.' },
    { title: 'Items', items: ['One', 'Two'] },
  ] };
  const slides = resolvePresentation(deck).slides;
  assert.ok(slides[0].geometry.logo, 'section divider logo');
  assert.equal(logos(toSvg(deck, 1, { trace: true })).length, 1);
  for (const index of [1, 2]) {
    assert.equal(slides[index].geometry.logo, undefined, `content slide ${index} has no logo`);
    assert.equal(images(toSvg(deck, index + 1, { trace: true })).length, 0, `content slide ${index} draws no image`);
  }
  // No organization logo anywhere: nothing is drawn.
  assert.equal(images(toSvg({ slides: [{ title: 'Quarterly review', layout: 'title' }] }, 1)).length, 0);
  assert.equal(images(toSvg({ organization: organization(undefined), slides: [{ title: 'Quarterly review', layout: 'title' }] }, 1)).length, 0);
  checked++;
}

// design.logo names another organization's logo (a slide's wins over the deck's) or is false; the primary organization's full logo is the default.
{
  const deck = { organization: [organization(wide, { role: 'primary' }), { id: 'beta', name: 'Beta Inc', logo: tall }], design: { logo: 'var:organization.beta.logo' }, slides: [
    { title: 'Own', layout: 'title', design: { logo: 'var:organization.acme.logo' } },
    { title: 'Inherited', layout: 'title' },
    { title: 'Hidden here', layout: 'title', design: { logo: false } },
  ] };
  const drawn = index => logos(toSvg(deck, index + 1, { trace: true }));
  assert.equal(attr(drawn(0)[0], 'href'), wide, 'a slide design.logo wins over the deck design.logo');
  assert.equal(attr(drawn(0)[0], 'data-opf-path'), 'organization.0.logo');
  assert.equal(attr(drawn(1)[0], 'href'), tall, 'the deck design.logo names the partner');
  assert.equal(attr(drawn(1)[0], 'data-opf-path'), 'organization.1.logo');
  assert.equal(drawn(2).length, 0, 'a slide design.logo: false hides the logo');
  assert.equal(resolvePresentation(deck).slides[2].geometry.logo, undefined);
  const fallback = { organization: organization(tall), slides: [{ title: 'Org', layout: 'title' }] };
  assert.equal(attr(logos(toSvg(fallback, 1, { trace: true }))[0], 'data-opf-path'), 'organization.logo');
  // design.logo: false on the deck hides the cover and section logos of every slide that does not name one.
  const hidden = { organization: organization(wide), design: { logo: false }, slides: [{ title: 'Quarterly review', layout: 'title' }, { title: 'Part one', layout: 'section-divider' }, { title: 'Back', layout: 'title', design: { logo: 'var:organization.logo' } }] };
  assert.equal(images(toSvg(hidden, 1)).length, 0, 'design.logo: false hides the cover logo');
  assert.equal(images(toSvg(hidden, 2)).length, 0, 'design.logo: false hides the section logo');
  assert.equal(images(toSvg(hidden, 3)).length, 1, 'a slide reference brings it back');
  checked++;
}

// { onLight, onDark }: the variant follows the slide background luminance (a dark background draws the onDark artwork).
{
  const light = await png(240, 240, 240), dark = await png(10, 10, 10);
  const set = { full: { onLight: dark, onDark: light } };
  for (const [name, background, variant, source] of [['dark background', darkBackground, 'onDark', light], ['light background', lightBackground, 'onLight', dark]]) {
    const deck = { organization: organization(set), design: { background }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
    const [drawn] = logos(toSvg(deck, 1, { trace: true }));
    assert.equal(attr(drawn, 'data-opf-path'), `organization.logo.full.${variant}`, name);
    assert.equal(attr(drawn, 'href'), source, name);
    assert.equal(resolvePresentation(deck).slides[0].geometry.logo.variant, variant, name);
  }
  // A slide with its own background picks by that background; the deck's other slides keep theirs.
  const mixed = { organization: organization(set), design: { background: lightBackground }, slides: [{ title: 'Dark one', layout: 'title', design: { background: darkBackground } }, { title: 'Light one', layout: 'title' }] };
  assert.equal(attr(logos(toSvg(mixed, 1, { trace: true }))[0], 'data-opf-path'), 'organization.logo.full.onDark');
  assert.equal(attr(logos(toSvg(mixed, 2, { trace: true }))[0], 'data-opf-path'), 'organization.logo.full.onLight');
  // A missing variant uses the other one.
  const onlyDark = { organization: organization({ full: { onDark: light } }), design: { background: lightBackground }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
  assert.equal(attr(logos(toSvg(onlyDark, 1, { trace: true }))[0], 'href'), light);
  checked++;
}

// An unresolved logo source keeps the placeholder and reports unresolved-asset at the logo path.
{
  const deck = { organization: organization('asset:missing'), slides: [{ title: 'Quarterly review', layout: 'title' }] };
  const diagnostics = [];
  const svg = toSvg(deck, 1, { trace: true, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-asset').map(item => item.path), ['organization.logo']);
  assert.match(svg, /data-opf-asset-status="unresolved"/);
  assert.throws(() => toSvg(deck, 1, { strictAssets: true }), { code: 'unresolved-asset' });
  // asset: references and host resolvers reach the same drawing.
  const referenced = { assets: { brand: { src: wide, alt: 'Brand' } }, organization: organization('asset:brand'), slides: [{ title: 'Quarterly review', layout: 'title' }] };
  assert.equal(attr(images(toSvg(referenced, 1))[0], 'aria-label'), 'Brand');
  const resolved = toSvg({ organization: organization('logo.png'), slides: [{ title: 'Quarterly review', layout: 'title' }] }, 1, { imageResolver: () => wide });
  assert.equal(attr(images(resolved)[0], 'href'), wide);
  checked++;
}

// Zone logos: `image: 'var:organization.logo.icon'` is an image part with the icon shape, in the variant for the slide background;
// `var:organization.<id>.logo.icon` draws a partner's. The parts of a zone sit in a row, image then text.
{
  const icon = await png(20, 160, 20, 48, 48), partner = await png(200, 120, 20, 48, 48), iconDark = await png(240, 240, 240, 48, 48);
  const orgs = [organization({ full: wide, icon: { onLight: icon, onDark: iconDark } }, { role: 'primary' }), { id: 'beta', name: 'Beta Inc', logo: { icon: partner } }];
  const deck = { organization: orgs, design: { background: lightBackground, footer: { left: { image: 'var:organization.logo.icon', text: 'Acme Corp' }, right: { image: 'var:organization.beta.logo.icon' } }, header: { right: { image: 'var:organization.logo.icon', text: 'Confidential' } } },
    slides: [{ title: 'Content', text: 'Body copy.' }] };
  const svg = toSvg(deck, 1, { trace: true });
  const furniture = [...svg.matchAll(/<g\b[^>]*data-opf-furniture-field="image"[^>]*>/g)].map(match => match[0]);
  assert.equal(furniture.length, 3, 'header and footer logo parts');
  for (const group of furniture) assert.equal(attr(group, 'data-opf-furniture-generated'), 'false');
  assert.deepEqual(furnitureSources(svg).sort(), ['organization.0.logo.icon.onLight', 'organization.0.logo.icon.onLight', 'organization.1.logo.icon']);
  assert.deepEqual(images(svg).map(image => attr(image, 'href')).sort(), [icon, icon, partner].sort(), 'the icon shape, not the full logo');
  const parts = resolvePresentation(deck).slides[0].geometry.furniture.parts;
  const imageParts = parts.filter(part => part.type === 'image');
  assert.deepEqual(imageParts.map(part => part.reference).sort(), ['var:organization.beta.logo.icon', 'var:organization.logo.icon', 'var:organization.logo.icon']);
  const drawn = images(svg).map(image => ['x', 'y', 'width', 'height'].map(name => Number(attr(image, name))));
  const near = (a, b) => Math.abs(a - b) < 0.002;
  for (const part of imageParts) assert.ok(drawn.some(box => box.every((value, index) => near(value, [part.box.x, part.box.y, part.box.width, part.box.height][index]))), `${part.kind} ${part.zone} logo drawn in its part box`);
  // Row layout: the image sits first, the text next to it after FURNITURE_GAP, both on the zone's left edge and vertically centred.
  const left = imageParts.find(part => part.kind === 'footer' && part.zone === 'left'), leftText = parts.find(part => part.kind === 'footer' && part.zone === 'left' && part.type === 'text');
  assert.ok(near(left.box.x, 1280 * 0.07), 'the image starts at the zone edge');
  assert.ok(near(leftText.box.x, left.box.x + left.box.width + composition.FURNITURE_GAP), 'the text follows the image after the gap');
  assert.ok(near(leftText.box.y + leftText.box.height / 2, left.box.y + left.box.height / 2), 'the row is vertically centred');
  const textGroup = [...svg.matchAll(/<g\b[^>]*>/g)].map(match => match[0]).find(group => attr(group, 'data-opf-path') === 'design.footer.left.text' && attr(group, 'data-opf-box-x') !== undefined);
  assert.ok(textGroup && near(Number(attr(textGroup, 'data-opf-box-x')), leftText.box.x), 'the text is drawn from its own box, beside the image');
  // The right zone ends at the right edge: the text is last, the image before it.
  const rightImage = imageParts.find(part => part.kind === 'header'), rightText = parts.find(part => part.kind === 'header' && part.type === 'text');
  assert.ok(near(rightText.box.x + rightText.box.width, 1280 * 0.93), 'the last part ends at the right zone edge');
  assert.ok(near(rightImage.box.x + rightImage.box.width + composition.FURNITURE_GAP, rightText.box.x), 'image before text in the right zone');
  assert.ok(svg.includes('Confidential'));
  // Furniture pictures repeat on every slide: decorative unless the asset names them.
  assert.ok(images(svg).every(image => attr(image, 'aria-hidden') === 'true' && attr(image, 'aria-label') === undefined));
  const named = toSvg({ ...deck, organization: [organization({ icon: { src: icon, alt: 'Acme mark' } }, { role: 'primary' }), orgs[1]] }, 1);
  assert.ok(images(named).some(image => attr(image, 'aria-label') === 'Acme mark' && attr(image, 'role') === 'img'));
  // On a dark slide the onDark artwork is drawn, in the zone as on the cover.
  const darkSlide = toSvg({ ...deck, design: { ...deck.design, background: darkBackground } }, 1, { trace: true });
  assert.deepEqual(furnitureSources(darkSlide).sort(), ['organization.0.logo.icon.onDark', 'organization.0.logo.icon.onDark', 'organization.1.logo.icon']);
  assert.ok(images(darkSlide).some(image => attr(image, 'href') === iconDark));
  // No logo to resolve: the reference is reported at its zone path and nothing is drawn.
  const missing = { organization: organization(undefined), design: { footer: { left: { image: 'var:organization.logo.icon' } } }, slides: [{ title: 'Content', text: 'Body copy.' }] };
  const reported = [];
  const bare = toSvg(missing, 1, { trace: true, onDiagnostic: diagnostic => reported.push(diagnostic) });
  assert.deepEqual(reported.filter(item => item.code === 'unresolved-content').map(item => item.path), ['design.footer.left.image']);
  assert.ok(!bare.includes('data-opf-furniture-field="image"'));
  checked++;
}

// design.listBullet: image draws the icon logo as each entry marker, beneath the entry text.
{
  const icon = await png(20, 160, 20, 48, 48);
  const entries = ['Alpha', 'Beta', 'Gamma'];
  const deck = { organization: organization({ full: wide, icon }), design: { listBullet: 'image' }, slides: [{ title: 'Items', items: entries }] };
  const geometry = resolvePresentation(deck).slides[0].geometry;
  const list = geometry.items.find(item => item.field === 'items');
  assert.ok(list.bulletImage, 'core attaches the picture bullet');
  const svg = toSvg(deck, 1, { trace: true });
  const markers = images(svg).filter(image => attr(image, 'aria-hidden') === 'true');
  assert.equal(markers.length, entries.length, 'one picture marker per entry');
  list.text.listEntries.forEach((entry, index) => {
    const marker = markers[index];
    assert.equal(Number(attr(marker, 'width')), Number(attr(marker, 'height')));
    // PowerPoint draws a:buBlip at buSzPct 100000 as a square about 0.65 of the font size (core's bulletBox).
    assert.equal(Number(attr(marker, 'width')), Number((entry.marker.fontSize * 0.65).toFixed(3)), 'PowerPoint picture-bullet size');
    assert.equal(Number(attr(marker, 'width')), Number(entry.bulletBox.width.toFixed(3)));
    assert.equal(Number(attr(marker, 'x')), Number(Number(entry.marker.x).toFixed(3)));
    assert.equal(Number(attr(marker, 'y')) + Number(attr(marker, 'height')), Number((entry.marker.y).toFixed(3)), 'bottom on the marker baseline');
    assert.equal(attr(marker, 'preserveAspectRatio'), 'xMidYMid meet');
    assert.equal(attr(marker, 'href'), icon);
  });
  assert.ok(!/aria-hidden="true"[^>]*>•/.test(svg) && !svg.includes('>•<'), 'no glyph markers');
  // Character bullets stay the default.
  const plain = toSvg({ organization: organization({ full: wide, icon }), slides: [{ title: 'Items', items: entries }] }, 1, { trace: true });
  assert.equal(images(plain).length, 0);
  assert.equal((plain.match(/>•</g) ?? []).length, entries.length);
  // An icon that cannot be drawn keeps the glyphs and reports unresolved-asset once.
  const unresolved = { organization: organization({ icon: 'https://example.invalid/logo.png' }), design: { listBullet: 'image' }, slides: [{ title: 'Items', items: entries }] };
  const diagnostics = [];
  const fallback = toSvg(unresolved, 1, { trace: true, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
  assert.equal(images(fallback).length, 0);
  assert.equal((fallback.match(/>•</g) ?? []).length, entries.length);
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-asset').map(item => item.path), ['organization.logo.icon']);
  checked++;
}

// fontScheme.accent: the slide tag and the quote body draw in the accent family; titles and body stay.
{
  const accent = 'Playfair Display';
  const deck = { design: { fontScheme: { id: 'aptos', accent: accent } }, slides: [
    { tag: 'Eyebrow', title: 'Accent check', text: 'Body copy.' },
    { title: 'Quote', quote: { text: 'Design is how it works.', attribution: 'Someone' } },
  ] };
  const families = (svg, path) => [...svg.matchAll(/<text\b([^>]*)>/g)].map(match => match[1])
    .filter(attrs => attrs.includes(`data-opf-path="${path}"`)).map(attrs => attr(` ${attrs}`, 'font-family'));
  const first = toSvg(deck, 1, { trace: true });
  assert.ok(families(first, 'slides.0.tag').every(family => family.startsWith(accent)), `tag family: ${families(first, 'slides.0.tag')}`);
  assert.ok(families(first, 'slides.0.tag').length > 0);
  for (const path of ['slides.0.title', 'slides.0.text']) assert.ok(families(first, path).every(family => !family.includes(accent)), path);
  const second = toSvg(deck, 2, { trace: true });
  const quoteFamilies = [...second.matchAll(/<text\b([^>]*)>/g)].map(match => attr(` ${match[1]}`, 'font-family'));
  assert.ok(quoteFamilies.some(family => family.startsWith(accent)), 'quote text uses the accent family');
  // The accent family is a design family like heading and body: every family list includes it.
  const resolved = resolvePresentation(deck);
  assert.equal(resolved.slides[0].design.fonts.accent, accent);
  // Without an accent role nothing changes.
  const plain = toSvg({ design: { fontScheme: 'aptos' }, slides: [deck.slides[0]] }, 1, { trace: true });
  assert.ok(families(plain, 'slides.0.tag').every(family => !family.includes(accent)));
  // The preview prepares the accent face like any other family (look-alike policy and embedding).
  const office = await loadFonts({ pack: 'office' }), options = { fonts: office };
  const georgia = { design: { fontScheme: { id: 'aptos', accent: 'Georgia' } }, slides: deck.slides };
  assert.ok(presentationFamilies(georgia, { catalogs }).has('Georgia'), 'the accent family is collected like heading, body and code');
  assert.ok(presentationFaces(georgia, { catalogs }).some(face => face.family === 'Georgia'), 'tag and quote request the accent face');
  const measured = resolvePresentation(georgia, options);
  assert.equal(measured.slides[0].design.fonts.accent, 'Gelasio', 'the accent family resolves through the font policy');
  for (const [index, prefix] of [[0, 'slides.0.tag'], [1, 'slides.1.quote']]) {
    const drawn = toSvg(georgia, index + 1, { ...options, trace: true });
    const used = [...drawn.matchAll(/<text\s([^>]*)>/g)].map(match => match[1]).filter(attrs => new RegExp(`data-opf-path="${prefix}[".]`).test(attrs)).map(attrs => attr(` ${attrs}`, 'font-family'));
    assert.ok(used.length > 0 && (index === 1 ? used.slice(0, 1) : used).every(family => family.startsWith('Gelasio')), `${prefix} draws the policy look-alike: ${used}`);
    assert.ok(drawn.includes('@font-face{font-family:"Gelasio"'), 'the look-alike face is embedded');
  }
  checked++;
}

console.log(`Design fields passed: ${checked} groups (cover and section logo, design.logo override and false, onLight/onDark tone, partner and row-laid zone logos, picture bullets, accent font).`);
