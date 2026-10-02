// RR-10: an SVG data URI is drawn as an image wherever a raster is (content, header/footer, watermark, logo, slide image,
// background, picture bullet), at the box core composes and with the same fit as a raster, and it rasterizes to PNG.
// A document that is not an SVG with a namespace and an intrinsic size keeps the "Image unavailable" placeholder.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {renderSvg, renderSvgDeck, svgToPng} from '../dist/index.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const rect = `<svg ${NS} width="120" height="60"><rect width="120" height="60" fill="#00cc00"/></svg>`;
const base64 = text => `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`;
const raster = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO8sAAAAASUVORK5CYII=';
const images = svg => [...svg.matchAll(/<image\b[^>]*>/g)].map(match => match[0]);
const attr = (element, name) => element.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
let checked = 0;

// Every encoding of the data URI draws, as base64.
for (const source of [base64(rect), `data:image/svg+xml;utf8,${encodeURIComponent(rect)}`, `data:image/svg+xml,${encodeURIComponent(rect)}`, `data:image/svg+xml;charset=utf-8;base64,${Buffer.from(rect).toString('base64')}`]) {
  const diagnostics = [];
  const svg = renderSvg({slides: [{title: 'T', image: {src: source, alt: 'Chart'}}]}, {trace: true, strictAssets: true, onDiagnostic: item => diagnostics.push(item)});
  const [image] = images(svg);
  assert.ok(image, 'drawn as an image');
  assert.equal(attr(image, 'href'), base64(rect), 'normalized to base64');
  assert.match(image, /preserveAspectRatio="xMidYMid meet"/);
  assert.equal(attr(image, 'aria-label'), 'Chart');
  assert.deepEqual(diagnostics, []);
  assert.ok(!svg.includes('data-opf-asset-status'));
  checked++;
}

// The box and the fit are the raster's: an SVG and a PNG of the same content get the same image element geometry.
for (const fill of ['fit', 'crop']) {
  const make = source => ({design: {imageFill: fill}, slides: [{title: 'T', layout: 'image-1x', image: {src: source, alt: 'x'}}]});
  const [vector] = images(renderSvg(make(base64(rect)), {trace: true})), [bitmap] = images(renderSvg(make(raster), {trace: true}));
  for (const name of ['x', 'y', 'width', 'height', 'preserveAspectRatio']) assert.equal(attr(vector, name), attr(bitmap, name), `${fill} ${name}`);
  checked++;
}

// Every place an image appears.
{
  const deck = {design: {logo: base64(rect), watermark: {src: base64(rect), opacity: .1}, header: {right: {image: {src: base64(rect), alt: 'Header'}}},
    listBullet: 'image', background: {type: 'image', image: {src: base64(rect)}}}, slides: [{title: 'Cover', layout: 'title'}, {title: 'Items', items: ['One', 'Two'], design: {slideImage: {src: base64(rect), position: 'right'}}}]};
  const diagnostics = [];
  const slides = renderSvgDeck(deck, {trace: true, strictAssets: true, onDiagnostic: item => diagnostics.push(item)});
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-asset'), []);
  for (const svg of slides) assert.ok(!svg.includes('data-opf-asset-status'), 'no placeholder');
  assert.ok(images(slides[0]).length >= 4, 'background, watermark, logo and header image on the cover');
  assert.ok(images(slides[1]).length >= 6, 'plus the slide image and two picture bullets');
  checked++;
}

// Not drawable: not well-formed XML (an unclosed or mismatched tag, a repeated attribute, text after the root, an undeclared entity, two roots),
// an external or markup entity (the export refuses these as svg-malformed and svg-unsafe, so the preview shows the placeholder too), no namespace, no size, not SVG text, a PNG label over SVG bytes. The placeholder and a diagnostic.
for (const source of [base64(`<svg ${NS} width="40" height="20"><g></svg>`), base64(`<svg ${NS} width="40" height="20"><g></h></svg>`), base64(`<svg ${NS} width="4" width="5" height="4"/>`), base64(`<svg ${NS} width="4" height="4"/>tail`), base64(`<svg ${NS} width="4" height="4"><text>&nope;</text></svg>`), base64(`<svg ${NS} width="4" height="4"/><svg ${NS} width="4" height="4"/>`),
  base64(`<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg ${NS} width="4" height="4"/>`), base64(`<!DOCTYPE svg [<!ENTITY x "<g/>">]><svg ${NS} width="4" height="4"/>`),
  base64(`<svg width="10" height="10"/>`), base64(`<svg ${NS}><rect width="4" height="4"/></svg>`), base64('<html></html>'), 'data:image/svg+xml;base64,@@@', `data:image/png;base64,${Buffer.from(rect).toString('base64')}`.replace(/^data:image\/png/, 'data:image/svg+xml').slice(0, 30)]) {
  const diagnostics = [];
  const svg = renderSvg({slides: [{title: 'T', image: {src: source, alt: 'Chart'}}]}, {onDiagnostic: item => diagnostics.push(item)});
  assert.ok(svg.includes('data-opf-asset-status="unresolved"'), 'placeholder');
  assert.equal(diagnostics.filter(item => item.code === 'unresolved-asset').length, 1);
  assert.throws(() => renderSvg({slides: [{title: 'T', image: source}]}, {strictAssets: true}), {code: 'unresolved-asset'});
  checked++;
}

// A prefixed root, a plain-text entity, CDATA and a utf-16 document with a BOM are well-formed and draw.
for (const source of [base64(`<svg:svg xmlns:svg="http://www.w3.org/2000/svg" width="8" height="4"><svg:rect width="8" height="4"/></svg:svg>`), base64(`<!DOCTYPE svg [<!ENTITY size "8">]><svg ${NS} width="&size;" height="4"><style><![CDATA[rect{fill:red}]]></style><title>a &amp; b &#169;</title></svg>`),
  `data:image/svg+xml;base64,${Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(rect, 'utf16le')]).toString('base64')}`]) {
  assert.equal(images(renderSvg({slides: [{title: 'T', image: source}]})).length, 1, source.slice(0, 60));
  checked++;
}

// A viewBox alone is an intrinsic size; a DOCTYPE, a comment and a prolog do not hide the root.
for (const text of [`<svg ${NS} viewBox="0 0 10 5"><rect width="10" height="5"/></svg>`, `<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><!-- logo --><svg ${NS} width="2in" height="1in"/>`]) {
  assert.ok(images(renderSvg({slides: [{title: 'T', image: base64(text)}]})).length === 1, text);
  checked++;
}

// PNG output draws the SVG (resvg, deterministic): the green rectangle is in the picture.
{
  const deck = {design: {dimensions: {widthInches: 4, heightInches: 2}, background: {type: 'solid', color: '#FFFFFF'}}, slides: [{image: {src: base64(rect), alt: 'Chart'}}]};
  const [svg] = renderSvgDeck(deck, {strictAssets: true});
  const png = await svgToPng(svg);
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let green = 0;
  for (let offset = 0; offset < data.length; offset += 4) if (data[offset] === 0 && data[offset + 1] === 204 && data[offset + 2] === 0) green++;
  assert.ok(green > info.width * info.height * .1, `the SVG picture is painted (${green} green pixels)`);
  assert.equal(Buffer.compare(Buffer.from(png), Buffer.from(await svgToPng(svg))), 0, 'deterministic');
  checked++;
}

// The text of an SVG picture is drawn in PNG output, with the render's fonts (resvg gives a nested document none).
{
  const label = `<svg ${NS} width="200" height="80"><text x="10" y="60" font-family="Roboto" font-size="64" font-weight="700" fill="#000000">Hi</text></svg>`;
  const deck = {design: {dimensions: {widthInches: 4, heightInches: 2}, background: {type: 'solid', color: '#FFFFFF'}}, slides: [{image: base64(label)}]};
  const [svg] = renderSvgDeck(deck, {strictAssets: true});
  const {data} = await sharp(await svgToPng(svg)).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let dark = 0;
  for (let offset = 0; offset < data.length; offset += 4) if (data[offset] < 64 && data[offset + 1] < 64 && data[offset + 2] < 64) dark++;
  assert.ok(dark > 200, `the picture's text is painted (${dark} dark pixels)`);
  assert.equal(Buffer.compare(Buffer.from(await svgToPng(svg)), Buffer.from(await svgToPng(svg))), 0, 'deterministic');
  // A picture that cannot be read does not fail the PNG output.
  const broken = `<svg ${NS} width="10" height="10"><text>`;
  await svgToPng(renderSvgDeck({slides: [{image: base64(broken)}]})[0]);
  checked++;
}

// An SVG used as an image reaches nothing outside itself in the rasterizer: a local file it names is not drawn.
{
  const red = await sharp({create: {width: 4, height: 4, channels: 4, background: '#ff0000'}}).png().toBuffer();
  const {writeFile, mkdtemp, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const path = await import('node:path');
  const directory = await mkdtemp(path.join(tmpdir(), 'opf-render-svg-'));
  try {
    const file = path.join(directory, 'red.png');
    await writeFile(file, red);
    const hostile = `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="20"><image xlink:href="${file.replaceAll('\\', '/')}" width="40" height="20"/><script>alert(1)</script></svg>`;
    const [svg] = renderSvgDeck({design: {dimensions: {widthInches: 4, heightInches: 2}}, slides: [{image: base64(hostile)}]});
    const {data} = await sharp(await svgToPng(svg)).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    for (let offset = 0; offset < data.length; offset += 4) assert.ok(!(data[offset] === 255 && data[offset + 1] === 0 && data[offset + 2] === 0), 'the local file is not drawn');
    checked++;
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

console.log(`SVG image checks passed (${checked}): data URI encodings, raster-identical boxes and fit, every image place, unusable SVG placeholders, PNG output and no outside reach.`);
