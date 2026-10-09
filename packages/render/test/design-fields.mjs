// Spec-gap closure A: the design fields that used to change nothing now draw. The deck logo on cover
// and section slides, furniture `logo: true`, picture bullets (design.listBullet: image) and the
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

// Cover logo: one left-anchored image in the composed box, generated, traced to its source path.
{
  const deck = { design: { logo: wide, background: lightBackground }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
  const geometry = resolvePresentation(deck).slides[0].geometry;
  assert.ok(geometry.logo, 'geometry.logo on a cover');
  const svg = toSvg(deck, 1, { trace: true });
  const [logo, ...rest] = logos(svg);
  assert.ok(logo && rest.length === 0, 'one generated logo image');
  assert.equal(attr(logo, 'preserveAspectRatio'), 'xMinYMid meet');
  assert.equal(attr(logo, 'role'), 'img');
  assert.equal(attr(logo, 'aria-label'), 'Logo');
  assert.equal(attr(logo, 'data-opf-path'), 'design.logo');
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => Number(attr(logo, name))), ['x', 'y', 'width', 'height'].map(name => geometry.logo.box[name]));
  assert.equal(attr(logo, 'href'), wide);
  assert.ok(svg.indexOf(logo) < svg.indexOf('data-opf-path="slides.0.title"'), 'logo is drawn before the content');
  // Without tracing the picture carries no editor attributes.
  assert.ok(!/data-opf-/.test(logos(toSvg(deck, 1)).join('')) && images(toSvg(deck, 1)).length === 1);
  // Authored alt text names the picture.
  const named = toSvg({ ...deck, design: { ...deck.design, logo: { src: wide, alt: 'Acme logo' } } }, 1);
  assert.equal(attr(images(named)[0], 'aria-label'), 'Acme logo');
  checked++;
}

// The logo comes after the watermark and before every content item.
{
  const deck = { design: { logo: wide, watermark: tall }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
  const svg = toSvg(deck, 1, { trace: true });
  const all = images(svg);
  assert.equal(all.length, 2);
  assert.equal(attr(all[0], 'data-opf-generated'), undefined, 'the watermark comes first');
  assert.equal(attr(all[1], 'data-opf-generated'), 'true');
  checked++;
}

// Section dividers draw it; content slides never do.
{
  const deck = { design: { logo: wide }, slides: [
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
  // No logo anywhere: nothing is drawn.
  assert.equal(images(toSvg({ slides: [{ title: 'Quarterly review', layout: 'title' }] }, 1)).length, 0);
  checked++;
}

// A slide logo wins over the deck logo; the organization logo is the fallback.
{
  const deck = { design: { logo: wide }, organization: { id: 'acme', name: 'Acme', logo: tall }, slides: [
    { title: 'Own', layout: 'title', design: { logo: tall } },
    { title: 'Inherited', layout: 'title' },
  ] };
  assert.equal(attr(logos(toSvg(deck, 1, { trace: true }))[0], 'data-opf-path'), 'slides.0.design.logo');
  assert.equal(attr(logos(toSvg(deck, 2, { trace: true }))[0], 'data-opf-path'), 'design.logo');
  const fallback = { organization: { id: 'acme', name: 'Acme', logo: tall }, slides: [{ title: 'Org', layout: 'title' }] };
  assert.equal(attr(logos(toSvg(fallback, 1, { trace: true }))[0], 'data-opf-path'), 'organization.logo');
  checked++;
}

// LogoSet: the variant follows the slide background luminance (dark background: the light variant).
{
  const set = { light: await png(240, 240, 240), dark: await png(10, 10, 10), default: wide };
  for (const [name, background, path] of [['dark background', darkBackground, 'design.logo.light'], ['light background', lightBackground, 'design.logo.dark']]) {
    const deck = { design: { logo: set, background }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
    assert.equal(attr(logos(toSvg(deck, 1, { trace: true }))[0], 'data-opf-path'), path, name);
  }
  // A slide with its own background picks by that background.
  const mixed = { design: { logo: set, background: lightBackground }, slides: [{ title: 'Dark one', layout: 'title', design: { background: darkBackground } }] };
  assert.equal(attr(logos(toSvg(mixed, 1, { trace: true }))[0], 'data-opf-path'), 'design.logo.light');
  checked++;
}

// An unresolved logo source keeps the placeholder and reports unresolved-asset at the logo path.
{
  const deck = { design: { logo: 'asset:missing' }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
  const diagnostics = [];
  const svg = toSvg(deck, 1, { trace: true, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-asset').map(item => item.path), ['design.logo']);
  assert.match(svg, /data-opf-asset-status="unresolved"/);
  assert.throws(() => toSvg(deck, 1, { strictAssets: true }), { code: 'unresolved-asset' });
  // asset: references and host resolvers reach the same drawing.
  const referenced = { assets: { brand: { src: wide, alt: 'Brand' } }, design: { logo: 'asset:brand' }, slides: [{ title: 'Quarterly review', layout: 'title' }] };
  assert.equal(attr(images(toSvg(referenced, 1))[0], 'aria-label'), 'Brand');
  const resolved = toSvg({ design: { logo: 'logo.png' }, slides: [{ title: 'Quarterly review', layout: 'title' }] }, 1, { imageResolver: () => wide });
  assert.equal(attr(images(resolved)[0], 'href'), wide);
  checked++;
}

// Footer and header `logo: true`: a generated image part with the icon variant.
{
  const icon = await png(20, 160, 20, 48, 48);
  const deck = { design: { logo: { default: wide, icon }, footer: { left: { logo: true } }, header: { right: { logo: true, text: 'Confidential' } } },
    slides: [{ title: 'Content', text: 'Body copy.' }] };
  const svg = toSvg(deck, 1, { trace: true });
  const furniture = [...svg.matchAll(/<g\b[^>]*data-opf-furniture-field="logo"[^>]*>/g)].map(match => match[0]);
  assert.equal(furniture.length, 2, 'header and footer logo parts');
  for (const group of furniture) assert.equal(attr(group, 'data-opf-furniture-generated'), 'true');
  assert.deepEqual(furniture.map(group => attr(group, 'data-opf-furniture-source')).sort(), ['design.logo.icon', 'design.logo.icon']);
  assert.ok(images(svg).every(image => attr(image, 'href') === icon), 'furniture uses the icon variant');
  assert.equal(images(svg).length, 2);
  // Furniture images align like the zone text: the left zone's logo starts at the zone's left edge, the right zone's ends at its right edge.
  const parts = resolvePresentation(deck).slides[0].geometry.furniture.parts.filter(part => part.type === 'image');
  const drawn = images(svg).map(image => ['x', 'y', 'width', 'height'].map(name => Number(attr(image, name))));
  const near = (a, b) => Math.abs(a - b) < 0.002;
  const left = parts.find(part => part.zone === 'left'), right = parts.find(part => part.zone === 'right');
  assert.ok(near(left.box.x, 1280 * 0.07) && near(right.box.x + right.box.width, 1280 * 0.93), 'logo parts sit on their zone edges');
  for (const part of parts) assert.ok(drawn.some(box => box.every((value, index) => near(value, [part.box.x, part.box.y, part.box.width, part.box.height][index]))), `${part.zone} logo drawn in its part box`);
  assert.ok(svg.includes('Confidential'));
  // No logo to resolve: the generated logo is reported at its furniture path and nothing is drawn.
  const missing = { design: { footer: { left: { logo: true } } }, slides: [{ title: 'Content', text: 'Body copy.' }] };
  const reported = [];
  const bare = toSvg(missing, 1, { trace: true, onDiagnostic: diagnostic => reported.push(diagnostic) });
  assert.deepEqual(reported.filter(item => item.code === 'unresolved-content').map(item => item.path), ['design.footer.left.logo']);
  assert.ok(!bare.includes('data-opf-furniture-field="logo"'));
  checked++;
}

// design.listBullet: image draws the icon logo as each entry marker, beneath the entry text.
{
  const icon = await png(20, 160, 20, 48, 48);
  const entries = ['Alpha', 'Beta', 'Gamma'];
  const deck = { design: { logo: { default: wide, icon }, listBullet: 'image' }, slides: [{ title: 'Items', items: entries }] };
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
  const plain = toSvg({ design: { logo: { default: wide, icon } }, slides: [{ title: 'Items', items: entries }] }, 1, { trace: true });
  assert.equal(images(plain).length, 0);
  assert.equal((plain.match(/>•</g) ?? []).length, entries.length);
  // An icon that cannot be drawn keeps the glyphs and reports unresolved-asset once.
  const unresolved = { design: { logo: 'https://example.invalid/logo.png', listBullet: 'image' }, slides: [{ title: 'Items', items: entries }] };
  const diagnostics = [];
  const fallback = toSvg(unresolved, 1, { trace: true, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
  assert.equal(images(fallback).length, 0);
  assert.equal((fallback.match(/>•</g) ?? []).length, entries.length);
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-asset').map(item => item.path), ['design.logo']);
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

console.log(`Design fields passed: ${checked} groups (cover and section logo, LogoSet tone, organization fallback, footer logo, picture bullets, accent font).`);
