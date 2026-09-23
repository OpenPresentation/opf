// FF-25: pattern and picture slide backgrounds export as native p:bg fills
// (a:pattFill / a:blipFill) and import back as OPF pattern / image backgrounds.
import assert from 'node:assert/strict';
import {deflateSync, crc32} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {validatePresentation} from '@openpresentation/opf';
const {toPptx, fromPptx} = await import(process.env.OPF_TEST_PPTX_MODULE ?? '../dist/index.js');
const utf8 = new TextDecoder(), encode = new TextEncoder();
const slideXml = bytes => utf8.decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
const bg = bytes => slideXml(bytes).match(/<p:bg>[\s\S]*?<\/p:bg>/)[0];
const attrs = (xml, tag) => Object.fromEntries([...(xml.match(new RegExp(`<a:${tag}\\b([^>]*)/?>`))?.[1] ?? '').matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const edit = (bytes, part, change) => {
  const parts = unzipSync(bytes), before = utf8.decode(parts[part]), after = change(before);
  assert.notEqual(after, before, `edit applies to ${part}`);
  parts[part] = encode.encode(after);
  return zipSync(parts);
};
async function roundTrip(document) {
  const exported = [], imported = [];
  const bytes = await toPptx(document, {onDiagnostic: d => exported.push(d)});
  for (const [path, part] of Object.entries(unzipSync(bytes))) if (path.endsWith('.xml') || path.endsWith('.rels')) assert.equal(XMLValidator.validate(utf8.decode(part)), true, path);
  assert.deepEqual(bytes, await toPptx(document), 'Deterministic native background');
  const back = await fromPptx(bytes, {onDiagnostic: d => imported.push(d)});
  assert.equal(validatePresentation(back).valid, true);
  return {bytes, exported, imported, background: back.slides[0].design?.background, back};
}
// A valid RGB PNG of the given pixel size (one flat color), optionally with a pHYs resolution.
function png(width, height, dpi) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0); out.write(type, 4, 'latin1'); data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x7f)]);
  const raw = Buffer.concat(Array.from({length: height}, () => row));
  const physical = Buffer.alloc(9);
  if (dpi) { physical.writeUInt32BE(Math.round(dpi / .0254), 0); physical.writeUInt32BE(Math.round(dpi / .0254), 4); physical[8] = 1; }
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), chunk('IHDR', header), ...(dpi ? [chunk('pHYs', physical)] : []), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
let cases = 0;

// Patterns: DrawingML presets are written as native preset pattern fills.
for (const preset of ['pct5', 'ltHorz', 'openDmnd', 'wave', 'smGrid', 'zigZag']) {
  const pattern = {preset, foregroundColor: '#E2E8F0', backgroundColor: '#FAF8F5'};
  const {bytes, exported, imported, background} = await roundTrip({design: {background: {type: 'pattern', pattern}}, slides: [{title: 'Pattern'}]});
  const xml = bg(bytes);
  assert.equal(attrs(xml, 'pattFill').prst, preset);
  assert.match(xml, /<a:fgClr><a:srgbClr val="E2E8F0">(?:<\/a:srgbClr>)?/);
  assert.match(xml, /<a:bgClr><a:srgbClr val="FAF8F5">(?:<\/a:srgbClr>)?/);
  assert.ok(!Object.keys(unzipSync(bytes)).some(p => p.startsWith('ppt/media/') && !p.endsWith('/')), 'Patterns are not rasterized');
  assert.deepEqual(exported, []);
  assert.deepEqual(background, {type: 'pattern', pattern});
  assert.ok(!imported.some(d => d.path.endsWith('design.background')), preset);
  cases++;
}
{
  // Opacity applies to both colors; foreground defaults to the slide text color like the SVG preview.
  const {bytes, background} = await roundTrip({design: {background: {type: 'pattern', pattern: {preset: 'pct5', backgroundColor: '#0F172A'}, opacity: .4}}, slides: [{}]});
  const xml = bg(bytes);
  assert.match(xml, /<a:fgClr><a:srgbClr val="FFFFFF"><a:alpha val="40000"\/>/, 'Light text color on a dark pattern');
  assert.match(xml, /<a:bgClr><a:srgbClr val="0F172A"><a:alpha val="40000"\/>/);
  assert.deepEqual(background, {type: 'pattern', pattern: {preset: 'pct5', foregroundColor: '#FFFFFF', backgroundColor: '#0F172A'}, opacity: .4});
  // Differing color alpha survives as eight-digit colors.
  const mixed = await roundTrip({slides: [{design: {background: {type: 'pattern', pattern: {preset: 'ltHorz', foregroundColor: '#11223380', backgroundColor: '#FFFFFF'}}}}]});
  assert.equal(mixed.background.pattern.foregroundColor, '#11223380');
  assert.equal(mixed.background.pattern.backgroundColor, '#FFFFFF');
  assert.equal(mixed.background.opacity, undefined);
  cases += 2;
}
{
  // FF-24 theme colors: a slot/role reference whose drawn color the deck theme holds exactly becomes a:schemeClr
  // (with background opacity as alpha). Like the preview, a named color that does not resolve to that slot is drawn
  // with the default color and stays literal. Import resolves the theme color back to RGB.
  for (const opacity of [1, .5]) {
    const alpha = opacity === 1 ? '' : '<a:alpha val="50000"/>';
    const named = await roundTrip({design: {background: {type: 'pattern', pattern: {preset: 'pct5', foregroundColor: 'dark1', backgroundColor: 'light1'}, opacity}}, slides: [{}]});
    assert.match(bg(named.bytes), new RegExp(`<a:fgClr><a:schemeClr val="tx1">${alpha}(?:</a:schemeClr>)?`));
    assert.match(bg(named.bytes), new RegExp(`<a:bgClr><a:schemeClr val="bg1">${alpha}(?:</a:schemeClr>)?`));
    assert.deepEqual(named.background, {type: 'pattern', pattern: {preset: 'pct5', foregroundColor: '#000000', backgroundColor: '#FFFFFF'}, ...(opacity === 1 ? {} : {opacity})});
    cases++;
  }
  const mismatch = await roundTrip({design: {background: {type: 'pattern', pattern: {preset: 'pct5', foregroundColor: 'accent1', backgroundColor: '#FFFFFF'}}}, slides: [{}]});
  assert.ok(!bg(mismatch.bytes).includes('schemeClr'), 'A name drawn as the default color and literal hex stay srgbClr');
  const translucent = await roundTrip({design: {background: {type: 'pattern', pattern: {preset: 'pct5', foregroundColor: '#00000080', backgroundColor: 'light1'}}}, slides: [{}]});
  assert.match(bg(translucent.bytes), /<a:fgClr><a:srgbClr val="000000"><a:alpha val="50196"\/>/);
  assert.match(bg(translucent.bytes), /<a:bgClr><a:schemeClr val="bg1">/);
  cases += 2;
}
{
  // The preview's engine id diagStripe is written as the closest preset; import reports the native name.
  const {bytes, exported, background} = await roundTrip({design: {background: {type: 'pattern', pattern: {preset: 'diagStripe', foregroundColor: '#000000', backgroundColor: '#FFFFFF'}}}, slides: [{}]});
  assert.equal(attrs(bg(bytes), 'pattFill').prst, 'wdUpDiag');
  assert.deepEqual(exported, []);
  assert.equal(background.pattern.preset, 'wdUpDiag');
  // Other engine-defined ids keep only the background color, as in the preview, and are reported.
  const unknown = await roundTrip({slides: [{design: {background: {type: 'pattern', pattern: {preset: 'engineDots', backgroundColor: '#123456'}}}}]});
  assert.match(bg(unknown.bytes), /<a:solidFill><a:srgbClr val="123456">/);
  assert.deepEqual(unknown.exported.map(d => [d.code, d.path]), [['unsupported-pattern', 'slides.0.design.background.pattern.preset']]);
  assert.deepEqual(unknown.background, {type: 'solid', color: '#123456'});
  cases += 2;
}
{
  // Native edits drive import; patterns without a preset or explicit colors are observable, not guessed.
  const {bytes} = await roundTrip({design: {background: {type: 'pattern', pattern: {preset: 'pct5', foregroundColor: '#000000', backgroundColor: '#FFFFFF'}}}, slides: [{}]});
  const edited = await fromPptx(edit(bytes, 'ppt/slides/slide1.xml', xml => xml.replace('prst="pct5"', 'prst="lgCheck"').replace('val="000000"', 'val="FF0000"')));
  assert.deepEqual(edited.slides[0].design.background.pattern, {preset: 'lgCheck', foregroundColor: '#FF0000', backgroundColor: '#FFFFFF'});
  for (const change of [xml => xml.replace('prst="pct5"', 'prst="notAPreset"'), xml => xml.replace(/<a:fgClr>[\s\S]*?<\/a:fgClr>/, ''), xml => xml.replace(/<a:bgClr>[\s\S]*?<\/a:bgClr>/, '<a:bgClr><a:schemeClr val="missing"/></a:bgClr>')]) {
    const reports = [];
    const result = await fromPptx(edit(bytes, 'ppt/slides/slide1.xml', change), {onDiagnostic: d => reports.push(d)});
    assert.equal(result.slides[0].design?.background, undefined);
    assert.deepEqual(reports.map(d => [d.code, d.path]), [['unsupported-background-fill', 'slides.0.design.background']]);
  }
  cases += 4;
}

// Pictures: cover crops the centered source, contain insets the fill rectangle, tile repeats cells.
const wide = png(480, 270), square = png(100, 100), tall = png(90, 160);
{
  const assets = {cover: {src: square, alt: 'Cover'}};
  const {bytes, exported, background} = await roundTrip({assets, design: {background: {type: 'image', image: {src: 'asset:cover', fit: 'cover'}}}, slides: [{title: 'Photo'}]});
  const xml = bg(bytes);
  assert.match(xml, /<a:blipFill\b[^>]*><a:blip r:embed="rId\d+"><\/a:blip><a:srcRect t="21875" b="21875"\/><a:stretch><a:fillRect\/><\/a:stretch><\/a:blipFill>/);
  const id = xml.match(/r:embed="([^"]+)"/)[1];
  const rels = utf8.decode(unzipSync(bytes)['ppt/slides/_rels/slide1.xml.rels']);
  const target = rels.match(new RegExp(`Id="${id}"[^>]*Target="\\.\\./media/([^"]+)"`))[1];
  assert.match(target, /\.png$/);
  assert.deepEqual(exported, []);
  assert.deepEqual(background, {type: 'image', image: {src: square, fit: 'cover'}}, 'Exact image bytes and fit return');
  // Portrait source on a 16:9 slide crops top and bottom; a wide source on a portrait slide crops the sides.
  const portrait = await roundTrip({slides: [{design: {background: {type: 'image', image: {src: tall}}}}]});
  const crop = attrs(bg(portrait.bytes), 'srcRect');
  assert.equal(Number(crop.t), Number(crop.b)); assert.ok(Number(crop.t) > 0 && !crop.l);
  assert.equal(portrait.background.image.fit, 'cover');
  const onPortrait = await roundTrip({design: {dimensions: {widthInches: 7.5, heightInches: 13.333}}, slides: [{design: {background: {type: 'image', image: {src: wide, fit: 'cover'}}}}]});
  const sides = attrs(bg(onPortrait.bytes), 'srcRect');
  assert.equal(sides.l, sides.r); assert.ok(Number(sides.l) > 0 && !sides.t);
  assert.equal(onPortrait.background.image.fit, 'cover');
  cases += 3;
}
{
  const {bytes, background} = await roundTrip({design: {background: {type: 'image', image: {src: square, fit: 'contain'}, opacity: .6}}, slides: [{}]});
  const xml = bg(bytes);
  assert.match(xml, /<a:blip r:embed="rId\d+"><a:alphaModFix amt="60000"\/><\/a:blip><a:srcRect\/><a:stretch><a:fillRect l="21875" r="21875"\/><\/a:stretch>/);
  assert.deepEqual(background, {type: 'image', image: {src: square, fit: 'contain'}, opacity: .6});
  cases++;
}
{
  // Tile cells are min(w,h)/4 = 180px on 1280x720. The deck imageFill decides cover/contain in a cell.
  const contain = await roundTrip({design: {background: {type: 'image', image: {src: wide, fit: 'tile'}}}, slides: [{}]});
  assert.deepEqual(attrs(bg(contain.bytes), 'tile'), {tx: '0', ty: '0', sx: '37500', sy: '37500', flip: 'none', algn: 'tl'});
  assert.deepEqual(attrs(bg(contain.bytes), 'srcRect'), {t: '-38889', b: '-38889'}, 'Transparent padding keeps the contained cell square');
  assert.equal(contain.background.image.fit, 'tile');
  assert.deepEqual(contain.imported.filter(d => d.path.endsWith('design.background')), [], 'OPF tile geometry imports without a diagnostic');
  const cover = await roundTrip({design: {imageFill: 'crop', background: {type: 'image', image: {src: wide, fit: 'tile'}}}, slides: [{}]});
  assert.deepEqual(attrs(bg(cover.bytes), 'tile'), {tx: '0', ty: '0', sx: '66667', sy: '66667', flip: 'none', algn: 'tl'});
  assert.deepEqual(attrs(bg(cover.bytes), 'srcRect'), {l: '21875', r: '21875'});
  assert.equal(cover.background.image.fit, 'tile');
  // Import carries no imageFill, so covered cells are reported as approximate.
  assert.deepEqual(cover.imported.filter(d => d.path.endsWith('design.background')).map(d => d.code), ['approximate-background-image']);
  // Native tile geometry OPF cannot express is reported, not silently dropped.
  for (const change of [xml => xml.replace('sx="37500"', 'sx="50000"'), xml => xml.replace('sy="37500"', 'sy="30000"'), xml => xml.replace('tx="0"', 'tx="91440"'),
    xml => xml.replace('ty="0"', 'ty="-45720"'), xml => xml.replace('algn="tl"', 'algn="ctr"'), xml => xml.replace('flip="none"', 'flip="xy"'), xml => xml.replace('t="-38889" b="-38889"', 't="-10000" b="-10000"')]) {
    const reports = [];
    const result = await fromPptx(edit(contain.bytes, 'ppt/slides/slide1.xml', change), {onDiagnostic: d => reports.push(d)});
    assert.equal(result.slides[0].design.background.image.fit, 'tile');
    assert.deepEqual(reports.filter(d => d.path.endsWith('design.background')).map(d => [d.code, d.path]), [['approximate-background-image', 'slides.0.design.background']]);
  }
  cases += 9;
}
{
  // dpi="0" sizes a tile from the raster's resolution; the scale matches the preview's CSS pixels at 72, 96 and 144 dpi.
  for (const dpi of [72, 96, 144]) {
    // pHYs stores whole pixels per metre, so 72 dpi is 2835 ppm (72.009 dpi).
    const source = png(480, 270, dpi), expected = 37500 * Math.round(dpi / .0254) * .0254 / 96;
    const {bytes, background, imported} = await roundTrip({design: {background: {type: 'image', image: {src: source, fit: 'tile'}}}, slides: [{}]});
    const tile = attrs(bg(bytes), 'tile');
    assert.ok(Math.abs(Number(tile.sx) - expected) <= 2 && tile.sx === tile.sy, `${dpi} dpi: ${tile.sx}`);
    assert.deepEqual(background, {type: 'image', image: {src: source, fit: 'tile'}});
    assert.deepEqual(imported.filter(d => d.path.endsWith('design.background')), [], `${dpi} dpi imports as exact tile`);
  }
  // Resolution metadata: PNG pHYs (metres only), JPEG JFIF (inch/cm, preferred) and EXIF X/YResolution.
  const {rasterMetadata} = await import('../dist/image-geometry.js');
  const bytes = uri => new Uint8Array(Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64'));
  const close = (actual, x, y) => assert.ok(Math.abs(actual.dpiX - x) < .01 && Math.abs(actual.dpiY - y) < .01, JSON.stringify(actual));
  close(rasterMetadata(bytes(png(10, 10, 144))), 144.0018, 144.0018);
  assert.equal(rasterMetadata(bytes(png(10, 10))).dpiX, undefined, 'No pHYs: no resolution (96 dpi fallback)');
  const segment = (marker, body) => Buffer.concat([Buffer.from([0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 255]), body]);
  const sof = segment(0xc0, Buffer.from([8, 0, 20, 0, 40, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0]));
  const jfif = (unit, x, y) => segment(0xe0, Buffer.concat([Buffer.from('JFIF\0', 'latin1'), Buffer.from([1, 2, unit, x >> 8, x & 255, y >> 8, y & 255, 0, 0])]));
  const exif = (x, y, unit) => {
    const tiff = Buffer.alloc(8 + 2 + 3 * 12 + 4 + 16);
    tiff.write('MM', 0, 'latin1'); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(8, 4); tiff.writeUInt16BE(3, 8);
    const entry = (i, tag, type, value) => { const at = 10 + i * 12; tiff.writeUInt16BE(tag, at); tiff.writeUInt16BE(type, at + 2); tiff.writeUInt32BE(1, at + 4); type === 3 ? tiff.writeUInt16BE(value, at + 8) : tiff.writeUInt32BE(value, at + 8); };
    entry(0, 0x11a, 5, 50); entry(1, 0x11b, 5, 58); entry(2, 0x128, 3, unit);
    tiff.writeUInt32BE(x, 50); tiff.writeUInt32BE(1, 54); tiff.writeUInt32BE(y, 58); tiff.writeUInt32BE(1, 62);
    return segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]));
  };
  const jpeg = (...segments) => new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments, sof, Buffer.from([0xff, 0xd9])]));
  close(rasterMetadata(jpeg(jfif(1, 72, 144))), 72, 144);
  close(rasterMetadata(jpeg(jfif(2, 100, 100))), 254, 254);
  close(rasterMetadata(jpeg(exif(300, 150, 2))), 300, 150);
  close(rasterMetadata(jpeg(exif(100, 100, 3))), 254, 254);
  close(rasterMetadata(jpeg(jfif(1, 72, 72), exif(300, 300, 2))), 72, 72);
  close(rasterMetadata(jpeg(jfif(0, 1, 1), exif(144, 144, 2))), 144, 144);
  assert.equal(rasterMetadata(jpeg(jfif(0, 1, 1))).dpiX, undefined, 'An aspect-only JFIF density defines no resolution');
  assert.equal(rasterMetadata(jpeg(jfif(1, 72, 72))).width, 40);
  cases += 11;
}
{
  // Slide overrides, deck inheritance and a host imageResolver.
  const document = {design: {background: {type: 'image', image: {src: 'https://example.invalid/bg.png'}}}, slides: [{}, {design: {background: '#112233'}}]};
  const reports = [];
  const bytes = await toPptx(document, {imageResolver: src => src.endsWith('bg.png') ? wide : null, onDiagnostic: d => reports.push(d)});
  assert.deepEqual(reports, []);
  const back = await fromPptx(bytes);
  assert.deepEqual(back.slides[0].design.background, {type: 'image', image: {src: wide, fit: 'cover'}});
  assert.equal(back.slides[1].design.background.color, '#112233');
  // An unresolved picture keeps the background color and is reported at its path.
  const missing = await roundTrip({slides: [{design: {background: {type: 'image', image: {src: 'asset:missing'}}}}]});
  assert.match(bg(missing.bytes), /<a:solidFill>/);
  assert.deepEqual(missing.exported.map(d => [d.code, d.path]), [['unresolved-asset', 'slides.0.design.background.image']]);
  await assert.rejects(toPptx({slides: [{design: {background: {type: 'image', image: {src: 'asset:missing'}}}}]}, {strictAssets: true}), {code: 'missing-asset'});
  cases += 3;
}
{
  // Import: off-center or distorted stretches and picture effects become the closest cover and are reported.
  const {bytes} = await roundTrip({design: {background: {type: 'image', image: {src: square}}}, slides: [{}]});
  const approximate = async change => {
    const reports = [];
    const result = await fromPptx(edit(bytes, 'ppt/slides/slide1.xml', change), {onDiagnostic: d => reports.push(d)});
    return {background: result.slides[0].design?.background, codes: reports.filter(d => d.path.endsWith('design.background')).map(d => d.code)};
  };
  for (const change of [xml => xml.replace('t="21875" b="21875"', 't="0" b="43750"'), xml => xml.replace('<a:srcRect t="21875" b="21875"/>', '<a:srcRect/>')]) {
    const result = await approximate(change);
    assert.equal(result.background.image.fit, 'cover');
    assert.deepEqual(result.codes, ['approximate-background-image']);
  }
  const effect = await approximate(xml => xml.replace('</a:blip>', '<a:grayscl/></a:blip>'));
  assert.deepEqual(effect.codes, ['approximate-background-image']);
  const linked = await approximate(xml => xml.replace(/r:embed="[^"]+"/, 'r:embed="rIdMissing"'));
  assert.equal(linked.background, undefined);
  assert.deepEqual(linked.codes, ['unsupported-background-image']);
  // Inherited picture fills resolve their relationship from the layout part.
  const parts = unzipSync(bytes), slide = utf8.decode(parts['ppt/slides/slide1.xml']);
  const fill = slide.match(/<p:bg>[\s\S]*?<\/p:bg>/)[0], id = fill.match(/r:embed="([^"]+)"/)[1];
  const media = utf8.decode(parts['ppt/slides/_rels/slide1.xml.rels']).match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`))[1];
  parts['ppt/slides/slide1.xml'] = encode.encode(slide.replace(fill, ''));
  parts['ppt/slideLayouts/slideLayout1.xml'] = encode.encode(utf8.decode(parts['ppt/slideLayouts/slideLayout1.xml']).replace(/<p:bg>[\s\S]*?<\/p:bg>/, fill.replace(id, 'rIdLayoutBg')));
  parts['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = encode.encode(utf8.decode(parts['ppt/slideLayouts/_rels/slideLayout1.xml.rels']).replace('</Relationships>', `<Relationship Id="rIdLayoutBg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${media}"/></Relationships>`));
  const inherited = await fromPptx(zipSync(parts));
  assert.deepEqual(inherited.slides[0].design.background, {type: 'image', image: {src: square, fit: 'cover'}});
  cases += 5;
}
{
  // JPEG and WebP sources: WebP becomes a compatible PNG part; EXIF orientation cannot rotate a background fill.
  const fixture = async name => new Uint8Array(await readFile(new URL(`./fixtures/images/${name}`, import.meta.url)));
  const uri = (bytes, type) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
  const jpeg = await roundTrip({slides: [{design: {background: {type: 'image', image: {src: uri(await fixture('wide.jpg'), 'image/jpeg')}}}}]});
  assert.deepEqual(jpeg.exported, []);
  assert.match(jpeg.background.image.src, /^data:image\/jpeg;base64,/);
  const webp = await roundTrip({slides: [{design: {background: {type: 'image', image: {src: uri(await fixture('wide.webp'), 'image/webp')}}}}]});
  assert.ok(Object.keys(unzipSync(webp.bytes)).some(p => /^ppt\/media\/.+\.png$/.test(p)), 'WebP converted to PNG');
  assert.match(webp.background.image.src, /^data:image\/png;base64,/);
  const rotated = await roundTrip({slides: [{design: {background: {type: 'image', image: {src: uri(await fixture('orientation-6.jpg'), 'image/jpeg')}}}}]});
  assert.deepEqual(rotated.exported.map(d => [d.code, d.path]), [['unsupported-background-image-orientation', 'slides.0.design.background.image']]);
  cases += 3;
}
console.log(`Background fills passed: ${cases} native pattern/picture export, import, inheritance and diagnostic cases.`);
