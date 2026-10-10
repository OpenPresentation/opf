// RR-10 native-check set: decks that exercise every SVG picture place, a raster control, and a probe for picture effects on
// SVG pictures, written with a manifest of what to verify in desktop PowerPoint. This script never opens Office.
//
//   node test/native-svg-decks.mjs generate OUTPUT_DIRECTORY   decks, manifest.json, preview PNGs, fallback PNGs
//   node test/native-svg-decks.mjs verify DIRECTORY_OF_SAVED_FILES [OUTPUT_DIRECTORY]
//       reads decks PowerPoint saved (same file names) and reports whether each SVG picture survived the save and
//       what fromPptx returns for it.
//
// OPF_RENDER_DIST (optional): a directory with an opf-render build (its dist/index.js) used for the previews; the
// installed renderer is used otherwise. The manifest records whether the renderer draws SVG pictures.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {strFromU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {attachSvgPictures, prepareSvg, svgDataUriBytes} from '../dist/svg-image.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const uri = text => `data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}`;
const FIXED = {seed: 1, timestamp: '2026-10-01T00:00:00Z', zipDate: '2026-10-01T00:00:00Z'};

// Vector art that shows whether the picture is vector: thin strokes, a gradient, curves, text.
const logoWide = `<svg ${NS} width="300" height="100" viewBox="0 0 300 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f5aa6"/><stop offset="1" stop-color="#7a3cc2"/></linearGradient></defs>
  <rect x="2" y="2" width="296" height="96" rx="18" fill="url(#g)"/>
  <circle cx="50" cy="50" r="30" fill="none" stroke="#ffffff" stroke-width="2"/>
  <circle cx="50" cy="50" r="20" fill="none" stroke="#ffffff" stroke-width="1"/>
  <path d="M30 50 H70 M50 30 V70" stroke="#ffffff" stroke-width="0.75"/>
  <text x="100" y="62" font-family="Roboto, Arial, sans-serif" font-size="40" font-weight="700" fill="#ffffff">OPF logo</text>
</svg>`;
const diagram = `<svg ${NS} width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#f7f9fc"/>
  ${Array.from({length: 31}, (_, i) => `<path d="M${20 + i * 20} 20 V340" stroke="#d0d7e2" stroke-width="0.5"/>`).join('')}
  ${Array.from({length: 17}, (_, i) => `<path d="M20 ${20 + i * 20} H620" stroke="#d0d7e2" stroke-width="0.5"/>`).join('')}
  <path d="M20 320 C120 60 220 340 320 180 S520 40 620 200" fill="none" stroke="#c0392b" stroke-width="2"/>
  <path d="M20 300 C140 280 240 100 340 160 S540 300 620 60" fill="none" stroke="#1f5aa6" stroke-width="1"/>
  <circle cx="320" cy="180" r="6" fill="#c0392b"/><circle cx="340" cy="160" r="4" fill="#1f5aa6"/>
  <text x="30" y="40" font-family="Roboto, Arial, sans-serif" font-size="14" fill="#333">Fine detail: stays sharp at any zoom</text>
</svg>`;
const iconSquare = `<svg ${NS} width="200" height="200" viewBox="0 0 200 200">
  ${[90, 70, 50, 30, 10].map((r, i) => `<circle cx="100" cy="100" r="${r}" fill="${['#1f5aa6', '#ffffff', '#c0392b', '#ffffff', '#222222'][i]}" stroke="#000000" stroke-width="0.5"/>`).join('')}
  ${Array.from({length: 12}, (_, i) => `<path d="M100 100 L${100 + 95 * Math.cos(i * Math.PI / 6)} ${100 + 95 * Math.sin(i * Math.PI / 6)}" stroke="#555555" stroke-width="0.4"/>`).join('')}
</svg>`;
const tallBadge = `<svg ${NS} width="120" height="240" viewBox="0 0 120 240"><rect x="4" y="4" width="112" height="232" rx="24" fill="#fff4d6" stroke="#b7791f" stroke-width="3"/><path d="M60 40 L84 90 L36 90 Z" fill="#b7791f"/><path d="M20 150 H100 M20 170 H100 M20 190 H70" stroke="#b7791f" stroke-width="2"/></svg>`;
const viewBoxOnly = `<svg ${NS} viewBox="0 0 200 100"><rect width="200" height="100" fill="#e6f4ea"/><path d="M10 90 L60 20 L110 70 L190 10" fill="none" stroke="#188038" stroke-width="3"/></svg>`;
const hostile = `<?xml version="1.0"?><svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="100" onload="alert('script ran')">
  <script>alert('script ran')</script>
  <image xlink:href="https://example.invalid/tracker.png" width="200" height="100"/>
  <rect width="200" height="100" fill="#fdecea"/><circle cx="100" cy="50" r="30" fill="#c0392b"/>
  <text x="100" y="95" text-anchor="middle" font-size="12" font-family="Arial">only this should show</text>
</svg>`;
const sources = {logoWide, diagram, iconSquare, tallBadge, viewBoxOnly, hostile};
const light = {type: 'solid', color: '#FFFFFF'};

const slides = [
  {id: 'content-contain', title: 'Content image, contained', layout: 'image-1x', image: {src: uri(diagram), alt: 'Diagram: crossing curves on a grid'},
    check: 'Click the picture: Graphics Format tab appears (not Picture Format). Zoom to 400%: lines and text stay sharp. Right-click > Convert to Shape is offered. Alt text reads "Diagram: crossing curves on a grid".'},
  {id: 'cover-logo-watermark', title: 'Cover with logo and watermark', layout: 'title', design: {watermark: {src: uri(iconSquare), opacity: 1}},
    check: 'The logo (top-left) and the centered opaque watermark behind the title are SVG pictures (Graphics Format; sharp at 400%). Opacity is 1 here on purpose: see svg-effects-probe for translucent.'},
  {id: 'placed-image-cover', title: 'Placed image, cover', blocks: [{type: 'image', image: uri(diagram), fit: 'cover', placement: {edge: 'right'}}, {type: 'text', text: 'Body copy beside the image.'}],
    check: 'The right-hand placed image block is an SVG picture cropped to its frame (a positive a:srcRect). Crop handles in PowerPoint show the trimmed area; zoom stays sharp.'},
  {id: 'placed-image-contain', title: 'Placed image, contain', blocks: [{type: 'image', image: uri(tallBadge), fit: 'contain', placement: {edge: 'left'}}, {type: 'text', text: 'A tall badge padded in its frame.'}],
    check: 'The placed image block is an SVG picture padded inside a wider frame by a NEGATIVE a:srcRect. Confirm it draws complete (nothing cut, nothing stretched) and no repair prompt appears. If negative crop misbehaves on SVG pictures, report it: the exporter would then shrink the frame instead.'},
  {id: 'content-crop', title: 'Content image, cover fit', layout: 'image-1x', design: {imageFit: 'cover'}, image: {src: uri(logoWide), alt: 'Wide logo cropped to the content box'},
    check: 'design.imageFit cover: the wide logo fills the content box, trimmed at the sides (a:srcRect). Sharp at zoom.'},
  {id: 'header-footer-logo', title: 'Header and footer logos', text: 'The header image and the footer logo are generated pictures.',
    design: {header: {right: {image: {src: uri(iconSquare), alt: 'Icon'}}}, footer: {left: {image: 'var:organization.logo'}}},
    check: 'Both furniture pictures are SVG pictures at their furniture boxes.'},
  {id: 'viewbox-only', title: 'viewBox-only SVG', layout: 'image-1x', image: {src: uri(viewBoxOnly), alt: 'Rising line chart'},
    check: 'An SVG with only a viewBox (no width or height) is a 2:1 SVG picture, not stretched.'},
  {id: 'sanitized', title: 'Sanitized SVG', layout: 'image-1x', image: {src: uri(hostile), alt: 'Pink square with a red circle'},
    check: 'The SVG had a script, an onload handler and an external image: all removed at export. PowerPoint opens it silently (no security warning, no network request, no alert) and shows the pink panel with the red circle and the caption only.'},
  {id: 'effects-native', title: 'Opacity, grayscale and border', design: {watermark: {src: uri(iconSquare), opacity: .3}}, blocks: [{type: 'image', image: uri(logoWide), placement: {edge: 'right'}, recolor: 'grayscale', opacity: .8, border: {color: '#c0392b', width: 6}}, {type: 'text', text: 'Native SVG pictures with effects.'}],
    check: 'Confirmed natively on 2026-10-01 (as a 0.14 slide image) and exported as SVG pictures since: the centered watermark is at 30% (a:alphaModFix before the SVG extension), the right-hand placed image is grayscale at 80% with a red 6 pt border. Both stay Graphics Format pictures.'},
];

function deckFor(options = {}) {
  return {name: 'RR-10 SVG pictures', organization: {id: 'acme', name: 'Acme', logo: uri(logoWide)}, design: {theme: 'classic', background: light}, slides: slides.map(({id: _id, check: _check, ...slide}) => slide), ...options};
}

// What each exported slide holds, read from the package.
const pictureRows = (entries, slideNumber) => {
  const xml = strFromU8(entries[`ppt/slides/slide${slideNumber}.xml`]), rels = strFromU8(entries[`ppt/slides/_rels/slide${slideNumber}.xml.rels`]);
  const part = id => `ppt/${rels.match(new RegExp(`<Relationship Id="${id}"[^>]*Target="([^"]+)"`))?.[1].replace(/^\.\.\//, '')}`;
  return [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(([picture]) => {
    const embed = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1], svg = picture.match(/<asvg:svgBlip\b[^>]*r:embed="([^"]+)"/)?.[1];
    return {name: picture.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1], fallbackPart: part(embed), svgPart: svg ? part(svg) : null,
      frameEmu: picture.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/)?.slice(1).map(Number),
      srcRect: picture.match(/<a:srcRect\b[^>]*\/>/)?.[0] ?? null, alphaModFix: picture.match(/<a:alphaModFix\b[^>]*\/>/)?.[0] ?? null};
  });
};

async function loadRenderer() {
  const target = process.env.OPF_RENDER_DIST ? pathToFileURL(path.resolve(process.env.OPF_RENDER_DIST, 'dist/index.js')).href : '@openpresentation/opf-render';
  const renderer = await import(target);
  const probe = renderer.toSvg({slides: [{image: uri(logoWide)}]}, 1);
  return {...renderer, drawsSvg: /<image\b/.test(probe) && !probe.includes('data-opf-asset-status'), source: process.env.OPF_RENDER_DIST ?? 'installed @openpresentation/opf-render'};
}

async function generate(output) {
  await mkdir(path.join(output, 'preview'), {recursive: true});
  await mkdir(path.join(output, 'fallback'), {recursive: true});
  const renderer = await loadRenderer();
  const diagnostics = [];
  const decks = [];
  const write = async (file, bytes, purpose, extra = {}) => {
    await writeFile(path.join(output, file), bytes);
    decks.push({file, sha256: sha(bytes), bytes: bytes.length, purpose, ...extra});
  };

  // 1. The set: every SVG picture place.
  const main = await toPptx(deckFor(), {...FIXED, onDiagnostic: item => diagnostics.push(item)});
  const mainEntries = unzipSync(main);
  await write('rr10-svg-pictures.pptx', main, 'Native SVG pictures in every place an image appears.', {
    slides: slides.map((slide, index) => ({n: index + 1, id: slide.id, title: slide.title, pictures: pictureRows(mainEntries, index + 1), verify: slide.check})),
  });

  // 2. The raster control: the same deck with each SVG as a PNG picture only (what an exporter without SVG support wrote).
  const {toPng} = renderer;
  const png = await toPptx(deckFor(), {...FIXED, imageResolver: async src => {
    const bytes = svgDataUriBytes(src);
    if (!bytes) return null;
    return {data: await toPng(prepareSvg(bytes).text, {scale: 1, background: 'rgba(0, 0, 0, 0)'}), mediaType: 'image/png'};
  }});
  await write('rr10-svg-raster-control.pptx', png, 'The same slides with each SVG as a 1x PNG picture only: compare at 400% zoom with rr10-svg-pictures.pptx (the control is soft, the SVG deck is sharp).', {
    slides: slides.map((slide, index) => ({n: index + 1, id: slide.id, pictures: pictureRows(unzipSync(png), index + 1)})),
  });

  // 3. The effects probe: effects not confirmed on SVG pictures (opacity, grayscale and border are: they are native above). The
  // exporter writes these as PNG only; here the SVG extension is added so PowerPoint shows whether it honours the effect.
  const effectDeck = {name: 'RR-10 SVG effect probe', design: {theme: 'classic', background: light}, slides: [
    {title: 'Image block, duotone', blocks: [{type: 'image', image: uri(logoWide), placement: {edge: 'right'}, recolor: {dark: '#102030', light: '#f0e0d0'}}, {type: 'text', text: 'a:duotone on an SVG blip.'}]},
    {title: 'Image block, circle mask', blocks: [{type: 'image', image: uri(logoWide), placement: {edge: 'right'}, shape: 'circle'}, {type: 'text', text: 'prstGeom ellipse on a wide SVG picture.'}]},
    {title: 'Image block, rounded mask', blocks: [{type: 'image', image: uri(diagram), placement: {edge: 'right'}, shape: 'rounded', cornerRadius: 0.12}, {type: 'text', text: 'roundRect on a wide SVG picture.'}]},
  ]};
  const probeDiagnostics = [];
  const probeBytes = await toPptx(effectDeck, {...FIXED, onDiagnostic: item => probeDiagnostics.push(item)});
  const probeEntries = unzipSync(probeBytes);
  const svgFor = {1: logoWide, 2: logoWide, 3: diagram};
  for (const [slide, text] of Object.entries(svgFor)) {
    const prepared = prepareSvg(new TextEncoder().encode(text));
    const names = [...strFromU8(probeEntries[`ppt/slides/slide${slide}.xml`]).matchAll(/<p:cNvPr\b[^>]*\bname="([^"]*)"/g)].map(match => match[1]).filter(name => /^OPF image \d+$/.test(name));
    attachSvgPictures(probeEntries, new Map(names.map(name => [name, {bytes: prepared.bytes, width: prepared.width, height: prepared.height}])));
  }
  const probe = zipSync(Object.fromEntries(Object.entries(probeEntries).filter(([name]) => !name.endsWith('/')).sort(([a], [b]) => a < b ? -1 : 1)), {level: 6, mtime: new Date('2026-10-01T00:00:00Z')});
  await write('rr10-svg-effects-probe.pptx', probe, 'PROBE (not shipped behaviour): SVG pictures with a duotone recolor or a non-rectangular mask. The exporter writes these as PNG only; here the SVG extension is added so PowerPoint shows whether it honours the effect.', {
    exporterDiagnostics: probeDiagnostics.map(({code, path: at}) => ({code, path: at})),
    slides: [1, 2, 3].map(n => ({n, pictures: pictureRows(unzipSync(probe), n), verify: `${['The wide logo recolored dark navy to cream (a:duotone on the blip).', 'The wide logo cut to a circle (prstGeom ellipse): the sides must be clipped.', 'The wide diagram with rounded corners (roundRect).'][n - 1]} Open without a repair prompt? Is the effect applied to the SVG picture? If it is ignored the exporter is right to keep these as PNG.` })),
  });

  // Previews (this renderer) and the PNG fallbacks that were embedded.
  for (const [file, deck] of [['rr10-svg-pictures', deckFor()], ['rr10-svg-effects-probe', effectDeck]]) {
    const svgs = renderer.toSvg(deck, {});
    for (const [index, svg] of svgs.entries()) await writeFile(path.join(output, 'preview', `${file}-${index + 1}.png`), await toPng(svg, {scale: 1}));
  }
  for (const [file, entries] of [['rr10-svg-pictures', mainEntries]]) {
    for (const [part, bytes] of Object.entries(entries)) if (part.endsWith('.png') && part.startsWith('ppt/media/')) await writeFile(path.join(output, 'fallback', `${file}-${path.basename(part)}`), bytes);
  }

  const manifest = {
    purpose: 'RR-10 native confirmation of SVG pictures (asvg:svgBlip over a PNG fallback). Written by test/native-svg-decks.mjs; no Office was opened to make these.',
    generated: {node: process.version, previewRenderer: renderer.source, previewRendererDrawsSvg: renderer.drawsSvg,
      note: renderer.drawsSvg ? undefined : 'The renderer used for preview/ draws an SVG data URI as the "Image unavailable" placeholder; the previews are not a reference for SVG pictures.'},
    exporterDiagnostics: diagnostics.map(({code, path: at, message}) => ({code, path: at, message})),
    checklist: [
      'Open each deck in desktop PowerPoint (2016+ / Microsoft 365). No repair prompt, no security warning.',
      'rr10-svg-pictures.pptx: every SVG picture shows the Graphics Format tab when selected, right-click offers Convert to Shape, and stays crisp at 400% zoom; the PNG-only deck (rr10-svg-raster-control.pptx) is soft at that zoom and shows Picture Format.',
      'Frames: each picture sits where the preview/ PNG draws it (contain = padded inside its box, crop = trimmed to its box); the alt text is on the picture (Alt Text pane).',
      'Save As a new file (same file names in a folder) and run: node test/native-svg-decks.mjs verify THAT_FOLDER - the SVG pictures must still be svgBlip pictures and fromPptx must return the SVG for them.',
      'rr10-svg-effects-probe.pptx: report whether PowerPoint applies a duotone recolor and a circle / rounded mask to an SVG picture (opacity, grayscale and border were confirmed on 2026-10-01 and are native in rr10-svg-pictures.pptx slide 9). If they apply, the exporter can keep SVG for those too; today it keeps the PNG.',
      'slide 4 of rr10-svg-pictures.pptx (negative a:srcRect on an SVG picture) must draw the whole badge, padded, not cut or stretched.',
    ],
    decks,
  };
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${decks.length} decks, ${decks.reduce((n, deck) => n + (deck.slides?.length ?? 0), 0)} slide records and manifest.json to ${output} (renderer draws SVG: ${renderer.drawsSvg}).`);
}

async function verify(directory, output) {
  const report = [];
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.pptx')).sort()) {
    const bytes = new Uint8Array(await readFile(path.join(directory, file)));
    const entries = unzipSync(bytes);
    const slideParts = Object.keys(entries).filter(part => /^ppt\/slides\/slide\d+\.xml$/.test(part)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
    const blips = slideParts.map(part => (strFromU8(entries[part]).match(/<asvg:svgBlip\b/g) ?? []).length);
    const types = strFromU8(entries['[Content_Types].xml']);
    const svgParts = Object.keys(entries).filter(part => part.endsWith('.svg'));
    const imported = await fromPptx(bytes, {onDiagnostic: () => {}});
    const sources = [];
    const visit = value => {
      if (typeof value === 'string' && /^data:image\//.test(value)) sources.push(value.slice(0, value.indexOf(';')));
      else if (value && typeof value === 'object') for (const item of Object.values(value)) visit(item);
    };
    visit(imported);
    report.push({file, sha256: sha(bytes), svgBlipsPerSlide: blips, svgParts: svgParts.length, svgContentTypeRegistered: /Extension="svg"/i.test(types) || svgParts.every(part => types.includes(`PartName="/${part}"`)),
      importedImageTypes: Object.fromEntries([...new Set(sources)].map(type => [type, sources.filter(item => item === type).length]))});
  }
  const text = JSON.stringify(report, null, 2) + '\n';
  if (output) await writeFile(path.resolve(output), text);
  console.log(text);
  assert.ok(report.length, 'no .pptx files found');
}

const [command, first, second] = process.argv.slice(2);
if (command === 'generate' && first) await generate(path.resolve(first));
else if (command === 'verify' && first) await verify(path.resolve(first), second);
else {
  console.error('Usage: node test/native-svg-decks.mjs generate OUTPUT_DIRECTORY | verify DIRECTORY [REPORT.json]');
  process.exit(2);
}
