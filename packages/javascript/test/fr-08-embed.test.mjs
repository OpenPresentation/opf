// FR-08: the `embed` content kind: schema, the credentials warning, the frame core composes, the card, Markdown and YAML round trips,
// and the conversions between a video and an embed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromMarkdown, toMarkdown } from '../dist/markdown.js';
import { fromYaml, toYaml } from '../dist/yaml.js';
import { convertContent, contentConversionTargets } from '../dist/convert.js';
import { composeSlide, regionAccepts } from '../dist/composition.js';
import { layouts } from './support/template-samples.mjs';
import { EMBED_DEFAULT_ASPECT, embedAspect, embedCardLayout, embedSite, embedTitle, credentialInSrc, embedValue, stats, validate } from '../dist/index.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const findings = (deck, id) => validate(deck).findings.filter((finding) => finding.ruleId === `opf/${id}`);
const errors = (deck) => validate(deck).findings.filter((finding) => finding.severity === 'error');
const canvas = { width: 1280, height: 720 };

test('the string shorthand and the full form are valid, on a slide and as a block, with a caption', () => {
  const deck = {
    name: 'Embed', assets: { shot: png },
    slides: [
      { title: 'Live', embed: { src: 'https://app.example.com/dashboards/revenue', title: 'Revenue dashboard', aspectRatio: 1.6, preview: 'asset:shot' }, caption: 'Revenue, last quarter' },
      { title: 'Block', blocks: [{ text: 'The checkout flow.' }, { embed: 'https://prototype.example.com/checkout', caption: 'Prototype' }] },
      { title: 'Typed', type: 'embed', embed: 'https://x.example.com/a' },
    ],
  };
  assert.deepEqual(errors(deck), []);
  assert.equal(validate(deck).valid, true);
});

test('an address that is not https, or no address, is a schema error at the embed', () => {
  for (const embed of ['http://app.example.com/x', 'javascript:alert(1)', 'data:text/html,hi', './page.html', '//app.example.com/x', 'https://', 'https:// space.example.com']) {
    const found = errors({ slides: [{ title: 'D', embed }] });
    assert.ok(found.some((finding) => finding.ruleId === 'opf/schema' && finding.path.startsWith('/slides/0/embed')), JSON.stringify(embed));
  }
  const missing = errors({ slides: [{ title: 'D', embed: { title: 'Revenue dashboard' } }] });
  assert.ok(missing.some((finding) => finding.path === '/slides/0/embed' && /src/.test(finding.message)));
  assert.ok(errors({ slides: [{ title: 'D', embed: { src: `https://example.com/${'a'.repeat(2048)}` } }] }).length > 0, 'an address over 2048 characters');
  assert.ok(errors({ slides: [{ title: 'D', embed: { src: 'https://example.com/', aspectRatio: 0 } }] }).length > 0);
  assert.ok(errors({ slides: [{ title: 'D', embed: { src: 'https://example.com/', aspectRatio: 11 } }] }).length > 0);
  assert.ok(errors({ slides: [{ title: 'D', embed: { src: 'https://example.com/', sandbox: 'allow-scripts' } }] }).length > 0, 'the deck holds no sandbox policy');
  assert.ok(errors({ slides: [{ title: 'D', embed: { src: 'https://example.com/', title: '' } }] }).length > 0);
});

test('a block takes no image option; the frame is set inside the embed', () => {
  const found = errors({ slides: [{ title: 'D', blocks: [{ embed: 'https://a.example.com', aspectRatio: 1.2, fit: 'cover' }] }] });
  assert.deepEqual(found.map((finding) => [finding.ruleId, finding.path]).sort(), [['opf/image-option-unsupported-payload', '/slides/0/blocks/0/aspectRatio'], ['opf/image-option-unsupported-payload', '/slides/0/blocks/0/fit']]);
});

test('an embed and another payload on one block are incompatible, an embed in a group is refused', () => {
  assert.ok(errors({ slides: [{ title: 'D', blocks: [{ embed: 'https://a.example.com', chart: { type: 'column', data: { columns: ['A', 'B'], rows: [['x', 1]] } } }] }] }).length > 0);
  assert.ok(errors({ slides: [{ title: 'D', blocks: [{ type: 'group', embed: 'https://a.example.com', blocks: [{ text: 'a' }] }] }] }).length > 0);
  assert.ok(errors({ slides: [{ title: 'D', blocks: [{ type: 'embed' }] }] }).length > 0, 'type embed requires an embed');
});

test('opf/embed-credentials warns for a user name, a password or a secret query parameter, and names where', () => {
  const deck = { slides: [
    { title: 'a', embed: 'https://app.example.com/d/revenue?api_key=abc123' },
    { title: 'b', embed: { src: 'https://user:pass@app.example.com/' } },
    { title: 'c', blocks: [{ embed: 'https://app.example.com/?X-Amz-Signature=1' }] },
    { title: 'd', embed: 'https://app.example.com/?page=2&monkey=1&design=2' },
  ] };
  const found = findings(deck, 'embed-credentials');
  assert.deepEqual(found.map((finding) => finding.path), ['/slides/0/embed', '/slides/1/embed/src', '/slides/2/blocks/0/embed']);
  assert.ok(found.every((finding) => finding.severity === 'warning'));
  assert.equal(found[0].message, 'This embed\'s address carries what looks like a credential (a query parameter named "api_key"). Anyone with the deck can read it.');
  assert.match(found[1].message, /a user and password/);
  assert.equal(validate(deck).valid, true, 'a warning never makes a deck invalid');
});

test('the shared credential test reads names by word', () => {
  for (const name of ['key', 'token', 'secret', 'password', 'sig', 'signature', 'auth', 'api_key', 'apiKey', 'access-token', 'X-Amz-Signature', 'authorization', 'client_secret', 'accesstoken', 'TOKEN']) assert.equal(credentialInSrc(`https://app.example.com/?${name}=1`), `a query parameter named "${name}"`, name);
  for (const name of ['page', 'monkey', 'design', 'author_name', 'keyboard', 'sign', 'q', 'theme', 'hotkey_id']) assert.equal(credentialInSrc(`https://app.example.com/?${name}=1`), undefined, name);
  assert.equal(credentialInSrc('https://app.example.com/?page=1'), undefined);
  assert.equal(credentialInSrc('https://u@app.example.com/'), undefined, 'a user name alone is not a secret, as for a data source');
  assert.equal(credentialInSrc('not a url'), undefined);
  assert.equal(credentialInSrc(undefined), undefined);
});

test('a preview that names an asset the deck lacks is the existing missing-asset error', () => {
  const found = findings({ slides: [{ title: 'D', embed: { src: 'https://a.example.com/', preview: 'asset:nope' } }] }, 'asset-reference');
  assert.deepEqual(found.map((finding) => [finding.severity, finding.path]), [['error', '/slides/0/embed/preview']]);
  assert.deepEqual(findings({ assets: { nope: png }, slides: [{ title: 'D', embed: { src: 'https://a.example.com/', preview: 'asset:nope' } }] }, 'asset-reference'), []);
});

test('readings: object form, site name, title and aspect ratio', () => {
  assert.deepEqual(embedValue('https://www.example.com/a'), { src: 'https://www.example.com/a' });
  assert.equal(embedValue({ title: 'x' }), undefined);
  assert.equal(embedSite('https://www.app.example.com/path?q=1'), 'app.example.com');
  assert.equal(embedTitle('https://www.app.example.com/path'), 'app.example.com');
  assert.equal(embedTitle({ src: 'https://a.example.com/', title: 'Dashboard' }), 'Dashboard');
  assert.equal(embedAspect('https://a.example.com/'), EMBED_DEFAULT_ASPECT);
  assert.equal(embedAspect({ src: 'https://a.example.com/', aspectRatio: 1.6 }), 1.6);
});

test('composition: the frame is the largest box of its aspect ratio in the region; the caption sits below', () => {
  const item = (slide) => composeSlide(slide, canvas).items.find((entry) => entry.field === 'embed');
  const wide = item({ title: 'T', embed: 'https://a.example.com/' });
  assert.equal(wide.type, 'embed');
  assert.ok(Math.abs(wide.box.width / wide.box.height - 16 / 9) < 0.01, `16:9, got ${wide.box.width / wide.box.height}`);
  const tall = item({ title: 'T', embed: { src: 'https://a.example.com/', aspectRatio: 0.5 } });
  assert.ok(Math.abs(tall.box.width / tall.box.height - 0.5) < 0.01);
  const captioned = item({ title: 'T', embed: 'https://a.example.com/', caption: 'Caption' });
  assert.ok(captioned.caption && captioned.caption.box.y >= captioned.box.y + captioned.box.height - 1, 'the caption is below the frame');
  const extreme = item({ title: 'T', embed: { src: 'https://a.example.com/', aspectRatio: 10 } });
  assert.ok(extreme.box.width > 0 && extreme.box.height > 0 && Math.abs(extreme.box.width / extreme.box.height - 10) < 0.05);
});

test('a layout region that accepts video accepts an embed; one that accepts neither does not', () => {
  const block = { embed: 'https://a.example.com/' };
  assert.equal(regionAccepts({ accepts: ['video'] }, block), true);
  assert.equal(regionAccepts({ accepts: ['embed'] }, block), true);
  assert.equal(regionAccepts({ accepts: ['text', 'list'] }, block), false);
  assert.equal(regionAccepts({ accepts: ['image', 'diagram'] }, block), false);
  // No default layout lists 'embed': the media region of image-beside takes it because it takes video.
  const result = composeSlide({ title: 'T', blocks: [{ text: 'Words beside the page.' }, block] }, { layout: layouts['image-beside'] });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.items.find((item) => item.field === 'embed').region, 'media');
});

test('the card: badge, title and site name at any size, never under the floor, and only the badge below it', () => {
  const base = { title: 'Revenue dashboard', site: 'app.example.com', headingFamily: 'Roboto', bodyFamily: 'Roboto', scale: 1 };
  const big = embedCardLayout({ ...base, frame: { x: 100, y: 100, width: 800, height: 450 } });
  assert.ok(big.title && big.site, 'a large frame draws the title and the site name');
  assert.equal(big.title.clipped, false);
  assert.ok(big.title.fontSize >= 16 && big.site.fontSize >= 16);
  assert.equal(big.icon.points.length, 7);
  const small = embedCardLayout({ ...base, frame: { x: 0, y: 0, width: 360, height: 100 } });
  assert.ok(small.title, 'a small frame keeps the title');
  assert.equal(small.site, undefined, 'and drops the site name before it clips the title');
  assert.ok(small.title.fontSize >= 16);
  const tiny = embedCardLayout({ ...base, frame: { x: 0, y: 0, width: 80, height: 50 } });
  assert.equal(tiny.title, undefined);
  assert.equal(tiny.site, undefined);
  assert.ok(tiny.icon.badge.width > 0);
  const long = embedCardLayout({ ...base, title: 'A very long title that goes on and on about quarterly figures, regional splits, forecasts and the plan for the next three years of the company', frame: { x: 0, y: 0, width: 420, height: 260 } });
  assert.ok(long.title.lines.length <= 3 && long.title.fontSize >= 16);
  assert.equal(long.title.clipped, true);
  assert.match(long.title.lines.at(-1), /…$/);
  const same = embedCardLayout({ ...base, title: 'app.example.com', frame: { x: 0, y: 0, width: 800, height: 450 } });
  assert.equal(same.site, undefined, 'the site name is not drawn twice');
});

test('the card is centered in every form and its title grows with the card', () => {
  const base = { title: 'Revenue dashboard', site: 'app.example.com', headingFamily: 'Roboto', bodyFamily: 'Roboto', scale: 1 };
  const near = (a, b, message) => assert.ok(Math.abs(a - b) <= 0.5, `${message}: ${a} against ${b}`);
  const bounds = (card) => {
    const boxes = [card.icon.badge, card.title?.box, card.site?.box].filter(Boolean);
    return { top: Math.min(...boxes.map((box) => box.y)), bottom: Math.max(...boxes.map((box) => box.y + box.height)) };
  };
  for (const [name, frame] of [['a full slide', { x: 182, y: 147, width: 915, height: 515 }], ['beside text', { x: 700, y: 200, width: 570, height: 321 }], ['small, with a title', { x: 40, y: 30, width: 360, height: 100 }], ['small, the badge only', { x: 10, y: 20, width: 80, height: 50 }]]) {
    const card = embedCardLayout({ ...base, frame });
    near(card.icon.badge.x + card.icon.badge.width / 2, frame.x + frame.width / 2, `${name}: the badge is centered across`);
    const { top, bottom } = bounds(card);
    near((top + bottom) / 2, frame.y + frame.height / 2, `${name}: the block is centered down`);
    for (const part of [card.title, card.site].filter(Boolean)) {
      assert.equal(part.align, 'center');
      near(part.box.x + part.box.width / 2, frame.x + frame.width / 2, `${name}: the text is centered across`);
      assert.equal(part.lineWidths.length, part.lines.length);
      assert.ok(part.lineWidths.every((width) => width <= part.box.width + 1e-6));
    }
  }
  // The title's size: a tenth of the shorter side, between today's 28 and a ceiling of 40; the badge and the site name grow with it.
  const sizes = [[915, 515], [570, 321], [360, 100]].map(([width, height]) => embedCardLayout({ ...base, frame: { x: 0, y: 0, width, height } }));
  assert.equal(sizes[0].title.fontSize, 40, 'a full-slide card is at the ceiling');
  assert.ok(Math.abs(sizes[1].title.fontSize - 32.1) < 0.2, 'a card beside text is a tenth of its shorter side');
  assert.ok(sizes[2].title.fontSize <= 28 && sizes[2].title.fontSize >= 16, 'a small card is at the old size or below, never under the floor');
  assert.ok(sizes[0].icon.badge.width > sizes[1].icon.badge.width && sizes[1].icon.badge.width > sizes[2].icon.badge.width, 'the badge grows with the title');
  assert.ok(sizes[0].site.fontSize > sizes[1].site.fontSize && sizes[1].site.fontSize > 18 - 1e-9);
  // Scale multiplies the sizes, and the three-line limit holds at the larger size.
  const doubled = embedCardLayout({ ...base, scale: 2, frame: { x: 0, y: 0, width: 1830, height: 1030 } });
  assert.equal(doubled.title.fontSize, 80);
  const long = embedCardLayout({ ...base, title: 'A very long title that goes on and on about quarterly figures, regional splits, forecasts and the plan for the next three years of the company', frame: { x: 0, y: 0, width: 915, height: 515 } });
  assert.ok(long.title.lines.length <= 3);
  const longSmall = embedCardLayout({ ...base, title: 'A very long title that goes on and on about quarterly figures, regional splits, forecasts and the plan for the next three years of the company', frame: { x: 0, y: 0, width: 420, height: 260 } });
  assert.equal(longSmall.title.clipped, true);
  assert.match(longSmall.title.lines.at(-1), /…$/);
  // The two small forms keep their thresholds.
  assert.ok(embedCardLayout({ ...base, frame: { x: 0, y: 0, width: 360, height: 100 } }).title);
  assert.equal(embedCardLayout({ ...base, frame: { x: 0, y: 0, width: 360, height: 100 } }).site, undefined);
  assert.equal(embedCardLayout({ ...base, frame: { x: 0, y: 0, width: 80, height: 50 } }).title, undefined);
});

test('Markdown and YAML round trips keep the shorthand, the full form and a slide embed with a caption', () => {
  const deck = {
    name: 'Embed', assets: { shot: png },
    slides: [
      { title: 'Full', embed: { src: 'https://app.example.com/dashboards/revenue', title: 'Revenue dashboard', aspectRatio: 1.6, preview: 'asset:shot' } },
      { title: 'Block', blocks: [{ text: 'The checkout flow.' }, { embed: 'https://prototype.example.com/checkout', caption: 'Prototype' }] },
      { title: 'Caption', embed: 'https://x.example.com/', caption: 'A slide caption' },
    ],
  };
  const markdown = fromMarkdown(toMarkdown(deck).markdown);
  assert.deepEqual(markdown.presentation.slides, deck.slides);
  assert.deepEqual(fromYaml(toYaml(deck).yaml).presentation.slides, deck.slides);
});

test('video and embed convert to each other keeping the address and the title, only for https', () => {
  const toEmbed = convertContent({ video: { src: 'https://cdn.example.com/demo.mp4', title: 'Demo', alt: 'A demo' } }, 'embed');
  assert.deepEqual(toEmbed.payload, { embed: { src: 'https://cdn.example.com/demo.mp4', title: 'Demo' } });
  assert.deepEqual(toEmbed.loss, ['video alt']);
  assert.deepEqual(convertContent({ video: 'https://cdn.example.com/demo.mp4' }, 'embed').payload, { embed: 'https://cdn.example.com/demo.mp4' });
  assert.throws(() => convertContent({ video: 'asset:demo' }, 'embed'), /https/);
  assert.throws(() => convertContent({ video: 'http://cdn.example.com/demo.mp4' }, 'embed'), /https/);
  const toVideo = convertContent({ embed: { src: 'https://a.example.com/', title: 'Page', aspectRatio: 1.6, preview: 'asset:shot' } }, 'video');
  assert.deepEqual(toVideo.payload, { video: { src: 'https://a.example.com/', title: 'Page' } });
  assert.deepEqual(toVideo.loss, ['embed aspectRatio, preview']);
  assert.deepEqual(contentConversionTargets({ image: 'https://a.example.com/a.png' }).map((target) => target.kind), [], 'an image does not convert to an embed');
  assert.deepEqual(contentConversionTargets({ embed: 'https://a.example.com/' }).map((target) => target.kind), ['video']);
});

test('stats count embeds', () => {
  const result = stats({ slides: [{ title: 'a', embed: 'https://a.example.com/' }, { title: 'b', blocks: [{ embed: { src: 'https://b.example.com/', preview: 'asset:shot' } }] }], assets: { shot: png } });
  assert.equal(result.payloads.embed, 2);

});
