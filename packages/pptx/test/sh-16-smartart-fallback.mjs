// SH-16: every live SmartArt is an mc:AlternateContent. Its mc:Choice is the SmartArt frame SH-09 writes (PowerPoint takes it); its
// mc:Fallback is a picture of the same frame and name, OPF's preview of that frame as an SVG over a PNG raster, so an app that does not
// lay SmartArt out shows OPF's own drawing. The picture's alt text is the outline and, in full provenance, it carries OPF_SMARTART_V1,
// so a file in which only the fallback survived imports as the same list on the same layout.
//
// The "other app" here is a markup-compatibility processor (ECMA-376 Part 3) that does not understand the Choice's namespace: it is a
// check of the XML, not a third-party application (none was run).
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLBuilder, XMLParser, XMLValidator} from 'fast-xml-parser';
import sharp from 'sharp';
import {toPng} from '@openpresentation/opf-render';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {defaultCatalog, fromPptx, toPptx, toSvg} from './helpers/default-catalog.mjs';

const options = {seed: 1616, timestamp: '2026-11-06T00:00:00Z', zipDate: '2026-11-06T00:00:00Z'};
const pyramid = ['Vision', 'Goals', 'Programs', 'Teams'], matrix = ['North', 'South', 'East', 'West'];
const deck = {slides: [{layout: 'pyramid', title: 'Our strategy', items: pyramid}, {layout: 'matrix', title: 'Four markets', items: matrix}]};
const exported = async (document, extra = {}) => {
  const diagnostics = [], bytes = new Uint8Array(await toPptx(document, {...options, ...extra, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  return {bytes, entries, diagnostics, text: path => strFromU8(entries[path])};
};
const relationshipsOf = (entries, part) => new Map([...strFromU8(entries[part.replace(/([^/]+)$/, '_rels/$1.rels')]).matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)]
  .map(([, id, target]) => [id, new URL(target, `file:///${part}`).pathname.slice(1)]));

// ---------------------------------------------------------------------------
// An ECMA-376 Part 3 (markup compatibility) consumer that understands `understood` and nothing else: each mc:AlternateContent becomes
// its first mc:Choice whose Requires prefixes all name understood namespaces, else its mc:Fallback; an element or attribute in another
// namespace is dropped when mc:Ignorable lists its prefix and is an error otherwise. Extension lists (a:ext, p:ext) and a:graphicData
// are opaque, as the extLst and graphic-data mechanisms make them.
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const READER = new Set([
  'http://schemas.openxmlformats.org/presentationml/2006/main', 'http://schemas.openxmlformats.org/drawingml/2006/main',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships', MC, 'http://www.w3.org/XML/1998/namespace',
  // What a reader without SmartArt commonly claims besides (PowerPoint 2010 and DrawingML 2010 extensions).
  'http://schemas.microsoft.com/office/powerpoint/2010/main', 'http://schemas.microsoft.com/office/drawing/2010/main',
]);
const ordered = {preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: false};
const reader = new XMLParser(ordered), writer = new XMLBuilder({...ordered, suppressEmptyNode: false});
const nameOf = node => Object.keys(node).find(key => key !== ':@');
function compatibility(xml, understood) {
  const choices = [];
  const visit = (nodes, scope) => nodes.flatMap(node => {
    const name = nameOf(node);
    if (name === '#text' || name === '?xml') return [node];
    const attributes = node[':@'] ?? {}, own = {...scope.prefixes};
    for (const [key, value] of Object.entries(attributes)) if (key === 'xmlns' || key.startsWith('xmlns:')) own[key === 'xmlns' ? '' : key.slice(6)] = value;
    const namespace = prefix => prefix === 'xml' ? 'http://www.w3.org/XML/1998/namespace' : own[prefix];
    const ignorable = new Set(scope.ignorable);
    const mcPrefix = Object.keys(own).find(prefix => own[prefix] === MC);
    for (const prefix of String(attributes[`${mcPrefix}:Ignorable`] ?? '').split(/\s+/).filter(Boolean)) ignorable.add(namespace(prefix));
    const inner = {prefixes: own, ignorable};
    const [prefix, local] = name.includes(':') ? name.split(':') : ['', name];
    const ns = namespace(prefix);
    if (ns === MC && local === 'AlternateContent') {
      const children = node[name];
      const chosen = children.find(child => nameOf(child) === `${prefix}:Choice` && String(child[':@']?.Requires ?? '').split(/\s+/).filter(Boolean).every(required => {
        const scoped = {...own};
        for (const [key, value] of Object.entries(child[':@'] ?? {})) if (key.startsWith('xmlns:')) scoped[key.slice(6)] = value;
        return understood.has(scoped[required]);
      }));
      const taken = chosen ?? children.find(child => nameOf(child) === `${prefix}:Fallback`);
      choices.push(chosen ? 'choice' : taken ? 'fallback' : 'none');
      if (!taken) return [];
      const scoped = {...inner, prefixes: {...own}};
      for (const [key, value] of Object.entries(taken[':@'] ?? {})) if (key.startsWith('xmlns:')) scoped.prefixes[key.slice(6)] = value;
      return visit(taken[nameOf(taken)], scoped);
    }
    if (!understood.has(ns)) {
      if (ignorable.has(ns)) return [];
      throw new Error(`<${name}> is in ${ns}, which this reader does not understand and which is not ignorable`);
    }
    const kept = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'xmlns' || key.startsWith('xmlns:') || !key.includes(':')) { kept[key] = value; continue; }
      const attributeNs = namespace(key.split(':')[0]);
      if (attributeNs === MC) continue;
      if (understood.has(attributeNs)) kept[key] = value;
      else if (!ignorable.has(attributeNs)) throw new Error(`the attribute ${key} is in ${attributeNs}, which this reader does not understand`);
    }
    const opaque = (local === 'ext' || local === 'graphicData') &&/drawingml\/2006\/main$|presentationml\/2006\/main$/.test(ns);
    return [{[name]: opaque ? node[name] : visit(node[name], inner), ...(Object.keys(kept).length ? {':@': kept} : {})}];
  });
  const tree = visit(reader.parse(xml), {prefixes: {}, ignorable: new Set()});
  return {xml: writer.build(tree), choices};
}

const live = await exported(deck);
const plainParser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: true});

// 1. The wrapper: the frame in the mc:Choice (requiring the 2016 diagram namespace), the picture of the same frame, id and name in the
//    mc:Fallback, its SVG and PNG parts, the outline as its description; SH-09's parts, the drawing included, are all still there.
{
  const {text, entries} = live;
  for (const [index, [kind, values]] of [['pyramid', pyramid], ['matrix', matrix]].entries()) {
    const part = `ppt/slides/slide${index + 1}.xml`, slide = text(part);
    const alternate = slide.match(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/)?.[0];
    assert.ok(alternate, `${kind}: an mc:AlternateContent`);
    assert.match(alternate, /^<mc:AlternateContent xmlns:mc="http:\/\/schemas\.openxmlformats\.org\/markup-compatibility\/2006"><mc:Choice xmlns:dgm1612="http:\/\/schemas\.microsoft\.com\/office\/drawing\/2016\/12\/diagram" Requires="dgm1612"><p:graphicFrame>/);
    assert.doesNotMatch(slide.replace(alternate, ''), /drawingml\/2006\/diagram|OPF smartart/, `${kind}: no frame or picture outside the wrapper`);
    const choice = plainParser.parse(alternate)['mc:AlternateContent']['mc:Choice']['p:graphicFrame'];
    const picture = plainParser.parse(alternate)['mc:AlternateContent']['mc:Fallback']['p:pic'];
    assert.equal(choice['a:graphic']['a:graphicData'].uri, 'http://schemas.openxmlformats.org/drawingml/2006/diagram');
    const frameName = choice['p:nvGraphicFramePr']['p:cNvPr'], pictureName = picture['p:nvPicPr']['p:cNvPr'];
    assert.equal(pictureName.name, `OPF smartart slides.${index}.items`);
    assert.equal(pictureName.name, frameName.name, 'the same name');
    assert.equal(pictureName.id, frameName.id, 'the same id: one object');
    // The frame grown by its bleed (the outlines and miter joins outside it, and a pixel of antialiasing) on every side.
    const [frame, grown] = [choice['p:xfrm'], picture['p:spPr']['a:xfrm']].map(xfrm => [xfrm['a:off'].x, xfrm['a:off'].y, xfrm['a:ext'].cx, xfrm['a:ext'].cy].map(Number));
    const bleed = frame[0] - grown[0];
    // The pyramid's base corners reach furthest (their miter joins); the matrix's nodes lie inside its frame, so it has the antialiasing pixel.
    assert.ok(kind === 'pyramid' ? bleed > 2 * 9525 && bleed < 8 * 9525 : bleed === 9525, `${kind}: its bleed (${bleed} EMU)`);
    assert.deepEqual(grown, [frame[0] - bleed, frame[1] - bleed, frame[2] + 2 * bleed, frame[3] + 2 * bleed], `${kind}: the frame grown by the bleed on every side`);
    const head = kind === 'pyramid' ? 'Pyramid of 4 levels, top to bottom:' : 'Matrix of 4 entries, in reading order:';
    assert.equal(pictureName.descr.replace(/&#10;/g, '\n'), [head, ...values].join('\n'), 'the outline, one entry a line, in entry order');
    const relationships = relationshipsOf(entries, part);
    const png = entries[relationships.get(picture['p:blipFill']['a:blip']['r:embed'])];
    const svgId = picture['p:blipFill']['a:blip']['a:extLst']['a:ext']['asvg:svgBlip']['r:embed'];
    const svg = strFromU8(entries[relationships.get(svgId)]);
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG raster');
    assert.equal(XMLValidator.validate(svg), true, 'a well-formed SVG');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="[\d.]+" height="[\d.]+" viewBox="[\d.]+ [\d.]+ [\d.]+ [\d.]+">/);
    assert.doesNotMatch(svg, /data-opf-|<image\b|<script\b/, 'no trace, picture or script');
    for (const part of ['data', 'quickStyle', 'colors', 'drawing']) assert.ok(entries[`ppt/diagrams/${part}${index + 1}.xml`], `${kind}: ${part} part`);
  }
  assert.match(text('[Content_Types].xml'), /<Default Extension="svg" ContentType="image\/svg\+xml"\/>/);
}

// 2. The fallback is OPF's preview of the frame: the preview's own node outlines, and its pixels over the whole picture, including the
//    outline and miter joins outside the frame (the pyramid's base corners and apex) and the matrix diamond's tips, which the bleed holds.
const fallbackOf = (exported, number) => {
  const part = `ppt/slides/slide${number}.xml`, slide = exported.text(part), relationships = relationshipsOf(exported.entries, part);
  const choice = slide.match(/<p:xfrm><a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/).slice(1).map(value => Number(value) / 9525);
  return {svg: strFromU8(exported.entries[relationships.get(slide.match(/<asvg:svgBlip [^>]*r:embed="([^"]+)"/)[1])]),
    png: exported.entries[relationships.get(slide.match(/<mc:Fallback>[\s\S]*?<a:blip r:embed="([^"]+)"/)[1])], frame: {x: choice[0], y: choice[1], width: choice[2], height: choice[3]}};
};
for (const number of [1, 2]) {
  const preview = toSvg(deck, number, {trace: true}), {svg, png, frame} = fallbackOf(live, number);
  const outlines = [...preview.matchAll(/<(?:path|rect) [^>]*data-opf-arrangement-path=[^>]*>/g)].map(match => match[0].replace(/\sdata-opf-[\w-]+="[^"]*"/g, ''));
  assert.equal(outlines.length, 4);
  for (const outline of outlines) assert.ok(svg.includes(outline), `slide ${number}: a node outline of the preview`);
  const [, x, y, width, height] = svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/).map(Number);
  assert.ok(x < frame.x && x + width > frame.x + frame.width && y < frame.y && y + height > frame.y + frame.height, 'the picture holds the frame with its bleed');
  const fallback = sharp(png), {width: w, height: h} = await fallback.metadata(), scale = w / width;
  assert.ok(w >= 1024 && Math.abs(w / h - width / height) < 0.01, "the raster is drawn at the export resolution (192 dpi), in the picture's proportions");
  const background = preview.match(/data-opf-path="slides\.\d+\.design\.background" fill="(#[0-9A-F]{6})"/)[1];
  const region = await sharp(await toPng(preview, {scale})).extract({left: Math.round(x * scale), top: Math.round(y * scale), width: w, height: h}).removeAlpha().raw().toBuffer();
  const drawn = await sharp({create: {width: w, height: h, channels: 3, background}}).composite([{input: await fallback.png().toBuffer()}]).removeAlpha().raw().toBuffer();
  const alpha = await sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer();
  const window = (cx, cy, size = 8) => {
    const left = Math.max(0, Math.round((cx - x - size / 2) * scale)), top = Math.max(0, Math.round((cy - y - size / 2) * scale));
    const right = Math.min(w, Math.round((cx - x + size / 2) * scale)), bottom = Math.min(h, Math.round((cy - y + size / 2) * scale));
    let total = 0, count = 0, outside = 0;
    for (let row = top; row < bottom; row++) for (let column = left; column < right; column++) {
      const at = (row * w + column) * 3;
      for (let channel = 0; channel < 3; channel++) total += Math.abs(region[at + channel] - drawn[at + channel]);
      count += 3;
      const px = x + (column + 0.5) / scale, py = y + (row + 0.5) / scale;
      if ((px < frame.x || px > frame.x + frame.width || py < frame.y || py > frame.y + frame.height) && alpha[row * w + column] > 64) outside += 1;
    }
    return {mean: total / count, outside};
  };
  let total = 0;
  for (let index = 0; index < region.length; index++) total += Math.abs(region[index] - drawn[index]);
  assert.ok(total / region.length < 2, `slide ${number}: the fallback draws the preview's pixels (mean difference ${(total / region.length).toFixed(2)})`);
  // The ink at the frame's edge: the base corners and apex of the pyramid (its outline's miter joins), the diamond's tips of the matrix.
  const diamond = number === 2 ? preview.match(/data-opf-arrangement="matrix"[^>]*><path [^>]*\bd="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) Z"/).slice(1).map(Number) : [];
  const edges = number === 1
    ? [[frame.x, frame.y + frame.height], [frame.x + frame.width, frame.y + frame.height], [frame.x + frame.width / 2, frame.y]]
    : [0, 2, 4, 6].map(index => [diamond[index], diamond[index + 1]]);
  for (const [cx, cy] of edges) {
    const found = window(cx, cy);
    assert.ok(found.mean < 6, `slide ${number}: the preview's pixels at (${cx.toFixed(1)}, ${cy.toFixed(1)}) (mean difference ${found.mean.toFixed(2)})`);
    if (number === 1) assert.ok(found.outside > 0, `slide ${number}: the outline outside the frame at (${cx.toFixed(1)}, ${cy.toFixed(1)}) is drawn, not clipped`);
  }
}

// 3. A reader that does not understand the Choice's namespace takes the fallback picture; one that does takes the SmartArt frame.
const fallbackOnly = {};
{
  for (const index of [1, 2]) {
    const part = `ppt/slides/slide${index}.xml`, xml = live.text(part);
    const other = compatibility(xml, READER);
    assert.deepEqual(other.choices, ['fallback'], `slide ${index}: the fallback is taken`);
    assert.doesNotMatch(other.xml, /drawingml\/2006\/diagram"|dgm:relIds/, 'no SmartArt frame is left');
    const picture = other.xml.match(/<p:pic>[\s\S]*?<\/p:pic>/)?.[0];
    assert.ok(picture && picture.includes(`name="OPF smartart slides.${index - 1}.items"`), 'the fallback picture is on the slide');
    const office = compatibility(xml, new Set([...READER, 'http://schemas.microsoft.com/office/drawing/2016/12/diagram', 'http://schemas.microsoft.com/office/drawing/2016/SVG/main']));
    assert.deepEqual(office.choices, ['choice'], `slide ${index}: a SmartArt reader takes the choice`);
    assert.match(office.xml, /<dgm:relIds /);
    fallbackOnly[part] = other.xml;
  }
}

// 4. The round trip from the mc:Choice: each SmartArt is its list again, on its layout.
{
  const back = await fromPptx(live.bytes);
  assert.deepEqual(back.slides.map(slide => [slide.layout, slide.items]), [['pyramid', pyramid], ['matrix', matrix]]);
}

// 5. Only the fallback survived (an app without SmartArt saved the file: the processed slides, the diagram parts gone): the tagged
//    picture is the same list on the same layout.
const withoutDiagrams = (entries, slides) => {
  const next = {...entries, ...Object.fromEntries(Object.entries(slides).map(([part, xml]) => [part, strToU8(xml)]))};
  for (const path of Object.keys(next)) if (/^ppt\/diagrams\//.test(path)) delete next[path];
  for (const path of Object.keys(next).filter(path => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(path)))
    next[path] = strToU8(strFromU8(next[path]).replace(/<Relationship [^>]*Target="\.\.\/diagrams\/[^"]+"\/>/g, ''));
  next['[Content_Types].xml'] = strToU8(strFromU8(next['[Content_Types].xml']).replace(/<Override PartName="\/ppt\/diagrams\/[^"]+" ContentType="[^"]+"\/>/g, ''));
  return zipSync(next);
};
{
  const diagnostics = [], back = await fromPptx(withoutDiagrams(live.entries, fallbackOnly), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.deepEqual(back.slides.map(slide => [slide.layout, slide.items]), [['pyramid', pyramid], ['matrix', matrix]]);
  assert.equal(diagnostics.filter(item => /reference-changed|smartart/.test(item.code)).length, 0, JSON.stringify(diagnostics));
}

// 6. A fallback picture that was replaced (another picture under the same name and tag) is an ordinary picture.
{
  const entries = unzipSync(withoutDiagrams(live.entries, fallbackOnly)), relationships = relationshipsOf(entries, 'ppt/slides/slide1.xml');
  const slide = strFromU8(entries['ppt/slides/slide1.xml']);
  const png = relationships.get(slide.match(/<a:blip r:embed="([^"]+)"/)[1]), svg = relationships.get(slide.match(/<asvg:svgBlip [^>]*r:embed="([^"]+)"/)[1]);
  entries[png] = new Uint8Array(await sharp({create: {width: 64, height: 32, channels: 3, background: '#808080'}}).png().toBuffer());
  entries[svg] = strToU8('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#808080"/></svg>');
  const diagnostics = [], back = await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.ok(diagnostics.some(item => item.code === 'invalid-smartart-provenance'), 'the replaced picture is reported');
  assert.equal(back.slides[0].items, undefined);
  assert.ok(JSON.stringify(back.slides[0]).includes('"type":"image"'), 'and imported as a picture');
  assert.deepEqual(back.slides[1].items, matrix, 'the untouched matrix is still its list');
}

// 7. Without full provenance the fallback carries no record: the mc:Choice still reads back (its data model), the fallback alone is a picture.
{
  const bare = await exported(deck, {provenance: 'references-only'});
  assert.equal(Object.keys(bare.entries).some(path => /opfSmartArtFallback/.test(path)), false, 'no fallback record');
  assert.match(bare.text('ppt/slides/slide1.xml'), /<mc:Fallback><p:pic>/);
  const back = await fromPptx(bare.bytes);
  assert.deepEqual(back.slides.map(slide => slide.items ?? slide.blocks?.[0]?.items), [pyramid, matrix]);
  const slides = Object.fromEntries([1, 2].map(index => [`ppt/slides/slide${index}.xml`, compatibility(bare.text(`ppt/slides/slide${index}.xml`), READER).xml]));
  const alone = await fromPptx(withoutDiagrams(bare.entries, slides));
  assert.ok(JSON.stringify(alone.slides[0]).includes('"type":"image"'), 'the untagged fallback is a picture');
}

// 8. No fallback picture can be drawn (no rasterizer for its PNG): no SmartArt either, the arrangement is native shapes, reported.
{
  const unavailable = await exported(deck, {svgRasterizer: async () => { throw Object.assign(new Error('no rasterizer'), {code: 'svg-rasterizer-unavailable'}); }});
  const reported = unavailable.diagnostics.filter(item => item.code === 'smartart-unavailable');
  assert.equal(reported.length, 2);
  assert.match(reported[0].reason, /^no fallback picture can be drawn for apps without SmartArt \(/);
  assert.doesNotMatch(unavailable.text('ppt/slides/slide1.xml'), /mc:AlternateContent|drawingml\/2006\/diagram/);
  assert.match(unavailable.text('ppt/slides/slide1.xml'), /name="OPF arrangement slides\.0\.items node 0"/);
  assert.equal(Object.keys(unavailable.entries).some(path => path.startsWith('ppt/diagrams/')), false);
}

// 9. `typefaces: "safe"`: the fallback is drawn in the Office-safe family the export writes and lays the nodes out with, not the
//    preview's: its glyph outlines are those of a deck that names that family itself, and differ from the selected family's.
{
  const fonts = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck});
  const latin = exported => exported.text('ppt/diagrams/data1.xml').match(/<a:latin typeface="([^"]+)"\/>/)?.[1];
  const selected = await exported(deck, {fonts}), safe = await exported(deck, {fonts, typefaces: 'safe'});
  const face = latin(safe);
  assert.ok(face && face !== latin(selected), `safe mode writes another family (${latin(selected)} becomes ${face})`);
  const glyphs = svg => [...svg.matchAll(/<path id="opf-g-[^"]*" d="([^"]+)"/g)].map(match => match[1]).sort();
  // A gallery font scheme whose body family (the nodes' family) is the safe family.
  const scheme = Object.entries(defaultCatalog.fontSchemes).find(([, record]) => record.minor === face)?.[0];
  assert.ok(scheme, `a gallery font scheme of ${face}`);
  // Its heading family may be proprietary (Arial Black): the control previews it with its visual replacement; the nodes are the body family.
  const control = {...deck, design: {fontScheme: scheme}};
  const named = await exported(control, {fonts: await loadFonts({pack: 'office', scripts: 'auto', presentation: control, substitutionPolicy: 'visual'})});
  assert.equal(latin(named), face, 'the control deck names the safe family');
  assert.deepEqual(glyphs(fallbackOf(safe, 1).svg), glyphs(fallbackOf(named, 1).svg), "the fallback draws the safe family's glyphs");
  assert.notDeepEqual(glyphs(fallbackOf(safe, 1).svg), glyphs(fallbackOf(selected, 1).svg), "and not the selected family's");
}

// 10. `smartArt: "shapes"` writes no wrapper, and the export stays deterministic.
{
  const shapes = await exported(deck, {smartArt: 'shapes'});
  assert.doesNotMatch(shapes.text('ppt/slides/slide1.xml'), /mc:AlternateContent/);
  const again = await exported(deck);
  assert.deepEqual(again.bytes, live.bytes, 'the same bytes from the same deck');
}

console.log('SH-16 SmartArt fallback passed: the mc:AlternateContent wrapper (dgm1612 choice, picture fallback of the same id and name at the frame grown by its bleed), the preview pixels (base corners, apex and diamond tips included), safe typefaces, a markup-compatibility reader without SmartArt, the round trip from the choice and from the fallback alone, a replaced fallback, references-only provenance, the unavailable fallback and determinism.');
