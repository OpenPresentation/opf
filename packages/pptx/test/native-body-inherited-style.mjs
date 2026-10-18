// Effective current-native Body styles. No native applications or source typography replay.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import path from 'node:path';
import {gallery} from '@openpresentation/gallery';
import {toSvg} from '@openpresentation/opf-render';
import {fromPptx} from '../dist/index.js';
import {nativeBodyReader} from '../dist/body-text-import.js';

const directory = new URL('./fixtures/keynote-native-bullets/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory))), bytes = await readFile(new URL(manifest.file, directory));
assert.equal(bytes.length, manifest.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
const original = unzipSync(bytes), slide = 'ppt/slides/slide3.xml', layout = 'ppt/slideLayouts/slideLayout30.xml', master = 'ppt/slideMasters/slideMaster1.xml', theme = 'ppt/theme/theme1.xml';
const slideXml = strFromU8(original[slide]), body = slideXml.match(/<p:sp>[\s\S]*?<\/p:sp>/g).find(shape => shape.includes('OPF native body slides.2.text'));
const plain = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(plain).join('') : value?.text === undefined ? '' : plain(value.text);
const bodyValue = deck => deck.slides[2].blocks[0].text;
const at = (deck, text) => bodyValue(deck).find(run => run?.text === text);
const expectedWords = 'Bold words and italic words and bold italic words\nA second rich paragraph.';
async function read(parts = original) {
  const diagnostics = [], deck = await fromPptx(parts === original ? bytes : zipSync(parts), {onDiagnostic: value => diagnostics.push(value)});
  assert.equal(plain(bodyValue(deck)), expectedWords, 'Only current authored words and paragraph boundary are retained');
  return {deck, diagnostics};
}
const {deck, diagnostics} = await read();
assert.equal(createHash('sha256').update(JSON.stringify(deck)).digest('hex'), 'c6a3d6a414dab48c37e2b076ab5182dee00532aecedd7e7036b1f4906d05aa15', 'Exact reviewed whole import; no style normalization');
for (const slide of [1,2,4,6,8,13,14,15,16]) {
  const block = deck.slides[slide].blocks[0], values = slide === 16 ? block.items : [block.text];
  for (const value of values) for (const run of Array.isArray(value) ? value : [value]) if (typeof run !== 'string') {
    assert.equal(run.fontFamily, 'Arial'); assert.equal(run.fontSize, slide === 16 ? 24 : 18); assert.equal(run.color, '#FFFFFF');
    for (const key of ['underline','strikethrough','superscript','subscript']) assert.equal(run[key], false);
  }
}
for (const run of bodyValue(deck).filter(run => typeof run !== 'string')) {
  assert.equal(run.fontFamily, 'Arial'); assert.equal(run.fontSize, 18); assert.equal(run.color, '#FFFFFF');
}
assert.equal(at(deck, 'Bold words').bold, true);
assert.equal(at(deck, 'italic words').italic, true); assert.equal(at(deck, 'italic words').bold, false);
assert.equal(at(deck, 'bold italic words').bold, true); assert.equal(at(deck, 'bold italic words').italic, true);
assert.equal(at(deck, 'A second rich paragraph.').bold, false); assert.equal(at(deck, 'A second rich paragraph.').italic, false);
assert.equal(deck.design.fontScheme, undefined, 'No global font scheme is invented');
assert.equal(typeof deck.slides[2].title, 'string', 'Heading typography is outside this Body-only change');
assert.equal(deck.slides[16].blocks.find(block => block.type === 'list').items[0][0].fontSize, 24, 'K17 current paragraph point size overrides its layout size');
assert.ok(!diagnostics.some(value => value.code.startsWith('unsupported-body-')), 'Equivalent resolved Arial script slots need no false unsupported warning');
const svg = toSvg(deck, 3, {catalogs: [gallery]});
for (const text of ['Bold words', 'A second rich paragraph.']) {
  const element = svg.match(new RegExp('<tspan[^>]*>' + text.replaceAll('.', '\\.') + '</tspan>'))?.[0];
  assert.ok(element); assert.match(element, /font-family="Arial, sans-serif"/); assert.match(element, /font-size="24"/); assert.match(element, /fill="#FFFFFF"/);
}
assert.match(svg, /fill="#011842"/, 'Current dark background remains distinct from readable white body');
const changed = (transform = value => value, edit = () => {}) => {
  const parts = {...original, [slide]: strToU8(slideXml.replace(body, transform(body)))}; edit(parts); return parts;
};
const editBodyPlaceholder = (parts, part, edit) => {
  let count = 0;
  parts[part] = strToU8(strFromU8(parts[part]).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
    if (!shape.includes('<p:ph type="body" idx="1"/>')) return shape;
    count++; return edit(shape);
  }));
  assert.equal(count, 1);
};
const themeChanged = await read(changed(undefined, parts => {
  parts[theme] = strToU8(strFromU8(parts[theme]).replace(/<a:minorFont>[\s\S]*?<\/a:minorFont>/, text => text.replace('<a:latin typeface="Arial"/>', '<a:latin typeface="Cousine"/>')));
}));
assert.equal(at(themeChanged.deck, 'Bold words').fontFamily, 'Cousine', 'Current theme family wins over the original Arial');
assert.ok(themeChanged.diagnostics.some(value => value.code === 'unsupported-body-font'), 'Different current script faces retain their truthful warning');
const sizeChanged = await read(changed(undefined, parts => editBodyPlaceholder(parts, layout, shape => shape.replace('sz="1800"', 'sz="2130"'))));
assert.equal(at(sizeChanged.deck, 'Bold words').fontSize, 21.3, 'Current layout size is in OPF points, not the original source size');
const colorChanged = await read(changed(undefined, parts => {
  parts[master] = strToU8(strFromU8(parts[master]).replace(/<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/, style => style.replace('val="FFFFFF"', 'val="11EE55"')));
}));
assert.equal(at(colorChanged.deck, 'A second rich paragraph.').color, '#11EE55');
const local = await read(changed(shape => shape.replace('<a:r><a:t>Bold words</a:t></a:r>', '<a:r><a:rPr b="0" i="0" sz="2200"><a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:latin typeface="Cousine"/></a:rPr><a:t>Bold words</a:t></a:r>')));
const localRun = at(local.deck, 'Bold words');
assert.equal(localRun.fontFamily, 'Cousine'); assert.equal(localRun.fontSize, 22); assert.equal(localRun.color, '#123456'); assert.equal(localRun.bold, false); assert.equal(localRun.italic, false);
const linked = await read(changed(shape => shape.replace('<a:r><a:t>Bold words</a:t></a:r>', '<a:r><a:rPr><a:solidFill><a:schemeClr val="hlink"/></a:solidFill><a:hlinkClick r:id="currentLink"/></a:rPr><a:t>Bold words</a:t></a:r>'), parts => {
  const rels = 'ppt/slides/_rels/slide3.xml.rels';
  parts[rels] = strToU8(strFromU8(parts[rels]).replace('</Relationships>', '<Relationship Id="currentLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.test/current-link" TargetMode="External"/></Relationships>'));
}));
assert.equal(at(linked.deck, 'Bold words').link, 'https://example.test/current-link'); assert.equal(at(linked.deck, 'Bold words').color, undefined, 'Canonical theme-colored link remains colorless');
assert.ok(!linked.diagnostics.some(value => value.code === 'unsupported-body-inherited-style' && value.path === 'slides.2.shapes.2.paragraphs.0.runs.0'), 'A resolved canonical link is not a missing default');
// The importer only supplies codeFamily when a surviving current design can
// identify it. Exercise that existing canonical form directly on current XML.
const codeParts = changed(shape => shape.replace('<a:r><a:t>Bold words</a:t></a:r>', '<a:r><a:rPr><a:latin typeface="Cousine"/></a:rPr><a:t>Bold words</a:t></a:r>'));
const keyedParser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false});
const archive = {
  bytes: name => codeParts[name],
  part: (name, parser) => parser.parse(strFromU8(codeParts[name])),
  relationships: name => {
    const rels = path.posix.join(path.posix.dirname(name), '_rels', path.posix.basename(name) + '.rels');
    const parsed = codeParts[rels] ? keyedParser.parse(strFromU8(codeParts[rels])).Relationships?.Relationship ?? [] : [];
    return new Map((Array.isArray(parsed) ? parsed : [parsed]).map(rel => [rel.Id, {type: rel.Type, targetMode: rel.TargetMode, target: rel.Target,
      path: path.posix.normalize(path.posix.join(path.posix.dirname(name), rel.Target))}]));
  }
};
const codeDiagnostics = [], codeParagraphs = nativeBodyReader(slide, archive, new Map(), value => codeDiagnostics.push(value), {codeFamily: 'Cousine'})(2);
const codeRun = codeParagraphs[0].richText.find(run => run?.text === 'Bold words');
assert.equal(codeRun.code, true); assert.equal(codeRun.fontFamily, undefined); assert.equal(codeRun.fontSize, 18); assert.equal(codeRun.color, '#FFFFFF');
assert.ok(!codeDiagnostics.some(value => value.code === 'unsupported-body-inherited-style' && value.path === 'shapes.2.paragraphs.0.runs.0'), 'A resolved canonical code family is not a missing default');
const ownDefault = await read(changed(shape => shape.replace('<a:lstStyle/>', '<a:lstStyle><a:defPPr><a:defRPr sz="1900"><a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:defPPr></a:lstStyle>')));
assert.equal(at(ownDefault.deck, 'A second rich paragraph.').fontSize, 19); assert.equal(at(ownDefault.deck, 'A second rich paragraph.').color, '#112233');
const paragraphDefault = await read(changed(shape => shape.replace('<a:defRPr b="1"/>', '<a:defRPr b="1" sz="2050"><a:solidFill><a:srgbClr val="AABBCC"/></a:solidFill></a:defRPr>')));
assert.equal(at(paragraphDefault.deck, 'Bold words').fontSize, 20.5); assert.equal(at(paragraphDefault.deck, 'Bold words').color, '#AABBCC');
assert.equal(at(paragraphDefault.deck, 'A second rich paragraph.').fontSize, 18);

const missingLayout = parts => {const rels = 'ppt/slides/_rels/slide3.xml.rels'; parts[rels] = strToU8(strFromU8(parts[rels]).replace(/<Relationship\b[^>]*Type="[^"]*\/slideLayout"[^>]*\/>/, ''));};
const unsupported = result => assert.ok(result.diagnostics.some(value => value.code === 'unsupported-body-inherited-style' && /^slides\.2\.shapes\.2\.paragraphs\.\d+\.runs\.\d+$/.test(value.path)), 'Unresolved needed defaults have an explicit current-run path');
unsupported(await read(changed(undefined, missingLayout)));
unsupported(await read(changed(undefined, parts => {delete parts[master];})));
unsupported(await read(changed(undefined, parts => {
  const value = strFromU8(parts[layout]), ph = value.match(/<p:sp>[\s\S]*?<\/p:sp>/g).find(shape => shape.includes('<p:ph type="body" idx="1"/>'));
  parts[layout] = strToU8(value.replace('</p:spTree>', ph + '</p:spTree>'));
})));
unsupported(await read(changed(undefined, parts => editBodyPlaceholder(parts, layout, shape => shape.replace('<a:defRPr sz="1800"/>', '<a:defRPr sz="1800"/><a:defRPr sz="2000"/>')))));
const gradient = await read(changed(undefined, parts => {
  parts[master] = strToU8(strFromU8(parts[master]).replace(/<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/, style => style.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, '<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs><a:gs pos="100000"><a:srgbClr val="000000"/></a:gs></a:gsLst><a:lin ang="0" scaled="1"/></a:gradFill>')));
}));
assert.ok(gradient.diagnostics.some(value => value.code === 'unsupported-body-text-fill' && value.path.startsWith('slides.2.shapes.2.'))); unsupported(gradient);
// A missing unused cascade must not warn when all needed properties are current and explicit.
const explicitRuns = shape => shape.replace(/<a:r>(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>)?/g, (_all, properties) => {
  const defaults = '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial"/>';
  const current = properties ? properties.replace(/\/>$/, '>').replace(/<\/a:rPr>$/, '') : '<a:rPr>';
  return '<a:r>' + current.replace('<a:rPr', '<a:rPr sz="1800"') + defaults + '</a:rPr>';
});
for (const parts of [changed(explicitRuns, missingLayout), changed(shape => explicitRuns(shape).replace('<p:ph type="body" idx="1"/>', '<p:ph type="body" idx="999"/>'))]) {
  const explicit = await read(parts);
  assert.ok(!explicit.diagnostics.some(value => value.code === 'unsupported-body-inherited-style' && value.path.startsWith('slides.2.')));
  for (const run of bodyValue(explicit.deck).filter(run => typeof run !== 'string')) {assert.equal(run.fontFamily, 'Arial'); assert.equal(run.fontSize, 18); assert.equal(run.color, '#FFFFFF');}
}
console.log('Current native Body defaults: Arial18pt/white becomes readable24px SVG; current theme/layout/master and local overrides, rich/paragraph semantics, unused cascade, missing/ambiguous styles and truthful unsupported fills/script faces pass.');
