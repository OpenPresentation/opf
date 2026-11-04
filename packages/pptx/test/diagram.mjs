// Diagrams (OPF `diagram`): each exports as one native SVG picture (`asvg:svgBlip` over a PNG fallback) painted by core's paintDiagram
// in the palette opf-render previews it with, at core's drawn box, with the alt text as the picture's description. A source that
// cannot be drawn, or a diagram without a rasterizer for its fallback, is the unavailable-diagram placeholder with a diagnostic. In
// full provenance OPF_DIAGRAM_V1 gives the diagram back on import; an edited picture, or an export without the tag, is an image.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx, toSvg} from './helpers/default-catalog.mjs';

const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
const SVG_URI = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';
const FLOW = 'flowchart LR\n  A[Idea] --> B[Prototype] --> C[Launch]';
const STEPS = {source: 'flowchart TB\n  X[Draft] --> Y[Review]', alt: 'A draft goes to review.'};
const BROKEN = 'flowchart LR\n  A[[[ --> ';
const design = {fontScheme: 'roboto', colorScheme: 'cool-horizon'};
let checked = 0;

async function open(deck, options = {}) {
  const diagnostics = [];
  const bytes = await toPptx(deck, {...FIXED, onDiagnostic: item => diagnostics.push(item), ...options});
  return {bytes, entries: unzipSync(bytes), diagnostics};
}
const slideXml = (entries, index) => strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);
const relTarget = (entries, index, id) => {
  const rel = strFromU8(entries[`ppt/slides/_rels/slide${index + 1}.xml.rels`]).match(new RegExp(`<Relationship Id="${id}"[^>]*>`))?.[0];
  assert.ok(rel, `relationship ${id} on slide ${index}`);
  return `ppt/${rel.match(/Target="([^"]+)"/)[1].replace(/^\.\.\//, '')}`;
};
const diagramPictures = (entries, index) => [...slideXml(entries, index).matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(([xml]) => ({
  xml, name: xml.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1], descr: xml.match(/<p:cNvPr\b[^>]*\bdescr="([^"]*)"/)?.[1],
  embed: xml.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1], svgEmbed: xml.match(/<asvg:svgBlip\b[^>]*r:embed="([^"]+)"/)?.[1],
  x: Number(xml.match(/<a:off x="(-?\d+)"/)?.[1]) / 9525, y: Number(xml.match(/<a:off x="-?\d+" y="(-?\d+)"/)?.[1]) / 9525,
  w: Number(xml.match(/<a:ext cx="(\d+)"/)?.[1]) / 9525, h: Number(xml.match(/<a:ext cx="\d+" cy="(\d+)"/)?.[1]) / 9525,
})).filter(picture => /^OPF diagram \d+$/.test(picture.name));
// The painted group of the n-th diagram of a preview slide: the group paintDiagramGroup wrote (its transform, font and fill) and its body.
function previewDiagram(svg, nth = 0) {
  let at = -1;
  for (let count = 0; count <= nth; count++) at = svg.indexOf('data-opf-diagram=', at + 1);
  assert.ok(at >= 0, 'the preview draws the diagram');
  const open = svg.indexOf('<g transform=', at), start = svg.indexOf('>', open) + 1;
  const tags = /<g\b|<\/g>/g;
  tags.lastIndex = start;
  let depth = 1, match;
  while ((match = tags.exec(svg))) { depth += match[0] === '</g>' ? -1 : 1; if (!depth) break; }
  const wrapper = svg.slice(open, start);
  const [, x, y, scale] = /translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.]+)\)/.exec(wrapper).map(Number);
  return {body: svg.slice(start, match.index), x, y, scale, font: /font-family="([^"]*)"/.exec(wrapper)[1], fill: /fill="([^"]*)"/.exec(wrapper)[1]};
}
// The exported SVG of a diagram picture: its root attributes and its body (without the title).
function exportedSvg(entries, index, picture) {
  const part = relTarget(entries, index, picture.svgEmbed);
  assert.match(part, /^ppt\/media\/[^/]+\.svg$/);
  const text = strFromU8(entries[part]);
  const root = /^<svg\b[^>]*>/.exec(text)[0];
  const attribute = name => new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1];
  return {text, viewBox: attribute('viewBox').split(' ').map(Number), width: Number(attribute('width')), height: Number(attribute('height')), font: attribute('font-family'), fill: attribute('fill'),
    title: /<title>([\s\S]*?)<\/title>/.exec(text)?.[1], body: text.slice(root.length).replace(/^<title>[\s\S]*?<\/title>/, '').replace(/<\/svg>$/, '')};
}
const near = (actual, expected, label, tolerance = .02) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const luminance = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).reduce((sum, channel) => sum + channel, 0) / 765;

// ---- 1. A full-slide diagram and a block diagram on a light, a dark and a card surface: native SVG pictures in the preview's palette.
const deck = {design, slides: [
  {title: 'Light', design: {variant: 'light1'}, diagram: FLOW},
  {title: 'Dark', design: {variant: 'dark1'}, diagram: FLOW},
  {title: 'Blocks', design: {variant: 'light1', contentBox: true}, composition: {mode: 'row'}, blocks: [{type: 'text', text: 'Left copy'}, {type: 'diagram', diagram: STEPS, caption: 'Figure 1'}]},
]};
const exported = await open(deck);
const previews = await toSvg(deck);
{
  assert.deepEqual(exported.diagnostics.filter(entry => entry.path?.includes('diagram')), [], 'a drawable diagram reports nothing');
  const painted = [];
  for (const [index, labels, alt] of [[0, ['Idea', 'Prototype', 'Launch'], 'Flowchart: Idea, Prototype, Launch'], [1, ['Idea', 'Prototype', 'Launch'], 'Flowchart: Idea, Prototype, Launch'], [2, ['Draft', 'Review'], STEPS.alt]]) {
    const label = `slide ${index + 1}`;
    const pictures = diagramPictures(exported.entries, index);
    assert.equal(pictures.length, 1, `${label}: one diagram picture`);
    const [picture] = pictures;
    assert.ok(picture.svgEmbed, `${label}: the picture carries asvg:svgBlip`);
    assert.ok(picture.xml.includes(`<a:ext uri="${SVG_URI}">`), `${label}: the SVG blip extension`);
    const png = exported.entries[relTarget(exported.entries, index, picture.embed)];
    assert.deepEqual([...png.subarray(1, 4)], [80, 78, 71], `${label}: the fallback blip is a PNG`);
    assert.equal(picture.descr, alt, `${label}: descr is the alt text`);
    const svg = exportedSvg(exported.entries, index, picture);
    for (const forbidden of ['var(', 'color-mix', 'class=', '<style', 'currentColor']) assert.ok(!svg.text.includes(forbidden), `${label}: the SVG has no ${forbidden}`);
    for (const text of labels) assert.match(svg.body, new RegExp(`<text\\b[^>]*>(?:<tspan\\b[^>]*>)?${text}<`), `${label}: "${text}" is SVG text`);
    assert.equal(svg.font, 'Roboto, sans-serif', `${label}: drawn in the deck's body family`);
    assert.equal(svg.title, alt, `${label}: the SVG title is the alt text`);
    // The preview's palette exactly: the same painted body, font and text fill as opf-render's slideDiagramPalette group.
    const preview = previewDiagram(previews[index]);
    assert.equal(svg.body, preview.body, `${label}: the exported SVG paints what the preview paints`);
    assert.equal(svg.font, preview.font, `${label}: the preview's font`);
    assert.equal(svg.fill, preview.fill, `${label}: the preview's text color`);
    // At core's drawn box: the preview's translate and scale, in reference px.
    near(picture.x, preview.x, `${label}: x`); near(picture.y, preview.y, `${label}: y`);
    near(picture.w, svg.viewBox[2] * preview.scale, `${label}: width`, .05); near(picture.h, svg.viewBox[3] * preview.scale, `${label}: height`, .05);
    near(svg.width, picture.w, `${label}: SVG width is the drawn size`, .05);
    painted.push(svg);
  }
  // The colors come from the deck scheme (cool-horizon) and follow the variant: dark tints and light text on the dark slide.
  const colors = svg => [...new Set(svg.body.match(/#[0-9A-F]{6}\b/gi))];
  assert.notDeepEqual(colors(painted[0]), colors(painted[1]), 'the dark variant paints other colors');
  assert.ok(luminance(painted[0].fill) < .3 && luminance(painted[1].fill) > .7, 'dark text on the light slide, light text on the dark one');
  const nodeFill = svg => /<rect\b[^>]*fill="(#[0-9A-F]{6})"/i.exec(svg.body)?.[1];
  assert.ok(luminance(nodeFill(painted[0])) > .7 && luminance(nodeFill(painted[1])) < .3, 'node fills are tints over the light and the dark surface');
  // The caption follows its diagram as tagged text named for the picture.
  assert.match(slideXml(exported.entries, 2), /<a:t>Figure 1<\/a:t>/, 'the caption is exported');
  // Deterministic: the same document gives the same bytes.
  const again = await open(deck);
  assert.deepEqual(again.bytes, exported.bytes, 'a second export is byte-identical');
  checked++;
}

// ---- 2. fromPptx gives back each unchanged diagram (source and alt), its caption and the root or block form.
{
  const diagnostics = [];
  const imported = await fromPptx(exported.bytes, {onDiagnostic: item => diagnostics.push(item)});
  assert.equal(imported.slides[0].diagram, FLOW, 'a root diagram returns as its source string');
  assert.equal(imported.slides[1].diagram, FLOW);
  const block = imported.slides[2].blocks.find(entry => entry.type === 'diagram');
  assert.deepEqual(block, {type: 'diagram', diagram: STEPS, caption: 'Figure 1'}, 'a block diagram returns with its alt and caption');
  assert.deepEqual(diagnostics.filter(item => /diagram/.test(item.code)), [], 'an unchanged export imports quietly');
  checked++;
}

// ---- 3. A source that cannot be drawn: the unavailable-diagram placeholder and a diagnostic; full provenance gives the source back.
{
  const broken = {design, slides: [{title: 'Broken', diagram: BROKEN}]};
  const {bytes, entries, diagnostics} = await open(broken);
  const xml = slideXml(entries, 0);
  assert.equal(diagramPictures(entries, 0).length, 0, 'no picture');
  assert.match(xml, /<p:cNvPr id="\d+" name="OPF diagram placeholder 1"\/>[\s\S]*?<a:prstDash val="dash"\/>[\s\S]*?<a:t>Diagram unavailable<\/a:t>/, 'one dashed shape that reads Diagram unavailable');
  assert.ok(diagnostics.some(item => item.code === 'content-placeholder' && item.reason === 'diagram-unavailable' && item.path === 'slides.0.diagram'), 'content-placeholder at the diagram');
  assert.ok(diagnostics.some(item => item.code === 'unresolved-content' && item.path === 'slides.0.diagram'), 'core says why');
  const imported = await fromPptx(bytes, {onDiagnostic: () => {}});
  assert.equal(imported.slides[0].diagram, BROKEN, 'the placeholder returns the authored source');
  checked++;
}

// ---- 4. No rasterizer for the PNG fallback: the placeholder and unresolved-asset, as for any SVG; strictAssets throws.
{
  const unavailable = () => { throw Object.assign(new Error('no renderer'), {code: 'svg-rasterizer-unavailable'}); };
  const single = {design, slides: [{title: 'Flow', diagram: FLOW}]};
  const {entries, diagnostics} = await open(single, {svgRasterizer: unavailable});
  assert.equal(diagramPictures(entries, 0).length, 0);
  assert.match(slideXml(entries, 0), /name="OPF diagram placeholder 1"/);
  const reported = diagnostics.filter(item => item.code === 'unresolved-asset');
  assert.deepEqual(reported.map(item => ({reason: item.reason, path: item.path})), [{reason: 'svg-rasterizer-unavailable', path: 'slides.0.diagram'}]);
  assert.match(reported[0].message, /^A diagram needs a rasterizer/);
  assert.match(reported[0].message, /unavailable-diagram placeholder\.$/);
  await assert.rejects(toPptx(single, {...FIXED, svgRasterizer: unavailable, strictAssets: true}), error => error.code === 'svg-rasterizer-unavailable');
  // A host rasterizer draws the fallback; the SVG is passed as text with the fallback size.
  const calls = [];
  const fallback = exported.entries[relTarget(exported.entries, 0, diagramPictures(exported.entries, 0)[0].embed)];
  const hosted = await open(single, {svgRasterizer: (svg, hint) => { calls.push({svg, hint}); return fallback; }});
  assert.equal(calls.length, 1);
  assert.ok(calls[0].svg.startsWith('<svg') && calls[0].hint.text === true && calls[0].hint.width > 0);
  assert.equal(diagramPictures(hosted.entries, 0).length, 1);
  checked++;
}

// ---- 5. Edited in PowerPoint: a moved or replaced picture is an image (invalid-diagram-provenance); a new description is the alt.
{
  const single = {design, slides: [{title: 'Flow', diagram: FLOW}]};
  const {entries} = await open(single);
  const edit = (change) => {
    const copy = Object.fromEntries(Object.entries(entries).map(([path, bytes]) => [path, bytes]));
    copy['ppt/slides/slide1.xml'] = strToU8(change(slideXml(entries, 0)));
    return zipSync(copy);
  };
  const read = async bytes => { const diagnostics = []; const imported = await fromPptx(bytes, {onDiagnostic: item => diagnostics.push(item)}); return {slide: imported.slides[0], diagnostics}; };
  const moved = await read(edit(xml => xml.replace(/(<p:pic>[\s\S]*?<a:off x=")(\d+)/, (_, head, x) => `${head}${Number(x) + 9525 * 40}`)));
  assert.equal(moved.slide.diagram, undefined, 'a moved picture is no diagram');
  assert.ok((moved.slide.blocks ?? [moved.slide]).some(block => block.image?.src?.startsWith('data:image/svg+xml')), 'it is the SVG image');
  assert.ok(moved.diagnostics.some(item => item.code === 'invalid-diagram-provenance'));
  const svgPart = relTarget(entries, 0, diagramPictures(entries, 0)[0].svgEmbed);
  const replacedEntries = {...entries, [svgPart]: strToU8(strFromU8(entries[svgPart]).replace('Prototype', 'Changed'))};
  const replaced = await read(zipSync(replacedEntries));
  assert.equal(replaced.slide.diagram, undefined, 'a replaced SVG is no diagram');
  assert.ok(replaced.diagnostics.some(item => item.code === 'invalid-diagram-provenance'));
  const described = await read(edit(xml => xml.replace(/descr="[^"]*"/, 'descr="Three steps to launch."')));
  assert.deepEqual(described.slide.diagram, {source: FLOW, alt: 'Three steps to launch.'}, 'the current description is the alt text');
  checked++;
}

// ---- 6. Without the tag (references-only, provenance false) the picture imports as the SVG image it is.
for (const provenance of ['references-only', false]) {
  const {bytes, entries} = await open({design, slides: [{title: 'Flow', diagram: FLOW}]}, {provenance});
  assert.equal(diagramPictures(entries, 0).length, 1, `${provenance}: still the diagram picture`);
  assert.ok(!Object.keys(entries).some(path => /opfDiagram/.test(path)), `${provenance}: no diagram tag`);
  const imported = await fromPptx(bytes, {onDiagnostic: () => {}});
  const slide = imported.slides[0];
  assert.equal(slide.diagram, undefined);
  assert.ok((slide.blocks ?? [slide]).some(block => block.image?.src?.startsWith('data:image/svg+xml')), `${provenance}: an SVG image`);
  checked++;
}

console.log(`Diagram checks passed (${checked}): native SVG pictures in the preview's palette, alt text, captions, placeholders, rasterizer fallback and the tagged round trip.`);
