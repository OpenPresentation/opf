// FA-30: the browser's accessibility tree for the standalone slide SVG (the way a host page embeds toSvg output). The slide
// is one group named by the title with the roledescription "slide"; the text of the slide is not below a picture (role=img) node
// except the chart's own marks; the pictures and the chart are named images; the picture with alt "" and the decorative shapes
// are not in the tree. Run offline: the page loads nothing.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the documents name gallery records)
import { previewA11yDeck } from './preview-a11y-fixture.mjs';

const svg = toSvg(previewA11yDeck(), 1);
const requests = [], errors = [];
const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:/, (route) => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Slide</title></head><body><main>${svg}</main></body></html>`);

  // The accessibility tree as Playwright prints it: the slide is a group, the pictures and the chart are named images.
  const snapshot = await page.locator('main').ariaSnapshot();
  assert.match(snapshot, /- group "Quarterly review":/, snapshot);
  for (const name of ['A harbour', 'North leads', 'Trend: up']) assert.match(snapshot, new RegExp(`img "${name}"`), `${name} is a named image`);
  assert.doesNotMatch(snapshot, /- img(?!\s+")/, 'no unnamed image: the alt "" picture is out of the tree');
  assert.doesNotMatch(snapshot, /img "Quarterly review"/, 'the slide is not an image');
  for (const text of ['Draft', 'Quarterly review', 'Sales Q2', 'Body paragraph', 'First point', 'Second point', 'A memorable quote', 'Ada', '42%', 'Growth', 'Col A', 'cell y', 'An inline note', 'Header text', 'Footer text']) assert.ok(snapshot.includes(text), `${text} is in the tree`);
  assert.ok(snapshot.indexOf('Quarterly review', 20) < snapshot.indexOf('Body paragraph') && snapshot.indexOf('Body paragraph') < snapshot.indexOf('Header text'), 'title, body, then furniture');
  assert.ok(!snapshot.includes('•'), 'the bullet marker is hidden');

  // The full tree through the protocol: roles, names, the roledescription, and the ancestry of every piece of text.
  const session = await page.context().newCDPSession(page);
  const { nodes } = await session.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const role = (node) => node.role?.value;
  const slide = nodes.filter((node) => !node.ignored && role(node) === 'group' && node.name?.value === 'Quarterly review');
  assert.equal(slide.length, 1, 'one slide group');
  assert.equal(slide[0].properties.find((property) => property.name === 'roledescription')?.value.value, 'slide');
  const images = nodes.filter((node) => !node.ignored && role(node) === 'image');
  assert.deepEqual(images.map((node) => node.name.value).sort(), ['A harbour', 'North leads', 'Trend: up']);
  const below = (node, wanted) => { for (let up = byId.get(node.parentId); up; up = byId.get(up.parentId)) if (!up.ignored && role(up) === wanted) return up; return null; };
  const wordsOutsideImages = nodes.filter((node) => !node.ignored && role(node) === 'StaticText' && !below(node, 'image')).map((node) => node.name.value).join(' ');
  for (const text of ['Quarterly review', 'Body paragraph', 'Second point', 'memorable', '42%', 'cell x', 'An inline note', 'Footer text']) assert.ok(wordsOutsideImages.includes(text), `${text} has no image ancestor`);
  const underImage = nodes.filter((node) => !node.ignored && role(node) === 'StaticText' && below(node, 'image')).map((node) => below(node, 'image').name.value);
  assert.ok(underImage.every((name) => name === 'North leads'), `only the chart's own marks sit under an image (${[...new Set(underImage)]})`);
  // The slide group is the only container with a roledescription.
  assert.equal(nodes.filter((node) => (node.properties ?? []).some((property) => property.name === 'roledescription')).length, 1);
  // Decorative shapes: aria-hidden removes them from the tree.
  const hidden = await page.evaluate(() => [...document.querySelectorAll('svg rect, svg line')].filter((shape) => !shape.closest('[role=img]')).map((shape) => shape.getAttribute('aria-hidden') === 'true' || Boolean(shape.closest('[aria-hidden=true]'))));
  assert.ok(hidden.length >= 6 && hidden.every(Boolean), 'every shape outside a picture is aria-hidden');

  assert.deepEqual(errors, []);
  assert.deepEqual(requests, [], 'the page loads nothing');
  console.log(`preview-a11y-browser: slide group, ${images.length} named images, text reachable (${browser.version()}).`);
} finally {
  await browser.close();
}
