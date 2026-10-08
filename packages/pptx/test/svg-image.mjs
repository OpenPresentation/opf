// RR-10: SVG pictures export as PowerPoint 2016 / Microsoft 365 store them: a `p:pic` whose `a:blip` embeds a PNG fallback
// and carries `asvg:svgBlip` pointing at the SVG media part (image/svg+xml). The fallback is drawn deterministically
// (opf-render's resvg, bundled fonts, transparent background). The SVG is sanitized (nothing executes, nothing is fetched).
// Import reads the SVG back (with provenance and from a plain PowerPoint package). Boxes follow the raster path, which
// the preview shares. Without a rasterizer the picture is the unavailable-image placeholder with a diagnostic.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {XMLValidator} from 'fast-xml-parser';
import {strFromU8, unzipSync, zipSync} from 'fflate';
import sharp from 'sharp';
import {svgToPng} from '@openpresentation/opf-render';
import {renderSlideSvg, resolvePresentation, fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {prepareSvg, svgDataUriBytes, svgIntrinsicSize, svgRasterScale} from '../dist/svg-image.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const SVG_URI = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';
const read = async name => new Uint8Array(await readFile(new URL(`./fixtures/images/${name}`, import.meta.url)));
const uriOf = (text, type = 'image/svg+xml') => `data:${type};base64,${Buffer.from(text).toString('base64')}`;
const rasterUri = (bytes, type = 'image/png') => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
// Axis-aligned shapes only: their raster is exact on any CPU, so the byte checks below hold on every OS.
const wideText = `<svg ${NS} width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="#cc0000"/></svg>`;
const tallText = `<svg ${NS} width="60" height="120"><rect width="60" height="120" fill="#0066cc"/></svg>`;
const squareText = `<svg ${NS} viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60" fill="#00aa44"/></svg>`;
const wide = uriOf(wideText), tall = uriOf(tallText), square = uriOf(squareText);
const widePng = rasterUri(await read('wide.png')), tallPng = rasterUri(await read('tall.png')), squarePng = rasterUri(await read('square.png'));
const light = {type: 'solid', color: '#FFFFFF'};
const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};

const decoder = new TextDecoder();
async function open(deck, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx(deck, {...FIXED, onDiagnostic: item => diagnostics.push(item), ...options});
  return {bytes, entries: unzipSync(bytes), diagnostics};
}
const slideXml = (entries, index = 0) => decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]);
const slideRels = (entries, index = 0) => decoder.decode(entries[`ppt/slides/_rels/slide${index + 1}.xml.rels`]);
const pictures = xml => [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(([picture]) => ({
  xml: picture,
  name: picture.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1],
  embed: picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1],
  svgEmbed: picture.match(/<asvg:svgBlip\b[^>]*r:embed="([^"]+)"/)?.[1],
  xfrm: picture.match(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/)?.[0],
  srcRect: picture.match(/<a:srcRect\b[^>]*\/>/)?.[0],
  x: Number(picture.match(/<a:off x="(-?\d+)"/)?.[1]) / 9525, y: Number(picture.match(/<a:off x="-?\d+" y="(-?\d+)"/)?.[1]) / 9525,
  w: Number(picture.match(/<a:ext cx="(\d+)"/)?.[1]) / 9525, h: Number(picture.match(/<a:ext cx="\d+" cy="(\d+)"/)?.[1]) / 9525,
}));
const target = (entries, index, id) => {
  const rel = slideRels(entries, index).match(new RegExp(`<Relationship Id="${id}"[^>]*>`))?.[0];
  assert.ok(rel, `relationship ${id} on slide ${index}`);
  return {type: rel.match(/Type="([^"]+)"/)[1], part: `ppt/${rel.match(/Target="([^"]+)"/)[1].replace(/^\.\.\//, '')}`};
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const near = (actual, expected, label, tolerance = .75) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const pixels = async png => {
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return {data, width: info.width, height: info.height, at: (x, y) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)]};
};
let checked = 0;

// One SVG picture, fully: the package parts, the extension, the fallback raster and the source bytes.
async function assertNative(entries, index, picture, svgText, label, ours = true) {
  assert.ok(picture.svgEmbed, `${label}: carries asvg:svgBlip`);
  assert.match(picture.xml, new RegExp(`<a:blip r:embed="${picture.embed}">(?:<a:[A-Za-z]+[^>]*/>)*<a:extLst><a:ext uri="${SVG_URI.replace(/[{}]/g, '\\$&')}"><asvg:svgBlip xmlns:asvg="http://schemas\\.microsoft\\.com/office/drawing/2016/SVG/main" r:embed="${picture.svgEmbed}"/></a:ext></a:extLst></a:blip>`), `${label}: the extension closes the blip`);
  const svgPart = target(entries, index, picture.svgEmbed), pngPart = target(entries, index, picture.embed);
  assert.equal(svgPart.type, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', `${label}: SVG relationship type`);
  assert.match(svgPart.part, /^ppt\/media\/[^/]+\.svg$/);
  assert.match(pngPart.part, /^ppt\/media\/[^/]+\.png$/);
  assert.equal(strFromU8(entries[svgPart.part]), svgText, `${label}: the SVG source is embedded unchanged`);
  const png = await pixels(entries[pngPart.part]);
  assert.ok(!ours || png.width % 128 === 0 || png.height % 128 === 0, `${label}: fallback long side is a multiple of 128 (${png.width}x${png.height})`);
  assert.ok(Math.max(png.width, png.height) <= 2304);
  const types = decoder.decode(entries['[Content_Types].xml']);
  assert.ok(/<Default Extension="svg" ContentType="image\/svg\+xml"\/>/.test(types) || types.includes(`PartName="/${svgPart.part}" ContentType="image/svg+xml"`), `${label}: svg content type registered`);
  assert.equal(XMLValidator.validate(decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`])), true, `${label}: slide XML is well-formed`);
  return {png, svgPart, pngPart};
}

// ---- 1. A content image: the same frame as the raster path (the preview's box and fit), contain and crop.
for (const [name, svg, raster, aspect] of [['wide', wide, widePng, 2], ['tall', tall, tallPng, .5], ['square', square, squarePng, 1]]) {
  for (const fill of ['contain', 'cover']) {
    const deck = {design: {imageFit: fill, background: light}, slides: [{title: 'Picture', layout: 'image-1x', image: {src: svg, alt: `${name} drawing`}}]};
    const reference = {...deck, slides: [{...deck.slides[0], image: {src: raster, alt: `${name} drawing`}}]};
    const {entries, diagnostics} = await open(deck, {strictAssets: true});
    const {entries: rasterEntries} = await open(reference, {strictAssets: true});
    assert.deepEqual(diagnostics, [], `${name}/${fill}: no diagnostics`);
    const [picture] = pictures(slideXml(entries)).filter(item => item.name === 'OPF image 1');
    const [expected] = pictures(slideXml(rasterEntries)).filter(item => item.name === 'OPF image 1');
    assert.equal(picture.xfrm, expected.xfrm, `${name}/${fill}: SVG frame equals the raster frame`);
    assert.equal(picture.srcRect, expected.srcRect, `${name}/${fill}: SVG crop equals the raster crop`);
    if (fill === 'contain') near(picture.w / picture.h, aspect, `${name} fitted aspect`, .005);
    const text = decoder.decode(svgDataUriBytes(svg));
    const {png} = await assertNative(entries, 0, picture, text, `${name}/${fill}`);
    near(png.width / png.height, aspect, `${name} fallback aspect`, .02);
    assert.match(slideXml(entries), /descr="[a-z]+ drawing"/, 'alt text survives');
    checked++;
  }
}

// ---- 2. The fallback is transparent where the drawing is, and opaque where it paints.
{
  const circle = `<svg ${NS} width="100" height="100"><circle cx="50" cy="50" r="40" fill="#336699"/></svg>`;
  const {entries} = await open({slides: [{title: 'T', image: uriOf(circle)}]});
  const [picture] = pictures(slideXml(entries));
  const png = await pixels(entries[target(entries, 0, picture.embed).part]);
  assert.equal(png.at(1, 1)[3], 0, 'the corner is transparent (no white background)');
  const centre = png.at(png.width >> 1, png.height >> 1);
  assert.deepEqual(centre, [0x33, 0x66, 0x99, 255], 'the centre is the fill');
  checked++;
}

// ---- 3. Every place an image appears.
{
  const logoDeck = {design: {logo: wide, imageFit: 'contain', background: light, watermark: {src: square, opacity: 1}, footer: {left: {logo: true}}},
    slides: [{title: 'Cover', layout: 'title'}, {title: 'Body', blocks: [{type: 'text', text: 'Copy'}, {type: 'image', image: {src: wide, alt: 'Wide'}}, {type: 'image', image: tall, placement: {edge: 'right'}}]}]};
  const {entries, diagnostics, bytes} = await open(logoDeck);
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-asset'), []);
  const cover = pictures(slideXml(entries, 0)), body = pictures(slideXml(entries, 1));
  const named = (list, prefix) => list.filter(item => item.name?.startsWith(prefix));
  // Cover logo (design.logo): native, left-anchored in core's box.
  const [logo] = named(cover, 'OPF logo');
  assert.ok(logo, 'the cover logo is drawn');
  await assertNative(entries, 0, logo, wideText, 'cover logo');
  const geometry = resolvePresentation(logoDeck).slides[0].geometry;
  const scale = Math.min(geometry.logo.box.width / 120, geometry.logo.box.height / 60);
  near(logo.w, 120 * scale, 'logo width'); near(logo.h, 60 * scale, 'logo height'); near(logo.x, geometry.logo.box.x, 'logo left edge');
  // Opaque watermark (opacity 1): native. A placed image block without treatments: native.
  const [watermark] = named(cover, 'OPF watermark');
  await assertNative(entries, 0, watermark, squareText, 'watermark');
  const placed = body.find(item => item.svgEmbed && strFromU8(entries[target(entries, 1, item.svgEmbed).part]) === tallText);
  await assertNative(entries, 1, placed, tallText, 'placed image block');
  // The footer logo (generated image part) is native too, and a body image.
  const footerLogos = body.filter(item => item !== placed && item.svgEmbed && item.name?.startsWith('OPF image'));
  assert.ok(footerLogos.length >= 2, 'footer logo and body image are native SVG pictures');
  for (const picture of footerLogos) await assertNative(entries, 1, picture, wideText, `slide 2 ${picture.name}`);
  // One SVG part per distinct source: the wide logo appears on both slides and the footer, as one media part.
  const svgParts = Object.keys(entries).filter(part => part.endsWith('.svg'));
  const wideParts = svgParts.filter(part => strFromU8(entries[part]) === wideText);
  assert.equal(wideParts.length, 1, 'identical SVG media parts are embedded once');
  assert.equal(new Set(svgParts).size, svgParts.length);
  // The rebuilt package re-imports: the logo and watermark return as design fields, the placed block with its SVG source.
  const reports = [];
  const imported = await fromPptx(bytes, {onDiagnostic: item => reports.push(item)});
  assert.equal(imported.design.logo, wide, 'design.logo returns as the authored SVG');
  assert.equal(imported.design.watermark.src, square);
  assert.equal(imported.slides[1].blocks.find(block => block.placement)?.image.src, tall);
  assert.deepEqual(reports.filter(item => /invalid|unsupported/.test(item.code)), [], 'no provenance complaint for SVG pictures');
  const rerun = await toPptx(imported, {...FIXED});
  assert.equal(pictures(slideXml(unzipSync(rerun), 0)).filter(item => item.svgEmbed).length, 3, 're-export keeps the native SVG logo, watermark and footer logo on the cover');
  checked++;
}

// ---- 4. Picture effects. PowerPoint applies opacity (a:alphaModFix), grayscale (a:grayscl) and a border (a:ln) to an SVG picture
// (native check 2026-10-01), so those stay native, the effect before the SVG extension; a duotone recolor and a non-rectangular mask
// are unconfirmed on an SVG picture and keep the PNG (svg-image-rasterized). A picture bullet is a raster (a:buBlip).
{
  const deck = {design: {watermark: {src: wide, opacity: .3}, background: light}, slides: [{title: 'T', blocks: [{type: 'image', image: square, placement: {edge: 'left'}, opacity: .5, recolor: 'grayscale', border: {color: '#c0392b', width: 6}}]}]};
  const {entries, diagnostics, bytes} = await open(deck);
  const xml = slideXml(entries);
  assert.deepEqual(diagnostics.filter(item => item.code === 'svg-image-rasterized'), []);
  const watermark = pictures(xml).find(item => item.name === 'OPF watermark'), image = pictures(xml).find(item => /^OPF image \d+$/.test(item.name));
  assert.ok(watermark.svgEmbed && image.svgEmbed, 'both stay native SVG pictures');
  assert.match(watermark.xml, /<a:blip r:embed="rId\d+"><a:alphaModFix amt="30000"\/><a:extLst>/);
  assert.match(image.xml, /<a:blip r:embed="rId\d+"><a:grayscl\/><a:alphaModFix amt="50000"\/><a:extLst>/);
  assert.match(image.xml, /<a:ln w="\d+"[^>]*>/, 'the border');
  await assertNative(entries, 0, watermark, wideText, 'translucent watermark');
  await assertNative(entries, 0, image, squareText, 'treated image block');
  // The effects are still identity: an unchanged export imports as the design field and the image block with their treatments.
  const imported = await fromPptx(bytes);
  assert.equal(imported.design.watermark.src, wide);
  assert.equal(imported.design.watermark.opacity, .3);
  assert.equal(imported.slides[0].blocks[0].image.src, square);
  assert.equal(imported.slides[0].blocks[0].opacity, .5);
  assert.equal(imported.slides[0].blocks[0].recolor, 'grayscale');
  for (const treatment of [{recolor: {dark: '#102030', light: '#f0e0d0'}}, {shape: 'circle'}]) {
    const result = await open({design: {background: light}, slides: [{title: 'T', blocks: [{type: 'image', image: square, placement: {edge: 'left'}, ...treatment}]}]});
    assert.ok(!/svgBlip/.test(slideXml(result.entries)), `${Object.keys(treatment)}: raster`);
    assert.deepEqual(result.diagnostics.filter(item => item.code === 'svg-image-rasterized').map(item => item.path), ['slides.0.blocks.0.image']);
  }
  checked++;
}
{
  const icon = uriOf(`<svg ${NS} width="32" height="32"><rect width="32" height="32" fill="#cc0000"/></svg>`);
  const deck = {design: {logo: {default: wide, icon}, listBullet: 'image', background: light}, slides: [{title: 'Items', items: ['Alpha', 'Beta']}]};
  const {entries, diagnostics} = await open(deck);
  const xml = slideXml(entries);
  assert.equal([...xml.matchAll(/<a:buBlip>/g)].length, 2, 'picture bullets');
  const embed = xml.match(/<a:buBlip><a:blip r:embed="([^"]+)"\/><\/a:buBlip>/)[1];
  const {part} = target(entries, 0, embed);
  assert.match(part, /\.png$/, 'a bullet references the PNG fallback (a:buBlip cannot reference an SVG)');
  assert.ok(!/svgBlip/.test(xml));
  assert.deepEqual(diagnostics.filter(item => item.code === 'unresolved-asset'), []);
  const raster = await pixels(entries[part]);
  assert.deepEqual(raster.at(raster.width >> 1, raster.height >> 1), [0xcc, 0, 0, 255]);
  checked++;
}

// ---- 5. An image background is the PNG raster at the slide's size (a slide background fill carries no SVG).
{
  const deck = {design: {background: {type: 'image', src: wide}}, slides: [{title: 'A'}]};
  const {entries, diagnostics} = await open(deck);
  assert.deepEqual(diagnostics, []);
  const xml = slideXml(entries);
  const background = xml.match(/<p:bg>[\s\S]*?<a:blip r:embed="(rId\d+)"><\/a:blip>/);
  assert.ok(background, 'a native picture fill');
  assert.match(target(entries, 0, background[1]).part, /\.png$/, 'the fill is the PNG raster');
  assert.ok(!/svgBlip/.test(xml));
  checked++;
}

// ---- 6. Determinism: two exports, other time zones and locales, and a pinned fallback raster.
{
  const deck = {design: {logo: wide, background: light}, slides: [{title: 'Cover', layout: 'title'}, {title: 'Body', image: {src: tall, alt: 'Tall'}}]};
  const first = await toPptx(deck, FIXED), second = await toPptx(deck, FIXED);
  assert.equal(sha(first), sha(second), 'two exports are byte-identical');
  const script = `import {toPptx} from ${JSON.stringify(new URL('../dist/index.js', import.meta.url).href)};
    process.stdout.write(Buffer.from(await toPptx(${JSON.stringify(deck)}, ${JSON.stringify(FIXED)})).toString('base64'));`;
  for (const env of [{TZ: 'Asia/Kolkata', LANG: 'tr_TR.UTF-8', LC_ALL: 'tr_TR.UTF-8'}, {TZ: 'America/Los_Angeles', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8'}]) {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {encoding: 'utf8', env: {...process.env, ...env}, maxBuffer: 64 * 1024 * 1024});
    assert.equal(child.status, 0, child.stderr);
    assert.equal(sha(Buffer.from(child.stdout, 'base64')), sha(first), `identical under ${env.TZ} ${env.LANG}`);
  }
  // The fallback is exactly the renderer's raster at the exported size; an axis-aligned drawing at a fixed zoom is the same on every machine.
  const {entries} = await open({slides: [{title: 'T', image: wide}]});
  const [picture] = pictures(slideXml(entries));
  const png = entries[target(entries, 0, picture.embed).part];
  const {width} = await sharp(png).metadata();
  const direct = await svgToPng(wideText, {scale: width / 120, background: 'rgba(0, 0, 0, 0)', fonts: {useBundledFonts: false, loadSystemFonts: false}});
  assert.equal(sha(png), sha(direct), 'the embedded fallback is the renderer raster');
  const pinned = await svgToPng(wideText, {scale: 4, background: 'rgba(0, 0, 0, 0)', fonts: {useBundledFonts: false, loadSystemFonts: false}});
  assert.equal(sha(pinned), 'f5b5253e22d9587f0d87d4d08ab5acdb91d39dcdea3d4110499be346ff7442d2', 'pinned raster of an axis-aligned drawing');
  checked++;
}

// ---- 7. Import: the SVG returns (with and without provenance), and a PowerPoint-saved package works.
{
  for (const provenance of ['full', 'references-only', false]) {
    const deck = {slides: [{title: 'T', blocks: [{image: {src: wide, alt: 'Chart'}}]}]};
    const {bytes} = await open(deck, {provenance});
    const imported = await fromPptx(bytes);
    const slide = imported.slides[0];
    const src = slide.image?.src ?? slide.blocks?.[0]?.image?.src;
    assert.equal(src, wide, `${provenance}: the image is the authored SVG data URI`);
    checked++;
  }
  // A package as PowerPoint writes it: different part names, a14 extension first, relationship ids renumbered.
  const {entries} = await open({slides: [{title: 'T', image: {src: wide, alt: 'Logo'}}]}, {provenance: false});
  const [picture] = pictures(slideXml(entries));
  const svgPart = target(entries, 0, picture.svgEmbed).part, pngPart = target(entries, 0, picture.embed).part;
  const saved = {...entries};
  delete saved[svgPart]; delete saved[pngPart];
  saved['ppt/media/image7.svg'] = entries[svgPart];
  saved['ppt/media/image6.png'] = entries[pngPart];
  saved['ppt/slides/slide1.xml'] = new TextEncoder().encode(slideXml(entries).replace(/<a:blip r:embed="[^"]+">[\s\S]*?<\/a:blip>/, '<a:blip r:embed="rId11"><a:extLst><a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId12"/></a:ext></a:extLst></a:blip>'));
  saved['ppt/slides/_rels/slide1.xml.rels'] = new TextEncoder().encode(slideRels(entries).replace(/<Relationship Id="rId1"[^>]*\/>/, '<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image6.png"/>').replace(/<Relationship Id="rIdOpfSvg1"[^>]*\/>/, '<Relationship Id="rId12" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image7.svg"/>'));
  const reports = [];
  const imported = await fromPptx(zipSync(Object.fromEntries(Object.entries(saved).filter(([name]) => !name.endsWith('/')))), {onDiagnostic: item => reports.push(item)});
  const slide = imported.slides[0];
  assert.equal(slide.image?.src ?? slide.blocks?.[0]?.image?.src, wide, 'a PowerPoint-style svgBlip imports the SVG, not the fallback');
  assert.equal(slide.image?.alt ?? slide.blocks?.[0]?.image?.alt, 'Logo');
  assert.deepEqual(reports.filter(item => /svg/.test(item.code)), []);
  // A damaged SVG part imports the PNG fallback and says so; a hostile one is sanitized.
  const damaged = {...saved, 'ppt/media/image7.svg': new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"')};
  const damagedReports = [];
  const fallback = await fromPptx(zipSync(Object.fromEntries(Object.entries(damaged).filter(([name]) => !name.endsWith('/')))), {onDiagnostic: item => damagedReports.push(item)});
  assert.match(fallback.slides[0].image?.src ?? fallback.slides[0].blocks?.[0]?.image?.src, /^data:image\/png;base64,/);
  assert.ok(damagedReports.some(item => item.code === 'invalid-svg-image'));
  const hostile = {...saved, 'ppt/media/image7.svg': new TextEncoder().encode(`<svg ${NS} width="10" height="10" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10"/></svg>`)};
  const hostileReports = [];
  const clean = await fromPptx(zipSync(Object.fromEntries(Object.entries(hostile).filter(([name]) => !name.endsWith('/')))), {onDiagnostic: item => hostileReports.push(item)});
  const cleanSrc = clean.slides[0].image?.src ?? clean.slides[0].blocks?.[0]?.image?.src;
  const cleanText = decoder.decode(svgDataUriBytes(cleanSrc));
  assert.ok(!/script|onload/.test(cleanText), 'imported SVG carries no script');
  assert.ok(hostileReports.some(item => item.code === 'svg-sanitized'));
  checked++;
}

// ---- 7b. A PowerPoint save of SVG pictures. PowerPoint (checked natively, 2026-10-01) renames media parts, renumbers
// relationships, renames tag parts, drops whitespace between elements and the zero sides of an a:srcRect, and may write the
// picture with NO PNG fallback (an a:blip with no r:embed, only the svgBlip). Every SVG picture still imports, as design
// fields where it is tagged and unchanged and as an ordinary SVG image where it is not.
{
  const enc = new TextEncoder();
  const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
  const slideParts = entries => Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));
  function powerpointSvgSave(bytes, {dropFallback}) {
    const entries = unzipSync(bytes);
    if (dropFallback) {
      for (const part of slideParts(entries)) {
        let rels = decoder.decode(entries[relsOf(part)]);
        entries[part] = enc.encode(decoder.decode(entries[part]).replace(/<a:blip r:embed="([^"]+)">(<a:extLst><a:ext uri="\{96DAC541[\s\S]*?<\/a:blip>)/g, (match, id, rest) => {
          rels = rels.replace(new RegExp(`<Relationship Id="${id}"[^>]*/>`), '');
          return `<a:blip>${rest}`;
        }));
        entries[relsOf(part)] = enc.encode(rels);
      }
      const referenced = new Set();
      for (const path of Object.keys(entries).filter(name => name.endsWith('.rels'))) for (const [, target] of decoder.decode(entries[path]).matchAll(/Target="\.\.\/media\/([^"]+)"/g)) referenced.add(`ppt/media/${target}`);
      for (const path of Object.keys(entries).filter(name => /^ppt\/media\/[^/]+$/.test(name) && !referenced.has(name))) {
        delete entries[path];
        entries['[Content_Types].xml'] = enc.encode(decoder.decode(entries['[Content_Types].xml']).replace(new RegExp(`<Override PartName="/${path}"[^>]*/>`), ''));
      }
    }
    const names = Object.keys(entries);
    const media = names.filter(path => /^ppt\/media\/[^/]+$/.test(path)).sort(), tags = names.filter(path => /^ppt\/tags\/[^/]+$/.test(path)).sort();
    const moved = new Map([...media.map((path, index) => [path, `ppt/media/image${index + 1}.${path.split('.').pop()}`]), ...tags.map((path, index) => [path, `ppt/tags/tag${tags.length - index}.xml`])]);
    const ids = new Map();
    for (const part of slideParts(entries)) {
      const all = [...decoder.decode(entries[relsOf(part)]).matchAll(/Id="([^"]+)"/g)].map(match => match[1]);
      ids.set(part, new Map(all.map((id, index) => [id, `rId${all.length - index}`])));
    }
    const result = {};
    for (const [path, data] of Object.entries(entries)) {
      let out = data;
      if (path.endsWith('.rels')) {
        const owner = path.replace('_rels/', '').replace(/\.rels$/, ''), directory = owner.replace(/[^/]*$/, '');
        let xml = decoder.decode(data).replace(/Target="([^"]+)"/g, (match, value) => {
          if (/^[a-z]+:/i.test(value)) return match;
          const to = moved.get(new URL(value, `http://x/${directory}`).pathname.slice(1));
          return to ? `Target="${value.replace(/[^/]+$/, to.split('/').pop())}"` : match;
        });
        const map = ids.get(owner);
        if (map) xml = xml.replace(/Id="([^"]+)"/g, (match, id) => `Id="${map.get(id) ?? id}"`);
        out = enc.encode(xml);
      } else if (path === '[Content_Types].xml') {
        out = enc.encode(decoder.decode(data).replace(/PartName="\/([^"]+)"/g, (match, part) => `PartName="/${moved.get(part) ?? part}"`));
      } else if (ids.has(path)) {
        let xml = decoder.decode(data).replace(/>\s+</g, '><').replace(/<a:srcRect\b[^>]*\/>/g, tag => tag.replace(/ [ltrb]="0"/g, ''));
        xml = xml.replace(/(r:(?:embed|id)=)"([^"]+)"/g, (match, attribute, id) => `${attribute}"${ids.get(path).get(id) ?? id}"`);
        out = enc.encode(xml);
      }
      result[moved.get(path) ?? path] = out;
    }
    return zipSync(Object.fromEntries(Object.entries(result).filter(([name]) => !name.endsWith('/'))));
  }
  const deck = {design: {logo: wide, watermark: {src: square, opacity: 1}, header: {right: {image: {src: tall, alt: 'Icon'}}}, footer: {left: {logo: true}}, background: light},
    slides: [
      {title: 'Cover', layout: 'title'},
      {title: 'Body', blocks: [{type: 'text', text: 'Copy'}, {type: 'image', image: {src: wide, alt: 'Wide'}}, {type: 'image', image: tall, fit: 'contain', placement: {edge: 'right'}}]},
      {title: 'Placed image cover', blocks: [{type: 'text', text: 'Copy'}, {type: 'image', image: wide, fit: 'cover', placement: {edge: 'left'}}]},
      {title: 'Blocks', blocks: [{image: {src: square, alt: 'Square'}}, {text: 'Beside'}]},
    ]};
  const {bytes} = await open(deck);
  for (const dropFallback of [false, true]) {
    const saved = powerpointSvgSave(bytes, {dropFallback});
    const savedEntries = unzipSync(saved);
    assert.equal(Object.keys(savedEntries).filter(path => path.endsWith('.png')).length > 0, !dropFallback, 'the PNG fallbacks are gone only in the drop variant');
    assert.ok(slideParts(savedEntries).every(part => !decoder.decode(savedEntries[part]).includes('rIdOpfSvg')), 'ids were renumbered');
    const reports = [];
    const imported = await fromPptx(saved, {onDiagnostic: item => reports.push(item)});
    const label = dropFallback ? 'SVG only' : 'with fallback';
    assert.deepEqual(reports.filter(item => /^invalid-|^unsupported-image-(?!crop)/.test(item.code)), [], `${label}: no provenance complaint`);
    assert.equal(imported.design.logo, wide, `${label}: design.logo`);
    assert.equal(imported.design.watermark?.src, square, `${label}: design.watermark`);
    assert.equal(imported.slides[1].blocks?.find(block => block.placement)?.image.src, tall, `${label}: placed image (contain)`);
    assert.equal(imported.slides[2].blocks?.find(block => block.placement)?.image.src, wide, `${label}: placed image (cover)`);
    const text = JSON.stringify(imported);
    assert.ok(!text.includes('PowerPoint image:'), `${label}: no picture was dropped to a text note`);
    assert.equal(imported.slides[1].image?.src ?? imported.slides[1].blocks?.find(block => block.image && !block.placement)?.image.src, wide, `${label}: content image`);
    assert.equal(imported.slides[3].blocks?.find(block => block.image)?.image.src ?? imported.slides[3].image?.src, square, `${label}: block image`);
    assert.ok(text.includes(tall) && JSON.stringify(imported.design).includes('"header"') || JSON.stringify(imported.slides).includes(tall), `${label}: the header image returns`);
    // Edited after the save (the watermark moved): it is no longer the design field but is not lost: it imports as an ordinary SVG image.
    const moved = new Map(Object.entries(savedEntries));
    const slide = decoder.decode(savedEntries['ppt/slides/slide1.xml']).replace(/(name="OPF watermark"[\s\S]*?<a:off x=")\d+/, '$11');
    moved.set('ppt/slides/slide1.xml', enc.encode(slide));
    const damagedReports = [];
    const damaged = await fromPptx(zipSync(Object.fromEntries(moved)), {onDiagnostic: item => damagedReports.push(item)});
    assert.ok(damagedReports.some(item => item.code === 'invalid-watermark-provenance'), `${label}: the edit is reported`);
    assert.equal(damaged.design?.watermark, undefined);
    const ordinary = JSON.stringify(damaged.slides[0]);
    assert.ok(ordinary.includes(square), `${label}: the edited watermark is still an image (${ordinary.slice(0, 120)})`);
  }
  checked++;
}

// ---- 8. Preview parity: the export frame is the rectangle the preview draws for the same picture.
{
  // The preview draws an SVG data URI as an image in the content box (preserveAspectRatio meet, or slice for cover) once the
  // renderer supports it; the raster of the same proportions is the control either way.
  for (const fill of ['contain', 'cover']) {
    const make = source => ({design: {imageFit: fill, background: light}, slides: [{title: 'Picture', layout: 'image-1x', image: {src: source, alt: 'x'}}]});
    const preview = renderSlideSvg(make(wide), 0, {trace: true}), control = renderSlideSvg(make(widePng), 0, {trace: true});
    const draws = /<image\b/.test(preview);
    const {entries} = await open(make(wide));
    const [picture] = pictures(slideXml(entries));
    const image = (draws ? preview : control).match(/<image\b[^>]*>/)[0];
    const box = Object.fromEntries(['x', 'y', 'width', 'height'].map(name => [name, Number(image.match(new RegExp(`\\s${name}="([^"]+)"`))[1])]));
    const scale = (fill === 'cover' ? Math.max : Math.min)(box.width / 120, box.height / 60);
    const drawn = {w: 120 * scale, h: 60 * scale};
    if (fill === 'contain') {
      near(picture.w, drawn.w, 'frame width', 1); near(picture.h, drawn.h, 'frame height', 1);
      near(picture.x, box.x + (box.width - drawn.w) / 2, 'frame x', 1); near(picture.y, box.y + (box.height - drawn.h) / 2, 'frame y', 1);
    } else {
      near(picture.w, box.width, 'cropped frame width', 1); near(picture.h, box.height, 'cropped frame height', 1);
      near(picture.x, box.x, 'cropped frame x', 1); near(picture.y, box.y, 'cropped frame y', 1);
    }
    checked++;
  }
}

// ---- 9. Sanitizing: nothing executes, nothing is fetched or read from disk.
{
  const directory = await mkdtemp(path.join(tmpdir(), 'opf-svg-'));
  try {
    const redPng = path.join(directory, 'red.png');
    await writeFile(redPng, await sharp({create: {width: 4, height: 4, channels: 4, background: '#ff0000'}}).png().toBuffer());
    const hostile = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY brand "Acme">]><?xml-stylesheet href="https://example.invalid/x.css"?>
<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" width="60" height="30" onload="fetch('https://example.invalid')">
  <style>@import url(https://example.invalid/a.css); .a { fill: url(https://example.invalid/p.svg#x); stroke: url(#ok) }</style>
  <script>fetch('https://example.invalid/steal')</script>
  <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">hello</div></foreignObject>
  <a xlink:href="https://example.invalid/page"><rect width="10" height="10" onclick="x()" fill="url(https://example.invalid/g)"/></a>
  <image xlink:href="${redPng.replaceAll('\\', '/')}" width="60" height="30"/>
  <image href="file:///etc/passwd" width="60" height="30"/>
  <use href="https://example.invalid/other.svg#i"/>
  <animate attributeName="href" to="javascript:alert(1)"/>
  <rect id="ok" x="1" y="1" width="4" height="4" fill="#00ff00" title="&brand;"/>
</svg>`;
    const prepared = prepareSvg(new TextEncoder().encode(hostile));
    assert.ok(!prepared.error, prepared.error?.message);
    for (const forbidden of [/<script/i, /onload|onclick/i, /example\.invalid/, /foreignObject/, /file:/, /DOCTYPE/, /<animate/, /xml-stylesheet/, /@import/, new RegExp(redPng.replaceAll('\\', '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))]) {
      assert.ok(!forbidden.test(prepared.text), `removed: ${forbidden}`);
    }
    assert.match(prepared.text, /title="Acme"/, 'a plain-text entity is expanded');
    assert.match(prepared.text, /stroke: url\(#ok\)/, 'local fragment references stay');
    assert.deepEqual(new Set(prepared.removed), new Set(['a DOCTYPE declaration', 'a stylesheet instruction', 'event handlers', 'external references', 'scripts', '<foreignObject> elements', '<animate> elements']));
    // The exported package: sanitized SVG part, one diagnostic, no network, and the fallback shows no file the SVG named.
    const requests = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (...args) => { requests.push(args); throw new Error('network is not allowed'); };
    try {
      const {entries, diagnostics} = await open({slides: [{title: 'T', image: uriOf(hostile)}]}, {strictAssets: true});
      assert.deepEqual(requests, [], 'no network request');
      assert.deepEqual(diagnostics.map(item => item.code), ['svg-sanitized']);
      const [picture] = pictures(slideXml(entries));
      const {svgPart, pngPart} = await assertNative(entries, 0, picture, prepared.text, 'hostile svg');
      assert.ok(!/script|onload|example\.invalid/.test(strFromU8(entries[svgPart.part])));
      const png = await pixels(entries[pngPart.part]);
      // The file the SVG named (red) is not drawn; the one green square (the only safe shape) is the only paint.
      const colours = new Set();
      for (let offset = 0; offset < png.data.length; offset += 4) if (png.data[offset + 3]) colours.add(png.data.subarray(offset, offset + 3).join(','));
      assert.ok(!colours.has('255,0,0'), 'the referenced local file is not drawn');
      assert.ok(colours.has('0,255,0'), 'the local shape is drawn');
    } finally {
      globalThis.fetch = realFetch;
    }
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
  // Safe SVG is embedded byte for byte (comments and all); entity bombs and external entities are refused.
  const safe = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Logo -->\n<svg ${NS} width="10" height="10"><rect width="10" height="10"/></svg>\n`;
  assert.deepEqual(prepareSvg(new TextEncoder().encode(safe)).bytes, new TextEncoder().encode(safe));
  assert.equal(prepareSvg(new TextEncoder().encode(`<!DOCTYPE svg [<!ENTITY a "&b;&b;"><!ENTITY b "x">]><svg ${NS} width="1" height="1">&a;</svg>`)).error.reason, 'svg-unsafe');
  assert.equal(prepareSvg(new TextEncoder().encode(`<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg ${NS} width="1" height="1">&x;</svg>`)).error.reason, 'svg-unsafe');
  assert.equal(prepareSvg(new TextEncoder().encode(`<svg ${NS} width="1" height="1">&nbsp;</svg>`)).error.reason, 'svg-malformed');
  assert.equal(prepareSvg(new Uint8Array(9 * 1024 * 1024)).error.reason, 'svg-too-large');
  // UTF-16 and ISO-8859-1 sources are read.
  assert.ok(!prepareSvg(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`<svg ${NS} width="1" height="1"/>`, 'utf16le')])).error);
  assert.match(prepareSvg(Buffer.from(`<?xml version="1.0" encoding="ISO-8859-1"?><svg ${NS} width="1" height="1"><title>caf\xe9</title></svg>`, 'latin1')).text, /café/);
  checked++;
}

// ---- 10. Sizes: width/height with units, viewBox alone, one length plus a viewBox; none at all.
{
  const size = attributes => svgIntrinsicSize(attributes);
  assert.deepEqual(size({width: '2in', height: '1in'}), {width: 192, height: 96});
  assert.deepEqual(size({width: '10mm', height: '10mm'}).width.toFixed(3), (10 * 96 / 25.4).toFixed(3));
  assert.deepEqual(size({viewBox: '0 0 300 100'}), {width: 300, height: 100});
  assert.deepEqual(size({viewBox: '10,10,300,100', width: '150'}), {width: 150, height: 50});
  assert.deepEqual(size({viewBox: '0 0 300 100', height: '50px'}), {width: 150, height: 50});
  assert.deepEqual(size({width: '100%', height: '100%', viewBox: '0 0 40 20'}), {width: 40, height: 20});
  assert.equal(size({width: '100%', height: '50%'}), null);
  assert.equal(size({width: '0', height: '10'}), null);
  assert.equal(size({}), null);
  // The same proportions core reads for furniture images.
  for (const [text, aspect] of [[wideText, 2], [tallText, .5], [squareText, 1]]) near(prepareSvg(new TextEncoder().encode(text)).width / prepareSvg(new TextEncoder().encode(text)).height, aspect, 'prepared aspect', 1e-9);
  // Fallback raster size: 192 dpi of the displayed size, multiples of 128, clamped.
  const scale = svgRasterScale({width: 120, height: 60}, {w: 4, h: 4});
  near(120 * scale, 768, 'a 4 inch wide picture: 192 dpi', 1e-6);
  near(120 * svgRasterScale({width: 120, height: 60}, {w: 4, h: 4}, true), 1536, 'covering a 4 inch square needs an 8 inch wide picture', 1e-6);
  assert.equal(120 * svgRasterScale({width: 120, height: 60}, {w: .05, h: .05}), 128);
  assert.equal(120 * svgRasterScale({width: 120, height: 60}, {w: 100, h: 100}), 2304);
  checked++;
}

// ---- 11. A local .svg path is read like a data URI; an unreadable one is a placeholder with a diagnostic.
{
  const directory = await mkdtemp(path.join(tmpdir(), 'opf-svg-path-'));
  try {
    await writeFile(path.join(directory, 'logo.svg'), wideText);
    const {entries, diagnostics} = await open({slides: [{title: 'T', image: 'logo.svg'}]}, {baseDir: directory, strictAssets: true});
    assert.deepEqual(diagnostics, []);
    await assertNative(entries, 0, pictures(slideXml(entries))[0], wideText, 'path source');
    // A name that merely ends in "svg" is no SVG path: it follows the raster path (PptxGenJS cannot read it here, so the export fails as for any missing raster).
    await assert.rejects(open({slides: [{title: 'T', image: 'logosvg'}]}, {baseDir: directory}), error => error.code !== 'invalid-svg-image');
    const missing = await open({slides: [{title: 'T', image: 'missing.svg'}]}, {baseDir: directory});
    assert.deepEqual(missing.diagnostics.map(({code, reason}) => ({code, reason})), [{code: 'unresolved-asset', reason: 'svg-unreadable'}]);
    await assert.rejects(open({slides: [{title: 'T', image: 'missing.svg'}]}, {baseDir: directory, strictAssets: true}), error => error.code === 'invalid-svg-image');
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
  checked++;
}

// ---- 12. A host rasterizer (options.svgRasterizer) and a host imageResolver that returns SVG bytes.
{
  const calls = [];
  const fake = await sharp({create: {width: 8, height: 4, channels: 4, background: '#00000000'}}).png().toBuffer();
  const svgRasterizer = (svg, size) => { calls.push({svg, size}); return new Uint8Array(fake); };
  const {entries, diagnostics} = await open({slides: [{title: 'T', image: wide}]}, {svgRasterizer, strictAssets: true});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].svg, wideText);
  assert.deepEqual(Object.keys(calls[0].size).sort(), ['height', 'scale', 'text', 'width']);
  assert.equal(calls[0].size.width / calls[0].size.height, 2);
  assert.equal(calls[0].size.text, false);
  assert.deepEqual(diagnostics, []);
  const [picture] = pictures(slideXml(entries));
  assert.equal(sha(entries[target(entries, 0, picture.embed).part]), sha(fake), 'the host raster is the fallback');
  await assertNative(entries, 0, picture, wideText, 'host rasterizer', false);
  // An SVG that draws text asks for the bundled fonts.
  const textual = `<svg ${NS} width="100" height="40"><text x="4" y="30" font-size="28">Hi</text></svg>`;
  calls.length = 0;
  await open({slides: [{title: 'T', image: uriOf(textual)}]}, {svgRasterizer});
  assert.equal(calls[0].size.text, true);
  // imageResolver may return SVG bytes: they are a native SVG picture.
  const resolved = await open({slides: [{title: 'T', image: 'asset-key'}]}, {imageResolver: async () => ({data: new TextEncoder().encode(wideText), mediaType: 'image/svg+xml'}), strictAssets: true});
  await assertNative(resolved.entries, 0, pictures(slideXml(resolved.entries))[0], wideText, 'resolver SVG');
  // Identical SVGs in different boxes share one fallback when the rounded raster size matches.
  checked++;
}

// ---- 13. No rasterizer installed: the placeholder with a diagnostic naming the cause (opf-render blocked in a child process).
{
  const script = `
    import assert from 'node:assert/strict';
    import {register} from 'node:module';
    register('data:text/javascript,'+encodeURIComponent('export async function resolve(s,c,n){if(s.startsWith("@openpresentation/opf-render"))throw Object.assign(new Error("Cannot find package"),{code:"ERR_MODULE_NOT_FOUND"});return n(s,c);}'),import.meta.url);
    const {toPptx}=await import(${JSON.stringify(new URL('../dist/index.js', import.meta.url).href)});
    const {unzipSync}=await import('fflate');
    const diagnostics=[];
    const deck={slides:[{title:'T',image:{src:${JSON.stringify(wide)},alt:'Logo'}}]};
    const bytes=await toPptx(deck,{provenance:false,onDiagnostic:d=>diagnostics.push(d)});
    const slide=new TextDecoder().decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
    assert.ok(!slide.includes('<p:pic>')&&slide.includes('OPF image placeholder 1'));
    assert.deepEqual(diagnostics.map(d=>({code:d.code,reason:d.reason,path:d.path})),[{code:'unresolved-asset',reason:'svg-rasterizer-unavailable',path:'slides.0.image'}]);
    assert.match(diagnostics[0].message,/opf-render/);
    await assert.rejects(toPptx(deck,{strictAssets:true}),e=>e.code==='svg-rasterizer-unavailable'&&e.details.path==='slides.0.image');
    // A raster deck needs no renderer, and a host rasterizer works without it.
    await toPptx({slides:[{title:'T'}]});
    const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO8sAAAAASUVORK5CYII=','base64'));
    const hosted=unzipSync(await toPptx(deck,{provenance:false,svgRasterizer:async()=>png,strictAssets:true}));
    assert.ok(Object.keys(hosted).some(p=>p.endsWith('.svg')));
    console.log('ok');`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-'], {input: script, encoding: 'utf8', cwd: fileURLToPath(new URL('..', import.meta.url))});
  assert.equal(child.status, 0, child.stderr + child.stdout);
  checked++;
}

console.log(`SVG picture checks passed (${checked}): native svgBlip over a PNG fallback in every image place, determinism, import, sanitizing, sizes, host rasterizer and the no-renderer fallback.`);
