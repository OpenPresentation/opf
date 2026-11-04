import assert from 'node:assert/strict';
import { colorContrast } from '@openpresentation/opf/composition';
import { toSvg, toPng, resolvePresentation } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import { slideDiagramPalette } from '../src/svg.js';
import { toPdf } from '../dist/index.js';
import { loadFonts } from '../dist/fonts-node.js';
import { openPdf, pageText } from './pdf-helpers.mjs';

// A diagram is core's drawing (pele's layout in the deck's measured fonts) painted in the slide's diagram palette: a self-contained
// group of shapes and text with no CSS variables, named by its alt, in the deck's body font, on light and dark slides alike.

const flow = 'flowchart LR\n  A[Brief] --> B{Approved?}\n  B -->|yes| C[Build]\n  B -->|no| A';
const deck = (slides, design = {}) => ({ language: 'en-US', design: { fontScheme: 'roboto', colorScheme: 'corporate-blue', ...design }, slides });
const fillsOf = svg => [...svg.matchAll(/<g [^>]*data-opf-diagram="[^"]+"[^>]*>([\s\S]*?)<\/g><\/g>\s*$|<g [^>]*data-opf-diagram="[^"]+"[^>]*>/g)].length;

{
  const svg = toSvg(deck([{ title: 'Flow', diagram: flow }]), 1);
  assert.match(svg, /<g aria-label="Flowchart: Brief, Approved\?, Build, yes, no" data-opf-diagram="flowchart" role="img">/);
  const group = svg.slice(svg.indexOf('data-opf-diagram="flowchart"'));
  for (const label of ['Brief', 'Approved?', 'Build', 'yes', 'no']) assert.ok(group.includes(`>${label.replace('?', '?')}<`), `label ${label} is text`);
  for (const leftover of ['var(--', 'color-mix', 'class="pele']) assert.ok(!svg.includes(leftover), `no ${leftover}`);
  assert.match(group, /font-family="Roboto, sans-serif"/);
  assert.equal(fillsOf(svg) >= 1, true);
  // Deterministic: the same deck draws the same bytes.
  assert.equal(toSvg(deck([{ title: 'Flow', diagram: flow }]), 1), svg);
}

// An authored alt names the picture; a caption is drawn under it.
{
  const svg = toSvg(deck([{ title: 'Flow', diagram: { source: flow, alt: 'Approved briefs are built.' }, caption: 'The review loop.' }]), 1);
  assert.match(svg, /aria-label="Approved briefs are built\." data-opf-diagram="flowchart" role="img"/);
  assert.match(svg, />The review loop\.</);
}

// The palette follows the slide: on a dark variant the node fills are dark tints and the text is light, both readable.
{
  const presentation = deck([{ title: 'Light', design: { variant: 'light1' }, diagram: flow }, { title: 'Dark', design: { variant: 'dark1' }, diagram: flow }]);
  const resolved = resolvePresentation(presentation, { fonts: undefined });
  const palettes = resolved.slides.map(slide => slideDiagramPalette(slide.geometry.items.find(item => item.field === 'diagram'), slide));
  const [light, dark] = palettes;
  assert.ok(colorContrast(light.surface, '#FFFFFF') < colorContrast(light.surface, '#000000'), 'light slide: light node fill');
  assert.ok(colorContrast(dark.surface, '#000000') < colorContrast(dark.surface, '#FFFFFF'), 'dark slide: dark node fill');
  for (const palette of palettes) {
    assert.ok(colorContrast(palette.text, palette.surface) >= 4.5);
    assert.ok(colorContrast(palette.line, palette.background) >= 3);
  }
  const svgs = toSvg(presentation);
  assert.ok(svgs[1].includes(`fill="${dark.surface}"`), 'the dark slide paints its own palette');
}

// A diagram block beside text takes its card's surface when it has one, and two diagrams on a slide keep distinct gradient ids.
{
  const svg = toSvg(deck([{ title: 'Two', blocks: [{ diagram: 'sankey-beta\nA,B,10\nB,C,5' }, { diagram: 'sankey-beta\nX,Y,4\nY,Z,2' }] }]), 1);
  const ids = [...svg.matchAll(/<linearGradient[^>]* id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'unique gradient ids');
}

// A source that cannot be drawn shows the placeholder, named by its error.
{
  const svg = toSvg(deck([{ title: 'Broken', diagram: 'flowchart LR\n  A --> [' }]), 1);
  assert.match(svg, /aria-label="Diagram unavailable: Expecting [^"]+" data-opf-diagram-status="unresolved" role="img"/);
  assert.ok(svg.includes('>Diagram unavailable<'));
}

// Trace output names the item path, as for every payload.
{
  const svg = toSvg(deck([{ title: 'Flow', blocks: [{ text: 'Context' }, { diagram: flow }] }]), 1, { trace: true });
  assert.match(svg, /data-opf-diagram="flowchart" data-opf-path="slides\.0\.blocks\.1\.diagram" role="img"/);
}

// The PNG draws the diagram: two renders are byte-identical.
{
  const presentation = deck([{ title: 'Flow', diagram: flow }]);
  const first = await toPng(presentation, 1, { width: 640 });
  const second = await toPng(presentation, 1, { width: 640 });
  assert.ok(first.length > 1000);
  assert.deepEqual(first, second);
}

// The vector PDF keeps a diagram's labels as text (sankey gradients and all), with no rasterized fallback.
{
  const presentation = deck([{ title: 'Flow', diagram: flow }, { title: 'Flows', diagram: 'sankey-beta\nVisits,Signups,40\nSignups,Paid,12' }]);
  const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual' });
  const diagnostics = [];
  const pdf = await toPdf(presentation, { fonts, onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
  const doc = await openPdf(pdf);
  assert.match(await pageText(doc, 1), /Brief .*Approved\? .*Build|yes no Brief Approved\? Build/);
  assert.match(await pageText(doc, 2), /Visits 40 .*Paid 12/);
  assert.ok(!diagnostics.some(diagnostic => /raster/i.test(`${diagnostic.code} ${diagnostic.reason ?? ''}`)), JSON.stringify(diagnostics));
}

console.log('diagram rendering: ok');
