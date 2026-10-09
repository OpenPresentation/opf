// RR-64 phase 3: an outlined slide is as accessible as its text version (FA-30). The glyphs are hidden from assistive technology
// and each outlined line is real text again, invisible, pinned to the drawn width. Checked in a real browser on the FA-30 fixture
// deck drawn with `text: "paths"`: the slide is one group named by its title; every piece of slide text is in the
// accessibility tree as text, outside any image except the chart's own marks; axe reports nothing; find-in-page finds the words;
// the readable layer paints nothing (same pixels without it); and it names no font, so no face is embedded for it. Offline.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { loadFonts } from '../dist/fonts-node.js';
import { toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import { previewA11yDeck } from './preview-a11y-fixture.mjs';

const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'all' });
const svg = toSvg(previewA11yDeck(), 1, { fonts, text: "paths" });
const readable = [...svg.matchAll(/<text [^>]*fill="none"[^>]*>/g)];
assert.ok(readable.length >= 10, `${readable.length} readable lines`);
assert.ok(readable.every(([tag]) => /font-family="sans-serif"/.test(tag) && /textLength="[\d.]+"/.test(tag)), 'readable lines name the generic family and are pinned to the drawn width');
assert.doesNotMatch(svg, /@font-face\{font-family:"sans-serif"/, 'no face is embedded for the readable layer');
const withoutLayer = svg.replace(/<text [^>]*fill="none"[^>]*>[^<]*<\/text>/g, '');

const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const requests = [], errors = [];
const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:/, (route) => { requests.push(route.request().url()); return route.abort(); });
  const show = (markup) => page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Slide</title><style>body{margin:0}</style></head><body><main>${markup}</main></body></html>`);

  // The invisible layer paints nothing.
  await show(withoutLayer);
  const bare = await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await show(svg);
  assert.ok((await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 720 } })).equals(bare), 'the readable layer paints nothing');

  // The accessibility tree: the slide group, the named images, and the slide's words as text.
  const snapshot = await page.locator('main').ariaSnapshot();
  assert.match(snapshot, /- group "Quarterly review":/, snapshot);
  for (const name of ['A harbour', 'North leads', 'Trend: up']) assert.match(snapshot, new RegExp(`img "${name}"`), `${name} is a named image`);
  assert.doesNotMatch(snapshot, /img "Quarterly review"/, 'the slide is not an image');
  for (const text of ['Draft', 'Quarterly review', 'Sales Q2', 'Body paragraph', 'First point', 'Second point', 'A memorable quote', 'Ada', '42%', 'Growth', 'Col A', 'cell y', 'An inline note', 'Header text', 'Footer text']) assert.ok(snapshot.includes(text), `${text} is readable`);
  assert.ok(snapshot.indexOf('Quarterly review', 20) < snapshot.indexOf('Body paragraph') && snapshot.indexOf('Body paragraph') < snapshot.indexOf('Header text'), 'title, body, then furniture');
  assert.ok(!snapshot.includes('•'), 'the bullet marker is hidden');
  const session = await page.context().newCDPSession(page);
  const { nodes } = await session.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const role = (node) => node.role?.value;
  const below = (node, wanted) => { for (let up = byId.get(node.parentId); up; up = byId.get(up.parentId)) if (!up.ignored && role(up) === wanted) return up; return null; };
  const words = nodes.filter((node) => !node.ignored && role(node) === 'StaticText' && !below(node, 'image')).map((node) => node.name.value).join(' ');
  for (const text of ['Quarterly review', 'Body paragraph', 'Second point', 'memorable', '42%', 'cell x', 'An inline note', 'Footer text']) assert.ok(words.includes(text), `${text} is text outside any image`);
  const underImage = nodes.filter((node) => !node.ignored && role(node) === 'StaticText' && below(node, 'image')).map((node) => below(node, 'image').name.value);
  assert.ok(underImage.every((name) => name === 'North leads'), `only the chart's own marks sit under an image (${[...new Set(underImage)]})`);

  // Find in page and axe.
  assert.equal(await page.evaluate(() => window.find('Body paragraph')), true, 'find-in-page finds outlined words');
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main'))).violations.map((violation) => `${violation.id}: ${violation.nodes.length}`));
  assert.deepEqual(violations, [], 'axe reports no violation');
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, [], 'the page loads nothing');
  console.log(`text-as-paths-a11y-browser: ${readable.length} readable lines; slide group, named images and every word as text; find and axe pass (${browser.version()}).`);
} finally {
  await browser.close();
}
