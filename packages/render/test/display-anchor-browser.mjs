// opf#1322: a tracked display line measured with the host's real faces starts at core's own x in a browser, whatever its alignment.
// A browser counts the letter spacing after a line's last character toward a middle or end anchor (resvg does not), so such a line no
// longer hangs from its anchor: it is start-anchored at the position core computed. Estimated widths keep the anchor.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolvePresentation, toSvg} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';
const prepared = await loadFonts(), {registry} = prepared;
const slides = [
  {text: 'Ship in March.'},
  {title: 'Quarterly business review', subtitle: 'Operations'},
  {text: 'Reliability is the feature our customers pay for.'},
];
const browser = await chromium.launch({channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined});
let checked = 0, tracked = 0;
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  await page.route(/^https?:/, route => route.abort());
  await page.setContent('<main></main>');
  await page.evaluate(async faces => { for (const face of faces) document.fonts.add(await new FontFace(face.family, `url(${face.dataUrl})`, {weight: String(face.weight), style: face.italic ? 'italic' : 'normal'}).load()); await document.fonts.ready; }, registry.embeddedFonts);
  for (const align of ['start', 'center', 'end']) for (const [index, slide] of slides.entries()) {
    const document = {design: {fontScheme: 'roboto', contentAlignment: align}, slides: [slide]};
    const measured = {fonts: {textMeasurement: prepared.textMeasurement}};
    const bound = resolvePresentation(document, measured).slides[0], svg = toSvg(document, 1, measured);
    // Every plain text line core placed: its path, its start x and whether its style is tracked.
    const expected = bound.geometry.items.filter(item => item.type === 'text' && item.text?.placement && !('richLines' in item.text))
      .flatMap(item => item.text.placement.lines.map((line, i) => ({path: item.path, field: item.field, x: line.x, width: line.width, tracking: item.textStyle?.tracking ?? 0, text: item.text.lines[i]})));
    assert.ok(expected.length, `${align}-${index}: placed lines`);
    const observed = await page.evaluate(async ({svg}) => {
      document.querySelector('main').innerHTML = svg; await document.fonts.ready;
      return [...document.querySelectorAll('svg text')].map(node => ({text: node.textContent, x: node.getNumberOfChars() ? node.getStartPositionOfChar(0).x : null, anchor: node.getAttribute('text-anchor'), spacing: parseFloat(getComputedStyle(node).letterSpacing) || 0}));
    }, {svg});
    for (const line of expected) {
      const node = observed.find(candidate => candidate.text === line.text);
      assert.ok(node, `${align}-${index}: ${line.text}`);
      assert.ok(Math.abs(node.x - line.x) < 0.1, `${align}-${index} ${line.field} "${line.text}": drawn at ${node.x}, core placed it at ${line.x}`);
      if (line.tracking < 0) { tracked++; assert.equal(node.anchor, 'start', `${align}-${index} ${line.field}: a measured tracked line is start-anchored`); assert.ok(node.spacing < 0); }
      checked++;
    }
    // Estimated widths keep the anchor: the shaper's width differs from core's there.
    if (align !== 'start' && !slide.title) assert.ok(/text-anchor="(middle|end)"/.test(toSvg(document, 1, {})), `${align}-${index}: estimated lines keep their anchor`);
  }
} finally { await browser.close(); }
assert.ok(tracked >= 6, `tracked display lines checked: ${tracked}`);
console.log(`Display anchors (browser): ${checked} measured lines start where core placed them, ${tracked} of them tracked display lines; estimated lines keep their anchor.`);
